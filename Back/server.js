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
const winHigh = 70;

const flightsDirectory = './flights'; // Укажите путь к папке с файлами

app.use(cors());

/* const db = new sqlite3.Database('./graveyard.sqlite', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the database.');
}); */

class Spectrum {
  constructor(channels, liveTime) {
    this.channels = channels;
    this.liveTime = liveTime;
  }

  valueInChannels(start, end, normalized = false) {
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
}


function toLLA(x, y, z) {
  if (Math.abs(x) < 100 || Math.abs(y) < 100) {
    return { lat: -1, lon: -1 };
  }

  const WGS84A = 6378137.0000;
  const WGS84B = 6356752.31424517929;

  const lx = x / 100.0;
  const ly = y / 100.0;
  const lz = z / 100.0;

  const a = WGS84A;
  const b = WGS84B;

  const e = Math.sqrt(((a * a) - (b * b)) / (a * a));
  const e1 = Math.sqrt(((a * a) - (b * b)) / (b * b));

  const p = Math.sqrt((lx * lx) + (ly * ly));
  const q = Math.atan2((lz * a), (p * b));

  const lon = Math.atan2(ly, lx);
  const lat = Math.atan2(
    (lz + (e1 * e1) * b * Math.pow(Math.sin(q), 3)),
    (p - (e * e) * a * Math.pow(Math.cos(q), 3))
  );

  const N = a / Math.sqrt(1 - ((e * e) * Math.pow(Math.sin(lat), 2)));
  const alt = (p / Math.cos(lat)) - N;

  return {
    lat: (lat * 180.0 / Math.PI),
    lon: (lon * 180.0 / Math.PI),
    alt: alt
  };
}

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

/* app.get('/api/data', (req, res) => {
  const sql = 'SELECT * FROM measurement limit 250000';
  db.all(sql, [], (err, rows) => {
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
 */
app.get('/api/data/:dbname/:collectionId', (req, res) => {
  const dbname = req.params.dbname;
  const collectionId = req.params.collectionId;

  console.log(dbname, ' ', collectionId);
  if (!dbname || dbname === 'null') return;

  const db_current = new sqlite3.Database(`${flightsDirectory}/${dbname}.sqlite`, (err) => {
    if (err) {
      console.error(err.message);
      return;
    }
    console.log(`Connected to the database ${dbname}`);
  });

  // Верхняя граница id для фильтрации
  const B = parseInt(collectionId, 10) + 0xFFFF;

  const sql = `SELECT * FROM measurement WHERE (_id >= ${collectionId}) AND (_id <= ${B})`;

  console.log( 'sql=', sql);
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

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
}); 