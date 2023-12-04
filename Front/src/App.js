import React, { useState } from 'react';
import './App.css';
import MyMapComponent from './MyMapComponent';
import CustomToolbar from './CustomToolbar';
import FlightComponent from './FlightComponent';
import Grid from '@mui/material/Grid'

// Создание контекста
export const FlightContext = React.createContext();

function App() {
  const [selectedFlight, setSelectedFlight] = useState(null);

  return (
    <div className="App">
      <FlightContext.Provider value={{ selectedFlight, setSelectedFlight }}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <CustomToolbar />
          </Grid>
          <Grid item xs={12} md={4}>
            <FlightComponent />
          </Grid>
          <Grid item xs={12} md={8}>
            <MyMapComponent />
          </Grid>
        </Grid>
        <h1>Веб Аэрогаммасъемка</h1>
      </FlightContext.Provider>
    </div>
  );
}

export default App;