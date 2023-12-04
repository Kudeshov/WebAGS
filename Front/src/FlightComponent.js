import React, { useState, useEffect, useContext } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography'; // Import Typography

import { FlightContext } from './App';

const FlightComponent = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const { selectedFlight } = useContext(FlightContext);

  useEffect(() => {
    if (!selectedFlight) return;
    setLoading(true);
    fetch(`http://localhost:3001/api/collection/${selectedFlight}`)
      .then(response => response.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Ошибка при загрузке данных:', error);
        setLoading(false);
      });
  }, [selectedFlight]);

  const handleSelectionChange = (event, value) => {
    setSelectedItem(value);
  };

  function convertDateTime(dateTimeString) {

    if (!dateTimeString)
      return;
    const date = new Date(dateTimeString);
  
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Месяцы начинаются с 0
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
  
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  }
  
 
  return (
    <div>
      <br/>
      <Autocomplete
        options={data}
        getOptionLabel={(option) => option.description || ''}
        onChange={handleSelectionChange}
        renderInput={(params) => (
          <TextField 
            {...params}
            size="small" 
            label="Выберите полет" 
            variant="outlined" 
            loading={loading}
          />
        )}
      />

      <TextField
        label="P0"
        value={selectedItem ? selectedItem.P0 : ''}
        size="small"
        variant="outlined"
        margin="normal"
        fullWidth
        disabled={!selectedItem}
      />

      <TextField
        label="P1"
        size="small"
        value={selectedItem ? selectedItem.P1 : ''}
        variant="outlined"
        margin="normal"
        fullWidth
        disabled={!selectedItem}
      />

      {/* Typography to display dateTime */}
      {selectedItem && (
        <Typography variant="subtitle1" gutterBottom>
          Дата: {convertDateTime(selectedItem.dateTime)}
        </Typography>
      )}
    </div>
  );
};

export default FlightComponent; 