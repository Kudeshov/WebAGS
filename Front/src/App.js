import React, { useState } from 'react';
import './App.css';
import MyMapComponent from './MyMapComponent';
import CustomToolbar from './CustomToolbar';
import FlightComponent from './FlightComponent';
import MyDataGrid from './MyDataGrid';

import Box from '@mui/material/Box';
import { AppBar, Toolbar, Typography, Container, Grid } from '@mui/material';
import { useTheme } from '@mui/material/styles';


// Создание контекста
export const FlightContext = React.createContext();

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
  console.log('appBarHeight', appBarHeight);
  const [selectedFlight, setSelectedFlight] = useState(null);

  return (
    <FlightContext.Provider value={{ selectedFlight, setSelectedFlight }}>
      <Grid container spacing={0} sx={{...gridStyles, ...tallGrid}} >
        <CustomToolbar />
        <Grid container spacing={0} >
          <Grid item xs={2}>
            <FlightComponent />
          </Grid>
          <Grid item xs={8}>
            <MyMapComponent />
          </Grid>
          <Grid item xs={2}>
            <MyDataGrid />
          </Grid>          
        </Grid>
      </Grid>
    </FlightContext.Provider>
  );
}

export default App;