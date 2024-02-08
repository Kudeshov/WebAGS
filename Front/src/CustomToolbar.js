import React, { useState, useEffect, useContext, useRef, useLayoutEffect} from 'react';
import { ReactComponent as PlaneIcon } from './icons/plane.svg';
import { ReactComponent as AnalyticsIcon } from './icons/table.svg';
import { ReactComponent as ChartIcon } from './icons/chart-bar.svg';
import { ReactComponent as DatabaseIcon } from './icons/database.svg';
import { ReactComponent as CubeIcon } from './icons/cube.svg';
import { ReactComponent as CameraIcon } from './icons/camera.svg';
import { ReactComponent as DownloadIcon } from './icons/download.svg';
import { ReactComponent as EraserIcon } from './icons/trash.svg';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import { AppBar, Grid, Toolbar, IconButton, Menu, MenuItem, ListSubheader, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, FormControlLabel, TextField, Button, Checkbox } from '@mui/material';
import { FlightDataContext } from './FlightDataContext';
import Snackbar from '@mui/material/Snackbar';
import Divider from '@mui/material/Divider';
import { createGradientT, calculateColorThresholds } from './colorUtils';
import CircularProgress from '@mui/material/CircularProgress';
import Backdrop from '@mui/material/Backdrop';
import { convertDateTime } from './dateUtils';

const CustomToolbar = ({ onToggleDrawer, drawerOpen, onToggleChart, chartOpen, onHeightFilterActive, heightFilterActive,
    handleThreeDToggle, threeDActive, onColorOverrideActive, colorOverrideActive }) => {

  const { selectedCollection, setSelectedCollection } = useContext(FlightDataContext);
  const { selectedFlight, setSelectedFlight } = useContext(FlightDataContext);
  const { onlineMeasurements, setOnlineMeasurements } = useContext(FlightDataContext);
  const [unitMenuAnchorEl, setUnitMenuAnchorEl] = useState(null);
  const [settingsMenuAnchorEl, setSettingsMenuAnchorEl] = useState(null);
  
  const [filterMenuAnchorE2, setDatabaseMenuAnchorE2] = useState(null);
  const [filterMenuAnchorCollection, setDatabaseMenuAnchorCollection] = useState(null);

  const [flightOptions, setFlightOptions] = useState([]);
  const [collectionOptions, setCollectionOptions] = useState([]);
  const [heightFilterDialogOpen, setHeightFilterDialogOpen] = useState(false);
  const [colorLegendFilterDialogOpen, setColorLegendFilterDialogOpen] = useState(false);

  const { heightFrom } = useContext(FlightDataContext);
  const { heightTo } = useContext(FlightDataContext);
  const { heightFilterFrom, setHeightFilterFrom } = useContext(FlightDataContext);
  const { heightFilterTo, setHeightFilterTo } = useContext(FlightDataContext);
  const { colorThresholds, setColorThresholds } = useContext(FlightDataContext);  
  const { minDoseValue } = useContext(FlightDataContext);
  const { maxDoseValue } = useContext(FlightDataContext);
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
  const [onlineFlightName, setOnlineFlightName] = useState('');
  const [winLowValue, setWinLowValue] = useState('');
  const [winHighValue, setWinHighValue] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(true);
  const {onlineFlightId, setOnlineFlightId} = useContext(FlightDataContext); // Состояние для хранения ID онлайн полета
  const [websocket, setWebsocket] = useState(null);
  const [simulationData, setSimulationData] = useState('');


  const dbName = selectedFlight;

  const handleStartFlightDialogOpen = () => {
    setStartFlightDialogOpen(true);
    handleCollectionMenuClose();
  };
    
  const handleStartFlightDialogClose = () => {
    setStartFlightDialogOpen(false);
  };


  const setupWebSocket = (onlineFlightId) => {
    const ws = new WebSocket('ws://localhost:3001');
    setWebsocket(ws);
  
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log(data);
      setOnlineMeasurements(currentMeasurements => {
        // Проверяем, что широта и долгота существуют и не равны null
        if (data.lat != null && data.lon != null) {
          return [...currentMeasurements, data];
        } else {
          // Если условие не выполняется, возвращаем текущее состояние без изменений
          return currentMeasurements;
        }
      });
      setSimulationData(`Дата: ${convertDateTime(data.datetime)}, Широта: ${data.lat ? Number(data.lat).toFixed(6) : '0.000000'}, ` +
                        `Долгота: ${data.lon ? Number(data.lon).toFixed(6) : '0.000000'}, ` +
                        `Высота: ${data.alt ? Number(data.alt).toFixed(2) : '0.00'}, ` +
                        `Счет в окне: ${data.winCount ? data.winCount : '0'}`);
    };
  
    ws.onopen = () => {
      console.log('WebSocket соединение установлено');
      // Здесь можно отправить начальные данные, если это необходимо
    };
  
    ws.onerror = (error) => {
      console.error('Ошибка WebSocket:', error);
    };
  };
  
  
  const handleStartFlight = () => {
    fetch('/start-flight-simulation', {
      
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ dbName: dbName })
    })
    
    .then(response => response.json())
    .then(data => {

      if (data && data.flightId) {
        console.log('data.flightId', data.flightId);
        setOnlineFlightId(data.flightId); // Сохраняем ID полета
        setupWebSocket(data.flightId); // Установка WebSocket соединения
        console.log('Ответ сервера:', data);
      };
    })
    .catch(error => {
      console.error('Ошибка при запуске эмуляции полета:', error);
    });

    console.log(`Starting online flight with name: ${onlineFlightName}, Window Low: ${winLowValue}, Window High: ${winHighValue}, Demo Mode: ${isDemoMode}`);
    // Здесь вызвать функцию, которая отправляет эти данные на сервер
    // ...
    setStartFlightDialogOpen(false);
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
          setOnlineFlightId(statusData.flightId); // Сохраняем ID активного полета
          setSelectedFlight(statusData.dbName); // Устанавливаем выбранную базу данных
          // Установка WebSocket соединения
          setupWebSocket(statusData.flightId);
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
      body: JSON.stringify({ flightId: onlineFlightId })
    })
    
    .then(response => {
      if(response.ok) {
        // Действия после успешного останова симуляции
        setOnlineFlightId(null); // Сброс ID симуляции
        if (websocket) {
          websocket.close();
          setWebsocket(null);
        }
      } else {
        console.error('Ошибка остановки эмуляции: HTTP-статус', response.status);
      }
    })
    .catch(error => {
      console.error('Ошибка остановки эмуляции:', error);
    });
  };
  
  const handleWinLowChange = (event) => {
    setWinLowValue(event.target.value);
  };
  
  const handleWinHighChange = (event) => {
    setWinHighValue(event.target.value);
  };
  
  const handleOnlineFlightNameChange = (event) => {
    setOnlineFlightName(event.target.value);
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
  
        // Вызываем setSelectedFlight с именем файла без расширения
        setSelectedFlight(fileNameWithoutExtension);
  
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
    if (!selectedFlight) return;
    fetch(`/api/collection/${selectedFlight}`)
      .then(response => response.json())
      .then(data => {
      })
      .catch(error => {
        console.error('Ошибка при загрузке данных:', error);
      });
  }, [selectedFlight]);

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
      const response = await fetch(`/api/collection/${selectedFlight}`)
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
 
  const handleFlightSelect = (flightName) => {
    setSelectedCollection(null); // Установите в null перед получением новых коллекций
    //setIsLoading(true);
    setSelectedFlight(flightName);
    // Закрыть меню после выбора
    setDatabaseMenuAnchorE2(null);
  };

  const handleCollectionSelect = (value) => {
    //setSelectedCollection(null);
    //setIsLoading(true);
    //console.log('handleCollectionSelect value = ', value);

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
              <span>{simulationData} | </span>
              <span>{selectedFlight ? selectedFlight : ''} | </span>
              <span>{selectedCollection?.description} | </span>
              <span>{convertDateTime(selectedCollection?.dateTime)} | </span>
              <span>P0: {selectedCollection?.P0} | </span>
              <span>P1: {selectedCollection?.P1}</span>        
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
        <TextField
          autoFocus
          margin="dense"
          id="name"
          label="Название полета"
          fullWidth
          variant="outlined"
          value={onlineFlightName}
          onChange={handleOnlineFlightNameChange}
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
        <Button onClick={handleStartFlight}>Начать полет</Button>
      </DialogActions>
    </Dialog>
    </AppBar>
         
  );
}

export default CustomToolbar;