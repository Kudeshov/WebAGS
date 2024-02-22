import React, { useState, useEffect, useContext, useRef, useLayoutEffect} from 'react';
import { ReactComponent as PlaneIcon } from './icons/plane.svg';
import { ReactComponent as AnalyticsIcon } from './icons/table.svg';
import { ReactComponent as ChartIcon } from './icons/chart-bar.svg';
import { ReactComponent as DatabaseIcon } from './icons/database.svg';
import { ReactComponent as CubeIcon } from './icons/cube.svg';
import { ReactComponent as CameraIcon } from './icons/camera.svg';
import { ReactComponent as DownloadIcon } from './icons/download.svg';
import { ReactComponent as EraserIcon } from './icons/trash.svg';
import { ReactComponent as CogIcon } from './icons/cog.svg';

import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import { AppBar, Grid, Toolbar, IconButton, Menu, MenuItem, ListSubheader, Dialog, DialogTitle, 
         Autocomplete, DialogContent, DialogContentText, DialogActions, FormControlLabel, TextField, Button, Checkbox } from '@mui/material';
import { FlightDataContext } from './FlightDataContext';
import Snackbar from '@mui/material/Snackbar';
import Divider from '@mui/material/Divider';
import { createGradientT, calculateColorThresholds } from './colorUtils';
import CircularProgress from '@mui/material/CircularProgress';
import Backdrop from '@mui/material/Backdrop';
import { convertDateTime, convertToTime } from './dateUtils';

const CustomToolbar = ({ onToggleDrawer, drawerOpen, onToggleChart, chartOpen, onHeightFilterActive, heightFilterActive,
    handleThreeDToggle, threeDActive, settingsOpen, onColorOverrideActive, colorOverrideActive }) => {

  const { selectedCollection, setSelectedCollection } = useContext(FlightDataContext);
  const { selectedDatabase, setSelectedDatabase } = useContext(FlightDataContext);
  const { onlineMeasurements, setOnlineMeasurements } = useContext(FlightDataContext);
  const [unitMenuAnchorEl, setUnitMenuAnchorEl] = useState(null);
  const [settingsMenuAnchorEl, setSettingsMenuAnchorEl] = useState(null);
  
  const [filterMenuAnchorE2, setDatabaseMenuAnchorE2] = useState(null);
  const [filterMenuAnchorCollection, setDatabaseMenuAnchorCollection] = useState(null);

  const [flightOptions, setFlightOptions] = useState([]);
  const [collectionOptions, setCollectionOptions] = useState([]);
  const [heightFilterDialogOpen, setHeightFilterDialogOpen] = useState(false);
  const [colorLegendFilterDialogOpen, setColorLegendFilterDialogOpen] = useState(false);
  const { validMeasurements, setValidMeasurements } = useContext(FlightDataContext);
  const { measurements, setMeasurements } = useContext(FlightDataContext);
  const [selectedOnlineDB, setSelectedOnlineDB] = useState(null);
  
  const { heightFrom } = useContext(FlightDataContext);
  const { heightTo } = useContext(FlightDataContext);
  const { heightFilterFrom, setHeightFilterFrom } = useContext(FlightDataContext);
  const { heightFilterTo, setHeightFilterTo } = useContext(FlightDataContext);
  const { colorThresholds, setColorThresholds } = useContext(FlightDataContext);  
  const { minDoseValue } = useContext(FlightDataContext);
  const { maxDoseValue } = useContext(FlightDataContext);
  const { setGlobalSettings } = useContext(FlightDataContext);
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [currentColorThresholds, setCurrentColorThresholds ] = useState({
    v0: 0,
    v1: 0,
    v2: 0,
    v3: 0,
  });

  const [minDoseValueR, setMinDoseValueR] = useState(0);
  const [maxDoseValueR, setMaxDoseValueR] = useState(0);

  const [localHeightFrom, setLocalHeightFrom] = useState(-1000);
  const [localHeightTo, setLocalHeightTo] = useState(1000);

  const { saveMapAsImage } = useContext(FlightDataContext);
  const { saveDataToFile } = useContext(FlightDataContext);
  const { isLoadingFlight } = useContext(FlightDataContext);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [databaseToDelete, setDatabaseToDelete] = useState(null);

  const [isLoading, setIsLoading] = useState(false);

  const [startFlightDialogOpen, setStartFlightDialogOpen] = useState(false);
  const [onlineFlightName, setOnlineCollectionName] = useState('Полет');
  const [winLowValue, setWinLowValue] = useState(20);
  const [winHighValue, setWinHighValue] = useState(200);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const {onlineFlightId, setOnlineFlightId} = useContext(FlightDataContext); // Состояние для хранения ID онлайн полета
  const [websocket, setWebsocket] = useState(null);
  const [simulationData, setSimulationData] = useState('');
  const [isSettingsLoading, setIsSettingsLoading] = useState(false);

    const handleCoeffChange = (value, index, arrayName) => {
      const newCoeffs = [...settings[arrayName]]; // Копируем текущий массив
      newCoeffs[index] = parseFloat(value); // Обновляем конкретный коэффициент по индексу
      setSettings({...settings, [arrayName]: newCoeffs}); // Обновляем состояние настроек
    };


  
  const handleStartFlightDialogOpen = () => {

    if (selectedDatabase) {
      setSelectedOnlineDB(selectedDatabase);
    } else {
      setSelectedOnlineDB('');
    }

    setStartFlightDialogOpen(true);
    handleCollectionMenuClose();
  };
    
  const handleStartFlightDialogClose = () => {
    setStartFlightDialogOpen(false);
  };

  const setupWebSocket = (onlineFlightId) => {
    let ws = new WebSocket('ws://localhost:3001');

    const connectWebSocket = () => {
        // Установка обработчиков событий WebSocket
        ws.onopen = () => {
            console.log('WebSocket соединение установлено');
        };

        console.log('Установка обработчика ws.onmessage');
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          console.log(data);
          setOnlineMeasurements(currentMeasurements => {
          // Проверяем, что широта и долгота существуют и не равны null
          if (data.lat != null && data.lon != null) {
            const isDuplicate = currentMeasurements.some(item => item.id === data.id);
            if (!isDuplicate) {
              // Если элемент уникален, добавляем его в массив
              return [...currentMeasurements, data];
            }
            else
            {
              return currentMeasurements;
            }
          } else {
            // Если условие не выполняется, возвращаем текущее состояние без изменений
            return currentMeasurements;
          }
          });
          setSimulationData(`Время: ${convertToTime(data.datetime)}, Широта: ${data.lat ? Number(data.lat).toFixed(6) : '0.000000'}, ` +
                            `Долгота: ${data.lon ? Number(data.lon).toFixed(6) : '0.000000'}, ` +
                            `Высота: ${data.alt ? Number(data.alt).toFixed(2) : '0.00'}, ` +
                            `Счет в окне: ${data.countw ? data.countw : '0'}`);
        };

        ws.onerror = (error) => {
          console.error('Ошибка WebSocket:', error);
          // Дополнительное логирование
          console.log(error.message);
        };

        ws.onclose = () => {
            console.log('WebSocket соединение закрыто');
            setTimeout(() => {
                console.log('Попытка переподключения...');
                ws = new WebSocket('ws://localhost:3001');
                connectWebSocket(); // Попытка переподключения
            }, 1000); // Переподключение через 1 секунду
        };
    };

    connectWebSocket(); // Первоначальное подключение
    setWebsocket(ws);
  };

  useEffect(() => {
    setValidMeasurements(onlineMeasurements);
    setMeasurements(onlineMeasurements);
    //console.log('onlineMeasurements', onlineMeasurements);
  }, [onlineMeasurements]);

  useEffect(() => {
    return () => {
        if (websocket) {
            websocket.close();
        }
    };
  }, [websocket]);

  const handleStartFlight = () => {
    setOnlineMeasurements([]);
    fetch('/start-flight-simulation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dbName: selectedOnlineDB,
        flightName: onlineFlightName, // Добавляем название полета
        winLow: winLowValue, // Добавляем нижнюю границу окна
        winHigh: winHighValue, // Добавляем верхнюю границу окна
        demoMode: isDemoMode // Добавляем статус демо-режима
      })
    })
    .then(response => response.json())
    .then(data => {
      //console.log('Полет начат:', data);
     
      //setSelectedDatabase(selectedOnlineDB);

      if (data && data.onlineFlightStatus) {
        console.log('Полет запущен:', data.onlineFlightStatus);
        setOnlineFlightId(data.onlineFlightStatus._id); // Сохраняем ID полета
        setSelectedDatabase(selectedOnlineDB);
        setSelectedCollection(data.onlineFlightStatus); // Предполагая, что это корректные данные для вашего контекста

        console.log("setupWebSocket из HandleStartFlight");
        setupWebSocket(data.onlineFlightStatus._id); // Установка WebSocket соединения
        
        setSnackbarOpen(true);
        setSnackbarMessage('Эмуляция полета запущена');
      } else {
        console.error('Не удалось запустить полет:', data);
        setSnackbarOpen(true);
        setSnackbarMessage('Ошибка при запуске полета');
      }
    })
    .catch(error => {
      console.error('Ошибка при запуске эмуляции полета:', error);
      setSnackbarOpen(true);
      setSnackbarMessage('Ошибка сети при запуске полета');
    })
    .finally(() => {
      //setIsLoading(false); // Выключаем индикатор загрузки
      handleStartFlightDialogClose(); // Закрываем диалоговое окно
    });
  };

 
  useEffect(() => {
    // Функция для запроса статуса онлайн-полета
    const checkOnlineFlightStatus = async () => {
      try {
        const response = await fetch('/api/online-flight-status');
        const statusData = await response.json();
  
        // Исправление условия на проверку ключа "active"
        if (statusData && statusData.active) {
          console.log('Онлайн-полет активен:', statusData);
          setOnlineFlightId(statusData._id); // Сохраняем ID активного полета
          setSelectedDatabase(statusData.dbName); // Устанавливаем выбранную базу данных
          // Установка WebSocket соединения
          setupWebSocket(statusData._id);
        } else {
          console.log('Онлайн-полет не активен');
        }
      } catch (error) {
        console.error('Ошибка при запросе статуса онлайн-полета:', error);
      }
    };
  
    // Выполнение функции проверки статуса онлайн-полета при инициализации
    checkOnlineFlightStatus();
  }, []); // Пустой массив зависимостей означает, что эффект выполнится один раз при монтировании компонента
 

  const handleStopFlight = () => {
    if (!onlineFlightId) {
      console.error('Ошибка: ID симуляции отсутствует');
      return;
    }
  
    fetch('/stop-flight-simulation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ _id: onlineFlightId })
    })
    
    .then(response => {
      if(response.ok) {
        // Действия после успешного останова симуляции
        setOnlineFlightId(null); // Сброс ID симуляции
        if (websocket) {
          websocket.close();
          setWebsocket(null);
        }
        setSnackbarMessage('Полет остановлен');
        handleCollectionMenuClose();
      } else {
        console.error('Ошибка остановки полета: HTTP-статус', response.status);
        setSnackbarMessage('Полет уже остановлен');
        setOnlineFlightId(null); // Сброс ID симуляции
        if (websocket) {
          websocket.close();
          setWebsocket(null);
        }
      }
    })
    .catch(error => {
      console.error('Ошибка остановки эмуляции:', error);
      setSnackbarMessage('Ошибка остановки полета: ', error);
      setOnlineFlightId(null); // Сброс ID симуляции
      if (websocket) {
        websocket.close();
        setWebsocket(null);
      }
    });
  };
  
  const handleWinLowChange = (event) => {
    setWinLowValue(event.target.value);
  };
  
  const handleWinHighChange = (event) => {
    setWinHighValue(event.target.value);
  };
  
  const handleOnlineCollectionNameChange = (event) => {
    setOnlineCollectionName(event.target.value);
    //setSelectedCollection(event.target.value);
  };
  
  const handleDemoModeChange = (event) => {
    setIsDemoMode(event.target.checked);
  };
  
  const handleOpenConfirmDialog = (databaseName) => {
    setDatabaseToDelete(databaseName);
    setOpenConfirmDialog(true);
  };

  
  const handleOpenDeleteDialog = (databaseName) => {
    setDatabaseToDelete(databaseName);
    setDeleteDialogOpen(true);
  };
  
  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setDatabaseToDelete(null);
    handleDatabaseMenuClose();  // Закрыть меню базы данных
  };
  
  const handleConfirmDelete = () => {
    if (databaseToDelete) {
      handleDeleteDatabase(databaseToDelete);
    }
    handleCloseDeleteDialog();
  };  

  const handleSnackbarOpen = (message) => {
    setSnackbarMessage(message);
    setSnackbarOpen(true);
  };
  
  const handleSnackbarClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  // Функция для открытия диалога настроек
  const handleSettingsDialogOpen = () => {
    fetchSettings(); // Загружаем текущие настройки перед открытием
    setSettingsDialogOpen(true);
  };

  // Функция для закрытия диалога настроек
  const handleSettingsDialogClose = () => {
    setSettingsDialogOpen(false);
  };

  // Функция для сохранения измененных настроек
  const handleSaveSettings = (newSettings) => {
    updateSettings(newSettings); // Отправляем измененные настройки на сервер
    setSettingsDialogOpen(false);
  };
  

  const handleDatabaseFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
  
    const formData = new FormData();
    formData.append('databaseFile', file);
  
    // Извлекаем имя файла без расширения
    const fileNameWithoutExtension = file.name.replace(/\.[^/.]+$/, "");
  
    console.log('Выбран файл:', file.name); // Выводим имя файла в лог
  
    // Отправляем файл на сервер через API
    try {
      setIsLoading(true);
      handleDatabaseMenuClose(); // Закрыть меню базы данных при начале загрузки

      const response = await fetch('/api/uploadDatabase', {
      method: 'POST',
      body: formData,
      });
  
      const textResponse = await response.text(); // Получение текста ответа
  
      if (response.ok) {
        handleSnackbarOpen(`Файл базы данных ${file.name} загружен`);
        // Вызываем setSelectedDatabase с именем файла без расширения
        setSelectedDatabase(fileNameWithoutExtension);
      } else {
        // Отображение сообщения об ошибке от сервера
        handleSnackbarOpen(textResponse);
      }
    } catch (error) {
      handleSnackbarOpen('Ошибка при отправке файла');
      console.error('Ошибка при отправке файла:', error);
    } finally {
      //setDatabaseMenuAnchorE2(null); // Закрыть меню после отправки файла
      setIsLoading(false);
    }
  };
  
  // Функция для открытия диалога выбора файла
  const openDatabaseFileDialog = () => {
    document.getElementById('fileInput').click();
  };

  useEffect(() => {
    setLocalHeightFrom(heightFrom);
  }, [heightFrom]);

  useEffect(() => {
    setLocalHeightTo(heightTo);
  }, [heightTo]);

  // Функции для открытия и закрытия диалогового окна
  const handleHeightFilterClickOpen = () => {
    setHeightFilterDialogOpen(true);
  };

  const handleHeightFilterClose = () => {
    setHeightFilterDialogOpen(false);
  };

    // Функции для обновления локальных состояний
    const handleLocalHeightFromChange = (event) => {
      setLocalHeightFrom(event.target.value);
    };
  
    const handleLocalHeightToChange = (event) => {
      setLocalHeightTo(event.target.value);
    };
  
  // Функция применения фильтра
  const applyHeightFilter = () => {
    // Обновление глобального состояния или контекста с новыми значениями
    setHeightFilterFrom(localHeightFrom);
    setHeightFilterTo(localHeightTo);
     
    onHeightFilterActive(true);

    // Закрытие диалогового окна
    setHeightFilterDialogOpen(false);
  };

   const theme = useTheme();

  // Измените обработчик для кнопки
  const handleDataGridToggle = () => {
    onToggleDrawer();
  };

  const handleChartToggle = () => {
    onToggleChart();
  };

  useEffect(() => {
    // Загрузка списка полетов из API
    fetch('/api/flights')
      .then((response) => response.json())
      .then((data) => {
        setFlightOptions(data); // Сохраняем полученный массив полетов в состоянии
      })
      .catch((error) => {
        console.error('Ошибка при загрузке списка полетов:', error);
      });
  }, []);

  useEffect(() => {
    const newThresholds = calculateColorThresholds(minDoseValue, maxDoseValue);
    setCurrentColorThresholds(newThresholds);
    setMinDoseValueR(parseFloat(newThresholds.v0));
    setMaxDoseValueR(parseFloat(newThresholds.v3));
  }, [minDoseValue, maxDoseValue]);

  useEffect(() => {
    if (!selectedDatabase) return;
    fetch(`/api/collection/${selectedDatabase}`)
      .then(response => response.json())
      .then(data => {
      })
      .catch(error => {
        console.error('Ошибка при загрузке данных:', error);
      });
  }, [selectedDatabase]);

  useEffect(() => {
    //console.log('isLoadingFlight changed = ', isLoadingFlight);
   // if (!selectedCollection) return;
    setIsLoading(isLoadingFlight);
  }, [isLoadingFlight]);
 

  const fetchData = async () => {
    try {
      const response = await fetch('/api/flights');
      const data = await response.json();
      setFlightOptions(data);
    } catch (error) {
      console.error('Ошибка при загрузке списка полетов:', error);
    }
  };

  const fetchDataCollection = async () => {
    try {
      const response = await fetch(`/api/collection/${selectedDatabase}`)
      const data = await response.json();
      setCollectionOptions(data);
    } catch (error) {
      console.error('Ошибка при загрузке списка коллекций:', error);
    }
  };

  const handleDatabaseMenuClick = (event) => {
    // Обновляем список при каждом открытии меню
    fetchData();
    setDatabaseMenuAnchorE2(event.currentTarget);
  };

  const handleDatabaseMenuClose = () => {
    setDatabaseMenuAnchorE2(null);
  };

  const handleCollectionMenuClick = (event) => {
    // Обновляем список при каждом открытии меню
    fetchDataCollection();
    setDatabaseMenuAnchorCollection(event.currentTarget);
  };

  const handleCollectionMenuClose = () => {
    setDatabaseMenuAnchorCollection(null);
  };
 
  const handleFlightSelect = (dbName) => {
    setSelectedCollection(null); // Установим в null перед получением новых коллекций
    setSelectedDatabase(dbName);
    // Закрыть меню после выбора
    setDatabaseMenuAnchorE2(null);
  };

  const handleCollectionSelect = (value) => {
    setSelectedCollection(value);
    // Закрыть меню после выбора
    setDatabaseMenuAnchorCollection(null);
  };

  const handleUnitMenuClick = (event) => {
    setUnitMenuAnchorEl(event.currentTarget);
  };

  const handleUnitMenuClose = () => {
    setUnitMenuAnchorEl(null);
  };

  const handleSettingsMenuClick = (event) => {
    setSettingsMenuAnchorEl(event.currentTarget);
  };

  const handleSettingsMenuClose = () => {
    setSettingsMenuAnchorEl(null);
  };

  const handleColorLegendFilterClickOpen = () => {
    setColorLegendFilterDialogOpen(true);
  };

  const handleColorLegendFilterClose = () => {
    setColorLegendFilterDialogOpen(false);
  };

  const applyColorLegendFilter = () => {
    setColorThresholds( currentColorThresholds );
    setColorLegendFilterDialogOpen(false);
    onColorOverrideActive(true);
  };
  
  const onColorLegendFilterActive = (isActive) => {
  };
  
  const legendControlRef = useRef(null);

  const GradientLegend = ({ thresholds, minValue, maxValue }) => {
    const gradientStyle = {
      background: `linear-gradient(to top, ${createGradientT(thresholds, minValue, maxValue)})`,
      width: '20px',
      height: '234px',
      marginLeft: '10px',
    };
    return <div style={gradientStyle}></div>;
  };

  const handleSaveDatabase = async (databaseName) => {
    try {
      // Перед началом загрузки, установите isLoading в true
      setIsLoading(true);
      handleDatabaseMenuClose(); // Закрыть меню базы данных при начале скачивания
  
      const response = await fetch(`/api/downloadDatabase/${databaseName}`, {
        method: 'GET',
      });
      if (!response.ok) {
        throw new Error('Произошла ошибка при скачивании базы данных');
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${databaseName}.sqlite`; // или другой формат, если необходим
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
  
      // После завершения загрузки, установите isLoading в false
      setIsLoading(false);
  
      handleSnackbarOpen('База данных успешно скачана:', databaseName);
      console.log('База данных успешно скачана:', databaseName);
    } catch (error) {
      // При ошибке также установите isLoading в false
      setIsLoading(false);
  
      handleSnackbarOpen('Ошибка при скачивании базы данных:', databaseName, error);
      console.error('Ошибка при скачивании базы данных:', databaseName, error);
      // Обработка ошибки (например, отображение уведомления пользователю)
    }
  };
const handleCloseConfirmDialog = () => {
  setOpenConfirmDialog(false);
};

const handleDeleteDatabase = async () => {
  try {
      handleDatabaseMenuClose(); // Закрыть меню базы данных при начале удаления
      const response = await fetch(`/api/deleteDatabase/${databaseToDelete}`, {
          method: 'DELETE',
      });
      const textResponse = await response.text(); // Получение текста ответа

      if (response.ok) {
          handleSnackbarOpen(`База данных '${databaseToDelete}' успешно удалена.`);
      } else {
          // Отображение сообщения об ошибке от сервера
          handleSnackbarOpen(textResponse);
      }
  } catch (error) {
      handleSnackbarOpen('Ошибка при удалении файла');
      console.error('Ошибка при удалении файла:', error);
  } finally {
      //setDatabaseMenuAnchorE2(null); // Закрыть меню после отправки файла
      handleCloseConfirmDialog(); // Закрыть диалог подтверждения
  }
};

// Состояние для отслеживания текущего ввода в Autocomplete
const [dbInputValue, setDbInputValue] = useState('');

const handleInputChange = (event, newInputValue) => {
  setDbInputValue(newInputValue);
};

// Функция проверки валидности введенных данных
const isStartFlightButtonDisabled = () => {
  // Обеспечиваем, что переменные будут строками перед использованием trim()
  const isDBSelectedOrInputValid = dbInputValue?.trim() || '';
  const isFlightNameValid = onlineFlightName?.trim() || '';
  const isWinLowValid = !isNaN(winLowValue) && parseInt(winLowValue, 10) > 0;
  const isWinHighValid = !isNaN(winHighValue) && parseInt(winHighValue, 10) > 0;
  const isWindowRangeValid = isWinLowValid && isWinHighValid && parseInt(winLowValue, 10) < parseInt(winHighValue, 10);

  return !isDBSelectedOrInputValid || !isFlightNameValid || !isWindowRangeValid;
};


const [settings, setSettings] = useState({}); // Для хранения настроек из config.json

  // Функция для загрузки настроек при открытии диалога
  const fetchSettings = () => {
    setIsSettingsLoading(true); // Начало загрузки
    fetch('/api/settings')
      .then(response => response.json())
      .then(data => {
        setSettings(data);
        console.log('Настройки загружены:', data);
        // Инициализация состояний формы значениями из настроек
        setWinLowValue(data.winLow);
        setWinHighValue(data.winHigh);
        // Добавьте инициализацию остальных состояний здесь
      })
      .catch(error => console.error('Ошибка при получении настроек:', error))
      .finally(() => setIsSettingsLoading(false)); // Загрузка завершена
  };

  // Функция для обновления настроек
  const updateSettings = () => {
    const updatedSettings = {
      ...settings,
      NSPCHANNELS: parseInt(settings.NSPCHANNELS), // Преобразование в целое число 
      SPECDEFTIME: parseInt(settings.SPECDEFTIME), // Преобразование в целое число
      winLow: parseInt(settings.winLow), // Преобразование в целое число
      winHigh: parseInt(settings.winHigh), // Преобразование в целое число
      MAX_ALLOWED_HEIGHT: settings.MAX_ALLOWED_HEIGHT, // Преобразование в целое число
      flightsDirectory: settings.flightsDirectory, // Строка остается строкой
      latInit: parseFloat(settings.latInit), // Преобразование в число с плавающей запятой
      lonInit: parseFloat(settings.lonInit), // Преобразование в число с плавающей запятой
      altInit: parseInt(settings.altInit), // Преобразование в целое число
      coeffs_below_550: settings.coeffs_below_550, // Массив остается массивом
      coeffs_above_550: settings.coeffs_above_550, // Массив остается массивом
      gm1Coeff: parseFloat(settings.gm1Coeff), // Преобразование в число с плавающей запятой
      gm2Coeff: parseFloat(settings.gm2Coeff), // Преобразование в число с плавающей запятой
      winCoeff: parseFloat(settings.winCoeff) // Преобразование в число с плавающей запятой
    };
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedSettings),
    })
    .then(response => response.text())
    .then(result => {
      console.log('Настройки обновлены:', result);
      setGlobalSettings(updatedSettings); // Обновим глобальные настройки здесь
    })
    .catch(error => console.error('Ошибка при обновлении настроек:', error));
  };

  return (
    <AppBar position="static" sx={{ height: '64px' }}>
        <Toolbar >
        <IconButton
          color="inherit"
          onClick={handleDatabaseMenuClick}
          disabled={onlineFlightId !== null} // Блокировка кнопки при активном онлайн-полете
        >
          <Tooltip title="База данных">
            {/* Маппинг массива полетов в элементы меню */}
            <DatabaseIcon style={{fill: onlineFlightId?"lightgray":"white", width: 24, height: 24 }} />
          </Tooltip>
        </IconButton>
        <Menu
          anchorEl={filterMenuAnchorE2}
          open={Boolean(filterMenuAnchorE2)}
          onClose={handleDatabaseMenuClose}
          MenuListProps={{
            subheader: <ListSubheader>База данных</ListSubheader>,
          }}
        >
          {flightOptions.map((flight, index) => (
            <MenuItem key={index} style={{ padding: 0 }}>
              {/* Обертка для контента пункта меню */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '3px 16px' }} onClick={() => handleFlightSelect(flight)}>
                {/* Название полета */}
                <span style={{ flexGrow: 1, cursor: 'pointer', display: 'flex', alignItems: 'center' }}> {/* добавлено display: 'flex', alignItems: 'center' для центрирования текста */}
                  {flight}
                </span>
                {/* Контейнер для иконок */}
                <div style={{ display: 'flex', alignItems: 'center', marginLeft: '8px' }}> {/* добавлено marginRight: '8px' для отступа справа */}
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation(); // предотвращаем всплытие события клика к родительскому элементу
                      handleSaveDatabase(flight);
                    }}
                  >
                    <Tooltip title="Сохранить базу данных">
                      <DownloadIcon style={{ fill: theme.palette.primary.main, width: 20, height: 20 }} />
                    </Tooltip>
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation(); // предотвращаем всплытие события клика к родительскому элементу
                      handleOpenDeleteDialog(flight);
                    }}
                  >
                    <Tooltip title="Удалить базу данных">
                      <EraserIcon style={{ fill: theme.palette.primary.main, width: 20, height: 20 }} />
                    </Tooltip>
                  </IconButton>
                </div>
              </div>
            </MenuItem>
          ))}
          <Divider />
          <MenuItem onClick={openDatabaseFileDialog}>
            Загрузить другую базу данных
          </MenuItem>
          <input
            type="file"
            id="fileInput"
            style={{ display: 'none' }}
            onChange={handleDatabaseFileChange}
            accept=".sqlite,.db"
          />
        </Menu>

        <IconButton
          color="inherit"
          onClick={handleCollectionMenuClick}
        >
          <Tooltip title="Открыть полёт">
            <PlaneIcon style={{ fill: "white", width: 24, height: 24 }} />
          </Tooltip>
        </IconButton>

        <Menu
          anchorEl={filterMenuAnchorCollection} 
          open={Boolean(filterMenuAnchorCollection)}
          onClose={handleCollectionMenuClose}
          MenuListProps={{
            subheader: <ListSubheader>Полет</ListSubheader>,
          }}
        >
          {/* Маппинг массива коллекций в элементы меню */}
          {collectionOptions.map((collection, index) => (
            <MenuItem       
            key={collection._id} 
            onClick={() => handleCollectionSelect(collection)}
            disabled={onlineFlightId !== null} // Блокировка выбора коллекции при активном онлайн-полете
          >
              {collection.description} 
            </MenuItem>
          ))}
          <Divider />
          <MenuItem onClick={handleStartFlightDialogOpen} disabled={onlineFlightId !== null}>Начать онлайн-полет</MenuItem>

          <MenuItem onClick={handleStopFlight} disabled={onlineFlightId === null}> Остановить онлайн-полет</MenuItem>
        </Menu>
 
        <div style={{
          backgroundColor: drawerOpen ? "white" : "transparent",
          borderRadius: '50%',
          padding: '0px',  
        }}>
          <IconButton color="inherit" onClick={handleDataGridToggle}>
            <Tooltip title="Таблица измерений">
              <AnalyticsIcon style={{ fill: drawerOpen ? theme.palette.primary.main : "white", width: 24, height: 24 }} />
            </Tooltip>
          </IconButton>
        </div>

        <div style={{
          backgroundColor: chartOpen ? "white" : "transparent",
          borderRadius: '50%',
          padding: '0px',  
        }}>
          <IconButton color="inherit" onClick={handleChartToggle}>
            <Tooltip title="Спектр">
              <ChartIcon style={{ fill: chartOpen ? theme.palette.primary.main : "white", width: 24, height: 24 }} />
            </Tooltip>
          </IconButton>
        </div>

        <div style={{
          backgroundColor: threeDActive ? "white" : "transparent",
          borderRadius: '50%',
          padding: '0px',  
        }}>
          <IconButton color="inherit" onClick={handleThreeDToggle}>
            <Tooltip title="Трехмерная модель">
              <CubeIcon style={{ fill: threeDActive ? theme.palette.primary.main : "white", width: 24, height: 24 }} />
            </Tooltip>
          </IconButton>
        </div>       


        <IconButton color="inherit" onClick={handleSettingsDialogOpen}>
          <Tooltip title="Настройки">
            <CogIcon style={{ fill: settingsOpen ? theme.palette.primary.main : "white", width: 24, height: 24 }} />
          </Tooltip>
        </IconButton>

        <Dialog open={settingsDialogOpen} onClose={handleSettingsDialogClose} aria-labelledby="settings-dialog-title">
  <DialogTitle id="settings-dialog-title">Настройки</DialogTitle>
  {isSettingsLoading ? (
    <DialogContent>
      <CircularProgress />
    </DialogContent>
  ) : (
    <DialogContent>
            <TextField
      margin="dense"
      id="NSPCHANNELS"
      label="Количество спектральных каналов"
      type="number"
      fullWidth
      size = "small"
      variant="outlined"
      value={settings.NSPCHANNELS}
      onChange={(e) => setSettings({...settings, NSPCHANNELS: e.target.value})}
    />
    <TextField
      margin="dense"
      id="SPECDEFTIME"
      label="Частота (скважность) измерений, с"
      type="number"
      fullWidth
      size = "small"
      variant="outlined"
      value={settings.SPECDEFTIME}
      onChange={(e) => setSettings({...settings, SPECDEFTIME: e.target.value})}
    />
    <TextField
      margin="dense"
      id="winLow"
      label="Нижняя граница окна"
      type="number"
      fullWidth
      size = "small"
      variant="outlined"
      value={settings.winLow}
      onChange={(e) => setSettings({...settings, winLow: e.target.value})}
    />
    <TextField
      margin="dense"
      id="winHigh"
      label="Верхняя граница окна"
      type="number"
      fullWidth
      size = "small"
      variant="outlined"
      value={settings.winHigh}
      onChange={(e) => setSettings({...settings, winHigh: e.target.value})}
    />
    <TextField
      margin="dense"
      id="MAX_ALLOWED_HEIGHT"
      label="Максимально допустимая высота"
      type="number"
      fullWidth
      size = "small"
      variant="outlined"
      value={settings.MAX_ALLOWED_HEIGHT}
      onChange={(e) => setSettings({...settings, MAX_ALLOWED_HEIGHT: e.target.value})}
    />
    <TextField
      margin="dense"
      id="flightsDirectory"
      label="Каталог файлов полетов"
      fullWidth
      size = "small"
      variant="outlined"
      value={settings.flightsDirectory}
      onChange={(e) => setSettings({...settings, flightsDirectory: e.target.value})}
    />
    <TextField
      margin="dense"
      id="latInit"
      label="Исходная широта"
      type="number"
      fullWidth
      size = "small"
      variant="outlined"
      value={settings.latInit}
      onChange={(e) => setSettings({...settings, latInit: e.target.value})}
    />
    <TextField
      margin="dense"
      id="lonInit"
      label="Исходная долгота"
      type="number"
      fullWidth
      size = "small"
      variant="outlined"
      value={settings.lonInit}
      onChange={(e) => setSettings({...settings, lonInit: e.target.value})}
    />
    <TextField
      margin="dense"
      id="altInit"
      label="Исходная высота"
      type="number"
      fullWidth
      size = "small"
      variant="outlined"
      value={settings.altInit}
      onChange={(e) => setSettings({...settings, altInit: e.target.value})}
    />
      <TextField
        margin="dense"
        id="gm1Coeff"
        label="Коэффициент пересчета ГМ1"
        type="number"
        fullWidth
        size="small"
        variant="outlined"
        value={settings.gm1Coeff}
        onChange={(e) => setSettings({...settings, gm1Coeff: e.target.value})}
      />

      <TextField
        margin="dense"
        id="gm2Coeff"
        label="Коэффициент пересчета ГМ2"
        type="number"
        fullWidth
        size="small"
        variant="outlined"
        value={settings.gm2Coeff}
        onChange={(e) => setSettings({...settings, gm2Coeff: e.target.value})}
      />

      <TextField
        margin="dense"
        id="winCoeff"
        label="Коэффициент пересчета Cs (1 окно)"
        type="number"
        fullWidth
        size="small"
        variant="outlined"
        value={settings.winCoeff}
        onChange={(e) => setSettings({...settings, winCoeff: e.target.value})}
      />
    {/* Для массивов можно использовать сериализацию в JSON или отдельные поля */}
    <div>
      <div>Коэффициенты полинома для уровня энергии менее 550 кэВ</div>
      {settings.coeffs_below_550 && settings.coeffs_below_550.map((coeff, index) => (
        <TextField
          key={`coeff-below-${index}`}
          margin="dense"
          id={`coeff-below-${index}`}
          label={`Коэфф ${index + 1} (<= 550 кэВ)`}
          fullWidth
          size = "small"
          variant="outlined"
          value={coeff}
          onChange={(e) => handleCoeffChange(e.target.value, index, 'coeffs_below_550')}
        />
      ))}
    </div>
    <div>
      <div>Коэффициенты полинома для уровня энергии более 550 кэВ</div>
      
      {settings.coeffs_above_550 && settings.coeffs_above_550.map((coeff, index) => (
        <TextField
          key={`coeff-above-${index}`}
          margin="dense"
          id={`coeff-above-${index}`}
          label={`Коэфф ${index + 1} (> 550 кэВ)`}
          fullWidth
          size = "small"
          variant="outlined"
          value={coeff}
          onChange={(e) => handleCoeffChange(e.target.value, index, 'coeffs_above_550')}
        />
      ))}
    </div>
    </DialogContent>
  )}
  <DialogActions>
    <Button onClick={handleSettingsDialogClose}>Отмена</Button>
    <Button onClick={() => handleSaveSettings(settings)} disabled={isSettingsLoading}>Сохранить</Button>
  </DialogActions>
</Dialog>

        <IconButton
          color="inherit"
          onClick={saveMapAsImage}
        >
          <Tooltip title="Сохранить экран карты">
            <CameraIcon style={{ fill: "white", width: 24, height: 24 }} />
          </Tooltip>
        </IconButton>

        <IconButton
          color="inherit"
          onClick={saveDataToFile}
        >
          <Tooltip title="Сохранить данные">
            <DownloadIcon style={{ fill: "white", width: 24, height: 24 }} />
          </Tooltip>
        </IconButton>

        <div style={{ flexGrow: 1, display: 'flex', justifyContent: 'flex-end' }}>
          {selectedCollection ? (
            <div style={{ color: 'white', fontSize: 'small' }}>
              {simulationData && <><span>{simulationData}</span><span> | </span></>}
              <span>{selectedDatabase ? selectedDatabase : ''} | </span>
              <span>{selectedCollection?.description} | </span>
              <span>{convertDateTime(selectedCollection?.dateTime)} </span>
{/*               <span>P0: {selectedCollection?.P0} | </span>
              <span>P1: {selectedCollection?.P1}</span>    */}     
            </div>
          ) : (
            <div style={{ color: 'white', fontSize: 'small' }}>
              Выберите базу данных
            </div>
          )}
          
          {isLoading && (
            <Backdrop sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }} open={isLoading}>
              <CircularProgress color="inherit" />
            </Backdrop>
          )}
        </div>

    </Toolbar>
    <Snackbar
      open={snackbarOpen}
      autoHideDuration={6000}
      onClose={handleSnackbarClose}
      message={snackbarMessage}
    />
    <Dialog
      open={deleteDialogOpen}
      onClose={handleCloseDeleteDialog}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">{"Удалить базу данных?"}</DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description">
          Вы уверены, что хотите удалить базу данных "{databaseToDelete}" с сервера?
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCloseDeleteDialog} color="primary">
          Нет
        </Button>
        <Button onClick={handleConfirmDelete} color="primary" autoFocus>
          Да
        </Button>
      </DialogActions>
    </Dialog>

    <Dialog open={startFlightDialogOpen} onClose={handleStartFlightDialogClose}>
      <DialogTitle>Начать онлайн-полет</DialogTitle>
      <DialogContent>
        <Autocomplete
          value={selectedOnlineDB}
          onChange={(event, newValue) => {
            setSelectedOnlineDB(newValue);
            setDbInputValue(newValue); // Обновляем dbInputValue при выборе из списка
          }}
          onInputChange={handleInputChange}
          freeSolo
          autoSelect
          options={flightOptions}
          renderInput={(params) => (
            <TextField {...params} label="Выберите или введите имя БД" margin="normal" />
          )}
        />      
        <TextField
          autoFocus
          margin="dense"
          id="name"
          label="Название полета"
          fullWidth
          variant="outlined"
          value={onlineFlightName}
          onChange={handleOnlineCollectionNameChange}
        />
        <Grid container spacing={2}>  
          <Grid item xs={6}>
            <TextField
              margin="dense"
              id="winLow"
              label="Нижняя граница окна"
              fullWidth
              variant="outlined"
              value={winLowValue}
              onChange={handleWinLowChange}
              type="number"
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              margin="dense"
              id="winHigh"
              label="Верхняя граница окна"
              fullWidth
              variant="outlined"
              value={winHighValue}
              onChange={handleWinHighChange}
              type="number"
            />
          </Grid>
        </Grid>
        <FormControlLabel
          control={<Checkbox checked={isDemoMode} onChange={handleDemoModeChange} disabled />}
          label="Демо-режим"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleStartFlightDialogClose}>Отмена</Button>
        <Button onClick={handleStartFlight} disabled={isStartFlightButtonDisabled()}>Начать полет</Button>
      </DialogActions>
    </Dialog>
    </AppBar>
         
  );
}

export default CustomToolbar;