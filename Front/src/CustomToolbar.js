import React, { useState } from 'react';
import { AppBar, Toolbar, IconButton, Menu, MenuItem, ListItemIcon, ListSubheader } from '@mui/material';
import { MoreVert, Person, Settings } from '@mui/icons-material';
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

import MapIcon from '@mui/icons-material/Map';
import { Rect } from 'victory';

function CustomToolbar() {
  const [anchorEl, setAnchorEl] = useState(null);
  const [mapMenuAnchorEl, setMapMenuAnchorEl] = useState(null);
  const [filterMenuAnchorEl, setFilterMenuAnchorEl] = useState(null);
  const [unitMenuAnchorEl, setUnitMenuAnchorEl] = useState(null);
  const [settingsMenuAnchorEl, setSettingsMenuAnchorEl] = useState(null);

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

  const handleFilterMenuClose = () => {
    setFilterMenuAnchorEl(null);
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
    
    <AppBar position="static">

      <Toolbar>
      <IconButton
          color="inherit"
          onClick={handleMapMenuClick}
        >
          <Tooltip title="База данных">
          <DatabaseIcon style={{ fill: "white", width: 24, height: 24 }} />
          </Tooltip>
        </IconButton>

        
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

        <IconButton
  color="inherit"
  onClick={() => {
    // Добавьте здесь логику для "Таблица измерений"
  }}
>
<Tooltip title="Таблица измерений">
          <AnalyticsIcon style={{ fill: "white", width: 24, height: 24 }} />
          </Tooltip>
</IconButton>
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