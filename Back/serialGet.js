const { SerialPort } = require('serialport');

// Инициализация SerialPort для вашего COM порта
const port = new SerialPort({
  path: 'CNCB1', // Укажите ваш порт здесь
  baudRate: 9600
});

// Слушаем событие 'data' для получения данных из порта напрямую
port.on('data', function (data) {
  console.log('Data received:', data.toString());
});

port.on('open', () => {
  console.log('Serial Port Opened for receiving');
});

port.on('error', (err) => {
  console.log('Error: ', err.message);
});
