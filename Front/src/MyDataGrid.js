import React, { useState, useEffect, useContext, useRef } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { FlightDataContext } from './FlightDataContext';
import { getColorT } from './colorUtils';
import { useGridScrollPagination } from './gridScrollHelper';

const MyDataGrid = ({ heightFilterActive }) => {
  const { measurements, heightFrom, heightTo } = useContext(FlightDataContext);
  const { selectedPoints, setSelectedPoints } = useContext(FlightDataContext);
  const { selectionSource, setSelectionSource } = useContext(FlightDataContext);
  const { colorThresholds, minDoseValue, maxDoseValue } = useContext(FlightDataContext);
  const { globalSettings } = useContext(FlightDataContext);
  const dataGridRef = useRef(null);
  const apiRef = useRef(null);
  const [rowSelectionModel, setRowSelectionModel] = useState([]);

  const handleRowSelection = (newSelectionModel) => {
    const selectedMeasurements = newSelectionModel.map(id => 
      measurements.find(measurement => measurement.id === id)
    );
    //console.log('handleRowSelection selectedMeasurements:', selectedMeasurements);
    setSelectedPoints(selectedMeasurements);
    setSelectionSource('table'); // Установка источника выбора в 'table'
  };

  useEffect(() => {
    if (selectedPoints.length > 0 && selectionSource === 'map') {
      const targetPointId = selectedPoints[0].id;
      console.log(targetPointId);
      scrollToIndexRef.current = targetPointId;
    }
  }, [selectedPoints, selectionSource, setRowSelectionModel]);  

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
    
  const {
    paginationModel,
    setPaginationModel,
    handleScrollToRow,
    scrollToIndexRef
  } = useGridScrollPagination(apiRef, measurements, setRowSelectionModel);

    
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
      field: globalSettings.altitudeSource === 'barometric' ? 'height' : 'alt',
      headerName: 'Высота',
      width: 70,
      valueFormatter: (params) => params.value.toFixed(2),
    },
/*     {
      field: 'dose',
      headerName: 'МЭД',
      width: 70,
      valueFormatter: (params) => params.value.toFixed(2),
    }, */
    {
      field: 'dose',
      headerName: 'МЭД',
      width: 80,
      renderCell: (params) => {
        const color = getColorT(params.value, colorThresholds, minDoseValue, maxDoseValue); // Получаем цвет для значения дозы
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <div style={{ 
              height: '12px',
              width: '12px',
              backgroundColor: color,
              borderRadius: '50%'
            }} />
            <div>{params.value.toFixed(2)}</div>
          </div>
        );
      },
    },    
    { field: 'spectrumValue', headerName: 'Значение спектра', width: 200, hide: true },
  ];

  return (
    <div style={{ height: 'calc(100vh - 64px)', width: '100%' }}>
      <DataGrid
        ref={dataGridRef}
        apiRef={apiRef}
        rows={filteredMeasurements}
        columns={columns}
        rowHeight={28} // Уменьшенная высота строки
        sx={{
          '& .MuiDataGrid-cell': {
            fontSize: '12px', // Мелкий шрифт
          },
          "& .MuiDataGrid-row.Mui-selected": {
            backgroundColor: "lightgray !important", // Красный цвет для выбранных строк
          },
          "& .MuiDataGrid-cell:focus-within": {
            outline: "none !important",
          },
          '& .MuiDataGrid-columnHeaderCheckbox, & .MuiDataGrid-cellCheckbox': {
            width: '20px', // Уменьшенная ширина
            minWidth: '20px', // Убедитесь, что ширина не станет больше этого значения
            maxWidth: '20px', // Убедитесь, что ширина не станет больше этого значения
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
