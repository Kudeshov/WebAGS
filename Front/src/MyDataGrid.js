import React, { useState, useEffect, useContext } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { FlightDataContext } from './FlightDataContext';

const MyDataGrid = ({ heightFilterActive }) => {
  const { measurements, heightFrom, heightTo } = useContext(FlightDataContext);
  const { selectedPoints, setSelectedPoints } = useContext(FlightDataContext);

  const [rowSelectionModel, setRowSelectionModel] = useState([]);

  const handleRowSelection = (newSelectionModel) => {
    const selectedMeasurements = newSelectionModel.map(id => 
      measurements.find(measurement => measurement.id === id)
    );
    //console.log('handleRowSelection selectedMeasurements:', selectedMeasurements);
    setSelectedPoints(selectedMeasurements);
  };

  useEffect(() => {
    // Получаем ID из selectedPoints
    const newSelectionModel = selectedPoints.map((point) => point.id);
    setRowSelectionModel(newSelectionModel);
  }, [selectedPoints]);
  
  // Фильтрация данных измерений по высоте
  const filteredMeasurements = heightFilterActive 
    ? measurements.filter(measurement => 
        measurement.height >= heightFrom && measurement.height <= heightTo)
    : measurements;
    
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
    {
      field: 'dose',
      headerName: 'МЭД',
      width: 70,
      valueFormatter: (params) => params.value.toFixed(2),
    },
    { field: 'spectrumValue', headerName: 'Значение спектра', width: 200, hide: true },
  ];

  return (
    <div style={{ height: 'calc(100vh - 64px)', width: '100%' }}>
      <DataGrid
        rows={filteredMeasurements}
        columns={columns}
        rowHeight={24} // Уменьшенная высота строки
        sx={{
          '& .MuiDataGrid-cell': {
            fontSize: '12px', // Мелкий шрифт
          },
          "& .MuiDataGrid-row.Mui-selected": {
            backgroundColor: "red !important", // Красный цвет для выбранных строк
          },
          "& .MuiDataGrid-cell:focus-within": {
            outline: "none !important",
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
        onRowSelectionModelChange={(ids) => {
          handleRowSelection(ids);
          console.log(rowSelectionModel)
        }}
        rowSelectionModel={rowSelectionModel}
        disableSelectionOnClick //={false}
        checkboxSelection // Добавьте это, если вы хотите использовать чекбоксы для выбора
      />
    </div>
  );
};

export default MyDataGrid;
