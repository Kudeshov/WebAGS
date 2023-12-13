import React, { useState, useEffect, useContext} from 'react';
import { AppBar, Toolbar, IconButton, Menu, MenuItem, ListItemIcon, ListSubheader } from '@mui/material';
import { Flight, MoreVert, Person, Settings } from '@mui/icons-material';
import { ReactComponent as PlaneIcon } from './icons/plane.svg';
import { ReactComponent as AnalyticsIcon } from './icons/analytics.svg';
import { ReactComponent as ChartIcon } from './icons/chart-bar.svg';
import { ReactComponent as CogIcon } from './icons/cog.svg';
import { ReactComponent as DatabaseIcon } from './icons/database.svg';
import { ReactComponent as FilterIcon } from './icons/filter.svg';
import { ReactComponent as MapIconSVG } from './icons/map.svg';
import { ReactComponent as RectangleIcon } from './icons/rectangle-landscape.svg';
import { ReactComponent as RulerIcon } from './icons/ruler.svg';
import { ReactComponent as TableIcon } from './icons/table.svg';
import Tooltip from '@mui/material/Tooltip';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useTheme } from '@mui/material/styles';

import MapIcon from '@mui/icons-material/Map';
import { Rect } from 'victory';
import { FlightContext } from './App';

const CustomToolbar = ({ onToggleDrawer, drawerOpen }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [mapMenuAnchorEl, setMapMenuAnchorEl] = useState(null);
  const [filterMenuAnchorEl, setFilterMenuAnchorEl] = useState(null);
  const [unitMenuAnchorEl, setUnitMenuAnchorEl] = useState(null);
  const [settingsMenuAnchorEl, setSettingsMenuAnchorEl] = useState(null);

  const [filterMenuAnchorE2, setDatabaseMenuAnchorE2] = useState(null);
  const [flightOptions, setFlightOptions] = useState([]);
  const [buttonClickCount, setButtonClickCount] = useState(0);
  const theme = useTheme();
  const tableButtonStyle = {
    fill: drawerOpen ? "white" : "white",
    width: 24,
    height: 24,
    border: '1px dashed grey',
    backgroundColor: drawerOpen ? "grey" : "transparent",
    /* borderRadius: "50%", */ // Сделайте borderRadius всегда круглым
    //borderRadius: drawerOpen ? "50%" : "0",
  };

/*   const tableButtonStyle = {
    fill: "white",
    width: 24, // Оставляем исходный размер иконки
    height: 24, // Оставляем исходный размер иконки
 
  }; */

  // Измените обработчик для кнопки
  const handleDataGridToggle = () => {
    onToggleDrawer();
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
  
  const fetchData = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/flights');
      const data = await response.json();
      setFlightOptions(data);
    } catch (error) {
      console.error('Ошибка при загрузке списка полетов:', error);
    }
  };

  const handleButtonClick = () => {
    // Увеличиваем счетчик при каждом нажатии на кнопку
    setButtonClickCount((prevCount) => prevCount + 1);
  };


  const handleMenuClick = (event) => {
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

  const handleDatabaseMenuClick = (event) => {
    // Обновляем список при каждом открытии меню
    fetchData();
    setDatabaseMenuAnchorE2(event.currentTarget);
  };

  const handleDatabaseMenuClose = () => {
    setDatabaseMenuAnchorE2(null);
  };

  const handleFilterMenuClose = () => {
    setFilterMenuAnchorEl(null);
  };

  const handleFlightSelect = (flightName) => {
    setSelectedFlight(flightName);
    // Закрыть меню после выбора
    setDatabaseMenuAnchorE2(null);
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

  const { setSelectedFlight } = useContext(FlightContext);


  return (
    <AppBar position="static">
        <Toolbar>

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
          onClick={() => {
            // Добавьте здесь логику для открытия полёта
          }}
        >
          <Tooltip title="Открыть полёт">
          <PlaneIcon style={{ fill: "white", width: 24, height: 24 }} />
          </Tooltip>
        </IconButton>

        <IconButton
          color="inherit"
          onClick={handleMapMenuClick}
        >
          <Tooltip title="Открыть карту">
          <MapIconSVG style={{ fill: "white", width: 24, height: 24 }} />
          </Tooltip>
        </IconButton>

       

        <Menu
          anchorEl={mapMenuAnchorEl}
          open={Boolean(mapMenuAnchorEl)}
          onClose={handleMapMenuClose}
          MenuListProps={{
            subheader: <ListSubheader>Открыть карту</ListSubheader>,
          }}
        >
          <MenuItem onClick={handleMapMenuClose}>
            <ListItemIcon>
              <MapIcon />
            </ListItemIcon>
            Open Map
          </MenuItem>
          <MenuItem onClick={handleMapMenuClose}>
            <ListItemIcon>
              <MapIcon />
            </ListItemIcon>
            Open Google
          </MenuItem>
          <MenuItem onClick={handleMapMenuClose}>
            <ListItemIcon>
              <MapIcon />
            </ListItemIcon>
            Open OpenStreetMap
          </MenuItem>
          {/* Add more menu items as needed */}
        </Menu>

        <div style={{
          backgroundColor: drawerOpen ? "white" : "transparent",
/*           color: drawerOpen ? "blue" : "white", */
          borderRadius: '50%',
          padding: '0px',  
        }}>
          <IconButton color="inherit" onClick={handleDataGridToggle}>
            <Tooltip title="Таблица измерений">
              <AnalyticsIcon style={{ fill: drawerOpen ? theme.palette.primary.main : "white", width: 24, height: 24 }} />
            </Tooltip>
          </IconButton>
        </div>
{/* 
        <IconButton color="inherit" onClick={handleDataGridToggle} style={{ borderRadius: '50%' }}>
          <div style={{
            backgroundColor: drawerOpen ? "grey" : "transparent",
            borderRadius: '50%',
            padding: '10px', // Увеличиваем отступ для создания крупного круглого фона
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <Tooltip title="Таблица измерений">
              <AnalyticsIcon style={{ fill: "white", width: 24, height: 24 }} />
            </Tooltip>
          </div>
        </IconButton> */}

{/*         <IconButton color="inherit" onClick={handleDataGridToggle}>
          <Tooltip title="Таблица измерений">
            <AnalyticsIcon style={tableButtonStyle} />
          </Tooltip>
        </IconButton> */}

{/*         <IconButton
  color="inherit"
  onClick={() => {
    // Добавьте здесь логику для "Таблица измерений"
  }}
>

  
          <Tooltip title="Таблица измерений"  onClick={handleDataGridToggle}>
            <AnalyticsIcon style={{ fill: "white", width: 24, height: 24 }} />
          </Tooltip>
</IconButton> */}
<IconButton
  color="inherit"
  onClick={() => {
    // Добавьте здесь логику для "Графики"
  }}
>
<Tooltip title="Графики">
          <ChartIcon style={{ fill: "white", width: 24, height: 24 }} />
          </Tooltip>
</IconButton>
<IconButton
  color="inherit"
  onClick={() => {
    // Добавьте здесь логику для "Указатель"
  }}
>

  
<Tooltip title="Выбрать">
          <RectangleIcon style={{ fill: "white", width: 24, height: 24 }} />
          </Tooltip>
</IconButton>


        <IconButton
          color="inherit"
          onClick={handleFilterMenuClick}
        >
         <Tooltip title="Отфильтровать по высоте">
          <FilterIcon style={{ fill: "white", width: 24, height: 24 }} />
          </Tooltip>

        </IconButton>
        <Menu
          anchorEl={filterMenuAnchorEl}
          open={Boolean(filterMenuAnchorEl)}
          onClose={handleFilterMenuClose}
          MenuListProps={{
            subheader: <ListSubheader>Отфильтровать по высоте</ListSubheader>,
          }}
        >
          {/* Add filter options */}
          <MenuItem onClick={handleFilterMenuClose}>Option 1</MenuItem>
          <MenuItem onClick={handleFilterMenuClose}>Option 2</MenuItem>
          {/* Add more filter options as needed */}
        </Menu>
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
      </Toolbar>


    </AppBar>
  );
}

export default CustomToolbar;