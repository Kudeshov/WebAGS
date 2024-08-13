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
  const { sourceCoordinates, setSourceCoordinates } = useContext(FlightDataContext); 

  const { validMeasurements, selectedCollection, globalSettings } = useContext(FlightDataContext); // Доступ к данным и настройкам через контекст
  const { P0, P1 } = selectedCollection || { P0: 0, P1: 1 }; // Значения по умолчанию, если нет данных

  useEffect(() => {
    calculateValues();
  }, [energyRange, validMeasurements, P0, P1]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setEnergyRange(prev => ({ ...prev, [name]: parseFloat(value) }));
  };

  const calculateValues = () => {
    if (!validMeasurements || !P0 || !P1) return;
  
    const leftIndex = Math.ceil((energyRange.low - P0) / P1);
    const rightIndex = Math.floor((energyRange.high - P0) / P1);
  
    let peakIndexSum = 0;
    let totalHeightSum = 0;
    let count = 0;
  
    validMeasurements.forEach(measure => {
      const { channels } = measure.spectrum;
      const relevantChannels = channels.slice(leftIndex, rightIndex + 1);
      const peakValue = Math.max(...relevantChannels);
      const localPeakIndex = relevantChannels.indexOf(peakValue) + leftIndex; // добавляем leftIndex чтобы получить абсолютную позицию
  
      peakIndexSum += localPeakIndex; // суммируем абсолютные позиции
      totalHeightSum += measure.height;
      count++;
    });
  
    const avgPeakIndex = peakIndexSum / count;
    const averageHeight = totalHeightSum / count;
  
    setAverageHeight(averageHeight.toFixed(2));
    setPeakCenter(((P0 + avgPeakIndex * P1)).toFixed(2)); // значение в килоэлектронвольтах
  };

  const handleCalculateSource = () => {
    const coordinates = findSourceCoordinates(validMeasurements, energyRange, P0, P1);
    // Устанавливаем найденные координаты в контексте

    if (coordinates) {
        setSourceCoordinates(coordinates);
        onClose();
        console.log("Найденные координаты источника:", coordinates);
        // Отображаем координаты в стандартном диалоговом окне
        //alert(`Координаты источника: \nШирота: ${coordinates.lat.toFixed(6)}\nДолгота: ${coordinates.lon.toFixed(6)}`);
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
