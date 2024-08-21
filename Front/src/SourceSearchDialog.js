import React, { useState, useContext, useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box
} from '@mui/material';
import { FlightDataContext } from './FlightDataContext'; // Импорт контекста
import { findSourceCoordinates, findSourceCoordinates3D } from './SourceFinder'; // Импорт функции поиска

function SourceSearchDialog({ open, onClose }) {
  const [energyRange, setEnergyRange] = useState({ low: 0, high: 0 });
  const [peakCenter, setPeakCenter] = useState('');
  const [averageHeight, setAverageHeight] = useState(0);
  const [selectedZone, setSelectedZone] = useState('Весь спектр'); // Инициализация на "Весь спектр"

  const { currentSensorType = "УДКГ-А01", globalSettings,
    sourceCoordinates, setSourceCoordinates, sourceActivity, setSourceActivity, sourceDeviation, setSourceDeviation } = useContext(FlightDataContext);
  const { validMeasurements, selectedCollection, selectedPoints } = useContext(FlightDataContext); // Доступ к данным и настройкам через контекст
  const { mapBounds } = useContext(FlightDataContext);
  
  const { P0 = 70, P1 = 11 } = selectedCollection || {}; // Значения по умолчанию, если нет данных

  const handleChange = (event) => {
    const { name, value } = event.target;
    setEnergyRange(prev => ({ ...prev, [name]: parseFloat(value) }));
    calculateValues();
  };

  useEffect(() => {
    if (open) {
      if (energyRange.low === 0 && energyRange.high === 0) {
        // Устанавливаем начальные значения диапазона энергии
        setEnergyRange({
          low: P0,
          high: P0 + P1 * (globalSettings.NSPCHANNELS - 1)
        });
      }
      // Вызываем пересчет значений всегда при открытии окна
      calculateValues();
    }
  }, [open, selectedZone, energyRange, validMeasurements, P0, P1, globalSettings, currentSensorType]);
  
  
  const handleZoneChange = (event) => {
    const zoneName = event.target.value;
    setSelectedZone(zoneName);
  
    // Обновляем диапазон энергий только если значения не были изменены вручную
    if (zoneName === 'Весь спектр') {
       
        setEnergyRange({
            low: P0,
            high: P0 + P1 * (globalSettings.NSPCHANNELS - 1)
        });
       
    } else if (globalSettings?.sensorTypes?.[currentSensorType]) {
      const zone = globalSettings.sensorTypes[currentSensorType].zonesOfInterest.find(z => z.Name === zoneName);
      if (zone) {
        setEnergyRange({ low: zone.leftE, high: zone.rightE });
      }
    }

    calculateValues(); 
  };

  const calculateValues = () => {
    const measurements = selectedPoints && selectedPoints.length > 0 ? selectedPoints : validMeasurements;
    if (!measurements || !P0 || !P1 || !globalSettings.SPECDEFTIME) return;
  
    let leftIndex = Math.ceil((energyRange.low - P0) / P1);
    let rightIndex = Math.floor((energyRange.high - P0) / P1);
  
    // Корректировка индексов, если они выходят за допустимые границы
    if (leftIndex < 0) leftIndex = 0;
    if (rightIndex >= globalSettings.NSPCHANNELS) rightIndex = globalSettings.NSPCHANNELS - 1;
  
    const lTime = globalSettings.SPECDEFTIME;  // Используем globalSettings.SPECDEFTIME для нормализации
  
    const channelCount = globalSettings.NSPCHANNELS;  // Количество каналов спектра
    const averagedSpectrum = new Array(channelCount).fill(0);  // Массив для усредненного спектра
    let totalHeightSum = 0;
    let count = 0;
  
    // Сначала вычисляем средний спектр
    measurements.forEach(measure => {
      const { channels } = measure.spectrum;
      if (channels.length === 0) return;
  
      // Нормализуем каналы по времени и добавляем к усредненному спектру
      channels.forEach((value, index) => {
        averagedSpectrum[index] += value / lTime;
      });
  
      totalHeightSum += measure.height;
      count++;
    });
  
    // Завершаем вычисление усредненного спектра, деля на количество измерений
    for (let i = 0; i < averagedSpectrum.length; i++) {
      averagedSpectrum[i] /= count;
    }
  
    // Теперь находим пик в усредненном спектре в пределах [leftIndex, rightIndex]
    let globalPeakValue = -Infinity;
    let globalPeakIndex = 0;
  
    for (let i = leftIndex; i <= rightIndex; i++) {
      const v = averagedSpectrum[i];
      if (v > globalPeakValue) {
        globalPeakValue = v;
        globalPeakIndex = i;
      }
    }
  
    const averageHeight = totalHeightSum / count;
    const peakEnergy = (P0 + globalPeakIndex * P1);  // Энергия пика в килоэлектронвольтах
  
    setAverageHeight(averageHeight.toFixed(2));
    setPeakCenter(peakEnergy.toFixed(2));
  };
  


  const handleCalculateSource = () => {
    const measurements = /* selectedPoints && selectedPoints.length > 0 ? selectedPoints : */ validMeasurements;
    //console.log('meas1', measurements);
  
    let result;
    
    // Проверка на наличие выбранного алгоритма
    if (!globalSettings.selectedAlgorithm || globalSettings.selectedAlgorithm === 'algorithm1') {
      // Если алгоритм не задан или выбран algorithm1 — вызываем findSourceCoordinates (2D)
      result = findSourceCoordinates(measurements, energyRange, P0, P1);
    } else {
      // Иначе вызываем findSourceCoordinates3D (3D)
      console.log('mapBounds', mapBounds);
      result = findSourceCoordinates3D(measurements, energyRange, peakCenter, P0, P1, mapBounds);
    }
  
    //console.log('result', result);
  
    if (result && result.coordinates) {
      setSourceCoordinates(result.coordinates);
      setSourceActivity(result.activity.toExponential(5) + ' γ/с');
      setSourceDeviation(result.deviation.toExponential(5) + ' γ/с');
      onClose(); // Закрыть окно после нахождения точки
    } else {
      alert("Не удалось определить координаты источника.");
    }
  };
  


  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Поиск источника</DialogTitle>
      <DialogContent>
        {/* Отображение текущего типа датчика */}
        <Box mb={2}>
          <p>Датчик: {currentSensorType}</p>
        </Box>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={12}>
            {/* Выпадающий список для выбора зоны интереса */}
            <FormControl fullWidth margin="dense" variant="outlined" size="small">
              <InputLabel id="zone-select-label">Зона интереса</InputLabel>
              <Select
                size="small"
                labelId="zone-select-label"
                value={selectedZone}
                onChange={handleZoneChange}
                label="Зона интереса"
              >
                <MenuItem value="Весь спектр" size="small">Весь спектр</MenuItem>
                {globalSettings?.sensorTypes?.[currentSensorType]?.zonesOfInterest?.map((zone) => (
                  <MenuItem key={zone.Name} value={zone.Name} size="small">
                    {zone.Name}
                  </MenuItem>
                )) || <MenuItem disabled>Нет доступных зон</MenuItem>}
              </Select>
            </FormControl>
          </Grid>
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
              size="small"
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
              size="small"
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
              size="small"
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
              size="small"
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
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  margin="dense"
                  id="source-activity"
                  label="Активность источника (γ/с)"
                  type="text"
                  fullWidth
                  variant="outlined"
                  value={sourceActivity}
                  disabled
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  margin="dense"
                  id="source-deviation"
                  label="Погрешность (γ/с)"
                  type="text"
                  fullWidth
                  variant="outlined"
                  value={sourceDeviation}
                  disabled
                  size="small"
                />
              </Grid>
            </>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCalculateSource} variant="contained">Найти</Button>
        <Button onClick={onClose} variant="outlined">Закрыть</Button>
      </DialogActions>
    </Dialog>
  );
}

export default SourceSearchDialog;
