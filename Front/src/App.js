import React, { useState } from 'react';
import './App.css';
import MyMapComponent from './MyMapComponent';
import CustomToolbar from './CustomToolbar';
import FlightComponent from './FlightComponent';
import MyDataGrid from './MyDataGrid';
import MyTabsComponent from './MyTabsComponent';

import Box from '@mui/material/Box';
import { AppBar, Toolbar, Typography, Container, Grid } from '@mui/material';
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
  console.log('appBarHeight', appBarHeight);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState(null);

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };
  
/*   const [drawerOpen, setDrawerOpen] = React.useState(false);
  */ 
  

  return (
    <CollectionContext.Provider value={{ selectedCollection, setSelectedCollection }}>
    <FlightContext.Provider value={{ selectedFlight, setSelectedFlight }}>
      <Grid container spacing={0} sx={{...gridStyles, ...tallGrid}} >
      <CustomToolbar onToggleDrawer={toggleDrawer}  drawerOpen={drawerOpen} />
        <Grid container spacing={0} >
{/*           <Grid item xs={2}>
            <FlightComponent />
          </Grid> */}
          <Grid item xs={drawerOpen ? 9 : 12}>
            <MyMapComponent drawerOpen={drawerOpen} />
            <div style={{ height: '200px' }}>
              <MyTabsComponent />
            </div>
          </Grid>

          {drawerOpen &&
            <Grid item xs={3}>
              <Drawer
                sx={{
                  width: 380,
                  flexShrink: 0,
                  '& .MuiDrawer-paper': {
                    width: 380,
                  },
                }}
                variant="persistent"
                anchor="right"
                open={drawerOpen}
              >
                <MyDataGrid />
              </Drawer>
            </Grid>}   

          
{/*           <Grid item xs={10}>
            <MyMapComponent />
            <div style={{ height: '100px' }}>
            <MyTabsComponent />
            </div>
         */}
         </Grid>
      </Grid>  

    </FlightContext.Provider>
    </CollectionContext.Provider>
  );
}

export default App;