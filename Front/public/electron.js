const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const express = require('express');
const fs = require('fs');

let mainWindow;
let clientServer;

// Импортируем серверную функцию
const startServer = require('../server'); // путь к server.js от public

// Устанавливаем путь к сборке React-приложения
let buildPath = path.join(__dirname, '..', 'build');
if (!fs.existsSync(buildPath)) {
  buildPath = path.join(process.resourcesPath, 'build');
  //console.log(`Using resourcesPath for build: ${buildPath}`);
} else {
  //console.log(`Using local build path: ${buildPath}`);
}

// Запуск клиентского приложения на 3010 порту
function createExpressServer() {
  const clientApp = express();
  const clientPort = 3010;

  clientApp.use(express.static(buildPath));

  clientApp.use((req, res, next) => {
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  clientApp.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });

  return clientApp.listen(clientPort, () => {
    console.log(`Client running at http://localhost:${clientPort}`);
  });
}

// Создание окна Electron
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  //console.log('dirname: ',__dirname);
  mainWindow.loadFile(path.join(__dirname, 'loading.html'));

  setTimeout(() => {
    mainWindow.loadURL('http://localhost:3010');
  }, 500); // Даем секундную паузу, чтобы загрузить loading.html

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Access-Control-Allow-Origin": "*", // Разрешаем все источники
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS", // Указываем разрешенные методы
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    });
  });
  
  // Перенаправление всех запросов на /api с порта 3010 на 3009
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (details.url.startsWith('http://localhost:3010/api')) {
      const newUrl = details.url.replace('http://localhost:3010/api', 'http://localhost:3009/api');
      //console.log(`Redirecting request from ${details.url} to ${newUrl}`);
      callback({ redirectURL: newUrl });
    } else {
      callback({});
    }
  });

  mainWindow.on('closed', () => {
    if (clientServer) clientServer.close();
    if (apiServer) apiServer.close();
  });
}

let apiServer;
app.whenReady().then(() => {
  clientServer = createExpressServer(); // Запуск клиентского сервера на 3010
  apiServer = startServer(); // Запуск серверного API на 3009
  createWindow(); // Создание окна Electron
});

// Закрытие серверов при закрытии всех окон
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (clientServer) clientServer.close();
    if (apiServer) apiServer.close();
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
