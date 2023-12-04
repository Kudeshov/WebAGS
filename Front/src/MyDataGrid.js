import React, { useEffect, useState, useContext } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { FlightContext } from './App';

const MyDataGrid = () => {
  const { selectedFlight } = useContext(FlightContext);

  console.log('AAAA ', selectedFlight);
  const [data, setData] = useState([]);
  const columns = [
    { field: 'id', headerName: 'ID', width: 150 },
    { field: 'lat', headerName: 'Широта', width: 150 },
    { field: 'lon', headerName: 'Долгота', width: 150 },
    { field: 'alt', headerName: 'Высота', width: 150 },
    { field: 'spectrumValue', headerName: 'Значение спектра', width: 200 },
  ];

  useEffect(() => {
    // Используем fetch для выполнения HTTP-запроса
    fetch( `http://localhost:3001/api/data/${selectedFlight}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Ошибка при загрузке данных');
        }
        return response.json();
      })
      .then((data) => {
        // Если запрос успешен, обновляем данные
        setData(data);
      })
      .catch((error) => {
        console.error('Ошибка при загрузке данных:', error);
      });
  }, [selectedFlight]);

  return (
    <div style={{ height: 500, width: '100%' }}>
      <DataGrid
        rows={data}
        columns={columns}
        pageSize={10}
        checkboxSelection
      />
    </div>
  );
};

export default MyDataGrid;
