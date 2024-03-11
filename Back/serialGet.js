const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

// Настройка SerialPort для вашего COM порта
const port = new SerialPort({
  path: 'CNCB1', // Укажите ваш порт здесь
  baudRate: 57600
});


const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }))
//const parser = port.pipe(new Readline({ delimiter: '\r\n' }));

parser.on('data', data => {
  // Разбор полученной строки данных
  console.log(`Raw data received: ${data}`);
  const parsedData = parseData(data);
  if (parsedData) {
    console.log('Parsed data:', parsedData);
    // Здесь можно добавить дополнительную логику обработки данных
  } else {
    console.log('Data parsing error or invalid data format');
  }
});

function parseData(dataString) {
  try {
    // Предполагается, что данные имеют формат, указанный в serialSend.js
    // Например: "#8,1,1871,120567186,284661472,219385392,523390720,-122,8390,0,0,41,1,0y\r"
    // Удаляем начальный '#' и конечный 'y\r', затем разделяем по запятым
    const trimmedData = dataString.trim().slice(1, -2);
    const values = trimmedData.split(',');

    // Преобразование значений к соответствующим типам и возвращение объекта
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
