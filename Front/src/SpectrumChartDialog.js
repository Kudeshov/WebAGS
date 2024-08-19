import React, { useRef, useState, useContext, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  
  Filler
} from 'chart.js';

import { DataGrid } from '@mui/x-data-grid';
import { convertDateTime } from './dateUtils';
import zoomPlugin from 'chartjs-plugin-zoom';
import { Box, Typography, Checkbox, Grid, Button } from '@mui/material';
import { FlightDataContext } from './FlightDataContext';

// Регистрация компонентов ChartJS
ChartJS.register(CategoryScale, LinearScale, LogarithmicScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, zoomPlugin);

function SpectrumChart({ data, selectedCollection, averageHeight, timeInterval, width = 330, height = 200 }) {
  // Получение глобальных настроек через контекст
  const { globalSettings } = useContext(FlightDataContext);

  const [scale, setScale] = useState('linear');
  const [tableData, setTableData] = useState([]);
  const [energyRanges, setEnergyRanges] = useState([]);

  const chartRef = useRef(null);

  // Извлечение параметров калибровки и типа датчика
  const { P0 = 70, P1 = 11, sensorType = 'УДКГ-А01' } = selectedCollection || {};

  // Определение зон интереса на основе выбранного типа датчика
  const zonesOfInterest = globalSettings.sensorTypes[sensorType]?.zonesOfInterest || globalSettings.sensorTypes["УДКГ-А01"].zonesOfInterest;

  // Эффект для инициализации таблицы данных и диапазонов энергии
  useEffect(() => {
    if (zonesOfInterest.length > 0) {
      const initialTableData = zonesOfInterest.map(zone => ({
        id: zone.id,
        leftE: zone.leftE,
        rightE: zone.rightE,
        rate: 0, // Изначально скорость счета устанавливаем в 0, она обновится позже
        name: zone.Name
      }));
      setTableData(initialTableData);
      setEnergyRanges(initialTableData.map(zone => ({ id: zone.id, leftE: zone.leftE, rightE: zone.rightE })));
    }
  }, [zonesOfInterest]);

  // Эффект для обновления скоростей счета в таблице
  useEffect(() => {
    if (data && energyRanges.length > 0) {
      const updatedTableData = energyRanges.map((range) => {
        // Для leftIndex используем Math.ceil для точного попадания в интервал
        const leftIndex = Math.max(Math.ceil((range.leftE - P0) / P1), 0);
        // Для rightIndex используем Math.floor для точного попадания в интервал
        const rightIndex = Math.min(Math.floor((range.rightE - P0) / P1), data.length - 1);
  
        // Обновляем логику для пересчета скорости счета
        const rateSum = data.slice(leftIndex, rightIndex + 1).reduce((sum, point) => sum + point.value, 0);
        const numberOfPoints = rightIndex - leftIndex + 1; // Количество точек
        const rate = rateSum / (numberOfPoints * globalSettings.SPECDEFTIME || globalSettings.SPECDEFTIME); // Делим на количество точек
        
        console.log('numberOfPoints', numberOfPoints, leftIndex, rightIndex, P0, P1, leftIndex * P1 + P0, rightIndex * P1 + P0);
        const correspondingRow = tableData.find(row => row.id === range.id);
  
        return {
          ...correspondingRow,
          leftE: range.leftE,
          rightE: range.rightE,
          rate: rate.toFixed(2)
        };
      });
  
      setTableData(updatedTableData);
    }
  }, [data, energyRanges, P0, P1, globalSettings.SPECDEFTIME]);
   


  // Функция для загрузки CSV
  function downloadCsv(csvContent, fileName) {
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    
    link.click();
    document.body.removeChild(link);
  }

  // Экспорт данных в CSV
  function exportToCsv(data) {
    const headers = "Канал;Счет (имп);Энергия (кЭв);Счет (имп/с)\n";

    if (!timeInterval) {
      timeInterval = 1;
    }
    const metaInfo =  
    `Полет:;;${selectedCollection.description}
    Дата:;${convertDateTime(selectedCollection.dateTime)}
    Средняя высота:;${averageHeight};м
    Калибровочные коэффициенты:;${P0};кэВ
     ;${P1};кэВ/канал
    Время (количество точек):;${timeInterval};с\n\n`;

    let measurementsData = "";
    data.forEach((item, index) => {
      const calculatedEnergy = `=A${index + 9}*$B$5+$B$4`;
      const calculatedRate = `=B${index + 9}/$B$6`;
      measurementsData += `${index};${item.count};${calculatedEnergy};${calculatedRate}\n`;
    });

    const csvContent = metaInfo + headers + measurementsData;
    downloadCsv(csvContent, "spectrum.csv");
  }

  // Экспорт данных в формат N42
  function exportToN42(data, selectedCollection, averageHeight, timeInterval) {
    if (!timeInterval) {
      timeInterval = 1;
    }
    const liveTime = timeInterval;
    const realTime = timeInterval;
    const coefficients = `${selectedCollection.P0} ${selectedCollection.P1} 0 0`;
    const channelData = data.map(item => item.value).join(' ');

    const xmlContent = 
        `<?xml version="1.0" encoding="UTF-8"?>
        <N42InstrumentData>
            <Measurement>
            <Spectrum Type="PHA">
                <LiveTime>${liveTime}</LiveTime>
                <RealTime>${realTime}</RealTime>
                <Calibration Type="Energy">
                <Equation Model="Polynomial">
                    <Coefficients>${coefficients}</Coefficients>
                </Equation>
                </Calibration>
                <ChannelData>${channelData}</ChannelData>
            </Spectrum>
            </Measurement>
        </N42InstrumentData>`;

    const fileName = "spectrum.n42";
    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Функция для вычисления энергии
  function calculateEnergy(index, P0, P1) {
    return P0 + P1 * index;
  }

  // Настройки для графика
/*   const preprocessData = {
    labels: data.map((_, index) => calculateEnergy(index, P0, P1)),
    datasets: [{
      label: 'Спектр',
      data: data.map(point => point.value),
      fill: false,
      borderColor: 'rgba(0, 0, 255, 1)',
      backgroundColor: 'rgba(0, 0, 255, 0.1)',
      pointRadius: 0,
      tension: 0.1
    }]
  }; */

  // Используем один цвет для всех зон интереса
  const highlightColor = 'rgba(0, 128, 255, 0.2)'; // Голубой цвет с прозрачностью

  const preprocessData = {
    labels: data.map((_, index) => calculateEnergy(index, P0, P1)),
    datasets: [
      // Основной спектр
      {
        label: 'Спектр',
        data: data.map(point => point.value),
        fill: false,
        borderColor: 'rgba(0, 0, 255, 1)',
        backgroundColor: 'rgba(0, 0, 255, 0.1)',
        pointRadius: 0,
        tension: 0.1
      },
      // Подсветка для зон интереса
      ...zonesOfInterest.map((zone) => {
        // Используем точное преобразование значений энергий в индексы
        const leftEnergy = zone.leftE;
        const rightEnergy = zone.rightE;
  
        // Находим индексы для левой и правой границ зоны
        const leftIndex = data.findIndex((_, index) => calculateEnergy(index, P0, P1) >= leftEnergy);
        const rightIndex = data.findIndex((_, index) => calculateEnergy(index, P0, P1) >= rightEnergy);
  
        // Создание массива для подсветки только в пределах зон интереса
        const highlightData = data.map((point, index) => {
          if (index >= leftIndex && index <= rightIndex) {
            return point.value; // Только внутри диапазона зона интереса
          }
          return null; // Снаружи зоны - нет заполнения
        });
  
        return {
          label: `Зона: ${zone.Name}`,
          data: highlightData,
          fill: 'origin', // Заполнение от оси X
          backgroundColor: highlightColor, // Один голубой цвет
          pointRadius: 0,
          borderWidth: 0, // Без границы, только цветная область
          tension: 0.1,
        };
      })
    ]
  };
  

  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: false
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'xy',
        },
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true
          },
          mode: 'xy',
        }
      }
    },
    scales: {
      x: {
        type: 'linear',
        position: 'bottom',
        title: {
          display: true,
          text: 'Энергия (keV)'
        }
      },
      y: {
        type: scale === 'log' ? 'logarithmic' : 'linear',
        position: 'left',
        title: {
          display: true,
          text: 'Скорость счета 1/с'
        },
        min: 0
      }
    }
  };

  // Обработка обновления строки
  const processRowUpdate = (updatedRow, originalRow) => {
    const updatedEnergyRanges = energyRanges.map((range) =>
      range.id === updatedRow.id ? { ...range, leftE: updatedRow.leftE, rightE: updatedRow.rightE } : range
    );

    setEnergyRanges(updatedEnergyRanges);

    return updatedRow;
  };

  // Обработка ошибки обновления строки
  const handleProcessRowUpdateError = (error) => {
    console.error('Ошибка обновления строки:', error);
  };

  // Определение столбцов для таблицы
  const columns = [
    { field: 'id', headerName: '#', width: 50 },
    { field: 'leftE', headerName: 'leftE', width: 100, editable: true },
    { field: 'rightE', headerName: 'rightE', width: 100, editable: true },
    { field: 'rate', headerName: 'S(1/c)', width: 100 },
    { field: 'name', headerName: 'Name', width: 150 },
  ];
  
  return (
    <div style={{ cursor: 'pointer', position: 'relative', padding: '0px' }}>

      <Box sx={{ height: '340px', width: '100%' }}> {/* Установите нужную высоту */}
      <Line 
        ref={chartRef} 
        data={preprocessData} 
        options={{ 
          ...options, 
          maintainAspectRatio: false  // Отключаем соотношение сторон, чтобы график адаптировался по высоте
        }} 
      />
      </Box>
     {/*  <Line ref={chartRef} data={preprocessData} options={options} style={{ height: '300px' }} /> */}

     <Grid container spacing={2}> {/* Добавляем отступы между элементами */}
  <Grid item xs={3} sm={3}>
    {/* Внешний контейнер с вертикальной ориентацией */}
    <Box sx={{ display: 'flex', flexDirection: 'column', marginTop: '10px' }}>
      {/* Чекбокс с логарифмической шкалой */}
      <Box sx={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
        <Checkbox
          checked={scale === 'log'}
          onChange={(e) => setScale(e.target.checked ? 'log' : 'linear')}
          id="scaleCheckboxDialog"
        />
        <Typography htmlFor="scaleCheckboxDialog">Логарифмическая шкала</Typography>
      </Box>

      {/* Кнопка сброса масштаба */}
      <Button
        onClick={() => {
          const chart = chartRef.current;
          if (chart) {
            chart.resetZoom();
          }
        }}
        variant="contained"
        color="primary"
        sx={{ marginBottom: '10px' }}  
      >
        Сбросить масштаб
      </Button>

      {/* Блок сохранения спектра */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}> {/* Выравниваем кнопки по началу */}
        <Typography>Сохранить спектр</Typography>
        <Button
          onClick={() => exportToCsv(data)}
          variant="contained"
          color="primary"
          sx={{ marginBottom: '5px' }}  
        >
          .CSV
        </Button>
        <Button
          onClick={() => exportToN42(data, selectedCollection, averageHeight, timeInterval)}
          variant="contained"
          color="primary"
        >
          .N42
        </Button>
      </Box>
    </Box>
  </Grid>

  <Grid item xs={9} sm={9} sx={{ display: 'flex', justifyContent: 'flex-end' }}> {/* Выравниваем таблицу по правой стороне */}
    {/* Таблица должна быть выровнена по правой стороне */}
    <Box sx={{ width: '100%', marginBottom: '10px' }}>
      <Typography align="right" sx={{ marginBottom: '5px' }}>Зоны интереса</Typography> {/* Выровнено по правой стороне */}
      <DataGrid 
        rows={tableData} 
        columns={columns}
        rowHeight={25}
        pageSize={5} 
        hideFooter={true}
        processRowUpdate={processRowUpdate}
        onProcessRowUpdateError={handleProcessRowUpdateError}
        sx={{ 
          '& .MuiDataGrid-cell': { padding: '2px 8px' }, 
          justifyContent: 'flex-end'  // Выравнивание ячеек по правому краю 
        }}
      />
    </Box>
  </Grid>
</Grid>


    </div>
  );
}

export default SpectrumChart;