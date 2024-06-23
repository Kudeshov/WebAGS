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

const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

parser.on('data', data => {
  console.log(`Raw data received: ${data}`);
  const parsedData = parseData(data);
  if (parsedData) {
    console.log('Parsed data:', parsedData);
  } else {
    console.log('Data parsing error or invalid data format');
  }
});

function parseType2Data(values) {
  const dateTimeString = values[2];
  const day = parseInt(dateTimeString.slice(0, 2), 10);
  const month = parseInt(dateTimeString.slice(2, 4), 10) - 1; // Месяцы в JavaScript начинаются с 0
  const year = 2000 + parseInt(dateTimeString.slice(4, 6), 10); // Добавляем 2000 для корректного года
  const hour = parseInt(dateTimeString.slice(6, 8), 10);
  const minute = parseInt(dateTimeString.slice(8, 10), 10);
  const second = parseInt(dateTimeString.slice(10, 12), 10);
  
  const dateTime = new Date(Date.UTC(year, month, day, hour, minute, second));

  return {
    type: 2,
    dateTime: dateTime.toISOString(),
    Lat: parseFloat(values[3]),
    Lon: parseFloat(values[4]),
    HeightBar: parseFloat(values[5]),
    relativeHeight: parseFloat(values[5]),
    Pressure: parseFloat(values[6]),
    temper: parseFloat(values[7]),
    speed: parseFloat(values[8]),
    Sats: parseFloat(values[9])
  };
}

function parseType1Data(values) {
  // Проверяем, что массив значений содержит достаточно элементов для данного типа данных
  if (values.length !== 15) {
    console.error('Некорректное количество значений для типа 1');
    return null;
  }

  // Преобразуем значения из строк в соответствующие числовые типы
  return {
    type: 1,
    sensorId: parseInt(values[1], 10),
    flightNumber: parseInt(values[2], 10),
    gpsWeek: parseInt(values[3], 10),
    gpsTime: parseInt(values[4], 10),
    gpsX: parseInt(values[5], 10),
    gpsY: parseInt(values[6], 10),
    gpsZ: parseInt(values[7], 10),
    relativeHeight: parseFloat(values[8]), // Относительная высота, предположительно может быть дробным числом
    flightTime: parseInt(values[9], 10),
    operatingTime: parseInt(values[9], 10), // Дублируем flightTime, как в вашем исходном коде на C++
    sensorGM1Value: parseFloat(values[10]),
    sensorGM2Value: parseFloat(values[11]),
    sensorSWValue: parseFloat(values[12]),
    gpsAvailable: parseInt(values[13], 10) > 0, // Преобразуем в булево значение
    temporaryConst: parseInt(values[14], 10)
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





port.on('open', () => {
  console.log('Serial Port Opened for receiving');
});

port.on('error', (err) => {
  console.log('Error: ', err.message);
});
