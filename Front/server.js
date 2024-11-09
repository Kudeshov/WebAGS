const express = require('express');
const multer = require('multer');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();
const fs = require('fs');
const path = require('path');
/* const configPath = path.join(__dirname, 'config.json');
const isotopePath = path.join(__dirname, 'isotope_peaks_data.json'); */

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

let userDataPath;
try {
  const { app: electronApp } = require('electron');
  userDataPath = electronApp.getPath('userData');
} catch (error) {
  // Если Electron недоступен (например, при запуске через Node), используем стандартный путь
  userDataPath = path.join(__dirname, 'user_data');
}

const configPath = path.join(userDataPath, 'config.json');
const isotopePath = path.join(userDataPath, 'isotope_peaks_data.json');
const flightsPath = path.join(userDataPath, 'Flights');

// Пути к исходным файлам в сборке
const initialConfigPath = path.join(__dirname, 'config.json');
const initialIsotopePath = path.join(__dirname, 'isotope_peaks_data.json');
const templateDbPath = path.join(__dirname, 'flights', 'template.udkgdb');
const exampleDbPath = path.join(__dirname, 'flights', 'Могильник.sqlite');



app.use(express.json());

app.get('/api/isotope_peaks_data', (req, res) => {
  fs.readFile(isotopePath, 'utf8', (err, data) => {
    if (err) {
      res.status(500).send('Ошибка чтения файла изотопов');
      return;
    }
    res.json(JSON.parse(data));
  });
});

// Получение всех настроек
app.get('/api/settings', (req, res) => {
  fs.readFile(configPath, 'utf8', (err, data) => {
    if (err) {
      res.status(500).send('Ошибка чтения файла настроек');
      return;
    }
    res.json(JSON.parse(data));
  });
});

// Обновление настроек
app.post('/api/settings', (req, res) => {
  const newSettings = req.body;
  fs.writeFile(configPath, JSON.stringify(newSettings, null, 2), 'utf8', (err) => {
    if (err) {
      res.status(500).send('Ошибка записи файла настроек');
      return;
    }
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    res.send('Настройки успешно обновлены');
  });
});

/* app.use(cors()); */

app.use(cors({
  origin: 'http://localhost:3010', // Укажите нужный origin
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
const flightSimulations = {};

// Добавляем объект для хранения текущего состояния онлайн-полета
let onlineFlightStatus = {
  _id: null,
  dateTime: null,
  detector: null,
  hasCalibr: null,
  P0: null,
  P1: null,
  P2: null,
  P3: null,
  description: null,
  winLow: null,
  winHigh: null,
  active: false,
  dbName: null,
  is_online: false,
  is_real: false
};

/* // Запуск HTTP сервера
const server = app.listen(port, () => {
  console.log(`HTTP server listening at http://localhost:${port}`);
});*/

// Настройка WebSocket сервера
const wss = new WebSocket.Server({ noServer: true });
/*
server.on('upgrade', (request, socket, head) => {
  console.log('Получен запрос на установление WebSocket соединения');

  wss.handleUpgrade(request, socket, head, (ws) => {
  wss.emit('connection', ws, request);
  console.log('WebSocket соединение успешно установлено');
  });
}); */

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
  console.log('Received message:', message);
});

ws.on('error', (error) => {
  console.error('Ошибка WebSocket:', error);
});

//ws.send(JSON.stringify({ message: 'Connection established' }));
});


function calculateConversionFactor(E) {
  if (E <= 550) {
    return config.coeffs_below_550[0] * E**4 + config.coeffs_below_550[1] * E**3 +
           config.coeffs_below_550[2] * E**2 + config.coeffs_below_550[3] * E + config.coeffs_below_550[4];
  } else {
    return config.coeffs_above_550[0] * E**4 + config.coeffs_above_550[1] * E**3 +
           config.coeffs_above_550[2] * E**2 + config.coeffs_above_550[3] * E + config.coeffs_above_550[4];
  }
}

function calculateConversionFactors(eP0, eP1) {
  return Array.from({ length: config.NSPCHANNELS }, (_, i) => eP0 + eP1 * i)
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

const ONLINE_FLIGHT_ID_THRESHOLD = 1000000; // Определенное значение для различия между офлайн и онлайн полетами


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

  console.log('getDose(value, height)', value, height, gm );
  
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
  // Предполагаем, что результат уже в мкЗв/час
  return result;
}

function getDoseNew(spectrum, height, Dgeiger1, Dgeiger2, DGThresholdLow, DGThresholdHigh, gm1Coeff, gm2Coeff, eP0, eP1, doseRateConversionFactors) {
  let dose = 0;

  if (Dgeiger2 >= DGThresholdHigh) {
    // Используем грубый датчик
    dose = Dgeiger2 * gm2Coeff;
  } else if (Dgeiger1 >= DGThresholdLow) {
    // Используем чувствительный датчик
    dose = Dgeiger1 * gm1Coeff;
  } else {
    // Расчет по полиному на основе спектра
    dose = spectrum.calculateTotalDose(eP0, eP1, doseRateConversionFactors);
  }
  

  // Доза на высоте 1 метр
  let dose1m = dose;

  // Коррекция на высоту применяется к dose1m
  if (height > 1) {
    const Kh = 0.988 - 0.1768 * Math.log(Math.abs(height));
    if (Kh && dose1m > 0.15) {
      dose1m = (dose1m - 0.15) / Kh + 0.15; // перевод в мкЗв/час
    }
  }

  // Возвращаем два значения: дозу в точке измерения и дозу на высоте 1 м
  return {
    dose: dose,
    dose1m: dose1m
  };
}

const upload = multer({
  dest: 'uploads/' // временная папка для сохранения файлов
});

// Проверяем, существует ли папка для загрузки файлов. Если нет, создаем ее.
if (!fs.existsSync(flightsPath)){
  fs.mkdirSync(flightsPath, { recursive: true });
}

app.post('/api/uploadDatabase', upload.single('databaseFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('Файл не загружен.');
  }

  const tempPath = req.file.path;
  const name_dec = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  const targetPath = path.join(flightsPath, name_dec);

  // Проверяем, существует ли уже такой файл
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(tempPath); // Удаляем временный файл
    return res.status(400).send('Файл с таким именем уже существует.');
  }

  // Перемещаем файл из временной папки в целевую
  fs.rename(tempPath, targetPath, err => {
    if (err) {
      return res.status(500).send('Ошибка при сохранении файла.');
    }
    res.send('Файл успешно загружен.');
  });
});

app.get('/api/downloadDatabase/:dbname', (req, res) => {
  const dbname = req.params.dbname;
  //const filePath = path.join(flightsPath, `${dbname}.sqlite`);
  const filePath = path.join(flightsPath, `${dbname}.sqlite`);
  
  // Проверяем, существует ли файл
  if (fs.existsSync(filePath)) {
    res.download(filePath); // Set disposition and send it.
  } else {
    res.status(404).send('Файл не найден');
  }
});

app.delete('/api/deleteDatabase/:dbname', (req, res) => {
  const dbname = req.params.dbname;
  const filePath = path.join(flightsPath, `${dbname}.sqlite`);

  // Проверяем, существует ли файл
  if (fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('Ошибка при удалении файла:', err);
        res.status(500).send('Ошибка при удалении файла');
      } else {
        console.log('Файл успешно удален');
        res.send('Файл успешно удален');
      }
    });
  } else {
    res.status(404).send('Файл не найден');
  }
});

app.get('/api/collection/:dbname', (req, res) => {
  const dbname = req.params.dbname;
  console.log('БД ', dbname);
  if (!dbname || dbname == 'null') {
    res.status(400).send('Invalid database name');
    return;
  }

  const dbPath = `${flightsPath}/${dbname}.sqlite`;
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error(err.message);
      res.status(500).send('Error connecting to database');
      return;
    }
    console.log('Connected to the database ' + dbname);

    // Проверка наличия таблицы online_collection
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='online_collection';", [], (err, row) => {
      if (err) {
        console.error(err.message);
        res.status(500).send('Error checking for online_collection table');
        return;
      }

      const hasOnlineCollection = !!row;
      const collectionQuery = 'SELECT _id, dateTime, detector, hasCalibr, P0, P1, P2, P3, description, 0 as is_online FROM collection';
      const onlineCollectionQuery = hasOnlineCollection ? 'SELECT _id, dateTime, NULL as detector, NULL as hasCalibr, NULL as P0, NULL as P1, NULL as P2, NULL as P3, description, 1 as is_online FROM online_collection' : null;

      // Собрать данные из обеих таблиц, если обе существуют
      const queriesToRun = [collectionQuery];
      if (onlineCollectionQuery) queriesToRun.push(onlineCollectionQuery);

      Promise.all(queriesToRun.map(query => new Promise((resolve, reject) => {
        db.all(query, [], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      })))
      .then(results => {
        // Объединение результатов из обеих таблиц
        const combinedResults = results.flat();
        res.json(combinedResults);
      })
      .catch(error => {
        console.error(error.message);
        res.status(500).send('Error querying collections');
      });
    });
  });
});

app.get('/api/flights', (req, res) => {
  fs.readdir(flightsPath, (err, files) => {
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

async function openDatabase(path) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(path, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

async function handleOnlineFlights(db, collectionId) {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM online_measurement WHERE flightId = ? ORDER BY _id DESC`;
    db.all(sql, [collectionId], (err, rows) => {
      if (err) {
        console.error(err.message);
        reject('Ошибка при выполнении запроса к базе данных');
      }

      const transformedData = rows.map(row => {
        const coords = toLLA(row.gpsX, row.gpsY, row.gpsZ);

        // Предполагается, что функции toLLA и getDose уже определены
        const windose = getDose(row.winCount, row.rHeight, false, 1, config.gm1Coeff, config.gm2Coeff, config.winCoeff); 
        const gmDose1 = getDose(row.geiger1, row.rHeight, true, 1, config.gm1Coeff, config.gm2Coeff, config.winCoeff); 
        const gmDose2 = getDose(row.geiger2, row.rHeight, true, 2, config.gm1Coeff, config.gm2Coeff, config.winCoeff);
        console.log('row.winCount, windose', row.winCount, windose);
        // Округление высоты до сантиметра
        const heightRounded = Math.round(row.rHeight * 100) / 100;
        return {
            id: row._id,
            flightId: row.flightId,
            datetime: row.dateTime,
            lat: coords.lat,
            lon: coords.lon,
            alt: coords.alt,
            height: heightRounded,
            countw: row.winCount,
           // dosew: 0,
            dose1: windose,
            dosep: windose,
            dose: windose,
            geiger1: row.geiger1,
            geiger2: row.geiger2,
            gmdose1: gmDose1,
            gmdose2: gmDose2,
            spectrum: [] // Предполагается, что это место заполняется, если есть данные спектра
        };
      });

      resolve(transformedData);
    });
  });
}


  async function handleOfflineFlights(db, collectionId) {
    return new Promise((resolve, reject) => {
      // Запрос для получения калибровочных коэффициентов
      const sqlCalibration = `SELECT P0, P1 FROM collection WHERE _id = ?`;
      db.get(sqlCalibration, [collectionId], async (err, calibration) => {
        if (err) {
          console.error(err.message);
          reject('Error querying the calibration data');
          return;
        }
  
        if (!calibration) {
          reject('Calibration data not found');
          return;
        }
  
        const eP0 = calibration.P0;
        const eP1 = calibration.P1;
        let doseRateConversionFactors = calculateConversionFactors(eP0, eP1);
  
        const B = parseInt(collectionId, 10) + 0xFFFF;
        const sql = `SELECT * FROM measurement WHERE (_id >= ?) AND (_id <= ?)`;
  
        db.all(sql, [collectionId, B], (err, rows) => {
          if (err) {
            console.error(err.message);
            reject('Error performing the query on the database');
            return;
          }
  
          const results = rows.map(row => {
            let coords = toLLA(row.gpsX, row.gpsY, row.gpsZ);
  
            if (row.spectrum === undefined) {
              console.error("spectrum is undefined for row: ", row);
              return null;
            }
  
            const buffer = Buffer.from(row.spectrum, 'binary');
            const spectrumData = [];
            for (let i = 0; i < config.NSPCHANNELS; i++) {
              spectrumData.push(buffer.readUInt16LE(i * 2));
            }
  
            const spectrum = new Spectrum(spectrumData, config.SPECDEFTIME);
            const height = row.rHeight > config.MAX_ALLOWED_HEIGHT ? 0 : row.rHeight; // Обработка условия для высоты
  
            const { dose, dose1m } = getDoseNew(
              spectrum,
              row.rHeight,
              row.geiger1,
              row.geiger2,
              config.DGThresholdLow,
              config.DGThresholdHigh,
              config.gm1Coeff,
              config.gm2Coeff,
              eP0,
              eP1,
              doseRateConversionFactors
            );
  
            return {
              id: row._id,
              datetime: row.dateTime,
              lat: coords.lat,
              lon: coords.lon,
              alt: coords.alt,
              height,
              dose,
              dose1: dose1m,
              dosep: dose,
              geiger1: row.geiger1,
              geiger2: row.geiger2,
              spectrum: spectrum
            };
          }).filter(item => item !== null);
  
          resolve(results);
        });
      });
    });
  }
  

app.get('/api/data/:dbname/:collectionId', async (req, res) => {
  const { dbname, collectionId } = req.params;

  if (!dbname || dbname === 'null' || !collectionId || collectionId === 'null') {
    return res.status(400).send('Invalid database name or collection ID');
  }

  try {
    const db = await openDatabase(`${flightsPath}/${dbname}.sqlite`);
    console.log(`Connected to the database ${dbname}`);
    
    let transformedData;
    if (parseInt(collectionId, 10) < ONLINE_FLIGHT_ID_THRESHOLD) {
      transformedData = await handleOnlineFlights(db, collectionId);
    } else {
      transformedData = await handleOfflineFlights(db, collectionId);
    }

    res.json(transformedData);
  } catch (error) {
    console.error(error.message);
    res.status(500).send('An error occurred while processing your request');
  }
});

function ensureDatabaseExists(newDbName) {
  return new Promise((resolve, reject) => {
    const templatePath = path.join(flightsPath, 'template.udkgdb');
    const newDbPath = path.join(flightsPath, `${newDbName}.sqlite`);

    if (fs.existsSync(newDbPath)) {
      console.log('База данных уже существует.');
      resolve(true); // База данных существует, продолжаем выполнение
    } else {
      fs.copyFile(templatePath, newDbPath, (err) => {
        if (err) {
          console.error('Ошибка при копировании файла для создания новой базы данных:', err);
          reject(err);
        } else {
          console.log(`База данных ${newDbName} успешно создана из шаблона.`);
          resolve(true); // База данных успешно создана, продолжаем выполнение
        }
      });
    }
  });
}

app.post('/api/start-flight-simulation', (req, res) => {
  const dbName = req.body.dbName;
  const flightName = req.body.flightName;
  const winLow = req.body.winLow;
  const winHigh = req.body.winHigh;

  lat = config.latInit;  // Начальная широта
  lon = config.lonInit;  // Начальная долгота
  alt = config.altInit;  // Начальная высота, например 100 метров

  stepCounter = 5; // счетчик шагов
  directionLon = 1; // направление движения по долготе: 1 или -1

  ensureDatabaseExists(dbName).then(() => {
    // Теперь когда база данных гарантированно существует, открываем её
    const dbPath = `${flightsPath}/${dbName}.sqlite`;
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        console.error('Ошибка при открытии базы данных:', err);
        return res.status(500).json({ message: "Ошибка при открытии базы данных" });
      }
      console.log('База данных успешно открыта');
      // Создаём запись полёта, уже внутри коллбека открытия базы данных
      createFlightRecord(db, dbName, flightName, winLow, winHigh, (_id) => {
        console.log('Начинаем симуляцию');

        flightSimulations[_id] = {
          interval: setInterval(() => {
            // Добавляем проверку на существование flightSimulations[_id] перед доступом к iterations
            if (flightSimulations[_id] && flightSimulations[_id].iterations < 500) {
              generateMeasurementData(db, _id);
              flightSimulations[_id].iterations++;
            } else {
              // В случае если flightSimulations[_id] уже не существует, очищаем интервал без ошибок
              if (flightSimulations[_id]) {
                clearInterval(flightSimulations[_id].interval);
                delete flightSimulations[_id];
              }
 
              delete flightSimulations[_id];
              onlineFlightStatus = {
                _id: null,
                active: false,
                dbName: null,
                description: null,
                winLow: null,
                winHigh: null,
                dateTime: null,
                detector: null,
                hasCalibr: null,
                P0: null,
                P1: null,
                P2: null,
                P3: null,
                is_online: false,
                is_real: false
              };

              wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({ type: 'flightEnded', _id, message: 'Симуляция полета завершена' }));
                }
              });

              console.log(`Симуляция полета ${_id} достигла лимита итераций и была остановлена.`);
            }
          }, Math.round(config.SPECDEFTIME * 1000)),
          iterations: 0
        };

        onlineFlightStatus = {
          _id,
          dateTime: new Date().toISOString(),
          detector: null,
          hasCalibr: null,
          P0: null,
          P1: null,
          P2: null,
          P3: null,
          description: flightName,
          winLow,
          winHigh,
          active: true,
          dbName: dbName,
          is_online: true,
          is_real: false
        };

        res.json({ message: "Эмуляция полета запущена", _id, onlineFlightStatus });
      });
    });
  }).catch((error) => {
    console.error('Ошибка при подготовке базы данных:', error);
    res.status(500).json({ message: "Внутренняя ошибка сервера при подготовке базы данных" });
  });
});

app.post('/api/stop-flight', (req, res) => {
  const _id = req.body._id;
  console.log('Попытка останова полета, _id=', _id);

  if (onlineFlightStatus._id === _id && onlineFlightStatus.is_real) {
    // Остановка реального полета
    if (activeSerialPort && activeSerialPort.isOpen) {
      activeSerialPort.close(err => {
        if (err) {
          console.error('Ошибка при закрытии COM порта:', err);
          return res.status(500).send('Ошибка при закрытии COM порта');
        }
        console.log('COM порт успешно закрыт');
        activeSerialPort = null; // Сброс ссылки на порт после закрытия
        updateAndNotifyFlightStatus(_id, false); // Обновление статуса полета и отправка уведомления
        res.json({ message: "Реальный полет успешно остановлен", _id });
      });
    } else {
      console.log('COM порт не был открыт или уже закрыт');
      updateAndNotifyFlightStatus(_id, false); // Обновление статуса полета и отправка уведомления даже если порт уже закрыт
      res.json({ message: "COM порт не был открыт или уже закрыт", _id });
    }
  } else if (flightSimulations[_id]) {
    // Остановка симулированного полета
    clearInterval(flightSimulations[_id].interval);
    delete flightSimulations[_id];
    updateAndNotifyFlightStatus(_id, false); // Обновление статуса полета и отправка уведомления
    res.json({ message: "Симуляция полета остановлена", _id });
  } else {
    console.log("Полет не найден", _id);
    res.status(404).json({ message: "Полет не найден", _id });
  }
});

function updateAndNotifyFlightStatus(_id, isActive) {
  // Обновление статуса полета в объекте onlineFlightStatus
  onlineFlightStatus = {
    _id: null,
    active: isActive,
    dbName: null,
    description: null,
    winLow: null,
    winHigh: null,
    dateTime: null,
    detector: null,
    hasCalibr: null,
    P0: null,
    P1: null,
    P2: null,
    P3: null,
    is_online: false,
    is_real: false
  };

  console.log(`Полет ${_id} был остановлен.`);
  // Уведомление всех подключенных клиентов через WebSocket
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'flightEnded', _id, message: 'Полет остановлен' }));
    }
  });
}


app.get('/api/online-flight-status', (req, res) => {
  res.json(onlineFlightStatus);
});

function createFlightRecord(db, dbName, flightName, winLow, winHigh, callback) {
  //const dateTime = formatDateTimeISO(new Date());
  const dateTime = new Date().toISOString();
  const description = flightName; // Используем название полета как описание
  const insertSql = "INSERT INTO online_collection (dateTime, winLow, winHigh, description) VALUES (?, ?, ?, ?)";

  db.run(insertSql, [dateTime, winLow, winHigh, description], function(err) {
    if (err) {
      console.error(err.message);
      // Можно добавить обработку ошибки, например, отправку ответа с ошибкой
      return;
    }
    const newFlightId = this.lastID;
    callback(newFlightId);
  });
}

function toECEF(lat, lon, alt) {
  const latRad = lat * Math.PI / 180.0;
  const lonRad = lon * Math.PI / 180.0;

  const N = a / Math.sqrt(1 - e * e * Math.sin(latRad) * Math.sin(latRad));

  const X = (N + alt) * Math.cos(latRad) * Math.cos(lonRad);
  const Y = (N + alt) * Math.cos(latRad) * Math.sin(lonRad);
  const Z = ((b2 / a2) * N + alt) * Math.sin(latRad);

  // Округляем результат до ближайшего целого и масштабируем, если это необходимо
  return {
    x: Math.round(X * 100), // Округляем и умножаем на 100, если нужно соответствовать исходному масштабированию
    y: Math.round(Y * 100), // Округляем и умножаем на 100
    z: Math.round(Z * 100)  // Округляем и умножаем на 100
  };
}

const stepSizeLat = 0.00005; // шаг изменения широты
const stepSizeLon = 0.0001; // шаг изменения долготы
const meanderLength = 20; // количество шагов в одном направлении до смены направления
let stepCounter = 0; // счетчик шагов
let directionLon = 1; // направление движения по долготе: 1 или -1

const hotspots = [
  {lat: 55.70457387488768, lon: 37.62113840815405}, // Пример координат очага 1
  {lat: 55.70428567465594, lon: 37.621579947018716},  // Пример координат очага 2
];

// Функция для расчета расстояния между двумя точками на сфере (Земле)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Радиус Земли в километрах
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Возвращает расстояние в километрах
}

function insertOnlineMeasurement(db, flightId, measurementData) {
  // Проверка типа данных
  if (measurementData.type === 2) {
    // Для посылок типа 2 не записываем в БД, только отправляем по WebSocket
    const flightDataForWebSocket = {
      type: 2,
      flightId,
      datetime: measurementData.dateTime,
      lat: measurementData.Lat || null,
      lon: measurementData.Lon || null,
      alt: measurementData.HeightBar || null,
      pressure: measurementData.Pressure || null,
      temperature: measurementData.temper || null,
      speed: measurementData.speed || null,
      sats: measurementData.Sats || null
    };

    // Отправка данных всем подключенным клиентам через WebSocket
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(flightDataForWebSocket));
      }
    });
    //console.log('Посылка типа 2 отправлена на фронтенд без сохранения в БД');
  } else if (measurementData.type === 1) {
    // Для посылок типа 1 сохраняем в БД и отправляем по WebSocket
      const insertSql = `
          INSERT INTO online_measurement 
          (flightId, dateTime, gpsX, gpsY, gpsZ, rHeight, srtmHeight, calcHeight, geiger1, geiger2, winCount) 
          VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)`;

      db.run(insertSql, [
        flightId, measurementData.dateTime, measurementData.gpsX, measurementData.gpsY, measurementData.gpsZ, 
        measurementData.rHeight, measurementData.geiger1, measurementData.geiger2, measurementData.winCount
      ], function(err) {
        if (err) {
          console.error('Ошибка при добавлении записи в online_measurement:', err.message);
          return;
        }

        let coords = toLLA(measurementData.gpsX, measurementData.gpsY, measurementData.gpsZ);

        console.log(`Запись измерения добавлена. ID: ${this.lastID}`);

        let windose = getDose(measurementData.winCount, measurementData.rHeight, false, 1, config.gm1Coeff, config.gm2Coeff, config.winCoeff); // Используем функцию getDose для расчета дозы в окне
        const gmDose1 = getDose(0, coords.alt, true, 1, config.gm1Coeff, config.gm2Coeff, config.winCoeff); // Примерный вызов для gmdose1 с предположением, что geiger1 = 0
        const gmDose2 = getDose(0, coords.alt, true, 2, config.gm1Coeff, config.gm2Coeff, config.winCoeff); // Примерный вызов для gmdose2 с предположением, что geiger2 = 0
/*         if (windose>3) {
            windose = 3
          } */

        console.log('wincount, windose, rHeight', measurementData.winCount, windose, measurementData.rHeight);  
      
        // Подготовка данных для отправки через WebSocket с учетом требуемого формата
        const flightDataForWebSocket = {
          type: 1,
          id: this.lastID,
          flightId,
          datetime: measurementData.dateTime,
          lat: coords.lat, // Нужно будет добавить в measurementData
          lon: coords.lon, // Нужно будет добавить в measurementData
          alt: coords.alt, // Нужно будет добавить в measurementData
          height: measurementData.rHeight,
          countw: measurementData.winCount,
          dosew: windose, // Это значение должно быть рассчитано заранее
          dose: windose,
          geiger1: measurementData.geiger1,
          geiger2: measurementData.geiger2,
          gmdose1: measurementData.gmDose1, // Это значение должно быть рассчитано заранее
          gmdose2: measurementData.gmDose2, // Это значение должно быть рассчитано заранее
          spectrum: [] // Добавьте спектр, если он доступен
        };

        // Отправка данных всем подключенным клиентам через WebSocket
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(flightDataForWebSocket));
          }
          //console.log('Посылка типа 1 записана в БД и отправлена на фронтенд');
        });
    });
  }
}

app.delete('/api/delete-flight/:dbname/:_id', async (req, res) => {
  const dbname = req.params.dbname;
  if (!dbname || dbname === 'null') {
    return res.status(400).send('Invalid database name');
  }

  const dbPath = `${flightsPath}/${dbname}.sqlite`;

  // Подключаемся к базе данных
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send('Error connecting to database');
    }
    console.log('Connected to the database ' + dbname);

    const _id = req.params._id; // Получаем _id из параметров запроса
    console.log('Попытка удаления полета, _id=', _id);

    // Определяем, является ли полет онлайн или офлайн
    const isOnlineFlight = parseInt(_id, 10) < ONLINE_FLIGHT_ID_THRESHOLD;
    const tableName = isOnlineFlight ? "online_collection" : "collection";
    const deleteSql = `DELETE FROM ${tableName} WHERE _id = ?`;

    console.log(deleteSql);

    // Выполняем запрос к базе данных
    db.run(deleteSql, [_id], function(err) {
      if (err) {
        console.error(`Ошибка при удалении записи из ${tableName}:`, err.message);
        return res.status(500).send('Ошибка при удалении записи полета');
      } else {
        console.log(`Запись с _id=${_id} удалена из ${tableName}`);
        res.json({ message: "Полет успешно удален", _id });
      }
    });
  });
});

app.post('/api/save_collection_params', async (req, res) => {
  console.log('Сохранение параметров коллекции', req.body);
  const { dbName, collectionId, P0, P1 } = req.body;

  // Corrected: variable name `dbname` to `dbName` to match the destructuring above.
  if (!dbName || dbName === 'null' || !collectionId || collectionId === 'null') {
    return res.status(400).send('Invalid database name or collection ID');
  }

  try {
    // Template literals need backticks, not single quotes.
    const db = await openDatabase(`${flightsPath}/${dbName}.sqlite`);
    console.log(`Connected to the database ${dbName}`);

    await updateCollection(db, collectionId, { P0, P1 });

    // Success response
    res.send('Collection parameters updated successfully');
  } catch (error) {
    console.error(error.message);
    res.status(500).send('An error occurred while processing your request');
  }
});


async function updateCollection(db, collectionId, params) {
  const sql = `UPDATE collection SET P0 = ?, P1 = ? WHERE _id = ?`;
  await db.run(sql, [params.P0, params.P1, collectionId]);
}

function generateMeasurementData(db, flightId) {
  // Добавляем случайную погрешность к шагам
  const randomErrorLat = (Math.random() - 0.5) * 0.00002;
  const randomErrorLon = (Math.random() - 0.5) * 0.00002;

  // Меняем направление каждые meanderLength шагов
  stepCounter++;
  if (stepCounter % meanderLength === 0) {
    lat += stepSizeLat; // Движемся на север или юг
    directionLon *= -1; // Смена направления вдоль долготы
  }
  else
  {
    lon += stepSizeLon * directionLon;
  }

  // Высота остается постоянной или изменяется в небольшом диапазоне
  alt += (Math.random() - 0.5);

   // Гарантируем, что высота не станет отрицательной
   if (alt < 0) {
    alt = 0.5;
  }

  const ecefCoords = toECEF(lat+randomErrorLat, lon+randomErrorLon, alt);

  // Расчет близости к ближайшему очагу
  let minDistance = Infinity;
  hotspots.forEach(hotspot => {
    const distance = calculateDistance(lat, lon, hotspot.lat, hotspot.lon) * 1000; // Переводим расстояние в метры
    if (distance < minDistance) {
      minDistance = distance;
    }
  });

  // Модификация winCount в зависимости от близости к очагу
  const maxWinCount = 170; // Максимальное значение для winCount
  const baseWinCount = 20; // Базовое значение для winCount
  // Адаптация логики для нового условия близости (40 метров)
  if (minDistance <= 30) { // Если расстояние до очага 40 метров или меньше
    // Масштабируем winCount на основе расстояния, где близость к 0 метров дает максимальное значение winCount
    winCount = maxWinCount - ((minDistance / 30) * (maxWinCount - baseWinCount));
  } else {
    winCount = Math.floor(Math.random() * (baseWinCount + 1)); // Базовое значение для случаев, когда объект далеко от очагов
  }
  winCount = Math.round(winCount);
  
  // Время создания записи
  const dateTime = new Date().toISOString();
  // Расчёты дозы
  let windose = getDose(winCount, alt, false, 1, config.gm1Coeff, config.gm2Coeff, config.winCoeff); // Используем функцию getDose для расчета дозы в окне
  const gmDose1 = getDose(0, alt, true, 1, config.gm1Coeff, config.gm2Coeff, config.winCoeff); // Примерный вызов для gmdose1 с предположением, что geiger1 = 0
  const gmDose2 = getDose(0, alt, true, 2, config.gm1Coeff, config.gm2Coeff, config.winCoeff); // Примерный вызов для gmdose2 с предположением, что geiger2 = 0
  if (windose>3) {
      windose = 3
    }

  console.log('Эмуляция', winCount, alt, config.winCoeff, windose);

  const measurementData = {
    dateTime: new Date().toISOString(),
    gpsX: ecefCoords.x,
    gpsY: ecefCoords.y,
    gpsZ: ecefCoords.z,
    rHeight: alt,
    geiger1: 0, // Примерное значение, подставьте реальные данные
    geiger2: 0, // Примерное значение, подставьте реальные данные
    winCount: winCount,
    type: 1
  };
  insertOnlineMeasurement(db, flightId, measurementData);  
}

function parseType2Data(values) {
  const dateTimeString = values[2];
  const day = parseInt(dateTimeString.slice(0, 2), 10);
  const month = parseInt(dateTimeString.slice(2, 4), 10); 
  const year = 2000 + parseInt(dateTimeString.slice(4, 6), 10); // Добавляем 2000 для корректного года
  const hour = parseInt(dateTimeString.slice(6, 8), 10);
  const minute = parseInt(dateTimeString.slice(8, 10), 10);
  const second = parseInt(dateTimeString.slice(10, 12), 10);
  console.log(year, month, day, hour, minute, second);
  const dateTime = new Date(Date.UTC(year, month - 1, day, hour, minute, second)); // month -1, т.к. месяцы в JS 0-11

  return {
    type: 2,
    dateTime: dateTime.toISOString(),
    Lat: parseFloat(values[3]),
    Lon: parseFloat(values[4]),
    HeightBar: parseFloat(values[5]),
    Pressure: parseFloat(values[6]),
    temper: parseFloat(values[7]),
    speed: parseFloat(values[8]),
    Sats: parseInt(values[9], 10),
  };
}

function parseType1Data(values) {
  // Проверяем, что массив значений содержит достаточно элементов для данного типа данных
  if (values.length !== 15) {
    console.error('Некорректное количество значений для типа 1');
    return null;
  }

  // Расчет dateTime из gpsWeek и gpsTime
  const gpsWeek = parseInt(values[3]);
  const gpsTime = parseInt(values[4]); // gpsTime уже в миллисекундах

/*   const startDate = new Date(Date.UTC(1980, 0, 6));
  const millisecondsSinceEpoch = (gpsWeek * 7 * 24 * 60 * 60 * 1000) + gpsTime;
  const dateTime = new Date(startDate.getTime() + millisecondsSinceEpoch); */

  // Получаем текущее время в формате ISO (UTC)
  const dateTime = new Date();

  const ecefCoords = toECEF(config.latInit, config.lonInit, config.altInit);

  // Преобразуем значения из строк в соответствующие числовые типы и заменяем координаты при необходимости
/*   const gpsX = parseInt(values[5], 10) === 0 ? ecefCoords.x : parseInt(values[5], 10);
  const gpsY = parseInt(values[6], 10) === 0 ? ecefCoords.y : parseInt(values[6], 10);
  const gpsZ = parseInt(values[7], 10) === 0 ? ecefCoords.z : parseInt(values[7], 10); */

  const gpsX = parseInt(values[5], 10);
  const gpsY = parseInt(values[6], 10);
  const gpsZ = parseInt(values[7], 10);

  return {
    type: 1,
    sensorId: parseInt(values[1], 10),
    flightNumber: parseInt(values[2], 10),
    gpsWeek: parseInt(values[3], 10),
    gpsTime: parseInt(values[4], 10),
    gpsX: gpsX,
    gpsY: gpsY,
    gpsZ: gpsZ,
    rHeight: parseFloat(values[8]), // Относительная высота, предположительно может быть дробным числом
    flightTime: parseInt(values[9], 10),
    operatingTime: parseInt(values[9], 10), // Дублируем flightTime, как в вашем исходном коде на C++
    geiger1: parseFloat(values[10]),
    geiger2: parseFloat(values[11]),
    winCount: parseFloat(values[12]),
    gpsAvailable: parseInt(values[13], 10) > 0, // Преобразуем в булево значение
    temporaryConst: parseInt(values[14], 10),
    dateTime: dateTime.toISOString() // Добавляем рассчитанное dateTime
  };
}

function parseData(dataString) {
  try {
    const trimmedData = dataString.trim().slice(1, -1);
    const values = trimmedData.split(',');
    const type = parseInt(values[0], 10);

    if (type === 1 && values.length === 15) {
      return parseType1Data(values);
    } else if (type === 2 && values.length >= 10) {
      return parseType2Data(values);
    } else {
      console.log('Unknown data type or incorrect data format');
      return null;
    }
  } catch (error) {
    console.error('Error parsing data:', error);
    return null;
  }
}

function stopFlight(_id, db) {
  // Останавливаем симуляцию, если она запущена
  if (flightSimulations[_id]) {
    clearInterval(flightSimulations[_id].interval);
    delete flightSimulations[_id];
    console.log(`Симуляция полета ${_id} остановлена из-за ошибки.`);
  }

  // Очистка статуса полета
  onlineFlightStatus = {
    _id: null,
    active: false,
    dbName: null,
    description: null,
    winLow: null,
    winHigh: null,
    dateTime: null,
    detector: null,
    hasCalibr: null,
    P0: null,
    P1: null,
    P2: null,
    P3: null,
    is_online: false,
    is_real: false
  };

  // Удаление записи о полете из базы данных
  if (db && _id) {
    const deleteSql = "DELETE FROM online_collection WHERE _id = ?";
    db.run(deleteSql, [_id], function(err) {
      if (err) {
        console.error('Ошибка при удалении записи полета:', err.message);
      } else {
        console.log(`Запись полета ${_id} удалена из базы данных.`);
      }
    });
  }

  // Отправка сообщения через WebSocket о том, что полет остановлен
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'flightEnded', _id, message: 'Полет остановлен из-за ошибки' }));
    }
  });
}


app.post('/api/start-flight', (req, res) => {
  const { dbName, flightName, winLow, winHigh } = req.body;

  // Проверка наличия и создание базы данных, если требуется
  ensureDatabaseExists(dbName).then(() => {
      // Путь к файлу базы данных
      const dbPath = `${flightsPath}/${dbName}.sqlite`;
      // Открытие базы данных
      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
          if (err) {
              console.error('Ошибка при открытии базы данных:', err);
              return res.status(500).json({ message: "Ошибка при открытии базы данных" });
          }
          console.log('База данных успешно открыта');

          // Создание записи полета
          createFlightRecord(db, dbName, flightName, winLow, winHigh, (_id) => {
              console.log(`Запись полета ${_id} создана`);

              onlineFlightStatus = {
                _id,
                dateTime: new Date().toISOString(),
                detector: null,
                hasCalibr: null,
                P0: null,
                P1: null,
                P2: null,
                P3: null,
                description: flightName,
                winLow,
                winHigh,
                active: true,
                dbName: dbName,
                is_online: true,
                is_real: true
              };
      
              // Настройка и открытие COM порта
              const portUsed = new SerialPort({
                  path: config.serialPort.path,
                  baudRate: config.serialPort.baudRate
              });

              activeSerialPort = portUsed;

              const parser = portUsed.pipe(new ReadlineParser({ delimiter: '\n' }));

              parser.on('data', (data) => {
                  console.log(`Raw data received: ${data}`);
                  // Парсинг и обработка полученных данных
                  const parsedData = parseData(data);  
                  if (parsedData) {
                      console.log('Parsed data:', parsedData);
                      // Вставка данных измерения в таблицу online_measurement
                      insertOnlineMeasurement(db, _id, parsedData);
                  } else {
                      console.log('Data parsing error or invalid data format');
                  }
              });

              portUsed.on('open', () => {
                  console.log('Serial Port Opened for receiving data.', portUsed);
                  res.json({ message: "Полет запущен", _id, onlineFlightStatus });
              });

              portUsed.on('error', (err) => {
                console.error('Error with serial port:', err.message);
                // Здесь отправляем на фронтенд более информативное сообщение об ошибке
                res.status(500).json({ error: true, message: `Ошибка при открытии COM-порта: ${err.message}` });
                // Попытка остановить полет, если начат. Для этого нужна функция остановки
                stopFlight(_id, db);
              });
            
          });
      });
  }).catch((error) => {
      console.error('Error preparing database:', error);
      res.status(500).json({ message: "Internal server error preparing the database" });
  });
});

// Добавляем новый эндпойнт для отправки сообщения на открытый COM-порт
app.post('/api/sendToComPort', (req, res) => {
  const { message } = req.body; // Предполагаем, что сообщение будет передано в теле запроса

  if (!message) {
    return res.status(400).json({ error: true, message: 'Сообщение не может быть пустым' });
  }

  // Проверяем, открыт ли COM-порт
  if (activeSerialPort && activeSerialPort.isOpen) {
    // Пытаемся отправить сообщение
    activeSerialPort.write(message, (err) => {
      if (err) {
        console.error('Ошибка при отправке сообщения на COM-порт:', err.message);
        return res.status(500).json({ error: true, message: 'Ошибка при отправке сообщения на COM-порт' });
      }

      console.log(`Сообщение "${message}" успешно отправлено на COM-порт`);
      return res.json({ success: true, message: 'Сообщение успешно отправлено' });
    });
  } else {
    console.log('COM-порт не открыт');
    return res.status(400).json({ error: true, message: 'COM-порт не открыт' });
  }
});


function initializeUserData() {
  // Создаем config.json, если его нет
  if (!fs.existsSync(configPath)) {
    fs.copyFileSync(initialConfigPath, configPath);
  }

  // Создаем isotope_peaks_data.json, если его нет
  if (!fs.existsSync(isotopePath)) {
    fs.copyFileSync(initialIsotopePath, isotopePath);
  }

  // Создаем папку Flights, если ее нет
  if (!fs.existsSync(flightsPath)) {
    fs.mkdirSync(flightsPath, { recursive: true });
  }

  // Копируем template.udkgdb, если его нет в папке Flights
  const userTemplateDbPath = path.join(flightsPath, 'template.udkgdb');
  if (!fs.existsSync(userTemplateDbPath)) {
    fs.copyFileSync(templateDbPath, userTemplateDbPath);
  }

  // Копируем Могильник.sqlite, если его нет в папке Flights
  const userExampleDbPath = path.join(flightsPath, 'Могильник.sqlite');
  if (!fs.existsSync(userExampleDbPath)) {
    fs.copyFileSync(exampleDbPath, userExampleDbPath);
  }
}

// Вызываем функцию инициализации при запуске
initializeUserData();

let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
//const port = config.port; // Использование номера порта из config.json

let activeSerialPort = null;

const PORT = process.env.PORT || config.port || 3009;

function startServer() {
  const server = app.listen(PORT, () => {
    console.log(`HTTP server listening at http://localhost:${PORT}`);
  });

  server.on('upgrade', (request, socket, head) => {
    console.log('Получен запрос на установление WebSocket соединения');
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
      console.log('WebSocket соединение успешно установлено');
    });
  });

  return server;
}

// Проверка, запущен ли файл напрямую
if (require.main === module) {
  startServer(); // Запуск сервера при запуске через `node server.js`
} else {
  module.exports = startServer; // Экспорт функции для использования в `electron.js`
}