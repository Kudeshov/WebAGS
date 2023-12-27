const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();
const port = 3001;
const fs = require('fs');
const path = require('path');

const NSPCHANNELS = 238;
const SPECDEFTIME = 1;
const winLow = 20;
const winHigh = 200;

const flightsDirectory = './flights'; // Укажите путь к папке с файлами

// Коэффициенты полинома и калибровочные данные

const coeffs_below_550 = [3.88e-23, -6.70e-20, 4.28e-17, -8.48e-15, 5.97e-13];
const coeffs_above_550 = [-2.08e-27, 8.32e-23, -1.03e-18, 4.67e-15, -9.95e-13];

app.use(cors());


function calculateConversionFactor(E) {
  if (E <= 550) {
    return coeffs_below_550[0] * E**4 + coeffs_below_550[1] * E**3 +
           coeffs_below_550[2] * E**2 + coeffs_below_550[3] * E + coeffs_below_550[4];
  } else {
    return coeffs_above_550[0] * E**4 + coeffs_above_550[1] * E**3 +
           coeffs_above_550[2] * E**2 + coeffs_above_550[3] * E + coeffs_above_550[4];
  }
}

function calculateConversionFactors(eP0, eP1) {
  return Array.from({ length: NSPCHANNELS }, (_, i) => eP0 + eP1 * i)
              .map(E => calculateConversionFactor(E));
}

class Spectrum {
  constructor(channels, liveTime) {
    this.channels = channels;
    this.liveTime = liveTime;
  }

  valueInChannels(start, end, normalized = false) {
    //console.log(start,end);
    let result = 0;

    if (start < 0) start = 0;
    if (end >= this.channels.length) end = this.channels.length - 1;

    for (let i = start; i <= end; i++) {
      result += this.channels[i];
    }

    if (normalized) {
      result /= this.liveTime;
    }

    return result;
  }

  channelsNormalized() {
    return this.channels.map(value => value / this.liveTime);
  }

  calculateTotalDose(eP0, eP1, conversionFactors) {
    // Используем метод reduce для суммирования произведений значений каналов и коэффициентов
    const totalDose = this.channels.reduce((sum, channel, index) => sum + channel * conversionFactors[index], 0);
    // Перевод из Зв/с в мкЗв/ч
    return totalDose * 1e6 * 3600;
  }

}

const WGS84A = 6378137.0000;
const WGS84B = 6356752.31424517929;

const a = WGS84A;
const b = WGS84B;
const a2 = a * a;
const b2 = b * b;
const e = Math.sqrt((a2 - b2) / a2);
const e1 = Math.sqrt((a2 - b2) / b2);

function toLLA(x, y, z) {
  if (Math.abs(x) < 100 || Math.abs(y) < 100) {
    return { lat: -1, lon: -1 };
  }

  const lx = x / 100.0;
  const ly = y / 100.0;
  const lz = z / 100.0;

  const p = Math.sqrt((lx * lx) + (ly * ly));
  const q = Math.atan2((lz * a), (p * b));

  const sinQ = Math.sin(q);
  const cosQ = Math.cos(q);

  const lon = Math.atan2(ly, lx);
  const lat = Math.atan2(
    (lz + e1 * e1 * b * sinQ * sinQ * sinQ),
    (p - e * e * a * cosQ * cosQ * cosQ)
  );

  const sinLat = Math.sin(lat);
  const N = a / Math.sqrt(1 - e * e * sinLat * sinLat);
  const alt = (p / Math.cos(lat)) - N;

  return {
    lat: (lat * 180.0 / Math.PI),
    lon: (lon * 180.0 / Math.PI),
    alt: alt
  };
}

function getDose(value, height, gm = false, gmNum = 1, gm1Coeff, gm2Coeff, winCoeff) {
  let result = 0;
  
  if (gm) {
    result = value * (gmNum === 1 ? gm1Coeff : gm2Coeff);
  } else {
    result = value * winCoeff;
  }

  if (height > 1) {
    const Kh = 0.988 - 0.1768 * Math.log(Math.abs(height));
    if (Kh && result > 0.15) {
      result = (result - 0.15) / Kh + 0.15; // перевод в мкЗв/час
    }
  }
  //console.log(value, result);
  // Предполагаем, что результат уже в мкЗв/час
  return result;
}


app.get('/api/data/:dbname/:collectionId', (req, res) => {
  const dbname = req.params.dbname;
  const collectionId = req.params.collectionId;
  console.log(dbname, ' ', collectionId);

  if (!dbname || dbname === 'null' || !collectionId || collectionId === 'null') {
    res.status(400).send('Invalid database name or collection ID');
    return;
  }

  const db_current = new sqlite3.Database(`${flightsDirectory}/${dbname}.sqlite`, (err) => {
    if (err) {
      console.error(err.message);
      return;
    }
    console.log(`Connected to the database ${dbname}`);
  });

  // Получение коэффициентов из таблицы arms_settings
  db_current.get("SELECT gm1Coeff, gm2Coeff, winCoeff FROM arms_settings LIMIT 1", [], (err, settings) => {
    if (err) {
      console.error(err.message);
      res.status(500).send('Error querying the arms_settings');
      return;
    }

    if (!settings) {
      res.status(404).send('Settings not found');
      return;
    }

    console.log(settings);

    const { gm1Coeff, gm2Coeff, winCoeff } = settings;

    // Запрос для получения калибровочных коэффициентов
    const sqlCalibration = `SELECT P0, P1 FROM collection WHERE _id = ?`;
    db_current.get(sqlCalibration, [collectionId], (err, calibration) => {
      if (err) {
        console.error(err.message);
        res.status(500).send('Error querying the calibration data');
        return;
      }

      if (!calibration) {
        res.status(404).send('Calibration data not found');
        return;
      }

      const eP0 = calibration.P0;
      const eP1 = calibration.P1;
      let doseRateConversionFactors = calculateConversionFactors(eP0, eP1);

      const B = parseInt(collectionId, 10) + 0xFFFF;
      const sql = `SELECT * FROM measurement WHERE (_id >= ${collectionId}) AND (_id <= ${B})`;

      db_current.all(sql, [], (err, rows) => {
        if (err) {
          console.error(err.message);
          return;
        }

        const results = rows.map(row => {
          let coords = toLLA(row.gpsX, row.gpsY, row.gpsZ);

          if(row.spectrum === undefined) {
            console.error("spectrum is undefined for row: ", row);
            return null;
          }

          const buffer = Buffer.from(row.spectrum, 'binary');
          const spectrumData = [];
          for (let i = 0; i < NSPCHANNELS; i++) {
            spectrumData.push(buffer.readUInt16LE(i * 2));
          }

          const spectrum = new Spectrum(spectrumData, SPECDEFTIME);
          const countInWindow = spectrum.valueInChannels(winLow, winHigh, false);
          const windose = getDose(countInWindow, row.rHeight, false, 1, gm1Coeff, gm2Coeff, 0.0073);

          return {
            id: row._id,
            datetime: row.dateTime,
            lat: coords.lat,
            lon: coords.lon,
            alt: coords.alt,
            height: row.rHeight,
            countw: countInWindow,
            dosew: windose,
            dose: spectrum.calculateTotalDose(eP0, eP1, doseRateConversionFactors),
            geiger1: row.geiger1,
            geiger2: row.geiger2
          };
        }).filter(item => item !== null);

        res.json(results);
      });
    });
  });
});
/* 
app.get('/api/data/:dbname/:collectionId', (req, res) => {
  const dbname = req.params.dbname;
  const collectionId = req.params.collectionId;
  console.log(dbname, ' ', collectionId);
  if (!dbname || dbname === 'null' || !collectionId || collectionId === 'null') {
    res.status(400).send('Invalid database name or collection ID');
    return;
  }

  const db_current = new sqlite3.Database(`${flightsDirectory}/${dbname}.sqlite`, (err) => {
    if (err) {
      console.error(err.message);
      return;
    }
    console.log(`Connected to the database ${dbname}`);
  });

  // Запрос для получения калибровочных коэффициентов
  const sqlCalibration = `SELECT P0, P1 FROM collection WHERE _id = ?`;
  db_current.get(sqlCalibration, [collectionId], (err, calibration) => {
    if (err) {
      console.error(err.message);
      res.status(500).send('Error querying the calibration data');
      return;
    }

    if (!calibration) {
      res.status(404).send('Calibration data not found');
      return;
    }
    console.log(calibration);
    const eP0 = calibration.P0;
    const eP1 = calibration.P1;
    let doseRateConversionFactors = calculateConversionFactors(eP0, eP1);
  
    // Верхняя граница id для фильтрации
    const B = parseInt(collectionId, 10) + 0xFFFF;
    const sql = `SELECT * FROM measurement WHERE (_id >= ${collectionId}) AND (_id <= ${B})`;
   // let doseRateConversionFactors = calculateConversionFactors(eP0, eP1);
    console.time('ProcessingTime');
    db_current.all(sql, [], (err, rows) => {
      if (err) {
        throw err;
      }
      console.log('Number of rows received:', rows.length);
      const results = rows.map(row => {
        let coords = { lat: 0, lon: 0, alt: 0 }; // Если вам нужен объект
        if ((row.gpsX !==0) && (row.gpsY !==0))
          coords = toLLA(row.gpsX, row.gpsY, row.gpsZ); 
      
        if(row.spectrum === undefined) {
          console.error("spectrum is undefined for row: ", row);
          return null;
        }
        const buffer = Buffer.from(row.spectrum, 'binary');
        const spectrumData = [];
        for (let i = 0; i < NSPCHANNELS; i++) {
          spectrumData.push(buffer.readUInt16LE(i * 2));
        }
        const spectrum = new Spectrum(spectrumData, SPECDEFTIME);
        const countInWindow = spectrum.valueInChannels(winLow, winHigh, true);
        const windose = getDose(countInWindow, coords.alt);
        return {
          id: row._id,
          datetime: row.dateTime,
          lat: coords.lat,
          lon: coords.lon,
          alt: coords.alt,
          countw: countInWindow,
          dosew: windose,
          dose: spectrum.calculateTotalDose(eP0, eP1, doseRateConversionFactors),
          geiger1: row.geiger1,
          geiger2: row.geiger2
        };
      }).filter(item => item !== null);
      console.timeEnd('ProcessingTime');
      res.json(results);
    });
  });
}); */

app.get('/api/collection/:dbname', (req, res) => {
  const dbname = req.params.dbname;

  console.log('БД ', dbname);

  if (!dbname) 
    return;

  if (dbname=='null') 
    return;

  const db_current = new sqlite3.Database(flightsDirectory+'/'+dbname+'.sqlite', (err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Connected to the database '+dbname);
  });

  const sql = 'SELECT * FROM collection';
  db_current.all(sql, [], (err, rows) => {
    if (err) {
      throw err;
    }
    const results = rows;
    res.json(results);
  });
});

app.get('/api/spectrum/:dbname/:id', (req, res) => {
  const dbname = req.params.dbname;
 
  console.log('БД /api/spectrum/:dbname/:id', dbname);

  if (!dbname) 
    return;
  if (dbname=='null') 
    return;
  const id = req.params.id;

  console.log('id = ', id);

  const db = new sqlite3.Database(flightsDirectory+'/'+dbname+'.sqlite', (err) => {
    if (err) {
      console.error(err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    console.log('Connected to the database '+dbname);
  });

  const sql = 'SELECT * FROM measurement WHERE _id = ?';
  db.get(sql, [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!row) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const coords = toLLA(row.gpsX, row.gpsY, row.gpsZ);

    console.log('coords '+coords);
    
    if(row.spectrum === undefined) {
      console.error("spectrum is undefined for row: ", row);
      res.status(500).json({ error: 'Spectrum is undefined' });
      return;
    }
    
    const buffer = Buffer.from(row.spectrum, 'binary');
    const spectrumData = [];
    for (let i = 0; i < NSPCHANNELS; i++) {
      spectrumData.push(buffer.readUInt16LE(i * 2));
    }
    
    const spectrum = new Spectrum(spectrumData, SPECDEFTIME);
    const response = {
      id: row._id,
      datetime: row.dateTime,
      lat: coords.lat,
      lon: coords.lon,
      alt: coords.alt,
      spectrum: spectrum.channelsNormalized()
    };
    
    res.json(response);
  });
});

app.get('/api/flights', (req, res) => {
  fs.readdir(flightsDirectory, (err, files) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const sqliteFiles = files
      .filter(file => path.extname(file) === '.sqlite')
      .map(file => path.basename(file, '.sqlite'));

    res.json(sqliteFiles);
  });
});

app.get('/api/data/:dbname', (req, res) => {
  const dbname = req.params.dbname;

  console.log('БД ', dbname);

  if (!dbname) 
    return;

  if (dbname=='null') 
    return;

  const db_current = new sqlite3.Database(flightsDirectory+'/'+dbname+'.sqlite', (err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Connected to the database '+dbname);
  });

  const sql = 'SELECT * FROM measurement limit 250000';
  db_current.all(sql, [], (err, rows) => {
    if (err) {
      throw err;
    }

    const results = rows.map(row => {
      let coords = { lat: 0, lon: 0, alt: 0 }; // Если вам нужен объект
      if ((row.gpsX !==0) && (row.gpsY !==0))
        coords = toLLA(row.gpsX, row.gpsY, row.gpsZ);
    
      if(row.spectrum === undefined) {
        console.error("spectrum is undefined for row: ", row);
        return null;
      }
    
      const buffer = Buffer.from(row.spectrum, 'binary');
      const spectrumData = [];
      for (let i = 0; i < NSPCHANNELS; i++) {
        spectrumData.push(buffer.readUInt16LE(i * 2));
      }
      const spectrum = new Spectrum(spectrumData, SPECDEFTIME);
      return {
        id: row._id,
        datetime: row.dateTime,
        lat: coords.lat,
        lat: coords.lat,
        lon: coords.lon,
        alt: coords.alt,
        spectrumValue: spectrum.valueInChannels(winLow, winHigh, true)
      };
    }).filter(item => item !== null);
    res.json(results);
  });
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
}); 