import React, { useRef, useState } from 'react';
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
import { Box, Typography, Checkbox, Button } from '@mui/material';


ChartJS.register(CategoryScale, LinearScale, LogarithmicScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, zoomPlugin);


function SpectrumChart({ data, selectedCollection, averageHeight, timeInterval, width = 330, height = 200 }) {
  const [scale, setScale] = useState('linear');
  const [tableData, setTableData] = useState(
    data.map((point, index) => ({
      id: index,
      leftE: calculateEnergy(index, selectedCollection.P0, selectedCollection.P1),
      rightE: calculateEnergy(index + 1, selectedCollection.P0, selectedCollection.P1),
      rate: point.value === 0 ? 0.01 : point.value,
      name: `Point ${index}`
    }))
  );
  const chartRef = useRef(null);

  const { P0 = 70, P1 = 11 } = selectedCollection || {};

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

  function calculateEnergy(index, P0, P1) {
    return P0 + P1 * index;
  }

  if (!data?.length) {
    return (
      <div style={{ textAlign: 'center', padding: '20px', color: 'gray' }}>
        Выберите точку на карте
      </div>
    );
  }

  const preprocessData = {
    labels: tableData.map((row) => row.leftE),
    datasets: [{
      label: 'Спектр',
      data: tableData.map(point => point.rate),
      fill: false,
      borderColor: 'rgba(0, 0, 255, 1)',
      backgroundColor: 'rgba(0, 0, 255, 0.1)',
      pointRadius: 0,
      tension: 0.1
    }]
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
        }
      }
    }
  };

  const handleCellEditCommit = (params) => {
    const updatedData = [...tableData];
    const index = updatedData.findIndex((row) => row.id === params.id);
    updatedData[index] = { ...updatedData[index], [params.field]: params.value };
    setTableData(updatedData);
  };

  const columns = [
    { field: 'id', headerName: '#', width: 50 },
    { field: 'leftE', headerName: 'leftE', width: 150, editable: true },
    { field: 'rightE', headerName: 'rightE', width: 150, editable: true },
    { field: 'rate', headerName: 'S(1/c)', width: 150 },
    { field: 'name', headerName: 'Name', width: 150 },
  ];
  
  return (
    <div style={{ position: 'relative', padding: '10px' }}>
      <Line ref={chartRef} data={preprocessData} options={options} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Checkbox
            checked={scale === 'log'}
            onChange={(e) => setScale(e.target.checked ? 'log' : 'linear')}
            id="scaleCheckboxDialog"
          />
          <Typography htmlFor="scaleCheckboxDialog">Логарифмическая шкала</Typography>
        </Box>
        <Typography>Сохранить спектр</Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
        <Button
          onClick={() => {
            const chart = chartRef.current;
            if (chart) {
              chart.resetZoom();
            }
          }}
          variant="contained"
          color="primary"
        >
          Сбросить масштаб
        </Button>
        <Box>
          <Button
            onClick={() => exportToCsv(data)}
            variant="contained"
            color="primary"
            sx={{ marginRight: '10px' }}
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
      <Box sx={{ height: 400, width: '100%', marginTop: '20px' }}>
        <DataGrid 
          rows={tableData} 
          columns={columns} 
          pageSize={5} 
          rowsPerPageOptions={[5]} 
          onCellEditCommit={handleCellEditCommit}
        />
      </Box>
    </div>
  );
}


export default SpectrumChart;
