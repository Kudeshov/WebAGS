import React, { useState, useEffect, useContext, useCallback} from 'react';
import { ReactComponent as PlaneIcon } from './icons/plane.svg';
import { ReactComponent as AnalyticsIcon } from './icons/table.svg';
import { ReactComponent as ChartIcon } from './icons/chart-bar.svg';
import { ReactComponent as SignalIcon } from './icons/signal.svg';
import { ReactComponent as DatabaseIcon } from './icons/database.svg';
import { ReactComponent as CubeIcon } from './icons/cube.svg';
import { ReactComponent as CameraIcon } from './icons/camera.svg';
import { ReactComponent as DownloadIcon } from './icons/download.svg';
import { ReactComponent as EraserIcon } from './icons/trash.svg';
import { ReactComponent as CogIcon } from './icons/cog.svg';
import { ReactComponent as RadiationIcon } from './icons/radiation.svg';
import { ReactComponent as SensorAlertIcon } from './icons/sensor-alert.svg'; // Иконка для перезагрузки датчика
import { ReactComponent as SensorOnIcon } from './icons/sensor-on.svg'; // Иконка для установки нулевого уровня высоты
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import { FormControl, InputLabel, Select, AppBar, Grid, Toolbar, IconButton, Menu, MenuItem, ListSubheader, Dialog, DialogTitle, 
         Autocomplete, DialogContent, DialogContentText, DialogActions, FormControlLabel, TextField, Button, Checkbox, Tab, Tabs, Box  } from '@mui/material';
import { FlightDataContext } from './FlightDataContext';
import Snackbar from '@mui/material/Snackbar';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import Backdrop from '@mui/material/Backdrop';
import { convertDateTimeWithoutSeconds, convertDateTime, convertToTime } from './dateUtils';
import SpectrumChartDialog from './SpectrumChartDialog';
import SourceSearchDialog from './SourceSearchDialog'; 


const CustomToolbar = ({ onToggleDrawer, drawerOpen, onToggleChart, chartOpen, onHeightFilterActive, heightFilterActive,
    handleThreeDToggle, threeDActive, settingsOpen,}) => {

  const { selectedCollection, setSelectedCollection } = useContext(FlightDataContext);
  const { selectedDatabase, setSelectedDatabase } = useContext(FlightDataContext);
  const { onlineMeasurements, setOnlineMeasurements } = useContext(FlightDataContext);
  const { setDatabaseName} = useContext(FlightDataContext);
  
  const [filterMenuAnchorE2, setDatabaseMenuAnchorE2] = useState(null);
  const [filterMenuAnchorCollection, setDatabaseMenuAnchorCollection] = useState(null);

  const [flightOptions, setFlightOptions] = useState([]);
  const [collectionOptions, setCollectionOptions] = useState([]);
  const {validMeasurements, setValidMeasurements } = useContext(FlightDataContext);
  const {measurements, setMeasurements } = useContext(FlightDataContext);
  const [selectedOnlineDB, setSelectedOnlineDB] = useState(null);
  
  const { globalSettings, setGlobalSettings } = useContext(FlightDataContext);
  const { selectedPoints } = useContext(FlightDataContext);
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
  const {isotopes, setIsotopes} = useContext(FlightDataContext); // Состояние для хранения массива нуклидов
  const [websocket, setWebsocket] = useState(null);
  const [dataToShow, setDataToShow] = useState('');
  const [isSettingsLoading, setIsSettingsLoading] = useState(false);

  const [websocketConnected, setWebsocketConnected] = useState(false);
  const [lastDataTimestamp, setLastDataTimestamp] = useState(Date.now());
  const [spectrumDialogOpen, setSpectrumDialogOpen] = useState(false);

  const [spectrumData, setSpectrumData] = useState([]);
  const [averageHeight, setAverageHeight] = useState(0);
  const [timeInterval, setTimeInterval] = useState(0);

  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [messageToSend, setMessageToSend] = useState('');


  const handleOpenConfirmation = (message) => {
    setMessageToSend(message);
    setConfirmationOpen(true);
  };

  const handleCloseConfirmation = () => {
    setConfirmationOpen(false);
  };

  const handleSendMessage = () => {
    fetch('/api/sendToComPort', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: messageToSend }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          setSnackbarMessage(`Команда "${messageToSend}" успешно отправлена.`);
        } else {
          setSnackbarMessage(`Ошибка при отправке команды "${messageToSend}".`);
        }
        setSnackbarOpen(true); // Открываем Snackbar с сообщением
      })
      .catch((error) => {
        setSnackbarMessage(`Ошибка: ${error.message}`);
        setSnackbarOpen(true); // Открываем Snackbar с сообщением
        console.error('Ошибка:', error);
      });

    handleCloseConfirmation();
  };

  const [sourceSearchDialogOpen, setSourceSearchDialogOpen] = useState(false);
  const handleOpenSourceSearchDialog = () => {
    //console.log('Диалог выбора');
    setSourceSearchDialogOpen(true);
  };
  const handleCloseSourceSearchDialog = () => {
    setSourceSearchDialogOpen(false);
  };    

  // Calculate average spectrum data and height
  const calculateAverageSpectrum = useCallback((selectedPoints) => {
    if (selectedPoints.length === 0 || !selectedCollection) {
      return [];
    }
  
    const { P0 = 70, P1 = 11 } = selectedCollection || {};
  
    const sumSpectrum = Array(selectedPoints[0]?.spectrum?.channels.length || 0).fill(0);
  
    selectedPoints.forEach(point => {
      point.spectrum.channels.forEach((value, index) => {
        sumSpectrum[index] += value;
      });
    });
  
    const avgSpectrum = sumSpectrum.map((value, index) => ({
      energy: P0 + P1 * index,
      value: value / selectedPoints.length,
      count: value
    }));
  
    return avgSpectrum;
  }, [selectedCollection]);
  

  useEffect(() => {
    // Определяем массив данных для расчета: либо selectedPoints, либо validMeasurements
    const pointsToUse = (selectedPoints && selectedPoints.length > 0) ? selectedPoints : (validMeasurements || []);
    
    if (pointsToUse.length > 0 && selectedCollection) {
        // Рассчитываем среднюю высоту
        const totalHeight = pointsToUse.reduce((acc, point) => acc + point.height, 0);
        setAverageHeight(totalHeight / pointsToUse.length);

        // Рассчитываем интервал времени
        const times = pointsToUse.map(point => new Date(point.datetime).getTime());
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);
        setTimeInterval((maxTime - minTime) / 1000);

        // Проверяем, есть ли спектр у первой выбранной точки и содержит ли он массив каналов
        const hasSpectrumChannels = pointsToUse[0].spectrum && Array.isArray(pointsToUse[0].spectrum.channels);
        
        // Если нет спектра или каналов, возвращаем пустой массив
        if (!hasSpectrumChannels) {
            setSpectrumData([]);
        } else {
            const avgSpectrumData = calculateAverageSpectrum(pointsToUse);
            setSpectrumData(avgSpectrumData);
        }
    } else {
        setSpectrumData([]);
    }
}, [selectedPoints, validMeasurements, calculateAverageSpectrum, selectedCollection]);
  

  // Проверка на отсутствие данных в течение заданного времени (например, 30 секунд)
  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() - lastDataTimestamp > 30000) { // 30 секунд
        // Если данных нет более 30 секунд
        if (websocketConnected) {
          // Соединение есть, но данных нет
          setSnackbarMessage('Отсутствуют данные более 30 секунд');
        }
      }
    }, 10000); // Проверяем каждые 10 секунд

    return () => clearInterval(interval);
  }, [lastDataTimestamp, websocketConnected]);

  // Индикатор в тулбаре
  const OnlineIndicator = () => {
    let color = 'red'; // Отсутствие соединения
    let message = 'Соединение отсутствует';

    if (websocketConnected) {
      color = 'lightgreen';
      message = 'Онлайн-полет активен';
    }

    if (Date.now() - lastDataTimestamp > 30000) { // 30 секунд без данных
      color = 'yellow';
      message = 'Отсутствуют данные более 30 секунд';
    }

    return (
      <span style={{ marginLeft: '70px' }}>
        <div style={{ display: 'flex', alignItems: 'center', color}}>
        {onlineFlightId && 
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <PlaneIcon style={{fill: "white", width: 24, height: 24 }} />   
            <span style={{ marginLeft: '10px' }}>{message}</span>
          </div>
          }
        </div>
      </span>
  );
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


  let type2Data = {
    sats: 'N/A',
    pressure: 'N/A',
    temperature: 'N/A',
  };

  const setupWebSocket = (onlineFlightId, globalSettings) => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = process.env.REACT_APP_WEBSOCKET_HOST || window.location.host;
    console.log(wsProtocol, wsHost);
  
    let ws = new WebSocket(`${wsProtocol}//${wsHost}`);
  
    const connectWebSocket = () => {
      // Установка обработчиков событий WebSocket
      ws.onopen = () => {
        console.log('WebSocket соединение установлено');
        setLastDataTimestamp(Date.now());
        setWebsocketConnected(true);
      };
  
      console.log('Установка обработчика ws.onmessage');
      ws.onmessage = (event) => {
        console.log(event.data);
        const dataCheck = JSON.parse(event.data);
        console.log('dataCheck', dataCheck.type, dataCheck);
  
        // Обработка посылок второго типа
        if (dataCheck.type === 2) {
          type2Data = {
            sats: dataCheck.sats ? dataCheck.sats : 'N/A',
            pressure: dataCheck.pressure ? Number(dataCheck.pressure).toFixed(2) : 'N/A',
            temperature: dataCheck.temperature ? Number(dataCheck.temperature).toFixed(2) : 'N/A',
          };

          //console.log('updatedType2Data', updatedType2Data);
          //setType2Data(updatedType2Data);
          return; // Завершаем выполнение функции, чтобы не обрабатывать данные дальше
        } 
  
        const data = JSON.parse(event.data);
        
        setWebsocketConnected(true);
        
        // Проверка на сообщение о завершении полета
        if (data.type && data.type === 'flightEnded') {
          console.log('Полет завершен:', data.flightId);
          setSnackbarMessage('Полет завершен в штатном режиме');
          setSnackbarOpen(true); // Открываем Snackbar с сообщением
          setOnlineFlightId(null); // Сброс ID симуляции
          setDataToShow('');
          if (websocket) {
            websocket.close(); // Закрытие WebSocket соединения
            setWebsocket(null);
          }
          return; // Завершаем выполнение функции, чтобы не обрабатывать данные дальше
        } 
  
        setLastDataTimestamp(Date.now());
  
        setOnlineMeasurements(currentMeasurements => {
          // Проверяем, что широта и долгота существуют и не равны null
          if (data.lat != null && data.lon != null) {
            const isDuplicate = currentMeasurements.some(item => item.id === data.id);
            if (!isDuplicate) {
              // Если элемент уникален, добавляем его в массив
              return [...currentMeasurements, data];
            } else {
              return currentMeasurements;
            }
          } else {
            // Если условие не выполняется, возвращаем текущее состояние без изменений
            return currentMeasurements;
          }
        });
  
        // Обновляем строку информации, включая данные из посылок обоих типов
        setDataToShow(`Время: ${convertToTime(data.datetime)}, Широта: ${Number(data.lat)>0 ? Number(data.lat).toFixed(6) : 'N/A'}, ` +
                      `Долгота: ${Number(data.lon)>0 ? Number(data.lon).toFixed(6) : 'N/A'}, ` +
                      `Высота: ${data.alt ? Number(data.alt).toFixed(2) : '0.00'}, ` +
                      `Счет в окне: ${data.countw ? data.countw : '0'}, ` +
                      `Спутники: ${type2Data.sats}, Давление: ${type2Data.pressure}, Температура: ${type2Data.temperature}`);
      };
  
      ws.onerror = (error) => {
        console.error('Ошибка WebSocket:', error);
        console.log(error.message);
      };
  
      ws.onclose = () => {
        setWebsocketConnected(false);
        console.log('WebSocket соединение закрыто');
        setTimeout(() => {
          console.log('Попытка переподключения...');
          const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const wsHost = process.env.REACT_APP_WEBSOCKET_HOST || window.location.host;
          console.log(wsProtocol, wsHost);
          ws = new WebSocket(`${wsProtocol}//${wsHost}`);
          connectWebSocket(); // Попытка переподключения
        }, 1000); // Переподключение через 1 секунду
      };
    };
  
    connectWebSocket(); // Первоначальное подключение
    setWebsocket(ws);
  };
  

  useEffect(() => {
    setMeasurements(onlineMeasurements);
    //console.log('onlineMeasurements', onlineMeasurements);
  }, [onlineMeasurements, setMeasurements, setValidMeasurements]);

  useEffect(() => {
    return () => {
        if (websocket) {
            websocket.close();
        }
    };
  }, [websocket]);

  const handleStartFlight = () => {
    setOnlineMeasurements([]); // Очищаем предыдущие измерения
    const url = isDemoMode ? '/start-flight-simulation' : '/start-flight';

    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dbName: selectedOnlineDB,
        flightName: onlineFlightName,
        winLow: winLowValue,
        winHigh: winHighValue,
      })
    })
    .then(async response => {
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        return { status: response.status, body: data };
      } catch (error) {
        throw Error(text || "Произошла ошибка на сервере");
      }
    })
    .then(({ status, body }) => {
      if (status >= 400) {
        throw Error(body.message || "Произошла ошибка на сервере");
      }
      // Обрабатываем успешный ответ
      console.log('Полет запущен:', selectedOnlineDB);
      setMeasurements([]);
      setOnlineFlightId(body._id); // Сохраняем ID запущенного полета
      setSelectedDatabase(selectedOnlineDB);
      setSelectedCollection(body.onlineFlightStatus); 

      console.log("setupWebSocket из HandleStartFlight");
      setupWebSocket(body.onlineFlightStatus._id, globalSettings); // Установка WebSocket соединения

      setSnackbarOpen(true);
      setSnackbarMessage(isDemoMode ? 'Эмуляция полета запущена' : 'Полет запущен');
    })
    .catch(error => {
      // Обработка ошибок, включая некорректный JSON или ошибки сети
      console.error('Ошибка при выполнении запроса:', error.message);
      setSnackbarOpen(true);
      setSnackbarMessage(error.message);
    })
    .finally(() => {
      handleStartFlightDialogClose();
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
          setupWebSocket(statusData._id, globalSettings);
        } else {
          //console.log('Онлайн-полет не активен');
        }
      } catch (error) {
        console.error('Ошибка при запросе статуса онлайн-полета:', error);
      }
    };
  
    // Выполнение функции проверки статуса онлайн-полета при инициализации
    checkOnlineFlightStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Пустой массив зависимостей означает, что эффект выполнится один раз при монтировании компонента
 

  const handleStopFlight = () => {
    if (!onlineFlightId) {
      console.error('Ошибка: ID симуляции отсутствует');
      return;
    }
  
    fetch('/stop-flight', {
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
        setDataToShow('');
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
        setDataToShow('');
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
      setDataToShow('');
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
  const handleSaveSettings = (settings) => {
    if (!areAllCoeffsValid(settings)) {
      alert('Один или несколько коэффициентов имеют неверный формат.');
      return;
    }

    const updatedSettings = {
      ...settings,
      coeffs_below_550: convertCoeffsToNumbers(settings.coeffs_below_550),
      coeffs_above_550: convertCoeffsToNumbers(settings.coeffs_above_550),
      // Продолжить с остальными полями по аналогии
    };

    updateSettings(updatedSettings);
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
        console.log('3',fileNameWithoutExtension);
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

  useEffect(() => {
    if ( chartOpen && selectedCollection?.is_online)
      onToggleChart();
  }, [selectedCollection?.is_online]);
  
 

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
    setDatabaseName(dbName);
    setSelectedDatabase(dbName);
    // Закрыть меню после выбора
    setDatabaseMenuAnchorE2(null);
  };

  const handleCollectionSelect = (value) => {
    setSelectedCollection(value);
    // Закрыть меню после выбора
    setDatabaseMenuAnchorCollection(null);
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

    const [deleteFlightDialogOpen, setDeleteFlightDialogOpen] = useState(false);
    const [flightToDelete, setFlightToDelete] = useState({});
    const [selectedOption, setSelectedOption] = useState();

    // Функция для открытия диалога удаления
    const handleOpenDeleteFlightDialog = (id) => {
      const selectedMenuOption = collectionOptions.find(option => option._id === id);

      setSelectedOption(selectedMenuOption);
      setFlightToDelete(id);
      
      setDeleteFlightDialogOpen(true);
    };

    // Функция для закрытия диалога удаления
    const handleCloseDeleteFlightDialog = () => {
      setDeleteFlightDialogOpen(false);
    };

    // Функция для подтверждения удаления полета
    const handleConfirmDeleteFlight = async () => {
      try {
        handleCollectionMenuClose();
        // Предполагая, что flightToDelete содержит поле id с идентификатором полета
        const _id = flightToDelete;
        const response = await fetch(`/delete-flight/${selectedDatabase}/${_id}`, {
          
          method: 'DELETE',
        });
    
        if (!response.ok) {
          throw new Error('Проблема с удалением полета. Статус: ' + response.status);
        }
    
        const result = await response.json();
        console.log(result.message); // Показываем сообщение об успешном удалении
        
        // После успешного удаления закрываем диалог и, возможно, обновляем список полетов в UI
        setDeleteFlightDialogOpen(false);
        // Здесь можете добавить вызов функции для обновления списка полетов, если есть
    
      } catch (error) {
        console.error('Ошибка при удалении полета:', error);
        // Здесь можете обработать ошибку, например, показать уведомление пользователю
      }
    }

    const [flightSettingsDialogOpen, setFlightSettingsDialogOpen] = useState(false);

    const handleP0Change = (e) => {
      const updatedValue = e.target.value;
      setSelectedOption((prevOption) => ({
        ...prevOption,
        P0: updatedValue
      }));
    };

    const handleP1Change = (e) => {
      const updatedValue = e.target.value;
      setSelectedOption((prevOption) => ({
        ...prevOption,
        P1: updatedValue
      }));
    };

    
    const handleOpenFlightSettingsDialog = (id) => {
      const selectedMenuOption = collectionOptions.find(option => option._id === id);
      setSelectedOption(selectedMenuOption);
      //setFlightToDelete(id);
      setFlightSettingsDialogOpen(true);
    };

    const handleOpenSpectrumDialog = () => {
      setSpectrumDialogOpen(true);
    };
  
    // Function to handle closing the spectrum dialog
    const handleCloseSpectrumDialog = () => {
      setSpectrumDialogOpen(false);
    };

    async function saveCollectionParams(dbName, opt) {
      try {
        const payload = {
          dbName,
          collectionId: opt._id,  
          P0: opt.P0,
          P1: opt.P1,
        };
    
        const response = await fetch('/save_collection_params', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload), // Используем переменную payload для ясности
        });
    
        if (!response.ok) {
          throw new Error('Failed to save collection parameters');
        }
    
        const responseBody = await response.text();
        console.log(responseBody);
        return { success: true, message: responseBody };
      } catch (error) {
        console.error('Error saving collection params:', error);
        return { success: false, message: error.message };
      }
    }
    
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

  const handleCoeffChange = (value, index, arrayName) => {
    const newCoeffs = [...settings[arrayName]]; // Копируем текущий массив 
    newCoeffs[index] = value; //parseFloat(value); // Обновляем конкретный коэффициент по индексу
    setSettings({...settings, [arrayName]: newCoeffs}); // Обновляем состояние настроек
  };

  // Функция проверки корректности коэффициентов
  const isValidCoeff = (coeff) => {
    return !isNaN(parseFloat(coeff)) && isFinite(coeff);
  };

  // Функция проверки всех коэффициентов
  const areAllCoeffsValid = (settings) => {
    const arraysToCheck = ['coeffs_below_550', 'coeffs_above_550'];
    return arraysToCheck.every(arrayName => 
      settings[arrayName].every(isValidCoeff)
    );
  };

  // Преобразование коэффициентов в числа
  const convertCoeffsToNumbers = (coeffs) => {
    return coeffs.map(coeff => {
      const num = parseFloat(coeff);
      return isNaN(num) ? coeff : num;
    });
  };

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

  // Функция для обновления настроек теперь принимает параметр updatedSettings
  const updateSettings = (updatedSettingsParam) => {
    // Дополнительно проверяем, что переданные настройки не пусты
    if (!updatedSettingsParam || Object.keys(updatedSettingsParam).length === 0) {
      console.error('Ошибка: Настройки для обновления не предоставлены');
      return;
    }

   
    const updatedSettings = {
      ...updatedSettingsParam,
      NSPCHANNELS: parseInt(updatedSettingsParam.NSPCHANNELS, 10),
      SPECDEFTIME: parseFloat(updatedSettingsParam.SPECDEFTIME),
      winLow: parseInt(updatedSettingsParam.winLow, 10),
      winHigh: parseInt(updatedSettingsParam.winHigh, 10),
      MAX_ALLOWED_HEIGHT: parseInt(updatedSettingsParam.MAX_ALLOWED_HEIGHT, 10),
      flightsDirectory: updatedSettingsParam.flightsDirectory,
      latInit: parseFloat(updatedSettingsParam.latInit),
      lonInit: parseFloat(updatedSettingsParam.lonInit),
      altInit: parseInt(updatedSettingsParam.altInit, 10),
      coeffs_below_550: updatedSettingsParam.coeffs_below_550.map(Number), // Преобразование всех элементов в числа
      coeffs_above_550: updatedSettingsParam.coeffs_above_550.map(Number), // Аналогично
      gm1Coeff: parseFloat(updatedSettingsParam.gm1Coeff),
      gm2Coeff: parseFloat(updatedSettingsParam.gm2Coeff),
      winCoeff: parseFloat(updatedSettingsParam.winCoeff),
      selectedAlgorithm: updatedSettingsParam.selectedAlgorithm,
    };

    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedSettings),
    })
    .then(response => response.text())
    .then(result => {
      console.log('Настройки обновлены:', result);
      // Предполагается, что setGlobalSettings обновляет настройки в глобальном состоянии приложения
      setGlobalSettings(updatedSettings); // Обновляем глобальные настройки
    })
    .catch(error => console.error('Ошибка при обновлении настроек:', error));
  };

  useEffect(() => {
    // Выполняем запрос к API для получения данных о пиках изотопов
    fetch('/api/isotope_peaks_data')
      .then(response => response.json()) // Преобразуем ответ в JSON
      .then(data => {
        console.log('Fetched Isotopes:', data); // Выводим полученные данные в консоль для отладки
        setIsotopes(data); // Обновляем состояние с данными изотопов
      })
      .catch(error => console.error('Error fetching isotopes:', error)); // Обрабатываем ошибку, если запрос не удался
  }, []); // Пустой массив зависимостей означает, что этот код выполнится один раз при монтировании компонента


  const [activeTab, setActiveTab] = useState(0);

  const handleChangeTab = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleSerialPortChange = (e) => {
    const { name, value } = e.target;
    setSettings((prevState) => ({
      ...prevState,
      serialPort: {
        ...prevState.serialPort,
        [name]: value,
      },
    }));
  };  

  const { currentSensorType, setCurrentSensorType } = useContext(FlightDataContext);

  const handleSensorTypeChange = (event) => {
    setCurrentSensorType(event.target.value); // Меняем тип сенсора
  };

  const handleResolutionChange = (event) => {
    const newResolution = event.target.value;
    const updatedSettings = {
      ...settings,
      sensorTypes: {
        ...settings.sensorTypes,
        [currentSensorType]: {
          ...settings.sensorTypes[currentSensorType],
          resolution: newResolution, // Изменяем значение разрешения
        },
      },
    };
    setSettings(updatedSettings); // Обновляем состояние
  };

  const handleZoneChange = (index, field, value) => {
    const updatedZones = settings.sensorTypes[currentSensorType].zonesOfInterest.map((zone, idx) => {
      if (idx === index) {
        const updatedZone = { ...zone, [field]: value };
  
        // Если поле изменяемое - это "isotope_id", и новый нуклид имеет пики, устанавливаем первую доступную энергию и yield_percent
        if (field === 'isotope_id') {
          const selectedIsotope = isotopes.isotopes.find(isotope => isotope.id === value);
          if (selectedIsotope && selectedIsotope.peaks.length > 0) {
            updatedZone.peak_id = selectedIsotope.peaks[0].id; // Устанавливаем первую доступную энергию
            updatedZone.lineOutput = selectedIsotope.peaks[0].yield_percent; // Устанавливаем yield_percent
          }
        }
  
        // Если изменен peak_id, обновляем yield_percent для нового пика
/*         if (field === 'peak_id') {
          const selectedIsotope = isotopes.isotopes.find(isotope => isotope.id === zone.isotope_id);
          const selectedPeak = selectedIsotope?.peaks.find(peak => peak.id === value);
          if (selectedPeak) {
            updatedZone.lineOutput = selectedPeak.yield_percent; // Устанавливаем yield_percent для выбранного пика
          }
        } */
  
        return updatedZone;
      }
      return zone;
    });
  
    setSettings({
      ...settings,
      sensorTypes: {
        ...settings.sensorTypes,
        [currentSensorType]: {
          ...settings.sensorTypes[currentSensorType],
          zonesOfInterest: updatedZones,
        },
      },
    });
  };
  
  // Получение yield_percent для отображения:
  const getYieldPercent = (isotopeId, peakId) => {
    const isotope = isotopes.isotopes.find(i => i.id === isotopeId);
    const peak = isotope?.peaks.find(p => p.id === peakId);
    return peak ? peak.yield_percent : '';
  };

  const calculatePeakBounds = (energyPeak, spectrometerResolutionPercent) => {
    const spectrometerResolution = spectrometerResolutionPercent / 100; // Преобразуем в коэффициент
  
    // Эталонная энергия для Cs-137
    const energyCs137 = 661.7; // кэВ
  
    // Ширина пика на полувысоте для Cs-137
    const FWHM_Cs137 = spectrometerResolution * energyCs137;
  
    // Стандартное отклонение для Cs-137 (sigma)
    const sigmaCs137 = FWHM_Cs137 / 2.35;
  
    // Стандартное отклонение для произвольной энергии на основе зависимости 1/sqrt(E)
    const sigmaCurrent = sigmaCs137 * Math.sqrt( energyPeak / energyCs137 );
  
    // Границы пика ±3sigma
    const leftBound = energyPeak - 3 * sigmaCurrent;
    const rightBound = energyPeak + 3 * sigmaCurrent;
  
    return {
      leftBound: leftBound.toFixed(2), // округление до 2 знаков
      rightBound: rightBound.toFixed(2)
    };
  };
  
  const [zoneBounds, setZoneBounds] = useState([]);


  const tabPanelContent = (index) => {
    switch(index) {
      case 0: // Расчет МЭД(в точке детектора)
        return (
          <>
            <Box mb={0.5}> {/* mb = margin bottom 2 (технически, это 16px * 2 = 32px отступ снизу) */}
              Коэффициенты полинома для уровня энергии менее 550 кэВ
            </Box>
            {/* <div>Коэффициенты полинома для уровня энергии менее 550 кэВ</div> */}
            <Grid container spacing={2}>
              {settings.coeffs_below_550 && settings.coeffs_below_550.map((coeff, index) => (
                <Grid item xs={2.4} key={`coeff-below-${index}`}> {/* xs={3} означает, что каждый элемент займет 1/4 ширины контейнера */}
                  <TextField
                    margin="dense"                  
                    id={`coeff-below-${index}`}
                    label={`Коэфф ${index + 1}`}
                    fullWidth
                    size="small"
                    variant="outlined"
                    value={coeff}
                    onChange={(e) => handleCoeffChange(e.target.value, index, 'coeffs_below_550')}
                  />
                </Grid>
              ))}
            </Grid>
            <Box mb={0.5} mt={1}>  
              Коэффициенты полинома для уровня энергии более 550 кэВ
            </Box>     
            {/* <div>Коэффициенты полинома для уровня энергии более 550 кэВ</div> */}
            <Grid container spacing={2}>
              {settings.coeffs_above_550 && settings.coeffs_above_550.map((coeff, index) => (
                <Grid item xs={2.4} key={`coeff-above-${index}`}> {/* Аналогично, используем xs={3} для распределения по 4 в ряд */}
                  <TextField
                    margin="dense"
                    id={`coeff-above-${index}`}
                    label={`Коэфф ${index + 1}`}
                    fullWidth
                    size="small"
                    variant="outlined"
                    value={coeff}
                    onChange={(e) => handleCoeffChange(e.target.value, index, 'coeffs_above_550')}
                  />
                </Grid>
              ))}
            </Grid>
            </>
        )
      case 1: // Расчет МЭД(по спектрометрическому окну)
        return (
          <>
            <TextField
              margin="dense"
              id="winLow"
              label="Нижняя граница окна"
              type="number"
              fullWidth
              size="small"
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
              size="small"
              variant="outlined"
              value={settings.winHigh}
              onChange={(e) => setSettings({...settings, winHigh: e.target.value})}
            />
            <TextField
              margin="dense"
              id="winCoeff"
              label="Коэффициент чувствительности для выбранного диапазона"
              type="number"
              fullWidth
              size="small"
              variant="outlined"
              value={settings.winCoeff}
              onChange={(e) => setSettings({...settings, winCoeff: e.target.value})}
            />
          </>
        );
      case 2: // Расчет МЭД(по счетчикам Гейгера)
      return (
        <>
          <TextField
            margin="dense"
            id="dgThresholdLow"
            label="Порог счетчика Гейгера 1"
            type="number"
            fullWidth
            size="small"
            variant="outlined"
            value={settings.DGThresholdLow}
            onChange={(e) => setSettings({...settings, DGThresholdLow: e.target.value})}
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
            id="dgThresholdHigh"
            label="Порог счетчика Гейгера 2"
            type="number"
            fullWidth
            size="small"
            variant="outlined"
            value={settings.DGThresholdHigh}
            onChange={(e) => setSettings({...settings, DGThresholdHigh: e.target.value})}
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
        </>
      );
      case 3: // Зоны интереса
      return (
        <>
          {/* Выбор типа датчика */}
          <FormControl fullWidth margin="dense" size="small" variant="outlined">
            <InputLabel id="sensor-type-label">Тип датчика</InputLabel>
            <Select
              labelId="sensor-type-label"
              id="sensorType"
              value={currentSensorType} // Текущий выбранный тип датчика
              onChange={handleSensorTypeChange} // Обработчик изменения типа датчика
              label="Тип датчика"
            >
              {/* Проходим по всем типам сенсоров, заданным в конфигурации */}
              {Object.keys(settings.sensorTypes).map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
      
          <Box mt={2}>
            <TextField
              margin="dense"
              label="Разрешение, %"
              fullWidth
              size="small"
              variant="outlined"
              value={settings.sensorTypes[currentSensorType].resolution || ''} // Значение разрешающей способности из конфигурации
              onChange={handleResolutionChange} // Обработчик изменения
            />
          </Box>
      
          <Box mt={2}>
            {/* Проходим по массиву зон интереса для текущего типа датчика */}
            {settings.sensorTypes[currentSensorType].zonesOfInterest.map((zone, index) => {
              // Calculate LeftE and RightE based on the selected peak and resolution
              const { leftBound, rightBound } = calculatePeakBounds(
                zone.peak_id,
                settings.sensorTypes[currentSensorType].resolution
              );
      
              return (
                <Grid container spacing={2} key={zone.id}>
                  <Grid item xs={1}>
                    {/* Поле для отображения идентификатора зоны (только для чтения) */}
                    <TextField
                      margin="dense"
                      label="ID"
                      type="number"
                      fullWidth
                      size="small"
                      variant="outlined"
                      value={zone.id}
                      disabled
                    />
                  </Grid>
      
                  <Grid item xs={2}>
                    {/* Выпадающий список для выбора изотопа по ID */}
                    <FormControl fullWidth margin="dense" size="small" variant="outlined">
                      <InputLabel id={`isotope-select-label`}>Нуклид</InputLabel>
                      <Select
                        labelId={`isotope-select-label`}
                        value={zone.isotope_id} // ID изотопа из зоны интереса
                        onChange={(e) => handleZoneChange(index, 'isotope_id', e.target.value)} // Обработчик изменения поля isotope_id
                        label="Нуклид"
                      >
                        {/* Проходим по массиву изотопов для заполнения выпадающего списка */}
                        {isotopes.isotopes?.map((isotope) => (
                          <MenuItem key={isotope.id} value={isotope.id}>
                            {isotope.name} {/* Имя изотопа для отображения */}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
      
                  <Grid item xs={3}>
                    {/* Выпадающий список для выбора пика */}
                    <FormControl fullWidth margin="dense" size="small" variant="outlined">
                      <InputLabel id={`peak-select-label-${index}`}>Энергия</InputLabel>
                      <Select
                        labelId={`peak-select-label-${index}`}
                        value={zone.peak_id}
                        onChange={(e) => handleZoneChange(index, 'peak_id', e.target.value)}
                        label="Энергия"
                      >
                        {isotopes.isotopes
                          .find((isotope) => isotope.id === zone.isotope_id)?.peaks.map((peak) => (
                            <MenuItem key={peak.id} value={peak.id}>
                              {peak.energy_keV} keV
                            </MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                  </Grid>
      
                  <Grid item xs={2}>
                    {/* Поле для ввода значения "Выход линии, %" */}
                    <TextField
                      margin="dense"
                      label="Выход линии, %"
                      type="number"
                      fullWidth
                      size="small"
                      variant="outlined"
                      value={getYieldPercent(zone.isotope_id, zone.peak_id)}
                      //value={zone.lineOutput} // Значение "Выход линии" для зоны интереса
                      disabled // Поле только для чтения
                      //onChange={(e) => handleZoneChange(index, 'lineOutput', e.target.value)} // Обработчик изменения поля lineOutput
                    />
                  </Grid>
      
                  <Grid item xs={2}>
                    {/* Поле для ввода левой границы энергии (вычисленное значение) */}
                    <TextField
                      margin="dense"
                      label="LeftE"
                      type="number"
                      fullWidth
                      size="small"
                      variant="outlined"
                      value={leftBound} // Вычисленное значение левой границы энергии
                      disabled // Поле только для чтения
                    />
                  </Grid>
      
                  <Grid item xs={2}>
                    {/* Поле для ввода правой границы энергии (вычисленное значение) */}
                    <TextField
                      margin="dense"
                      label="RightE"
                      type="number"
                      fullWidth
                      size="small"
                      variant="outlined"
                      value={rightBound} // Вычисленное значение правой границы энергии
                      disabled // Поле только для чтения
                    />
                  </Grid>
                </Grid>
              );
            })}
          </Box>
        </>
      );
    
      case 4: // Прочееcase 3: // Прочее
      return (
        <>
          <TextField
            margin="dense"
            id="NSPCHANNELS"
            label="Количество спектральных каналов"
            type="number"
            fullWidth
            size="small"
            variant="outlined"
            value={settings.NSPCHANNELS}
            onChange={(e) => setSettings({ ...settings, NSPCHANNELS: e.target.value })}
          />
          <TextField
            margin="dense"
            id="SPECDEFTIME"
            label="Частота (скважность) измерений, с"
            type="number"
            fullWidth
            size="small"
            variant="outlined"
            value={settings.SPECDEFTIME}
            onChange={(e) => setSettings({ ...settings, SPECDEFTIME: e.target.value })}
          />
          <TextField
            margin="dense"
            id="MAX_ALLOWED_HEIGHT"
            label="Максимально допустимая высота"
            type="number"
            fullWidth
            size="small"
            variant="outlined"
            value={settings.MAX_ALLOWED_HEIGHT}
            onChange={(e) => setSettings({ ...settings, MAX_ALLOWED_HEIGHT: e.target.value })}
          />
          <TextField
            margin="dense"
            id="flightsDirectory"
            label="Каталог файлов полетов"
            fullWidth
            size="small"
            variant="outlined"
            value={settings.flightsDirectory}
            onChange={(e) => setSettings({ ...settings, flightsDirectory: e.target.value })}
          />
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <TextField
                margin="dense"
                id="latInit"
                label="Исходная широта"
                type="number"
                fullWidth
                size="small"
                variant="outlined"
                value={settings.latInit}
                onChange={(e) => setSettings({ ...settings, latInit: e.target.value })}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                margin="dense"
                id="lonInit"
                label="Исходная долгота"
                type="number"
                fullWidth
                size="small"
                variant="outlined"
                value={settings.lonInit}
                onChange={(e) => setSettings({ ...settings, lonInit: e.target.value })}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                margin="dense"
                id="altInit"
                label="Исходная высота"
                type="number"
                fullWidth
                size="small"
                variant="outlined"
                value={settings.altInit}
                onChange={(e) => setSettings({ ...settings, altInit: e.target.value })}
              />
            </Grid>
          </Grid>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                margin="dense"
                id="path"
                name="path"
                label="COM-порт"
                fullWidth
                size="small"
                variant="outlined"
                value={settings.serialPort.path}
                onChange={handleSerialPortChange}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                margin="dense"
                id="baudRate"
                name="baudRate"
                label="Скорость передачи данных (Baud Rate)"
                fullWidth
                size="small"
                variant="outlined"
                value={settings.serialPort.baudRate}
                onChange={handleSerialPortChange}
                type="number"
              />
            </Grid>
          </Grid>
          <TextField
            margin="dense"
            id="chartWindow"
            name="chartWindow"
            label="Онлайн-полет: отображать последние N секунд на графике"
            fullWidth
            size="small"
            variant="outlined"
            value={settings.chartWindow}
            onChange={(e) => setSettings({ ...settings, chartWindow: e.target.value })}
          />
          <FormControl fullWidth margin="dense" size="small" variant="outlined">
            <InputLabel id="altitude-source-label">Источник высоты</InputLabel>
            <Select
              labelId="altitude-source-label"
              id="altitudeSource"
              value={settings.altitudeSource}
              onChange={(e) => setSettings({ ...settings, altitudeSource: e.target.value })}
              label="Источник высоты"
            >
              <MenuItem value="barometric">Барометрическая</MenuItem>
              <MenuItem value="GPS">GPS</MenuItem>
            </Select>
          </FormControl>

          {/* Выпадающий список для выбора алгоритма поиска источника */}
          <FormControl fullWidth margin="dense" size="small" variant="outlined">
            <InputLabel id="algorithm-select-label">Алгоритм поиска источника</InputLabel>
            <Select
              labelId="algorithm-select-label"
              id="algorithm-select"
              value={settings.selectedAlgorithm}
              onChange={(e) => setSettings({ ...settings, selectedAlgorithm: e.target.value })}
              label="Алгоритм поиска источника"
            >
              <MenuItem value="algorithm1">Алгоритм интерполяции</MenuItem>
              <MenuItem value="algorithm2">Алгоритм сеточного поиска</MenuItem>
            </Select>
          </FormControl>
        </>
      );
      default:
        return 'Unknown tab';
    }
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
            subheader: <ListSubheader>Офлайн полеты</ListSubheader>,
          }}
        >

          {/* Отображение офлайн полетов */}
          {collectionOptions.filter(collection => !collection.is_online).map((collection, index) => (
            <MenuItem key={collection._id} onClick={() => handleCollectionSelect(collection)} disabled={onlineFlightId !== null}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', width: '100%' }}>
                <span style={{ fontWeight: 'normal', marginRight: '1rem' }}>{collection.description}</span>
                <span style={{ color: '#aaa', fontSize: '0.8rem' }}>
                  {convertDateTimeWithoutSeconds(collection?.dateTime)}
                </span>
              </div>

              <div>
          {/* Изменение кнопки удаления на IconButton с Tooltip */}
          <Tooltip title="Настпройки полета">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation(); // Предотвращаем всплытие события, чтобы не вызвать onClick родительского MenuItem
                handleOpenFlightSettingsDialog(collection._id);
              }}
            >
              <CogIcon style={{ fill: theme.palette.primary.main, width: 20, height: 20 }} />
            </IconButton>
          </Tooltip>
          </div>

          <div>
          {/* Изменение кнопки удаления на IconButton с Tooltip */}
          <Tooltip title="Удалить полет">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation(); // Предотвращаем всплытие события, чтобы не вызвать onClick родительского MenuItem
                handleOpenDeleteFlightDialog(collection._id);
              }}
            >
              <EraserIcon style={{ fill: theme.palette.primary.main, width: 20, height: 20 }} />
            </IconButton>
          </Tooltip>
          </div>
            </MenuItem>
          ))}

          {/* Разделитель, если есть офлайн полеты */}
          {collectionOptions.some(collection => !collection.is_online) && <Divider />}

          {/* Онлайн полеты, если они есть */}
          {collectionOptions.some(collection => collection.is_online) && [
            <ListSubheader key="online-flight-header">Онлайн полеты</ListSubheader>,
            <Divider key="online-flight-divider" />,
            ...collectionOptions.filter(collection => collection.is_online).map((collection, index) => (
              <MenuItem key={collection._id} onClick={() => handleCollectionSelect(collection)} disabled={onlineFlightId !== null}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', width: '100%' }}>
                  <span style={{ fontWeight: 'normal', marginRight: '1rem' }}>{collection.description}</span>
                  <span style={{ color: '#aaa', fontSize: '0.8rem' }}>
                    {convertDateTimeWithoutSeconds(collection?.dateTime)}
                  </span>
                </div>
                <div>
          {/* Изменение кнопки удаления на IconButton с Tooltip */}
          <Tooltip title="Удалить полет">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation(); // Предотвращаем всплытие события, чтобы не вызвать onClick родительского MenuItem
                handleOpenDeleteFlightDialog(collection._id);
              }}
            >
              <EraserIcon style={{ fill: theme.palette.primary.main, width: 20, height: 20 }} />
            </IconButton>
          </Tooltip>
          </div>
              </MenuItem>
              
            )),
            <Divider key="online-flight-final-divider" />
            
          ]}

          {/* Управление онлайн полетами */}
          <MenuItem onClick={handleStartFlightDialogOpen} disabled={onlineFlightId !== null}>Начать онлайн-полет</MenuItem>
          <MenuItem onClick={handleStopFlight} disabled={onlineFlightId === null}>Остановить онлайн-полет</MenuItem>
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
          <IconButton color="inherit" disabled={(measurements.length === 0 || selectedCollection?.is_online)} onClick={handleChartToggle} >
            <Tooltip title="Показать спектр на карте">
              <ChartIcon style={{ fill: (measurements.length === 0 || selectedCollection?.is_online)?"lightgray": (chartOpen ? theme.palette.primary.main : "white"), width: 24, height: 24 }} />
            </Tooltip>
          </IconButton>
        </div>

        <IconButton color="inherit" disabled={(measurements.length === 0 || selectedCollection?.is_online)} onClick={handleOpenSpectrumDialog} >
          <Tooltip title="Показать спектр в отдельном окне">
            <SignalIcon style={{ fill: (measurements.length === 0 || selectedCollection?.is_online)?"lightgray": "white", width: 24, height: 24 }} />
          </Tooltip>
        </IconButton>

        <div style={{
          backgroundColor: threeDActive ? "white" : "transparent",
          borderRadius: '50%',
          padding: '0px',  
        }}>
          <IconButton color="inherit" disabled={(measurements.length === 0)} onClick={handleThreeDToggle}>
            <Tooltip title="Трехмерная модель">
              <CubeIcon style={{ fill: (measurements.length === 0)?"lightgray": (threeDActive ? theme.palette.primary.main : "white"), width: 24, height: 24 } } />
            </Tooltip>
          </IconButton>
        </div>       

        <IconButton color="inherit" onClick={handleSettingsDialogOpen}>
          <Tooltip title="Настройки">
            <CogIcon style={{ fill: settingsOpen ? theme.palette.primary.main : "white", width: 24, height: 24 }} />
          </Tooltip>
        </IconButton>

        <Dialog open={settingsDialogOpen} onClose={handleSettingsDialogClose} aria-labelledby="settings-dialog-title" fullWidth maxWidth="md">
          <DialogTitle id="settings-dialog-title">Настройки</DialogTitle>
          <Tabs value={activeTab} variant="scrollable" onChange={handleChangeTab} aria-label="Настройки вкладок">
            <Tab label="МЭД(в точке)"/>
            <Tab label="МЭД(спектрометрия)"/>
            <Tab label="МЭД(Гейгера)"/>
            <Tab label="Зоны интереса"/>
            <Tab label="Общие"/>
          </Tabs>
          <DialogContent>
            {isSettingsLoading ? (
              <CircularProgress />
            ) : (
              <Box p={3}>
                {tabPanelContent(activeTab)}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button variant="contained" onClick={handleSettingsDialogClose}>Отмена</Button>
            <Button variant="contained" onClick={() => handleSaveSettings(settings)} disabled={isSettingsLoading}>Сохранить</Button>
          </DialogActions>
        </Dialog>

        <IconButton color="inherit" onClick={saveMapAsImage}>
          <Tooltip title="Сохранить экран карты">
            <CameraIcon style={{ fill: "white", width: 24, height: 24 }} />
          </Tooltip>
        </IconButton>

        <IconButton color="inherit" disabled={(measurements.length === 0 || onlineFlightId !== null)} onClick={saveDataToFile}>
          <Tooltip title="Сохранить данные">
            <DownloadIcon style={{ fill: (measurements.length === 0 || onlineFlightId !== null)?"lightgray": "white", width: 24, height: 24 }} />
          </Tooltip>
        </IconButton>

        <IconButton color="inherit" disabled={(measurements.length === 0 || selectedCollection?.is_online)} onClick={handleOpenSourceSearchDialog}>
          <Tooltip title="Поиск источника радиации">
            <RadiationIcon style={{ fill: (measurements.length === 0 || selectedCollection?.is_online)?"lightgray": "white", width: 24, height: 24 }} />
          </Tooltip>
        </IconButton>

        <IconButton
          color="inherit"
          disabled={!onlineFlightId}
          onClick={() => handleOpenConfirmation('RSTH0')}
        >
          <Tooltip title="Задать нулевой уровень высоты (RSTH0)">
            <SensorOnIcon style={{ fill: onlineFlightId ? "white" : "lightgray", width: 24, height: 24 }} />
          </Tooltip>
        </IconButton>

        <IconButton
          color="inherit"
          disabled={!onlineFlightId}
          onClick={() => handleOpenConfirmation('RESET')}
        >
          <Tooltip title="Перезагрузить датчик (RESET)">
            <SensorAlertIcon style={{ fill: onlineFlightId ? "white" : "lightgray", width: 24, height: 24 }} />
          </Tooltip>
        </IconButton>

        <Dialog open={confirmationOpen} onClose={handleCloseConfirmation}>
        <DialogTitle>Подтвердите действие</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Вы уверены, что хотите отправить команду "{messageToSend}" на датчик?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseConfirmation} color="primary">
            Отмена
          </Button>
          <Button onClick={handleSendMessage} color="primary">
            Отправить
          </Button>
        </DialogActions>
      </Dialog>

      <SourceSearchDialog open={sourceSearchDialogOpen} onClose={handleCloseSourceSearchDialog} />
  

      {/* Spectrum Dialog */}
      <Dialog 
        open={spectrumDialogOpen} 
        onClose={handleCloseSpectrumDialog} 
        aria-labelledby="spectrum-dialog-title" 
        fullWidth
        maxWidth={false} 
        className="dialog-cursor-default"
        sx={{ '& .MuiDialog-paper': { width: '850px', maxWidth: '100%' } }}  
      >
       {/*  <DialogTitle id="spectrum-dialog-title">Спектр</DialogTitle> */}
        <DialogContent>
          <DialogContentText>
            <div style={{ position: 'relative', paddingBottom: '0px' }}>
              <SpectrumChartDialog
                averageHeight={averageHeight}
                timeInterval={timeInterval}
                selectedCollection={selectedCollection}
                data={spectrumData}
                isLoading={false}
                width={850}
                height={500}
              />
            </div>
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ paddingBottom: '16px', paddingRight: '16px', marginTop: '-35px' }}> {/* Уменьшаем отступы снизу и смещаем кнопку вверх */}
          <Button onClick={handleCloseSpectrumDialog} variant="contained" color="primary">
            Закрыть
          </Button>
        </DialogActions>
      </Dialog>

      <OnlineIndicator/> 

        <div style={{ flexGrow: 1, display: 'flex', justifyContent: 'flex-end' }}>
          {selectedCollection ? (
            <div style={{ color: 'white', fontSize: 'small' }}>
              {dataToShow && <><span>{dataToShow}</span><span> | </span></>}
              <span>{selectedDatabase ? selectedDatabase : ''} | </span>
              <span>{selectedCollection?.description} | </span>
              <span>{convertDateTime(selectedCollection?.dateTime)} </span>   
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

    <Dialog open={deleteFlightDialogOpen} onClose={handleCloseDeleteFlightDialog}>
      <DialogTitle>Удалить полет</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Вы уверены, что хотите удалить полет {selectedOption?.description} ({convertDateTimeWithoutSeconds(selectedOption?.dateTime)}) из базы данных {selectedDatabase}?
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCloseDeleteFlightDialog} color="primary">
          Отмена
        </Button>
        <Button onClick={handleConfirmDeleteFlight} color="primary" autoFocus>
          Удалить
        </Button>
      </DialogActions>
    </Dialog>

    <Dialog open={flightSettingsDialogOpen} onClose={() => setFlightSettingsDialogOpen(false)}>
    <DialogTitle>Настройки полета - Энергетическая калибровка</DialogTitle>
      <DialogContent>
        <form>
          <TextField
            margin="dense"
            id="P0"
            label="P0"
            type="number"
            fullWidth
            variant="outlined"
            value={selectedOption?.P0 || 0}
            onChange={handleP0Change}
          />
          <TextField
            margin="dense"
            id="P1"
            label="P1"
            type="number"
            fullWidth
            variant="outlined"
            value={selectedOption?.P1 || 0}
            onChange={handleP1Change}
          />
        </form>
      </DialogContent>

      <DialogActions>
        <Button onClick={() => setFlightSettingsDialogOpen(false)}>Отмена</Button>
        <Button onClick={() => {
          // Здесь логика сохранения изменений
          saveCollectionParams(selectedDatabase, selectedOption);
          // После сохранения необходимо обновить collectionOptions и selectedCollection, если требуется
          setFlightSettingsDialogOpen(false);
        }}>Сохранить</Button>
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
          control={<Checkbox checked={isDemoMode} onChange={handleDemoModeChange} />}
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