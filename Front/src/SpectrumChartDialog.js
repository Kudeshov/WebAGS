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
  const { isotopes, currentSensorType = "УДКГ-А01", globalSettings } = useContext(FlightDataContext);

  const [scale, setScale] = useState('linear');
  const [tableData, setTableData] = useState([]);
  const [energyRanges, setEnergyRanges] = useState([]);

  const chartRef = useRef(null);

  // Извлечение параметров калибровки и типа датчика
  const { P0 = 70, P1 = 11, sensorType = 'УДКГ-А01' } = selectedCollection || {};

  // Определение зон интереса на основе выбранного типа датчика
  const zonesOfInterest = globalSettings.sensorTypes[sensorType]?.zonesOfInterest || globalSettings.sensorTypes["УДКГ-А01"].zonesOfInterest;

  const calculatePeakBounds = (energyPeak, resolutionPercent) => {
    const resolution = resolutionPercent/100;
    const energyCs137 = 661.7; // эталонная энергия для Cs-137
    const FWHM_Cs137 = resolution * energyCs137;
    const sigmaCs137 = FWHM_Cs137 / 2.35;

    const sigmaCurrent = sigmaCs137 * Math.sqrt(energyPeak / energyCs137);
    const leftBound = energyPeak - 3 * sigmaCurrent;
    const rightBound = energyPeak + 3 * sigmaCurrent;

    return { leftBound: leftBound.toFixed(2), rightBound: rightBound.toFixed(2) };
  };

  // Эффект для инициализации таблицы данных и диапазонов энергии
  useEffect(() => {
    if (zonesOfInterest.length > 0 && isotopes?.isotopes) {
      const initialTableData = zonesOfInterest.map(zone => {
        // Находим изотоп, связанный с текущей зоной
        const isotope = isotopes.isotopes.find(isotope => isotope.id === zone.isotope_id);
        
        if (isotope) {
          // Находим пик, связанный с текущей зоной
          const peak = isotope.peaks.find(peak => peak.id === zone.peak_id);
          
          if (peak) {
            // Рассчитываем границы пика
            const { leftBound, rightBound } = calculatePeakBounds(
              peak.energy_keV,
              globalSettings.sensorTypes[currentSensorType].resolution
            );
  
            return {
              id: zone.id,
              leftE: leftBound,
              rightE: rightBound,
              rate: 0, // Изначально скорость счета устанавливаем в 0
              name: isotope.name // Имя изотопа
            };
          }
        }
        // Возвращаем значение по умолчанию, если не удалось найти изотоп или пик
        return {
          id: zone.id,
          leftE: null,
          rightE: null,
          rate: 0,
          name: 'Unknown'
        };
      });
  
      // Устанавливаем данные таблицы и диапазоны энергии
      setTableData(initialTableData);
      setEnergyRanges(initialTableData.map(zone => ({
        id: zone.id,
        leftE: zone.leftE,
        rightE: zone.rightE
      })));
    }
  }, [zonesOfInterest, isotopes]);

  useEffect(() => {
    if (data && energyRanges.length > 0) {
      // Обновление таблицы
      const updatedTableData = energyRanges.map((range) => {
        const leftIndex = Math.max(Math.ceil((range.leftE - P0) / P1), 0);
        const rightIndex = Math.min(Math.floor((range.rightE - P0) / P1), data.length - 1);
        const rateSum = data.slice(leftIndex, rightIndex + 1).reduce((sum, point) => sum + point.value, 0);
        const numberOfPoints = rightIndex - leftIndex + 1;
        const rate = rateSum / (numberOfPoints * globalSettings.SPECDEFTIME || globalSettings.SPECDEFTIME);
  
        const correspondingRow = tableData.find(row => row.id === range.id);
  
        return {
          ...correspondingRow,
          leftE: range.leftE,
          rightE: range.rightE,
          rate: rate.toFixed(2)
        };
      });
  
      setTableData(updatedTableData);
  
      // Обновление данных для графика
      const updatedPreprocessData = {
        // Здесь создаем метки для энергии на нижней оси
        labels: data.map((_, index) => calculateEnergy(index, P0, P1)),
        datasets: [
          {
            label: 'Спектр',
            data: data.map(point => point.value),
            iChannel: data.map(point => point.id),
            fill: false,
            borderColor: 'rgba(0, 0, 255, 1)',
            backgroundColor: 'rgba(0, 0, 255, 0.1)',
            pointRadius: 0,
            tension: 0.1
          },
          ...energyRanges.map((range) => {
            const leftIndex = Math.max(Math.ceil((range.leftE - P0) / P1), 0);
            const rightIndex = Math.min(Math.floor((range.rightE - P0) / P1), data.length - 1);
  
            const highlightData = data.map((point, index) => (index >= leftIndex && index <= rightIndex ? point.value : null));
  
            return {
              label: `Зона: ${range.name}`,
              data: highlightData,
              fill: 'origin',
              iChannel: 0,
              backgroundColor: highlightColor,
              pointRadius: 0,
              borderWidth: 0,
              tension: 0.1,
            };
          }),
        ]
      };
  
      // Важное добавление: создаем метки для оси каналов (индексы данных)
      const channelLabels = data.map((_, index) => index); // Индексы каналов
  
      // Обновляем данные для обеих осей
      setChartData({
        ...updatedPreprocessData,
        labels: updatedPreprocessData.labels, // Метки энергии остаются на нижней оси
        channelLabels: channelLabels  // Метки каналов для верхней оси
      });
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

  // Функция для загрузки TXT
  function downloadTxt(content, fileName) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    
    link.click();
    document.body.removeChild(link);
  }

  // Экспорт данных в TXT
  function exportToTxt(data) {
    let txtContent = "";
    data.forEach((item, index) => {
      // Формат строки: (канал)(пробел)(счет)
      txtContent += `${index + 1} ${item.value}\n`;  // Канал начинается с 1
    });

    // Сохраняем данные как "spectrum.txt"
    downloadTxt(txtContent, "spectrum.txt");
  }


  // Функция для вычисления энергии
  function calculateEnergy(index, P0, P1) {
    return P0 + P1 * index;
  }

  // Используем один цвет для всех зон интереса
  const highlightColor = 'rgba(0, 128, 255, 0.2)'; // Голубой цвет с прозрачностью
  
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: []
  }); // Инициализируем chartData с валидной структурой

  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        callbacks: {
          title: (tooltipItems) => {
            // Заголовок тултипа — это энергия
            const energy = tooltipItems[0].label;
            return `Энергия: ${energy} keV`;
          },
          label: (tooltipItem) => {
            // Проверяем, что это основной график (datasetIndex === 0)
            if (tooltipItem.datasetIndex === 0) {
              const channel = tooltipItem.dataIndex;  // Индекс данных как номер канала
              const countRate = tooltipItem.raw.toFixed(2);  // Округляем до 2 знаков
              return `Канал: ${channel+1}, Скорость счета: ${countRate} 1/с`;
            }
            // Возвращаем null для других наборов данных, чтобы они не отображались в тултипе
            return null;
          }
        }
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
        },
        ticks: {
          callback: function(value) {
            return value.toFixed(2);
          }
        }
      },
/*       x2: {
        type: 'linear',  // Ось каналов остается линейной
        position: 'top',
        title: {
          display: true,
          text: 'Канал'
        },
        grid: {
          drawOnChartArea: false
        },
        ticks: {
          callback: function(value) {
            const channel = Math.floor((value - P0) / P1);  // Рассчитываем номер канала
            // Отображаем только номера, которые кратны 50
            return (channel >= 0 && channel <= data.length - 1) ? channel : '';
          },
          autoSkip: true,
          maxTicksLimit: 10,
        },
        min: 0,  // Начало графика энергии (0 keV)
        max: 3000,  // Временно ставим максимальное значение, но обновим его динамически
      }, */
      y: {
        type: scale === 'log' ? 'logarithmic' : 'linear',
        position: 'left',
        title: {
          display: true,
          text: 'Скорость счета 1/с'
        },
        min: 0
      }
    },
    onHover: (event, chartElement) => {
      const chart = chartRef.current;
      if (chart) {
        chart.canvas.style.cursor = chartElement.length ? 'pointer' : 'default';
      }
    },
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
    <div style={{ cursor: 'pointer', position: 'relative', padding: '0px', marginRight: '-17px', marginLeft: '-5px', marginTop: '-5px' }}>
      <Box sx={{ height: '350px', width: '100%'  }}>  
      <Line 
        ref={chartRef} 
        data={chartData} 
        options={{ 
          ...options, 
          maintainAspectRatio: false  // Отключаем соотношение сторон, чтобы график адаптировался по высоте
        }} 
      />
      </Box>
      <Box sx={{ height: '220px', width: '100%' }}> 
      <Grid container spacing={0}>
      <Grid item xs={3} sm={3}>
        {/* Внешний контейнер с вертикальной ориентацией */}
        <Box sx={{ display: 'flex', flexDirection: 'column', marginTop: '0px' }}>
          {/* Чекбокс с логарифмической шкалой */}
          <Box sx={{ display: 'flex', flexDirection: 'row-reverse', marginRight: '-42px', alignItems: 'center', marginBottom: '10px', marginTop: '-9px' }}>
            <Checkbox
              checked={scale === 'log'}
              onChange={(e) => setScale(e.target.checked ? 'log' : 'linear')}
              id="scaleCheckboxDialog"
            />
            <Typography htmlFor="scaleCheckboxDialog" sx={{ whiteSpace: 'nowrap', marginLeft: '22px', marginRight: '8px' }}> {/* Отступ для текста */}
              Логарифмическая шкала
            </Typography>
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
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginTop: '20px' }}>  
            <Typography sx={{  marginBottom: '8px' }}>Сохранить спектр</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'flex-start' }}>  
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
            <Button
              onClick={() => exportToTxt(data)}  // Добавляем кнопку для экспорта в TXT
              variant="contained"
              color="primary"
            >
              .TXT
            </Button>
            </Box>
          </Box>
        </Box>
      </Grid>
       
      <Grid item xs={9} sm={9} sx={{ display: 'flex', justifyContent: 'flex-end' }}> {/* Выравниваем таблицу по правой стороне */}
        <Box sx={{ width: '520px', height: '159px', marginBottom: '0px', marginRight: '17px' }}>
          <Typography align="left" sx={{ marginBottom: '5px' }}>Зоны интереса</Typography> {/* Выровнено по правой стороне */}
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
    </Box>
    </div>
  );
}

export default SpectrumChart;