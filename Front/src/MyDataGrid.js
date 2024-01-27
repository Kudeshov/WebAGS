import React, { useContext } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { FlightDataContext } from './FlightDataContext';

const MyDataGrid = ({ heightFilterActive }) => {
  const { measurements, heightFrom, heightTo } = useContext(FlightDataContext);
  const { selectedPoints, setSelectedPoints } = useContext(FlightDataContext);
  
/*   const handleSelectionChange = (newSelectionModel) => {
    console.log('handleSelectionChange');
    // Получить данные измерений для выбранных ID
    const selectedMeasurements = newSelectionModel.map(id => 
      measurements.find(measurement => measurement.id === id)
    );
  
    setSelectedPoints(selectedMeasurements);
  }; */
  
  const handleRowSelection = (newSelectionModel) => {
    console.log('handleRowSelection');
    const selectedMeasurements = newSelectionModel.map(id => 
      measurements.find(measurement => measurement.id === id)
    );
    setSelectedPoints(selectedMeasurements);
  };

  const handleRowClick = (params) => {
    // Проверяем, выбрана ли строка уже
    console.log('handleRowClick');
    const isCurrentlySelected = selectedPoints.some(point => point.id === params.row.id);

    if (isCurrentlySelected) {
      // Если уже выбрана, убираем из выбранных
      setSelectedPoints(selectedPoints.filter(point => point.id !== params.row.id));
    } else {
      // Если не выбрана, добавляем в выбранные
      setSelectedPoints([...selectedPoints, params.row]);
    }
  };
  
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
        onSelectionModelChange={handleRowSelection}
        //onRowClick={handleRowClick}
        //selectionModel={selectedPoints.map(point => point.id)} // Использование id выбранных точек для selectionModel
        checkboxSelection // Добавьте это, если вы хотите использовать чекбоксы для выбора
        disableSelectionOnClick // Добавьте это, чтобы предотвратить снятие выделения при клике на строку
      
      />
    </div>
  );
};

export default MyDataGrid;
