import React, { useEffect, useState, useContext } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { FlightContext, CollectionContext } from './App';

const MyDataGrid = () => {
  const { selectedFlight } = useContext(FlightContext);
  const { selectedCollection } = useContext(CollectionContext);

  console.log('AAAA ', selectedFlight);
  const [data, setData] = useState([]);
  const columns = [
    { field: 'id', headerName: 'ID', width: 150, hide: true },
    { field: 'lat', headerName: 'Широта', width: 150 },
    { field: 'lon', headerName: 'Долгота', width: 150 },
    { field: 'alt', headerName: 'Высота', width: 150 },
    { field: 'spectrumValue', headerName: 'Значение спектра', width: 200, hide: true },
  ];
  

  useEffect(() => {
    // Используем fetch для выполнения HTTP-запроса
    fetch( `http://localhost:3001/api/data/${selectedFlight}/${selectedCollection._id}`)
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
        initialState={{
          columns: {
            columnVisibilityModel: {
              // Hide columns status and traderName, the other columns will remain visible
              id: false,
              spectrumValue: false,
            },
          },
        }}       
      />
      
    </div>
  );
};

export default MyDataGrid;
