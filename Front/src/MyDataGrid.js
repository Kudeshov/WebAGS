import React, { useEffect, useState, useContext } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { FlightDataContext } from './FlightDataContext';

const MyDataGrid = () => {
  const { measurements } = useContext(FlightDataContext);

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
    {
      field: 'lat',
      headerName: 'Широта',
      width: 80,
      valueFormatter: (params) => params.value.toFixed(6),
    },
    {
      field: 'lon',
      headerName: 'Долгота',
      width: 80,
      valueFormatter: (params) => params.value.toFixed(6),
    },
    {
      field: 'height',
      headerName: 'Высота',
      width: 70,
      valueFormatter: (params) => params.value.toFixed(2),
    },
/*     { field: 'alt', headerName: 'Высота GPS', width: 70 }, */
    {
      field: 'dose',
      headerName: 'МЭД',
      width: 70,
      valueFormatter: (params) => params.value.toFixed(2),
    },
    { field: 'spectrumValue', headerName: 'Значение спектра', width: 200, hide: true },
  ];

  return (
    <div style={{ height: window.innerHeight - 70, width: '100%' }}>
      <DataGrid
        rows={measurements}
        columns={columns}
        rowHeight={24} // Уменьшенная высота строки
        sx={{
          '& .MuiDataGrid-cell': {
            fontSize: '12px', // Мелкий шрифт
          },
        }}
        paginationMode="server"
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
