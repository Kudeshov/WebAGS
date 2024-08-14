import React, { useState, useContext, useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Grid
} from '@mui/material';
import { FlightDataContext } from './FlightDataContext'; // Импорт контекста
import { findSourceCoordinates } from './SourceFinder'; // Импорт функции поиска

function SourceSearchDialog({ open, onClose }) {
  const [energyRange, setEnergyRange] = useState({ low: 0, high: 0 });
  const [peakCenter, setPeakCenter] = useState('');
  const [averageHeight, setAverageHeight] = useState(0);
  const [sourceActivity, setSourceActivity] = useState('');  // Добавлено состояние для активности
  const [sourceDeviation, setSourceDeviation] = useState('');  // Добавлено состояние для погрешности
  const { sourceCoordinates, setSourceCoordinates } = useContext(FlightDataContext); 

  const { validMeasurements, selectedCollection, selectedPoints } = useContext(FlightDataContext); // Доступ к данным и настройкам через контекст
  const { P0, P1 } = selectedCollection || { P0: 0, P1: 1 }; // Значения по умолчанию, если нет данных

  useEffect(() => {
    calculateValues();
  }, [energyRange, validMeasurements, P0, P1]);

  useEffect(() => {
    if (open) {
      calculateValues();
    }
  }, [open]); // Срабатывает при изменении `open`

  const handleChange = (event) => {
    const { name, value } = event.target;
    setEnergyRange(prev => ({ ...prev, [name]: parseFloat(value) }));
  };

  const calculateValues = () => {

    const measurements = selectedPoints && selectedPoints.length > 0 ? selectedPoints : validMeasurements;

    if (!validMeasurements || !P0 || !P1) return;
  
    const leftIndex = Math.ceil((energyRange.low - P0) / P1);
    const rightIndex = Math.floor((energyRange.high - P0) / P1);
  
    let globalPeakValue = -Infinity; // начальное значение, меньшее любого реального значения
    let globalPeakIndex = 0;
    let totalHeightSum = 0;
    let count = 0;
  
    measurements.forEach(measure => {
        const { channels } = measure.spectrum;
        const relevantChannels = channels.slice(leftIndex, rightIndex + 1);

        // Находим локальный максимум в пределах текущего измерения
        const localPeakValue = Math.max(...relevantChannels);
        const localPeakIndex = relevantChannels.indexOf(localPeakValue) + leftIndex; // находим индекс относительно общего спектра

        // Обновляем глобальный максимум, если текущий локальный максимум больше
        if (localPeakValue > globalPeakValue) {
            globalPeakValue = localPeakValue;
            globalPeakIndex = localPeakIndex;
        }

        totalHeightSum += measure.height;
        count++;
    });
  
    const averageHeight = totalHeightSum / count;
    const peakEnergy = (P0 + globalPeakIndex * P1); // центр пика в килоэлектронвольтах
  
    setAverageHeight(averageHeight.toFixed(2));
    setPeakCenter(peakEnergy.toFixed(2)); // значение в килоэлектронвольтах
  };

  const handleCalculateSource = () => {
    const measurements = selectedPoints && selectedPoints.length > 0 ? selectedPoints : validMeasurements;
    const { coordinates, activity, deviation } = findSourceCoordinates(measurements, energyRange, P0, P1);

    if (coordinates) {
        setSourceCoordinates(coordinates);
        setSourceActivity(activity.toExponential(5) + ' γ/с'); // Устанавливаем активность в научной нотации с единицами измерения
        setSourceDeviation(deviation.toExponential(5) + ' γ/с'); // Устанавливаем погрешность в научной нотации с единицами измерения
        console.log("Найденные координаты источника:", coordinates);
        console.log("Активность источника:", activity);
        console.log("Погрешность:", deviation);
    } else {
        console.log("Не удалось определить координаты источника.");
        alert("Не удалось определить координаты источника.");
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Поиск источника</DialogTitle>
      <DialogContent>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              autoFocus
              margin="dense"
              id="energy-low"
              name="low"
              label="Нижняя граница энергии (keV)"
              type="number"
              fullWidth
              variant="outlined"
              value={energyRange.low}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              margin="dense"
              id="energy-high"
              name="high"
              label="Верхняя граница энергии (keV)"
              type="number"
              fullWidth
              variant="outlined"
              value={energyRange.high}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              margin="dense"
              id="peak-center"
              label="Центр пика (keV)"
              type="number"
              fullWidth
              variant="outlined"
              value={peakCenter}
              disabled
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              margin="dense"
              id="average-height"
              label="Средняя высота (м)"
              type="number"
              fullWidth
              variant="outlined"
              value={averageHeight}
              disabled
            />
          </Grid>
          {sourceCoordinates && (
            <>
              <Grid item xs={12}>
                <TextField
                  margin="dense"
                  id="source-coordinates"
                  label="Координаты источника (lat, lon)"
                  fullWidth
                  variant="outlined"
                  value={`${sourceCoordinates.lat.toFixed(6)}, ${sourceCoordinates.lon.toFixed(6)}`}
                  disabled
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  margin="dense"
                  id="source-activity"
                  label="Активность источника (γ/с)"
                  type="text"
                  fullWidth
                  variant="outlined"
                  value={sourceActivity}
                  disabled
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  margin="dense"
                  id="source-deviation"
                  label="Погрешность (γ/с)"
                  type="text"
                  fullWidth
                  variant="outlined"
                  value={sourceDeviation}
                  disabled
                />
              </Grid>
            </>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCalculateSource}>Найти</Button>
        <Button onClick={onClose}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  );
}

export default SourceSearchDialog;
