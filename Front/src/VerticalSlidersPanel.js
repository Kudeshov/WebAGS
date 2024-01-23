import React, { useContext } from 'react';
import { FlightDataContext } from './FlightDataContext';
import Slider from '@mui/material/Slider';
import { createGradientT, calculateColorThresholds } from './colorUtils';
import './VerticalSlidersPanel.css'; // Импорт стилей
import Button from '@mui/material/Button'; // Импорт компонента кнопки MUI

const VerticalSlidersPanel = () => {
  const { heightFrom, heightTo, heightFilterFrom, heightFilterTo, setHeightFilterFrom, 
          setHeightFilterTo, colorThresholds, setColorThresholds, minDoseValue, maxDoseValue,
          minDoseValueR, maxDoseValueR } = useContext(FlightDataContext);

  const handleHeightChange = (event, newValue) => {
    setHeightFilterFrom(newValue[0]);
    setHeightFilterTo(newValue[1]);
  };

  const handleColorChange = (event, newValue) => {
    setColorThresholds({ ...colorThresholds, v0: newValue[0], v1: newValue[1], v2: newValue[2], v3: newValue[3] });
  };

  const gradientPanelStyle = {
    marginLeft: '10px',
    background: `linear-gradient(to top, ${createGradientT(colorThresholds, minDoseValue, maxDoseValue)})`, 
    width: '15px', 
    height: '180px'
  };

  // Функция для сброса значений слайдеров
  const handleReset = () => {
    setHeightFilterFrom(heightFrom);
    setHeightFilterTo(heightTo);
    const newColorThresholds = calculateColorThresholds(minDoseValue, maxDoseValue);
    setColorThresholds(newColorThresholds);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px' }}>
      
      <div style={{ marginBottom: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="sliderTitle">Высота</div>
        <div className="sliderValue">{`${heightTo}м`}</div>
        <div style={{ marginTop: '15px', marginBottom: '15px', display: 'flex', alignItems: 'center' }}>
          <Slider
            sx={{
              '& .MuiSlider-valueLabel': {
                fontSize: '12px', 
                borderRadius: '4px',
              },
              height: 150, marginLeft: 6, marginRight: 3
            }}
            orientation="vertical"
            value={[heightFilterFrom, heightFilterTo]}
            onChange={handleHeightChange}
            min={heightFrom}
            max={heightTo}
            valueLabelDisplay="on"
          />
          <div style={{ width: '25px' }}></div>
        </div>
        <div className="sliderValue">{`${heightFrom}м`}</div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="sliderTitle">Цвет</div>
        <div className="sliderValue">{`${maxDoseValueR}`}</div>
        <div style={{ marginTop: '15px', marginBottom: '15px', display: 'flex', alignItems: 'center' }}>
          <Slider
            sx={{
              '& .MuiSlider-valueLabel': {
                fontSize: '12px', 
                borderRadius: '4px',
              },
              height: 180, marginLeft: 6, marginRight: 3
            }}
            orientation="vertical"
            value={[colorThresholds.v0, colorThresholds.v1, colorThresholds.v2, colorThresholds.v3]}
            onChange={handleColorChange}
            min={minDoseValueR}
            max={maxDoseValueR}
            step={0.01}
            valueLabelDisplay="on"
          />
          <div style={gradientPanelStyle}></div>
        </div>
        <div className="sliderValue">{`${minDoseValueR}`}</div>
      </div>
      <Button variant="contained" color="primary" onClick={handleReset} style={{ marginTop: '20px' }}>
        Сброс
      </Button>
    </div>
  );
};

export default VerticalSlidersPanel;
