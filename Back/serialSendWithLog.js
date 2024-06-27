const { SerialPort } = require('serialport');
const fs = require('fs');
const readline = require('readline');
const path = require('path');

// Чтение настроек из config.json
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// Переопределение имени порта на 'CNCA1' для соответствия старой версии
config.serialPort.path = 'CNCA1';

const port = new SerialPort({
  path: config.serialPort.path,
  baudRate: config.serialPort.baudRate
});

const logFile = path.join(config.flightsDirectory, '20210511120546.log');
//const logFile = path.join(config.flightsDirectory, '20210511130338.log');

let logData = [];
let currentIndex = 0;

// Функция для чтения и обработки лог-файла
function readLogFile(filePath) {
  const lineReader = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity
  });

  lineReader.on('line', (line) => {
    if (line.startsWith('#1') || line.startsWith('#2')) {
      logData.push(line);
    }
  });

  lineReader.on('close', () => {
    console.log('Log file read complete');
    startSendingData();
  });
}

// Функция для отправки данных на COM-порт
function sendData() {
  if (currentIndex < logData.length) {
    const data = logData[currentIndex];
    console.log(`Sending: ${data}`);
    port.write(data + '\r\n', (err) => {
      if (err) {
        return console.log('Error on write: ', err.message);
      }
      console.log('Message written');
    });
    currentIndex++;
  } else {
    console.log('All data sent');
    clearInterval(intervalId);
  }
}

// Функция для начала отправки данных с интервалом
function startSendingData() {
  intervalId = setInterval(sendData, 500); // Отправка данных 
}

let intervalId;
readLogFile(logFile);
