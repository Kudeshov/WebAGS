import React, { useState, useContext } from 'react';
import './App.css';
import MyMapComponent from './MyMapComponent';
import CustomToolbar from './CustomToolbar';

// Создание контекста
export const FlightContext = React.createContext();

function App() {
  const [selectedFlight, setSelectedFlight] = useState(null);

  return (
    <div className="App">
      <FlightContext.Provider value={{ selectedFlight, setSelectedFlight }}>
        <CustomToolbar />
        <h1>Веб Аэрогаммасъемка</h1>
        <MyMapComponent />
      </FlightContext.Provider>
    </div>
  );
}

export default App;