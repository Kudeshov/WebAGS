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

import { convertDateTime } from './dateUtils';
import zoomPlugin from 'chartjs-plugin-zoom';

ChartJS.register(CategoryScale, LinearScale, LogarithmicScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, zoomPlugin);

function SpectrumChart({ data, selectedCollection, averageHeight, timeInterval, width = 330, height = 200 }) {
  const [scale, setScale] = useState('linear');
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
    labels: data.map((_, index) => calculateEnergy(index, P0, P1)),
    datasets: [{
      label: 'Спектр',
      data: data.map(point => point.value === 0 ? 0.01 : point.value),
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
  
  return (
   
    <div  style={{ cursor: 'pointer' }} >
    <Line ref={chartRef} data={preprocessData} options={options} margin={{ top: 5, right: 5, left: -10, bottom: 15 }} />


      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
        <div>
          <input
            type="checkbox"
            id="scaleCheckboxDialog"
            checked={scale === 'log'}
            onChange={(e) => setScale(e.target.checked ? 'log' : 'linear')}
          />
          <label htmlFor="scaleCheckboxDialog" style={{ marginLeft: '8px' }}>Логарифмическая шкала</label>
        </div>
        <div style={{ textAlign: 'right', marginRight: '6px' }}>
          Сохранить спектр
        </div>
      </div>         
    <div style={{ position: 'absolute', left: '5px', bottom: '5px' }}>
      <button
        onClick={() => {
          const chart = chartRef.current;
          if (chart) {
            chart.resetZoom();  // Убедитесь, что вы вызываете resetZoom у ChartJS
          }
        }}
        style={{
          fontSize: '0.75rem',
          color: 'white',
          backgroundColor: '#1976d2',
          border: 'none',
          borderRadius: '4px',
          padding: '6px 16px',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        Сбросить масштаб
      </button>
    </div>
  
    <div style={{ position: 'absolute', right: '5px', bottom: '5px' }}>
      <button
        onClick={() => exportToCsv(data)}
        style={{
          fontSize: '0.75rem',
          color: 'white',
          backgroundColor: '#1976d2',
          border: 'none',
          borderRadius: '4px',
          padding: '6px 16px',
          cursor: 'pointer',
          outline: 'none',
          marginRight: '10px',
        }}
      >
        .CSV
      </button>
      <button
        onClick={() => exportToN42(data, selectedCollection, averageHeight, timeInterval)}
        style={{
          fontSize: '0.75rem',
          color: 'white',
          backgroundColor: '#1976d2',
          border: 'none',
          borderRadius: '4px',
          padding: '6px 16px',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        .N42
      </button>
    </div>
  </div>
  );
}

export default SpectrumChart;
