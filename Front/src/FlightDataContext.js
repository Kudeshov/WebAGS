import React, { createContext, useState, useEffect, useCallback } from 'react';

const initialCenter = {
  lat: 55.704034038232834,
  lng: 37.62119540524117
};

export const FlightDataContext = createContext();

/* = ({ onToggleDrawer, drawerOpen, onToggleChart, chartOpen, onHeightFilterActive, heightFilterActive,
  handleThreeDToggle, threeDActive }) => 
 */
export const FlightDataProvider = ({ children, heightFilterActive, onHeightFilterActive }) => {
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [validMeasurements, setValidMeasurements] = useState([]);

  const [minDoseValue, setMinDoseValue] = useState(null);
  const [maxDoseValue, setMaxDoseValue] = useState(null);

  const [geoCenter, setGeoCenter] = useState(initialCenter);
  // Глобальные состояния для хранения значений высот полета
  const [heightFrom, setHeightFrom] = useState(-1000);
  const [heightTo, setHeightTo] = useState(1000);

  const [heightFilterFrom, setHeightFilterFrom] = useState(-1000);
  const [heightFilterTo, setHeightFilterTo] = useState(1000);

  const [localHeightFrom, setLocalHeightFrom] = useState(-1000);
  const [localHeightTo, setLocalHeightTo] = useState(1000);

  const fetchCollections = useCallback(() => {
    //console.log('вызвана fetchCollections')
    if (selectedFlight) {

      fetch(`http://localhost:3001/api/collection/${selectedFlight}`)
        .then(response => response.json())
        .then(collections => {
          // Автоматически выбираем первую коллекцию из списка
          if (collections && collections.length > 0) {
            setSelectedCollection(collections[0]);
          } else {
            setSelectedCollection(null);
          }
        })
        .catch(error => console.error('Ошибка при загрузке списка коллекций:', error));
    }
  }, [selectedFlight]);

  useEffect(() => {
    //console.log('вызвана fetchCollections из useEffect')
    fetchCollections();
  }, [fetchCollections]);

  const fetchMeasurements = useCallback(() => {
    if (selectedFlight && selectedCollection) {
      const apiUrl = `http://localhost:3001/api/data/${selectedFlight}/${selectedCollection?._id || null}`;
      fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
          onHeightFilterActive(false);
          let validData = data.filter(m => m.lat >= 0 && m.lon >= 0 && m.dose >= 0 && m.dosew >= 0 && m.countw<1000000);
          setValidMeasurements(validData);

          if (validData.length > 0) {
            const doses = validData.map(m => m.dose);
            setMinDoseValue(Math.min(...doses));
            setMaxDoseValue(Math.max(...doses));
      
            const latitudes = validData.map(m => m.lat);
            const longitudes = validData.map(m => m.lon);
            const centerLat = (Math.min(...latitudes) + Math.max(...latitudes)) / 2;
            const centerLng = (Math.min(...longitudes) + Math.max(...longitudes)) / 2;
            setGeoCenter({ lat: centerLat, lng: centerLng });
            // Находим минимальное и максимальное значение высоты
            const heights = validData.map(m => m.height); // Предполагаем, что данные о высоте хранятся в свойстве height
            const minHeight = Math.min(...heights);
            const maxHeight = Math.max(...heights);
            setHeightFrom(minHeight);
            setHeightTo(maxHeight);
            console.log('setHeightFilterTo(maxHeight)', maxHeight);
            setHeightFilterFrom(minHeight);
            setHeightFilterTo(maxHeight);
            setLocalHeightFrom(minHeight);
            setLocalHeightTo(maxHeight);    
            console.log(' heightFrom, heightTo', heightFrom, heightTo, minHeight, maxHeight);
            setLocalHeightFrom(minHeight);
            setLocalHeightTo(maxHeight);
          }
      
          setMeasurements(data);
         
        });
    }
  }, [selectedFlight, selectedCollection]);
  
  useEffect(() => {
    fetchMeasurements();
  }, [fetchMeasurements]);


  const filterMeasurementsByHeight = useCallback(() => {
    let validData = measurements.filter(m => m.lat >= 0 && m.lon >= 0 && m.dose >= 0 && m.dosew >= 0 && m.countw<1000000);
    if (heightFilterActive) {
    validData = validData.filter(m => 
      (m.height >= heightFilterFrom && m.height <= heightFilterTo)) 
    }

    setValidMeasurements(validData);
  }, [measurements, heightFilterFrom, heightFilterTo, heightFilterActive]);

  useEffect(() => {
    filterMeasurementsByHeight()
  }, [heightFilterFrom, heightFilterTo, filterMeasurementsByHeight]); 

  return (
    <FlightDataContext.Provider value={{
      selectedFlight,
      setSelectedFlight,
      selectedCollection,
      setSelectedCollection,
      measurements,
      setMeasurements,
      minDoseValue,
      maxDoseValue,
      geoCenter,
      validMeasurements,
      heightFrom, 
      setHeightFrom,
      heightTo, 
      setHeightTo,
      heightFilterFrom, 
      setHeightFilterFrom,
      heightFilterTo, 
      setHeightFilterTo,
      localHeightFrom, 
      setLocalHeightFrom,
      localHeightTo, 
      setLocalHeightTo
    }}>
      {children}
    </FlightDataContext.Provider>
  );
};
