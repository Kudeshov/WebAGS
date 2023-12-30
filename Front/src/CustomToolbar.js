import React, { useState, useEffect, useContext} from 'react';
import { ReactComponent as PlaneIcon } from './icons/plane.svg';
import { ReactComponent as AnalyticsIcon } from './icons/table.svg';
import { ReactComponent as ChartIcon } from './icons/chart-bar.svg';
import { ReactComponent as CogIcon } from './icons/cog.svg';
import { ReactComponent as DatabaseIcon } from './icons/database.svg';
/* import { ReactComponent as MapIconSVG } from './icons/map.svg';
import { ReactComponent as RectangleIcon } from './icons/rectangle-landscape.svg'; */
import { ReactComponent as RulerIcon } from './icons/ruler.svg';
import { ReactComponent as FilterIcon } from './icons/filter.svg';
import { ReactComponent as CubeIcon } from './icons/cube.svg';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
/* import TuneIcon from '@mui/icons-material/Tune'; */
import { AppBar, Toolbar, IconButton, Menu, MenuItem, ListSubheader, Dialog, DialogTitle, DialogContent, DialogActions,  TextField, Button } from '@mui/material';
import { FlightDataContext } from './FlightDataContext';

function convertDateTime(dateTimeString) {
  if (!dateTimeString) return '';
  const date = new Date(dateTimeString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

const CustomToolbar = ({ onToggleDrawer, drawerOpen, onToggleChart, chartOpen, onHeightFilterActive, heightFilterActive,
    handleThreeDToggle, threeDActive }) => {

  const { selectedCollection, setSelectedCollection } = useContext(FlightDataContext);
  const { selectedFlight, setSelectedFlight } = useContext(FlightDataContext);
  const [unitMenuAnchorEl, setUnitMenuAnchorEl] = useState(null);
  const [settingsMenuAnchorEl, setSettingsMenuAnchorEl] = useState(null);

  
  const [filterMenuAnchorE2, setDatabaseMenuAnchorE2] = useState(null);
  const [filterMenuAnchorCollection, setDatabaseMenuAnchorCollection] = useState(null);


  const [flightOptions, setFlightOptions] = useState([]);
  const [collectionOptions, setCollectionOptions] = useState([]);
 //  const [dataCollection, setDataCollection] = useState([]);

/*  const [loadingCollection, setLoadingCollection] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const [buttonClickCount, setButtonClickCount] = useState(0); */
  const [heightFilterDialogOpen, setHeightFilterDialogOpen] = useState(false);

  const { setHeightFrom } = useContext(FlightDataContext);
  const { setHeightTo } = useContext(FlightDataContext);

  // Функции для открытия и закрытия диалогового окна
  const handleHeightFilterClickOpen = () => {
    setHeightFilterDialogOpen(true);
  };

  const handleHeightFilterClose = () => {
    setHeightFilterDialogOpen(false);
  };

    // Локальные состояния для временного хранения значений высот
    const [localHeightFrom, setLocalHeightFrom] = useState(-1000);
    const [localHeightTo, setLocalHeightTo] = useState(1000);
  
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
    setHeightFrom(localHeightFrom);
    setHeightTo(localHeightTo);
     
    onHeightFilterActive(true);

    // Закрытие диалогового окна
    setHeightFilterDialogOpen(false);
  };

   const theme = useTheme();
 /* const tableButtonStyle = {
    fill: drawerOpen ? "white" : "white",
    width: 24,
    height: 24,
    border: '1px dashed grey',
    backgroundColor: drawerOpen ? "grey" : "transparent",
  }; */


  // Измените обработчик для кнопки
  const handleDataGridToggle = () => {
    onToggleDrawer();
  };

  const handleChartToggle = () => {
    onToggleChart();
  };

  useEffect(() => {
    // Загрузка списка полетов из API
    fetch('http://localhost:3001/api/flights')
      .then((response) => response.json())
      .then((data) => {
        setFlightOptions(data); // Сохраняем полученный массив полетов в состоянии
      })
      .catch((error) => {
        console.error('Ошибка при загрузке списка полетов:', error);
      });
  }, []);

  useEffect(() => {
    if (!selectedFlight) return;
    //setLoadingCollection(true);
    fetch(`http://localhost:3001/api/collection/${selectedFlight}`)
      .then(response => response.json())
      .then(data => {
        //setDataCollection(data);
        //setLoadingCollection(false);
      })
      .catch(error => {
        console.error('Ошибка при загрузке данных:', error);
        //setLoadingCollection(false);
      });
  }, [selectedFlight]);
  

  const fetchData = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/flights');
      const data = await response.json();
      setFlightOptions(data);
    } catch (error) {
      console.error('Ошибка при загрузке списка полетов:', error);
    }
  };

  const fetchDataCollection = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/collection/${selectedFlight}`)
      const data = await response.json();
      setCollectionOptions(data);
    } catch (error) {
      console.error('Ошибка при загрузке списка коллекций:', error);
    }
  };

/*   const handleButtonClick = () => {
    // Увеличиваем счетчик при каждом нажатии на кнопку
    setButtonClickCount((prevCount) => prevCount + 1);
  };
 */

/*   const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleMapMenuClick = (event) => {
    setMapMenuAnchorEl(event.currentTarget);
  };

  const handleMapMenuClose = () => {
    setMapMenuAnchorEl(null);
  };


  const handleFilterMenuClick = (event) => {
    setFilterMenuAnchorEl(event.currentTarget);
  };
 */

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

/*   const handleFilterMenuClose = () => {
    setFilterMenuAnchorEl(null);
  }; */

  const handleFlightSelect = (flightName) => {
    setSelectedCollection(null); // Установите в null перед получением новых коллекций
    setSelectedFlight(flightName);
    // Закрыть меню после выбора
    setDatabaseMenuAnchorE2(null);
  };

  const handleCollectionSelect = (value) => {
    console.log('value = ', value);
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
  
/*   const handleSelectionChange = (event, value) => {
    console.log('handleSelectionChange value', value)
    setSelectedCollection(value);
    //setSelectedItem(value);
  }; */

  return (
    <AppBar position="static" sx={{ height: '64px' }}>  {/*  '64px' */}
        <Toolbar >

        <IconButton
          color="inherit"
          onClick={handleDatabaseMenuClick}
        >
          <Tooltip title="База данных">
            {/* Маппинг массива полетов в элементы меню */}
            <DatabaseIcon style={{ fill: "white", width: 24, height: 24 }} />
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
          {/* Маппинг массива полетов в элементы меню */}
          {flightOptions.map((flight, index) => (
          <MenuItem key={index} onClick={() => handleFlightSelect(flight)}>
            {flight}
          </MenuItem>
        ))}
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
          anchorEl={filterMenuAnchorCollection} // Используйте anchorEl вместо anchorCollection
          open={Boolean(filterMenuAnchorCollection)}
          onClose={handleCollectionMenuClose}
          MenuListProps={{
            subheader: <ListSubheader>Полет</ListSubheader>,
          }}
        >
          {/* Маппинг массива коллекций в элементы меню */}
          {collectionOptions.map((collection, index) => (
            <MenuItem key={collection._id} onClick={() => handleCollectionSelect(collection)}>
              {collection.description} 
            </MenuItem>
          ))}
        </Menu>
  
{/*         <IconButton
          color="inherit"
          onClick={handleMapMenuClick}
        >
          <Tooltip title="Открыть карту">
          <MapIconSVG style={{ fill: "white", width: 24, height: 24 }} />
          </Tooltip>
        </IconButton> */}
 
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
            <Tooltip title="График">
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

        <div style={{
          backgroundColor: heightFilterActive ? "white" : "transparent",
          borderRadius: '50%',
          padding: '0px',  
        }}>
          <IconButton color="inherit" onClick={handleHeightFilterClickOpen}>
            <Tooltip title="Фильтр по высоте">
              <FilterIcon style={{ fill: heightFilterActive ? theme.palette.primary.main : "white", width: 24, height: 24 }} />
            </Tooltip>
          </IconButton>
        </div>

        {/* Диалоговое окно для фильтрации по высоте */}
        <Dialog open={heightFilterDialogOpen} onClose={handleHeightFilterClose}>
          <DialogTitle>Фильтр по высоте</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Высота от"
              type="number"
              fullWidth
              variant="standard"
              value={localHeightFrom}
              onChange={handleLocalHeightFromChange}
            />
            <TextField
              margin="dense"
              label="Высота до"
              type="number"
              fullWidth
              variant="standard"
              value={localHeightTo}
              onChange={handleLocalHeightToChange}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleHeightFilterClose} color="primary">
              Закрыть
            </Button>
            <Button onClick={applyHeightFilter} color="primary">
              Применить
            </Button>
            <Button onClick={() => {
                setHeightFilterDialogOpen(false); 
                onHeightFilterActive(false);
                setLocalHeightFrom(-1000);
                setLocalHeightTo(1000);
                }} color="primary">
              Сбросить фильтр
            </Button>
          </DialogActions>
        </Dialog>

        <IconButton
          color="inherit"
          onClick={handleUnitMenuClick}
        >
          <Tooltip title="Единицы измерения">
          <RulerIcon style={{ fill: "white", width: 24, height: 24 }} />
          </Tooltip>
        </IconButton>
        <Menu
          anchorEl={unitMenuAnchorEl}
          open={Boolean(unitMenuAnchorEl)}
          onClose={handleUnitMenuClose}
          MenuListProps={{
            subheader: <ListSubheader>Единицы измерения</ListSubheader>,
          }}
        >
          {/* Add unit options */}
          <MenuItem onClick={handleUnitMenuClose}>Option 1</MenuItem>
          <MenuItem onClick={handleUnitMenuClose}>Option 2</MenuItem>
          {/* Add more unit options as needed */}
        </Menu>
        <IconButton
          color="inherit"
          onClick={handleSettingsMenuClick}
        >
          <Tooltip title="Настройки">
          <CogIcon style={{ fill: "white", width: 24, height: 24 }} />
          </Tooltip>
        </IconButton>
        <Menu
          anchorEl={settingsMenuAnchorEl}
          open={Boolean(settingsMenuAnchorEl)}
          onClose={handleSettingsMenuClose}
          MenuListProps={{
            subheader: <ListSubheader>Настройки</ListSubheader>,
          }}
        >
          {/* Add settings options */}
          <MenuItem onClick={handleSettingsMenuClose}>Option 1</MenuItem>
          <MenuItem onClick={handleSettingsMenuClose}>Option 2</MenuItem>
          {/* Add more settings options as needed */}
        </Menu>
        <div style={{ flexGrow: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ color: 'white', fontSize: 'small' }}>
            <span>База: {selectedFlight ? selectedFlight : ''} | </span>
            <span>Полет: {selectedCollection ? selectedCollection.description : ''} | </span>
            <span>Дата: {selectedCollection ? convertDateTime(selectedCollection.dateTime) : ''} | </span>
            <span>P0: {selectedCollection ? selectedCollection.P0 : ''} | </span>
            <span>P1: {selectedCollection ? selectedCollection.P1 : ''}</span>        
          </div>
        </div>


     </Toolbar>
          
         </AppBar>
  );
}

export default CustomToolbar;