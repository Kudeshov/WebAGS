import React, { useState } from 'react';
import './App.css';
import MyMapComponent from './MyMapComponent';
import CustomToolbar from './CustomToolbar';
import MyDataGrid from './MyDataGrid';
import { Grid } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Drawer from '@mui/material/Drawer';

// Создание контекста
export const FlightContext = React.createContext();
export const CollectionContext = React.createContext();


const tallGrid = {
  height: '100%'
}

const gridStyles = {
  marginLeft: "auto",
  marginRight: "auto",
  maxWidth: '100%',
  paddingRight: 0,
  paddingBottom: 0
};

function App() {

  const theme = useTheme();
  const appBarHeight = theme.mixins.toolbar.minHeight;
  //console.log('appBarHeight', appBarHeight);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState(null);
  // Глобальные состояния для хранения значений высот
  const [heightFrom, setHeightFrom] = useState(0);
  const [heightTo, setHeightTo] = useState(1000);

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  const toggleChart = () => {
    console.log('App.js chartopen', chartOpen);
    setChartOpen(!chartOpen);
  };

  return (
    <CollectionContext.Provider value={{ selectedCollection, setSelectedCollection }}>
    <FlightContext.Provider value={{ selectedFlight, setSelectedFlight, chartOpen, heightFrom, setHeightFrom, heightTo, setHeightTo }}>
      <Grid container spacing={0} sx={{...gridStyles, ...tallGrid}} >
      <CustomToolbar 
        onToggleDrawer={toggleDrawer} drawerOpen={drawerOpen} 
        onToggleChart={toggleChart} chartOpen={chartOpen} 
      />
        <Grid container spacing={0} >

          <Grid item xs>
            <MyMapComponent />
          </Grid>      
         {drawerOpen && <Grid item style={{ width: '390px' }}>
            <MyDataGrid />
          </Grid>}   
         </Grid>
      </Grid>  
    </FlightContext.Provider>
    </CollectionContext.Provider>
  );
}

export default App;