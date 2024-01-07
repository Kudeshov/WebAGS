import React, { createContext, useState, useEffect, useCallback } from 'react';

const initialCenter = {
  lat: 55.704034038232834,
  lng: 37.62119540524117
};

export const FlightDataContext = createContext();

export const FlightDataProvider = ({ children }) => {
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

  const fetchCollections = useCallback(() => {
    console.log('вызвана fetchCollections')
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
    console.log('вызвана fetchCollections из useEffect')
    fetchCollections();
  }, [fetchCollections]);

  /* const fetchMeasurements = useCallback(() => {
    if (selectedFlight && selectedCollection) {
      const apiUrl = `http://localhost:3001/api/data/${selectedFlight}/${selectedCollection?._id || null}`;
      fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
          const validData = data.filter(m => m.lat >= 0 && m.lon >= 0);
  
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
          }
  
          setMeasurements(data);
        })
        .catch(error => console.error('Ошибка при загрузке данных:', error));
    }
  }, [selectedFlight, selectedCollection]); */

  const fetchMeasurements = useCallback(() => {
    if (selectedFlight && selectedCollection) {
      const apiUrl = `http://localhost:3001/api/data/${selectedFlight}/${selectedCollection?._id || null}`;
      fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
          const validData = data.filter(m => m.lat >= 0 && m.lon >= 0);

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

            setHeightFilterFrom(minHeight);
            setHeightFilterTo(maxHeight);
          }
  
          setMeasurements(data);
        });
    }
  }, [selectedFlight, selectedCollection]);
  
  useEffect(() => {
    fetchMeasurements();
  }, [fetchMeasurements]);

  
  
  useEffect(() => {
    fetchMeasurements();
  }, [fetchMeasurements]);

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
      setHeightFilterTo
    }}>
      {children}
    </FlightDataContext.Provider>
  );
};
