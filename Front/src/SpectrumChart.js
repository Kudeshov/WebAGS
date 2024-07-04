import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { convertDateTime } from './dateUtils';

const formatXAxis = (tickItem) => {
  const interval = 400;
  return Math.round(tickItem / interval) * interval;
};

function SpectrumChart({ data, selectedCollection, averageHeight, timeInterval, width = 330, height = 200 }) {
  const [scale, setScale] = useState('linear');

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
    const { P0 = 70, P1 = 11 } = selectedCollection || {};

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

  //if (!data?.length) return null;

  if (!data?.length) {
    return (
      <div style={{ textAlign: 'center', padding: '20px', color: 'gray' }}>
        Выберите точку на карте
      </div>
    );
  }

  const preprocessData = data.map(point => ({
    ...point,
    value: point.value === 0 ? 0.01 : point.value
  }));

  return (
    <div>
      <LineChart width={width} height={height} data={preprocessData} margin={{ top: 5, right: 5, left: -10, bottom: 15 }}>
      <Line
          type="monotone"
          dataKey="value"
          stroke="#0000FF"
          dot={false}
          isAnimationActive={false}
        />
        <CartesianGrid stroke="#ccc" />
        <XAxis
          tickFormatter={formatXAxis}
          dataKey="energy"
          label={{ value: "Энергия (keV)", position: "bottom", offset: -1 }}
        />
        {scale === 'log' ? (
          <YAxis
            scale="log"
            domain={['auto', 'auto']}
            allowDataOverflow={true}
            label={{ value: 'Скорость счета 1/с', angle: -90, position: 'insideLeft', offset: 17, dy: 60 }}
          />
        ) : (
          <YAxis
            label={{ value: 'Скорость счета 1/с', angle: -90, position: 'insideLeft', offset: 17, dy: 60 }}
          />
        )}
        <Tooltip />
      </LineChart>
      <div style={{ textAlign: 'right', marginRight: '12px' }}>
        Сохранить спектр
      </div>

      <div style={{ marginTop: '5px', textAlign: 'left' }}>
        <input
          type="checkbox"
          id="scaleCheckbox"
          checked={scale === 'log'}
          onChange={(e) => setScale(e.target.checked ? 'log' : 'linear')}
        />
        <label htmlFor="scaleCheckbox">Логарифмическая шкала</label>
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
