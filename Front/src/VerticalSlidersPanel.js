import React, { useState, useEffect, useContext } from 'react';
import { FlightDataContext } from './FlightDataContext';
import Slider from '@mui/material/Slider';
import { calculateColorThresholds } from './colorUtils';
import './VerticalSlidersPanel.css'; // Импорт стилей
import Button from '@mui/material/Button'; // Импорт компонента кнопки MUI

const VerticalSlidersPanel = () => {
  const { heightFrom, heightTo, heightFilterFrom, heightFilterTo, setHeightFilterFrom, 
          setHeightFilterTo, colorThresholds, setColorThresholds, minDoseValue, maxDoseValue,
          minDoseValueR, maxDoseValueR } = useContext(FlightDataContext);

  // Локальные состояния для управления ползунками
  const [localHeightFrom, setLocalHeightFrom] = useState(heightFilterFrom);
  const [localHeightTo, setLocalHeightTo] = useState(heightFilterTo);

  // Обработчик изменения положения ползунков
  const handleHeightChange = (event, newValue) => {
    setLocalHeightFrom(newValue[0]);
    setLocalHeightTo(newValue[1]);
  };

  // Обработчик завершения изменения положения ползунков
  const handleHeightChangeCommitted = (event, newValue) => {
    setHeightFilterFrom(newValue[0]);
    setHeightFilterTo(newValue[1]);
  };

  // Обновление локальных состояний при изменении глобальных
  useEffect(() => {
    setLocalHeightFrom(heightFilterFrom);
    setLocalHeightTo(heightFilterTo);
  }, [heightFilterFrom, heightFilterTo]);

  // Локальные состояния для управления ползунками цвета
  const [localColorThresholds, setLocalColorThresholds] = useState(colorThresholds);

  // Обработчик изменения положения ползунков цвета
  const handleColorChange = (event, newValue) => {
    setLocalColorThresholds({ ...localColorThresholds, v0: newValue[0], v1: newValue[1], v2: newValue[2], v3: newValue[3] });
  };

  // Обработчик завершения изменения положения ползунков цвета
  const handleColorChangeCommitted = (event, newValue) => {
    setColorThresholds({ ...colorThresholds, v0: newValue[0], v1: newValue[1], v2: newValue[2], v3: newValue[3] });
  };

  // Обновление локальных состояний при изменении глобальных
  useEffect(() => {
    setLocalColorThresholds(colorThresholds);
  }, [colorThresholds]);
  

/*   const gradientPanelStyle = {
    marginLeft: '10px',
    background: `linear-gradient(to top, ${createGradientT(colorThresholds, minDoseValue, maxDoseValue)})`, 
    width: '15px', 
    height: '150px'
  }; */

  // Функция для сброса значений слайдеров
  const handleReset = () => {
    setHeightFilterFrom(heightFrom);
    setHeightFilterTo(heightTo);
    const newColorThresholds = calculateColorThresholds(minDoseValue, maxDoseValue);
    setColorThresholds(newColorThresholds);
  };

  // Определяем процентное положение каждого ползунка на слайдере
  const calculatePercentage = (value, min, max) => ((value - min) / (max - min)) * 100;

  // Создаем строку градиента на основе текущего положения ползунков
  const gradientStyle = {
    background: `linear-gradient(to top, 
      blue ${calculatePercentage(colorThresholds.v0, minDoseValueR, maxDoseValueR)}%, 
      green ${calculatePercentage(colorThresholds.v1, minDoseValueR, maxDoseValueR)}%, 
      yellow ${calculatePercentage(colorThresholds.v2, minDoseValueR, maxDoseValueR)}%, 
      red ${calculatePercentage(colorThresholds.v3, minDoseValueR, maxDoseValueR)}%)`
  };  

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px' }}>
      
      <div style={{ marginBottom: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="sliderTitle">Высота</div>
        <div className="sliderValue">{`${heightTo}м`}</div>
        <div style={{ marginTop: '15px', marginBottom: '15px', display: 'flex', alignItems: 'center' }}>
          <Slider
            sx={{
              '& .MuiSlider-valueLabel': {
                fontSize: '12px', 
                borderRadius: '4px',
              },
              height: 150, marginLeft: 7, marginRight: 0
            }}
            orientation="vertical"
            value={[localHeightFrom, localHeightTo]}
            onChange={handleHeightChange}
            onChangeCommitted={handleHeightChangeCommitted}
            min={heightFrom}
            max={heightTo}
            valueLabelDisplay="on"
          />
          {/* <div style={{ width: '25px' }}></div> */}
        </div>
        <div className="sliderValue">{`${heightFrom}м`}</div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="sliderTitle">МЭД, мкЗв/ч</div>
        <div className="sliderValue">{`${maxDoseValueR}`}</div>
        <div style={{ marginTop: '15px', marginBottom: '15px', display: 'flex', alignItems: 'center' }}>
          <Slider
            sx={{
              '& .MuiSlider-thumb:nth-of-type(6)': { // Первый ползунок (сверху)
                backgroundColor: 'rgb(255, 0, 0)', // Красный
              },
              '& .MuiSlider-thumb:nth-of-type(5)': { // Второй ползунок
                backgroundColor: 'rgb(255, 255, 0)', // Желтый
              },
              '& .MuiSlider-thumb:nth-of-type(4)': { // Третий ползунок
                backgroundColor: 'rgb(0, 255, 0)', // Зеленый
              },
              '& .MuiSlider-thumb:nth-of-type(3)': { // Четвертый ползунок (снизу)
                backgroundColor: 'rgb(0, 0, 255)', // Синий
              },
              '& .MuiSlider-valueLabel': {
                fontSize: '12px', 
                borderRadius: '4px',
              },
              '& .MuiSlider-track': gradientStyle,
              '& .MuiSlider-rail': gradientStyle,              
/*               '& .MuiSlider-track': {
                background: 'linear-gradient(to top, blue, green, yellow, red)', // Градиент для трека
              },
              '& .MuiSlider-rail': {
                background: 'linear-gradient(to top, blue, green, yellow, red)', // Тот же градиент для рельса
              }, */
              height: 150, marginLeft: 7, marginRight: 0
            }}
            orientation="vertical"
            value={[localColorThresholds.v0, localColorThresholds.v1, localColorThresholds.v2, localColorThresholds.v3]}
            onChange={handleColorChange}
            onChangeCommitted={handleColorChangeCommitted}
            min={minDoseValueR}
            max={maxDoseValueR}
            step={0.01}
            valueLabelDisplay="on"
          />
          {/* <div style={gradientPanelStyle}></div> */}
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
