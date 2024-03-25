const { SerialPort } = require('serialport');

const port = new SerialPort({
  path: 'CNCA1',
  baudRate: 57600
});

// Определение параметров модели Земли
const a = 6378137.0; // Радиус Земли в метрах
const e = 0.08181919; // Эксцентриситет
const b2 = Math.pow(6356752.314245, 2); // Квадрат малой полуоси
const a2 = Math.pow(a, 2); // Квадрат большой полуоси

let lat = 55.704034038232834;
let lon = 37.62119540524117;
let alt = 25;

function toECEF(lat, lon, alt) {
  const latRad = lat * Math.PI / 180.0;
  const lonRad = lon * Math.PI / 180.0;
  const N = a / Math.sqrt(1 - e * e * Math.sin(latRad) * Math.sin(latRad));
  const X = (N + alt) * Math.cos(latRad) * Math.cos(lonRad);
  const Y = (N + alt) * Math.cos(latRad) * Math.sin(lonRad);
  const Z = ((b2 / a2) * N + alt) * Math.sin(latRad);
  return { x: Math.round(X * 100), y: Math.round(Y * 100), z: Math.round(Z * 100) };
}

function updatePosition() {
  // Случайное изменение координат и высоты
  lat += (Math.random() - 0.5) * 0.000036; // Примерно 2 метра в широту
  lon += (Math.random() - 0.5) * 0.000036; // Примерно 2 метра в долготу
  alt += (Math.random() - 0.5) * 1; // В пределах 0.5 метра
  if (alt<0) 
    alt++;
}

function generateData() {
  updatePosition();
  const ecef = toECEF(lat, lon, alt);
  
  const now = new Date();
  const startDate = new Date(Date.UTC(1980, 0, 6));
  const diff = now - startDate;
  const gpsWeek = Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
  const weekMilliseconds = diff % (7 * 24 * 60 * 60 * 1000);
  const gpsTime = Math.floor(weekMilliseconds);

  const sensorId = 8;
  const flightNumber = 1;
  const gpsX = ecef.x;
  const gpsY = ecef.y;
  const gpsZ = ecef.z;
  const relativeHeight = alt; /* Math.floor((alt - 25 ) * 100); */
  const flightTime = 8390;
  const operatingTime = flightTime;
  const sensorGM1Value = 0;
  const sensorGM2Value = 0;
  const sensorSWValue = 41;
  const gpsAvailable = 1;
  const temporaryConst = 0;

  return `#${sensorId},${flightNumber},${gpsWeek},${gpsTime},${gpsX},${gpsY},${gpsZ},${relativeHeight},${flightTime},${operatingTime},${sensorGM1Value},${sensorGM2Value},${sensorSWValue},${gpsAvailable},${temporaryConst}y\r`;
}

function sendData() {
  const data = generateData();
  console.log(`Sending: ${data}`);
  port.write(data + '\n', (err) => {
    if (err) {
      return console.log('Error on write: ', err.message);
    }
    console.log('Message written');
  });
}

setInterval(sendData, 1000);
