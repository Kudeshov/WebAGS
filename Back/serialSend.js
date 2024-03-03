const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

// Замените 'CNCA0' на имя вашего виртуального COM порта, если это необходимо
const port = new SerialPort({
  path: 'CNCA1',
  baudRate: 9600
});

function generateData() {
  // Получаем текущее время
  const now = new Date();
  
  // Определяем начальную точку отсчёта времени GPS (6 января 1980 года)
  const startDate = new Date(Date.UTC(1980, 0, 6));
  
  // Вычисляем gpsWeek и gpsTime
  const diff = now - startDate; // Разница в миллисекундах
  const gpsWeek = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)); // Количество недель
  const weekMilliseconds = diff % (7 * 24 * 60 * 60 * 1000); // Миллисекунды текущей недели
  const gpsTime = Math.floor(weekMilliseconds); // Оставляем как есть, поскольку уже в миллисекундах

  // Остальные параметры, как в предыдущем примере
  const sensorId = 8;
  const flightNumber = 1;
  const gpsX = Math.floor(Math.random() * 1000000000);
  const gpsY = Math.floor(Math.random() * 1000000000);
  const gpsZ = Math.floor(Math.random() * 1000000000);
  const relativeHeight = Math.floor(Math.random() * 100 - 50);
  const flightTime = 8390;
  const operatingTime = flightTime;
  const sensorGM1Value = 0;
  const sensorGM2Value = 0;
  const sensorSWValue = 41;
  const gpsAvailable = 1;
  const temporaryConst = 0;
/*   const barometerAvailable = 1;
  const magnetometerAvailable = 1;
  const photoTrigged = 0;
  const navigationMode = 0;
  const guidanceMode = 0;
  const batteryVoltage = 23000;
  const machineErrors = 0; */

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

// Отправляем данные каждую секунду
setInterval(sendData, 1000);
