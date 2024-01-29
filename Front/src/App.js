import React, { useState, useEffect } from 'react';
import './App.css';
import MyMapComponent from './MyMapComponent';
import CustomToolbar from './CustomToolbar';
import MyDataGrid from './MyDataGrid';
import { FlightDataProvider } from './FlightDataContext';
import DroneFlight3D from './DroneFlightVisualization';
import VerticalSlidersPanel from './VerticalSlidersPanel';

/* const tallGrid = {
  height: '100%'
} */

const TOOLBAR_HEIGHT = 64; // Примерная высота тулбара, адаптируйте под ваш дизайн
const DATA_GRID_WIDTH = 499; // Фиксированная ширина для MyDataGrid


/* const gridStyles = {
  marginLeft: "auto",
  marginRight: "auto",
  maxWidth: '100%',
  paddingRight: 0,
  paddingBottom: 0
}; */

function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [heightFilterActive, setHeightFilterActive] = useState(true);
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

  const [windowHeight, setWindowHeight] = useState(window.innerHeight);
  const [contentWidth, setContentWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => {
      setWindowHeight(window.innerHeight);
      setContentWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    // Обновление ширины контента при открытии/закрытии drawer
    setContentWidth(drawerOpen ? window.innerWidth - DATA_GRID_WIDTH : window.innerWidth);
  }, [drawerOpen]);

  return (
    <FlightDataProvider heightFilterActive={heightFilterActive} onHeightFilterActive={setHeightFilterActive}
      colorOverrideActive={colorOverrideActive} onColorOverrideActive={setColorOverrideActive}
      >
      <div>
        <CustomToolbar 
          onToggleDrawer={toggleDrawer} drawerOpen={drawerOpen} 
          onToggleChart={toggleChart} chartOpen={chartOpen} 
          onHeightFilterActive={setHeightFilterActive} heightFilterActive={heightFilterActive}
          handleThreeDToggle={toggleThreeD} threeDActive={threeDActive}
          onColorOverrideActive={setColorOverrideActive} colorOverrideActive={colorOverrideActive}
        />

        <div style={{ display: 'flex', height: `calc(${windowHeight}px - ${TOOLBAR_HEIGHT}px)` }}>
          <VerticalSlidersPanel /> {/* Добавьте компонент здесь */}
          <div style={{ flexGrow: 1, position: 'relative', width: `${contentWidth}px` }}>
            {threeDActive && <DroneFlight3D />}
            {!threeDActive && <MyMapComponent chartOpen={chartOpen} heightFilterActive={heightFilterActive} />}
          </div>
          {drawerOpen && (
            <div style={{ width: DATA_GRID_WIDTH, overflow: 'auto' }}>
              <MyDataGrid heightFilterActive={heightFilterActive}/>
            </div>
          )}
        </div>
      </div>
    </FlightDataProvider>

  );
}

export default App;