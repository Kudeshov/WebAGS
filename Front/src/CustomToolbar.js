import React, { useState, useEffect, useContext} from 'react';
import { ReactComponent as PlaneIcon } from './icons/plane.svg';
import { ReactComponent as AnalyticsIcon } from './icons/table.svg';
import { ReactComponent as ChartIcon } from './icons/chart-bar.svg';
import { ReactComponent as CogIcon } from './icons/cog.svg';
import { ReactComponent as DatabaseIcon } from './icons/database.svg';
import { ReactComponent as RulerIcon } from './icons/ruler.svg';
import { ReactComponent as FilterIcon } from './icons/filter.svg';
import { ReactComponent as CubeIcon } from './icons/cube.svg';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import { AppBar, Toolbar, IconButton, Menu, MenuItem, ListSubheader, Dialog, DialogTitle, DialogContent, DialogActions,  TextField, Button } from '@mui/material';
import { FlightDataContext } from './FlightDataContext';
import Slider from '@mui/material/Slider';


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
  const [heightFilterDialogOpen, setHeightFilterDialogOpen] = useState(false);

  const { heightFrom } = useContext(FlightDataContext);
  const { heightTo } = useContext(FlightDataContext);
  const { heightFilterFrom, setHeightFilterFrom } = useContext(FlightDataContext);
  const { heightFilterTo, setHeightFilterTo } = useContext(FlightDataContext);
/*   const { localHeightFrom, setLocalHeightFrom } = useContext(FlightDataContext);
  const { localHeightTo, setLocalHeightTo } = useContext(FlightDataContext); */

  const [localHeightFrom, setLocalHeightFrom] = useState(-1000);
  const [localHeightTo, setLocalHeightTo] = useState(1000);

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
        <Dialog 
  open={heightFilterDialogOpen} 
  onClose={handleHeightFilterClose}
  PaperProps={{
    style: {
      height: 400, // Установите желаемую фиксированную высоту здесь
    },
  }}
  
>
  
<DialogTitle>Фильтр по высоте</DialogTitle>
<DialogContent style={{ display: 'flex', height: 170, justifyContent: 'center', alignItems: 'center' }}>
  <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
    <Slider
      sx={{ 
        height: 170, // Установите высоту слайдера
        marginTop: 'auto',
        marginBottom: 'auto',
        marginLeft: 5
      }}
      orientation="vertical"
      getAriaLabel={() => 'Диапазон высот'}
      value={[localHeightFrom, localHeightTo]}
      onChange={(event, newValue) => {
        setLocalHeightFrom(newValue[0]);
        setLocalHeightTo(newValue[1]);
      }}
      valueLabelDisplay="on"
      min={heightFrom}
      max={heightTo}
      marks={[
        {
          value: heightFrom,
          label: `${heightFrom}`,
        },
        {
          value: heightTo,
          label: `${heightTo}`,
        },
      ]}
    />
  </div>
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
      setLocalHeightFrom(heightFrom);
      setLocalHeightTo(heightTo);
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
            <span>{selectedFlight ? selectedFlight : ''} | </span>
            <span>{selectedCollection ? selectedCollection.description : ''} | </span>
            <span>{selectedCollection ? convertDateTime(selectedCollection.dateTime) : ''} | </span>
            <span>P0: {selectedCollection ? selectedCollection.P0 : ''} | </span>
            <span>P1: {selectedCollection ? selectedCollection.P1 : ''}</span>        
          </div>
        </div>


     </Toolbar>
          
         </AppBar>
  );
}

export default CustomToolbar;