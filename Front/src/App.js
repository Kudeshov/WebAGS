import React from 'react';
import { Grid } from '@mui/material';
import MyDataGrid from './MyDataGrid';
import MyMapComponent from './MyMapComponent';
import MyChartComponent from './MyChartComponent';

function App() {
  return (
    <div className="App">
      <h1>Веб Аэрогаммасъемка</h1>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <MyMapComponent />
        </Grid>
        <Grid item xs={12} sm={6}>
          <Grid container direction="column">
            <Grid item>
              <MyChartComponent />
            </Grid>
            <Grid item>
              <MyDataGrid />
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </div>
  );
}

export default App;