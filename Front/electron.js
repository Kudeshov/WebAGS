const { app, BrowserWindow } = require('electron');

function createWindow () {
  // Создание окна браузера
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: "Аэрогаммасъемка", // Ваш заголовок окна
    webPreferences: {
      nodeIntegration: true
    }
  });

  // и загрузка index.html приложения
  // mainWindow.loadFile('index.html');
  mainWindow.loadURL('http://localhost:3000');
  mainWindow.setMenu(null); // Скрыть меню
  // Открыть инструменты разработчика.
  // mainWindow.webContents.openDevTools();
}

// Этот метод будет вызываться, когда Electron закончит
// инициализацию и готов к созданию окон браузера.
// Некоторые API могут использоваться только после того, как этот метод вызывается.
app.whenReady().then(createWindow);

// Закрыть все окна, когда пользователь выйдет.
app.on('window-all-closed', () => {
  // На macOS приложения и их меню обычно остаются активными, пока пользователь явно не выйдет
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // На macOS обычно пересоздают окна приложения, когда
  // пользователь кликает по иконке в доке и у него нет других открытых окон.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
