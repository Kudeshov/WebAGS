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
  const [minDoseValue, setMinDoseValue] = useState(null);
  const [maxDoseValue, setMaxDoseValue] = useState(null);

  const [geoCenter, setGeoCenter] = useState(initialCenter);
  const [validMeasurements, setValidMeasurements] = useState([]);

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
          }
  
          setMeasurements(data);
        });
    }
  }, [selectedFlight, selectedCollection]);
  
/* 
  const fetchMeasurements = useCallback(() => {
    console.log('fetchMeasurements selectedFlight', selectedFlight, 'selectedCollection?._id ', selectedCollection?._id || null );
    if (selectedFlight && selectedCollection) {
      
      const apiUrl = `http://localhost:3001/api/data/${selectedFlight}/${selectedCollection?._id || null}`;
      console.log('fetchMeasurements apiUrl ', apiUrl);
      fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
          setMeasurements(data);
        });
    }
  }, [selectedFlight, selectedCollection]);
   */

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
      validMeasurements
    }}>
      {children}
    </FlightDataContext.Provider>
  );
};
