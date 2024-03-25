const fs = require('fs');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

// Путь к файлу конфигурации
const configPath = './config.json';

// Чтение и парсинг конфигурационного файла
let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Настройка SerialPort с использованием данных из файла конфигурации
const port = new SerialPort({
  path: config.serialPort.path, // Используем значение 'path' из файла конфигурации
  baudRate: config.serialPort.baudRate // Используем значение 'baudRate' из файла конфигурации
});

const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

parser.on('data', data => {
  console.log(`Raw data received: ${data}`);
  const parsedData = parseData(data);
  if (parsedData) {
    console.log('Parsed data:', parsedData);
  } else {
    console.log('Data parsing error or invalid data format');
  }
});

function parseData(dataString) {
  try {
    const trimmedData = dataString.trim().slice(1, -2);
    const values = trimmedData.split(',');
    return {
      sensorId: parseInt(values[0]),
      flightNumber: parseInt(values[1]),
      gpsWeek: parseInt(values[2]),
      gpsTime: parseInt(values[3]),
      gpsX: parseInt(values[4]),
      gpsY: parseInt(values[5]),
      gpsZ: parseInt(values[6]),
      relativeHeight: parseInt(values[7]),
      flightTime: parseInt(values[8]),
      operatingTime: parseInt(values[9]),
      sensorGM1Value: parseInt(values[10]),
      sensorGM2Value: parseInt(values[11]),
      sensorSWValue: parseInt(values[12]),
      gpsAvailable: parseInt(values[13]),
      temporaryConst: parseInt(values[14])
    };
  } catch (error) {
    console.error('Error parsing data:', error);
    return null;
  }
}

port.on('open', () => {
  console.log('Serial Port Opened for receiving');
});

port.on('error', (err) => {
  console.log('Error: ', err.message);
});
