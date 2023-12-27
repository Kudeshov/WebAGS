import React, { useState } from 'react';
import './App.css';
import MyMapComponent from './MyMapComponent';
import CustomToolbar from './CustomToolbar';
import MyDataGrid from './MyDataGrid';
import { Grid } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Drawer from '@mui/material/Drawer';
import { FlightDataProvider } from './FlightDataContext';

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

  return (
/*     <CollectionContext.Provider value={{ selectedCollection, setSelectedCollection }}>
    <FlightContext.Provider value={{ selectedFlight, setSelectedFlight }}> */
    <FlightDataProvider>
    
      <Grid container spacing={0} sx={{...gridStyles, ...tallGrid}} >
      <CustomToolbar onToggleDrawer={toggleDrawer}  drawerOpen={drawerOpen} />
        <Grid container spacing={0} >

          <Grid item xs>
            <MyMapComponent />
          </Grid>      
{/*           <Grid item xs={drawerOpen ? 9 : 12}>
            <MyMapComponent drawerOpen={drawerOpen} />
          </Grid>
 */}
         {drawerOpen && <Grid item style={{ width: '390px' }}>
            <MyDataGrid />
          </Grid>}   
         </Grid>
      </Grid>  
    </FlightDataProvider>
/*     </FlightContext.Provider>
    
    </CollectionContext.Provider> */
  );
}

export default App;