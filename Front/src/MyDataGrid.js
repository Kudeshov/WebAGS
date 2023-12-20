import React, { useEffect, useState, useContext } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { FlightContext, CollectionContext } from './App';

const MyDataGrid = () => {
  const { selectedFlight } = useContext(FlightContext);
  const { selectedCollection } = useContext(CollectionContext);

  const [data, setData] = useState([]);
  const columns = [
    { field: 'id', headerName: 'ID', width: 60, hide: true },
    {
      field: 'datetime',
      headerName: 'Время',
      width: 70,
      valueFormatter: (params) => {
        // Преобразование ISO строки в объект Date
        const date = new Date(params.value);
        // Форматирование даты, чтобы отобразить только время
        return date.toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      }
    },
    { field: 'lat', headerName: 'Широта', width: 80 },
    { field: 'lon', headerName: 'Долгота', width: 80 },
    { field: 'alt', headerName: 'Высота', width: 70 },
    { field: 'dose', headerName: 'МЭД', width: 70 },
    { field: 'spectrumValue', headerName: 'Значение спектра', width: 200, hide: true },
  ];

  useEffect(() => {
    if (!selectedFlight) return;
  
    const apiUrl = `http://localhost:3001/api/data/${selectedFlight}/${selectedCollection?._id || null}`;
    fetch(apiUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Ошибка при загрузке данных');
        }
        return response.json();
      })
      .then((fetchedData) => {
        // Round latitude, longitude to 6 decimal places, and altitude to 3 decimal places
        const roundedData = fetchedData.map(item => ({
          ...item,
          lat: item.lat.toFixed(6),
          lon: item.lon.toFixed(6),
          alt: item.alt.toFixed(2),
          dose: item.dose.toFixed(2)
        }));
        setData(roundedData);
      })
      .catch((error) => {
        console.error('Ошибка при загрузке данных:', error);
      });
  }, [selectedFlight]);

  return (
    <div style={{ height: window.innerHeight - 70, width: '100%' }}>
      <DataGrid
        rows={data}
        columns={columns}
        rowHeight={24} // Уменьшенная высота строки
        sx={{
          '& .MuiDataGrid-cell': {
            fontSize: '12px', // Мелкий шрифт
          },
        }}
        paginationMode="server"
        /* hideFooterPagination */
        initialState={{
          sorting: {
            sortModel: [{ field: 'id', sort: 'desc' }], // Сортировка по убыванию для столбца id
          },
          columns: {
            columnVisibilityModel: {
              id: false,
              spectrumValue: false,
            },
          },
        }}     
        hideFooter // Скрытие нижней панели
      />
    </div>
  );
};

export default MyDataGrid;
