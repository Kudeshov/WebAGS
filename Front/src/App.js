import React, { useState } from 'react';
import './App.css';
import MyMapComponent from './MyMapComponent';
import CustomToolbar from './CustomToolbar';
import MyDataGrid from './MyDataGrid';
import { Grid } from '@mui/material';
import { FlightDataProvider } from './FlightDataContext';
import DroneFlight3D from './DroneFlightVisualization';

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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [heightFilterActive, setHeightFilterActive] = useState(false);
  const [threeDActive, setThreeDActive] = useState(false);
  const [colorOverrideActive, setColorOverrideActive] = useState(false);

  const toggleThreeD = () => {
    setThreeDActive(!threeDActive);
  };

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  const toggleChart = () => {
    console.log('App.js chartopen', chartOpen);
    setChartOpen(!chartOpen);
  };

  return (
    <FlightDataProvider heightFilterActive={heightFilterActive} onHeightFilterActive={setHeightFilterActive}>
      <Grid container spacing={0} sx={{...gridStyles, ...tallGrid}} >
      <CustomToolbar 
        onToggleDrawer={toggleDrawer} drawerOpen={drawerOpen} 
        onToggleChart={toggleChart} chartOpen={chartOpen} 
        onHeightFilterActive={setHeightFilterActive} heightFilterActive={heightFilterActive}
        handleThreeDToggle={toggleThreeD} threeDActive={threeDActive}
        onColorOverrideActive={setColorOverrideActive} colorOverrideActive={colorOverrideActive}
      />
        <Grid container spacing={0} >
          <Grid item xs>
          {threeDActive && 
            <DroneFlight3D/>
          }

          {!threeDActive && 
            <MyMapComponent chartOpen={chartOpen} heightFilterActive={heightFilterActive} />
          }  
          </Grid>      
         {drawerOpen && <Grid item style={{ width: '390px' }}>
            <MyDataGrid heightFilterActive={heightFilterActive}/>
          </Grid>}   
         </Grid>
      </Grid>  
      
    </FlightDataProvider>
  );
}

export default App;