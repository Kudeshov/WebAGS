import React, { useState, useContext, useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tabs,
  Tab,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography
} from '@mui/material';
import { FlightDataContext } from './FlightDataContext';
import CalibrationDialog from './CalibrationDialog';
import { findSourceCoordinatesInterpolate, findSourceCoordinates3D } from './SourceFinder';
import { saveCollectionParams } from './apiAGS';

function SourceSearchDialog({ open, onClose }) {
  const [energyRange, setEnergyRange] = useState({ low: 0, high: 0 });
  const [calculatedPeakCenter, setCalculatedPeakCenter] = useState('');
  const [idealPeakCenter, setIdealPeakCenter] = useState('');
  const [peakCenter, setPeakCenter] = useState('');
  const [averageHeight, setAverageHeight] = useState(0);
  const [selectedZone, setSelectedZone] = useState('');
  const [isEnergyRangeValid, setIsEnergyRangeValid] = useState(true);
  const [showCalibrationMessage, setShowCalibrationMessage] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);
  const [alphaValue, setAlphaValue] = useState(0.001);
  const [resultC, setResultC] = useState('');
  const [unit, setUnit] = useState('Бк/м2');
  const [deviationD, setDeviationD] = useState('');
  // Новые состояния для averagedSpectrum и globalPeakIndex
  const [averagedSpectrum, setAveragedSpectrum] = useState([]);
  const [globalPeakIndex, setGlobalPeakIndex] = useState(0);

  const { currentSensorType = "УДКГ-А01", globalSettings,
    sourceCoordinates, setSourceCoordinates, sourceActivity, setSourceActivity, sourceDeviation, setSourceDeviation } = useContext(FlightDataContext);
  const { validMeasurements, selectedCollection, setSelectedCollection, selectedPoints, isotopes, selectedDatabase } = useContext(FlightDataContext);
  const { P0 = 70, P1 = 11, _id: collectionId } = selectedCollection || {};  

  // Используем коэффициенты из selectedCollection для начального состояния
  const [calculatedCoefficients, setCalculatedCoefficients] = useState({ P0, P1 });
  const [calibrationDialogOpen, setCalibrationDialogOpen] = useState(false);
  const [useRefinedPeakAreaCalculation, setUseRefinedPeakAreaCalculation] = useState(false);

  const handlePeakCenterChange = (event) => {
    const { value } = event.target;
    setPeakCenter(value);  // Обновляем состояние на основе ввода пользователя
  };

  const { mapBounds } = useContext(FlightDataContext);
  const getZoneName = (zone) => {
    const isotope = isotopes.isotopes.find(i => i.id === zone.isotope_id);
    if (isotope) {
      const peak = isotope.peaks.find(p => p.id === zone.peak_id);
      if (peak) {
        return `${isotope.name} (${peak.energy_keV} keV)`;
      }
    }
    return 'Неизвестная зона';
  };

  const handleZoneChange = (event) => {
    const zoneName = event.target.value;
    setSelectedZone(zoneName);

    const selectedZoneObject = globalSettings?.sensorTypes?.[currentSensorType]?.zonesOfInterest.find(z => getZoneName(z) === zoneName);
    if (selectedZoneObject) {
      const selectedIsotope = isotopes.isotopes.find(isotope => isotope.id === selectedZoneObject.isotope_id);
      if (selectedIsotope) {
        const selectedPeak = selectedIsotope.peaks.find(peak => peak.id === selectedZoneObject.peak_id);

        if (selectedPeak) {
          
          const { leftBound, rightBound } = calculatePeakBounds(selectedPeak.energy_keV, globalSettings.sensorTypes[currentSensorType].resolution);
          setEnergyRange({ low: leftBound, high: rightBound });
          setIdealPeakCenter(selectedPeak.energy_keV.toFixed(2)); // Устанавливаем референсный пик
          calculateValues();
        }
      }
    }
  };

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

  const handleChange = (event) => {
    const { name, value } = event.target;
    const newEnergyRange = { ...energyRange, [name]: parseFloat(value) };
    setEnergyRange(newEnergyRange);

    if (newEnergyRange.low >= newEnergyRange.high) {
      setIsEnergyRangeValid(false);
      setPeakCenter('NaN');
    } else {
      setIsEnergyRangeValid(true);
      calculateValues();
    }
  };

  useEffect(() => {
    if (open) {
      calculateValues();
    }
  }, [open, selectedZone, energyRange, validMeasurements, P0, P1, globalSettings, currentSensorType]);


  // Функция проверки выпуклости пика
  const isConvexPeak = (spectrum, peakIndex) => {
    // Проверяем, что значения слева и справа от пика уменьшаются
    if (peakIndex <= 0 || peakIndex >= spectrum.length - 1) {
      return false; // Невозможно проверить выпуклость на границах
    }

    const leftNeighbor = spectrum[peakIndex - 1];
    const rightNeighbor = spectrum[peakIndex + 1];
    const peakValue = spectrum[peakIndex];

    console.log('leftNeighbor, rightNeighbor, peakValue', leftNeighbor, rightNeighbor, peakValue); 

    // Пик считается выпуклым, если значения слева и справа меньше, чем значение пика
    return leftNeighbor < peakValue && rightNeighbor < peakValue;
  };

  const calculateValues = () => {
    if (!isEnergyRangeValid) {
      setPeakCenter('NaN');
      return;
    }
  
    const P0Numeric = parseFloat(P0);
    const P1Numeric = parseFloat(P1);
  
    if (isNaN(P0Numeric) || isNaN(P1Numeric)) {
      console.error("P0 или P1 содержат неверные данные:", { P0, P1 });
      return;
    }
  
    const measurements = (selectedPoints && selectedPoints.length > 0) ? selectedPoints : validMeasurements;
    if (!measurements || measurements.length === 0 || !globalSettings.SPECDEFTIME) {
      console.error("Не удалось найти необходимые данные для расчета.");
      return;
    }
  
    // Вычисляем индексы для диапазона энергии
    let leftIndex = Math.ceil((energyRange.low - P0Numeric) / P1Numeric);
    let rightIndex = Math.floor((energyRange.high - P0Numeric) / P1Numeric);
  
    if (leftIndex < 0) leftIndex = 0;
    if (rightIndex >= globalSettings.NSPCHANNELS) rightIndex = globalSettings.NSPCHANNELS - 1;
  
    //console.log(`Диапазон индексов: leftIndex = ${leftIndex}, rightIndex = ${rightIndex}`);
  
    const lTime = globalSettings.SPECDEFTIME;
  
    const averagedSpectrum = new Array(globalSettings.NSPCHANNELS).fill(0);
    let totalHeightSum = 0;
    let count = 0;
  
    // Усредняем спектры
    measurements.forEach(measure => {
      const { channels } = measure.spectrum;
      channels.forEach((value, index) => {
        averagedSpectrum[index] += value / lTime;
      });
      totalHeightSum += measure.height;
      count++;
    });
  
    if (count === 0) {
      console.error("Нет валидных измерений для обработки.");
      return;
    }
  
    for (let i = 0; i < averagedSpectrum.length; i++) {
      averagedSpectrum[i] /= count;
    }
  
    let globalPeakValue = -Infinity;
    let globalPeakIndex = -1; // Индикатор отсутствия пика
  
    // Поиск максимального значения пика без проверки на выпуклость
    for (let i = leftIndex; i <= rightIndex; i++) {
      const v = averagedSpectrum[i];
      if (v > globalPeakValue) { // Убираем проверку isConvexPeak
        globalPeakValue = v;
        globalPeakIndex = i;
      }
    }
  
    // Если пик не найден в границах
    if (globalPeakIndex === -1) {
      console.error('Пик не найден в указанном диапазоне.');
      setCalculatedPeakCenter('');
      //setPeakCenter('');
      setShowCalibrationMessage(false);
      return;
    }
  
    const averageHeight = totalHeightSum / count;
    const peakEnergy = P0Numeric + globalPeakIndex * P1Numeric;
  
    if (isNaN(peakEnergy)) {
      console.error('Расчет peakEnergy дал неверное значение:', peakEnergy);
      //setPeakCenter('');
      return;
    }
  
    setAverageHeight(averageHeight.toFixed(2));
    setCalculatedPeakCenter(peakEnergy.toFixed(2)); // Сохраняем расчетный пик
    setPeakCenter(idealPeakCenter); // Используем паспортный пик по умолчанию
    setAveragedSpectrum(averagedSpectrum);
    setGlobalPeakIndex(globalPeakIndex);
  
    if (Math.abs(peakEnergy - idealPeakCenter) > 10) {
      setShowCalibrationMessage(true); // Показываем сообщение о калибровке
    } else {
      setShowCalibrationMessage(false);
    }
  };
  
  const handleCalculateSource = () => {
    if (!isEnergyRangeValid) {
      alert("Неправильные границы энергии. Пожалуйста, исправьте значения.");
      return;
    }

    const measurements = JSON.parse(JSON.stringify(validMeasurements));
    let result;

    if (!globalSettings.selectedAlgorithm || globalSettings.selectedAlgorithm === 'algorithm1') {
      result = findSourceCoordinatesInterpolate(measurements, energyRange, peakCenter, P0, P1, mapBounds, useRefinedPeakAreaCalculation, globalSettings.sensorTypes[currentSensorType].resolution, globalPeakIndex );
    } else {
      result = findSourceCoordinates3D(measurements, energyRange, peakCenter, P0, P1, mapBounds, useRefinedPeakAreaCalculation, globalSettings.sensorTypes[currentSensorType].resolution, globalPeakIndex );
    }

    if (result && result.coordinates) {
      setSourceCoordinates(result.coordinates);
      setSourceActivity(result.activity?.toExponential(5) + ' γ/с');
      setSourceDeviation(result.deviation?.toExponential(5) + ' γ/с');
      onClose();
    } else {
      alert("Не удалось определить координаты источника.");
    }
  };

  const calculateCoefficients = () => {
    // Данные из состояния
    const idealCenter = parseFloat(idealPeakCenter); // Референсный пик (в кэВ)
    const calculatedCenter = parseFloat(calculatedPeakCenter); // Расчетный центр пика (в кэВ)
    
    // Определяем коэффициент: если определен globalSettings.calibrationCoeff, то используем его, иначе 0.5
    const calibrationCoeff = globalSettings.calibrationCoeff || 0.5;
  
    // Исходные значения для A и B (P1 и P0)
    let A_old = P1; // A соответствует P1
    let B_old = P0; // B соответствует P0
    
    // Сдвиг на разницу между расчетным и референсным пиком, умноженный на calibrationCoeff
    const delta = (calculatedCenter - idealCenter) * calibrationCoeff; // модуль смещения
    const B_new = (B_old - delta).toFixed(2); // применяем смещение и округляем до сотых
  
    // Пересчитываем новое значение A
    const A_new = ((idealPeakCenter - B_new) / globalPeakIndex).toFixed(2); // пересчет A и округление до сотых
  
    console.log('вызываем setCalculatedCoefficients с параметрами ', { P0: B_new, P1: A_new, _id: collectionId });
  
    // Устанавливаем новые коэффициенты
    setCalculatedCoefficients({ P0: B_new, P1: A_new, _id: collectionId });
    setCalibrationDialogOpen(true);
  };

  const handleTabChange = (event, newValue) => {
    setTabIndex(newValue);
  };
   
  const calculateY = (h, alpha) => {
    let baseValue, polynomial;
    switch (alpha) {
      case 0.001:
        baseValue = 29.834 * Math.pow(10, -15);
        polynomial = (-9.775191 * Math.pow(10, -25) * Math.pow(h, 6) +
                      3.121542 * Math.pow(10, -20) * Math.pow(h, 5) -
                      3.935069 * Math.pow(10, -16) * Math.pow(h, 4) +
                      2.576472 * Math.pow(10, -12) * Math.pow(h, 3) -
                      8.458268 * Math.pow(10, -9) * Math.pow(h, 2) +
                      7.551543 * Math.pow(10, -5) * h +
                      0.9930782);
        return baseValue * Math.pow(polynomial, 2);
  
      case 0.2:
        baseValue = 2692 * Math.pow(10, -15);
        polynomial = (-1.381729 * Math.pow(10, -24) * Math.pow(h, 6) +
                      4.809152 * Math.pow(10, -20) * Math.pow(h, 5) -
                      6.609362 * Math.pow(10, -16) * Math.pow(h, 4) +
                      4.662866 * Math.pow(10, -12) * Math.pow(h, 3) -
                      1.715926 * Math.pow(10, -8) * Math.pow(h, 2) +
                      1.095233 * Math.pow(10, -4) * h +
                      0.9902729);
        return baseValue * Math.pow(polynomial, 2);
  
      case 1:
        baseValue = 4812 * Math.pow(10, -15);
        polynomial = (-3.579299 * Math.pow(10, -24) * Math.pow(h, 6) +
                      1.238533 * Math.pow(10, -19) * Math.pow(h, 5) -
                      1.693261 * Math.pow(10, -15) * Math.pow(h, 4) +
                      1.176691 * Math.pow(10, -11) * Math.pow(h, 3) -
                      4.379517 * Math.pow(10, -8) * Math.pow(h, 2) +
                      1.849012 * Math.pow(10, -4) * h +
                      0.9842871);
        return baseValue * Math.pow(polynomial, 2);
  
      case 4:
        baseValue = 6339 * Math.pow(10, -15);
        polynomial = (-9.192162 * Math.pow(10, -24) * Math.pow(h, 6) +
                      3.050737 * Math.pow(10, -19) * Math.pow(h, 5) -
                      3.998739 * Math.pow(10, -15) * Math.pow(h, 4) +
                      2.658244 * Math.pow(10, -11) * Math.pow(h, 3) -
                      9.529568 * Math.pow(10, -8) * Math.pow(h, 2) +
                      2.960621 * Math.pow(10, -4) * h +
                      0.9769177);
        return baseValue * Math.pow(polynomial, 2);
  
      case 30:
        baseValue = 7609 * Math.pow(10, -15);
        polynomial = (-1.882731 * Math.pow(10, -23) * Math.pow(h, 6) +
                      6.209096 * Math.pow(10, -19) * Math.pow(h, 5) -
                      8.019973 * Math.pow(10, -15) * Math.pow(h, 4) +
                      5.176837 * Math.pow(10, -11) * Math.pow(h, 3) -
                      1.766714 * Math.pow(10, -7) * Math.pow(h, 2) +
                      4.377511 * Math.pow(10, -4) * h +
                      0.9722361);
        return baseValue * Math.pow(polynomial, 2);
  
      default:
        return 1; // значение по умолчанию для безопасности
    }
  };
  
  const [rawResultC, setRawResultC] = useState(0);
  const [rawDeviationD, setRawDeviationD] = useState(0);

  const handleCalculateDensity = () => {
    const contaminationDensities = validMeasurements.map((measurement) => {
      const { dose, height } = measurement;
      const Y = calculateY(height, alphaValue);
      console.log('Y, height', Y, height);
      return dose / Y;
    });

    // Вычисление среднего значения
    const meanC = contaminationDensities.reduce((acc, curr) => acc + curr, 0) / contaminationDensities.length;
    
    // Вычисление дисперсии
    const variance = contaminationDensities.reduce((acc, curr) => acc + Math.pow(curr - meanC, 2), 0) / (contaminationDensities.length - 1);
    
    // Вычисление среднеквадратичного отклонения
    const stdDeviation = Math.sqrt(variance);

    // Сохраняем необработанные значения
    setRawResultC(meanC);
    setRawDeviationD(stdDeviation);

    // Пересчитываем для отображения
    updateDisplayedValues(meanC, stdDeviation, unit);
  };

  // Функция пересчета значений на основе выбранной единицы
  const updateDisplayedValues = (result, deviation, unit) => {
    let convertedResult = result;
    let convertedDeviation = deviation;

    switch (unit) {
      case 'Бк/км2':
        convertedResult *= 1e6;  // Перевод из Бк/м² в Бк/км²
        convertedDeviation *= 1e6;
        break;
      case 'Ки/км2':
        convertedResult /= 3.7e10;  // Перевод из Бк/м² в Ки/км²
        convertedDeviation /= 3.7e10;
        break;
      default:
        // Значения остаются без изменений для Бк/м²
        break;
    }

    setResultC(convertedResult.toExponential(2));
    setDeviationD(convertedDeviation.toExponential(2));
  };

  // Обработчик изменения единицы измерения
  const handleUnitChange = (event) => {
    const selectedUnit = event.target.value;
    setUnit(selectedUnit);

    // Пересчитываем значения для новой единицы измерения
    updateDisplayedValues(rawResultC, rawDeviationD, selectedUnit);
  };


  const handleCalibrationDialogClose = (save, newCoefficients) => {
    if (save && newCoefficients) {
      // Обновляем коллекцию, только если пользователь подтвердил изменения
      setSelectedCollection(prev => ({
        ...prev,
        P0: newCoefficients.P0,
        P1: newCoefficients.P1,
      }));      
      // Обновляем коэффициенты, если пользователь их сохранил
      setCalculatedCoefficients(newCoefficients);
    }
    setCalibrationDialogOpen(false);
  };    

  return (
    <Dialog open={open} onClose={onClose}       PaperProps={{
      style: { width: '700px' },  
    }}>
      
      <Tabs value={tabIndex} onChange={handleTabChange} variant="fullWidth">
        <Tab label="Поиск источника" />
        <Tab label="Плотность по дозе" />
        <Tab label="Заглубление по высоте" />
        <Tab label="Плотность по поглощению" />
      </Tabs>
      <DialogContent>
        {tabIndex === 0 && (
          <Box>
            {/* Содержимое для "Поиск источника" */}
            {/* Если зона не выбрана, показываем это сообщение */}
            {!selectedZone && (
              <Typography color="error" variant="body2">
                Зона интереса не выбрана. Пожалуйста, выберите зону интереса.
              </Typography>
            )}
            {/* Если зона выбрана, но пик не совпадает */}
            {selectedZone && showCalibrationMessage && (
              <Typography color="error" variant="body2">
                Расчетный пик не совпадает с ожидаемым. Проведите докалибровку.
              </Typography>
            )}
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <Box mb={2}>
                  <p>Датчик: {currentSensorType}</p>
                </Box>
              </Grid>
              <Grid item xs={8}>
                <FormControl fullWidth margin="dense" variant="outlined" size="small">
                  <InputLabel id="zone-select-label">Зона интереса</InputLabel>
                  <Select
                    size="small"
                    labelId="zone-select-label"
                    value={selectedZone}
                    onChange={handleZoneChange}
                    label="Зона интереса"
                  >
                    {globalSettings?.sensorTypes?.[currentSensorType]?.zonesOfInterest?.map((zone) => (
                      <MenuItem key={zone.id} value={getZoneName(zone)} size="small">
                        {getZoneName(zone)}
                      </MenuItem>
                    )) || <MenuItem disabled>Нет доступных зон</MenuItem>}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Grid container alignItems="center" spacing={1}>
                  {/* Референсный пик */}
                  <Grid item xs={8}>
                    <Typography variant="body2" gutterBottom>
                      Паспортный пик: {idealPeakCenter} keV
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                  </Grid>

                  {/* Расчетный пик */}
                  <Grid item xs={8}>
                    <Typography variant="body2" gutterBottom>
                      Расчетный пик: {calculatedPeakCenter} keV
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Button onClick={calculateCoefficients} variant="outlined" color="primary" fullWidth>
                      Докалибровка
                    </Button>
                  </Grid>
                </Grid>
              </Grid>

              <Grid item xs={4}>
                <TextField
                  margin="dense"
                  id="energy-low"
                  name="low"
                  label="Нижняя граница (keV)"
                  type="number"
                  fullWidth
                  variant="outlined"
                  value={energyRange.low}
                  onChange={handleChange}
                  size="small"
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  margin="dense"
                  id="energy-high"
                  name="high"
                  label="Верхняя граница (keV)"
                  type="number"
                  fullWidth
                  variant="outlined"
                  value={energyRange.high}
                  onChange={handleChange}
                  size="small"
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  margin="dense"
                  id="peak-center"
                  label="Центр пика (keV)"
                  type="number"
                  fullWidth
                  variant="outlined"
                  value={peakCenter}
                  onChange={handlePeakCenterChange} // Добавьте этот обработчик
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
              <Grid item xs={12}>
                <Typography variant="body2" gutterBottom>
                  Коэффициенты калибровки: {P0} {P1}
                </Typography>
              </Grid>
              <Grid item xs={9}>
                <FormControl fullWidth margin="dense">
                  <label  >
                    <input
                      type="checkbox"
                      variant="body2"
                      checked={useRefinedPeakAreaCalculation}
                      onChange={(e) => setUseRefinedPeakAreaCalculation(e.target.checked)}
                    />
                    Использовать уточненный расчет площади пика
                  </label>
                </FormControl>
              </Grid>
              <Grid item xs={3}>
                <Button onClick={handleCalculateSource} variant="contained" disabled={!isEnergyRangeValid} fullWidth>
                  Найти
                </Button>
              </Grid>
            </Grid>

            {/* Диалог калибровки */}
            <CalibrationDialog
              open={calibrationDialogOpen}
              onClose={handleCalibrationDialogClose}
              initialCoefficients={calculatedCoefficients}
              selectedDatabase={selectedDatabase}
              saveCollectionParams={saveCollectionParams} // Передаем функцию сохранения
            />
          </Box>
        )}
        {tabIndex === 1 && (
          <Box>
            {/* Содержимое для "Плотность по дозе" */}
            <Grid container alignItems="center" spacing={1}>
            <Grid item xs={6}>
            <Box >
              <p>Коэффициент заглубления α</p>
            </Box>
            </Grid>
  
              <Grid item xs={6}>
                <FormControl fullWidth variant="outlined" size="small">
                  <Select
                    value={alphaValue}
                    onChange={(e) => setAlphaValue(e.target.value)}
                  >
                    <MenuItem value={0.001}>0,001</MenuItem>
                    <MenuItem value={0.2}>0,2</MenuItem>
                    <MenuItem value={1}>1</MenuItem>
                    <MenuItem value={4}>4</MenuItem>
                    <MenuItem value={30}>30</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleCalculateDensity}
                  fullWidth
                >
                  Рассчитать
                </Button>
              </Grid>              
              <Grid item xs={6}>
                <Box >
                  <p> Плотность загрязнения (Cs-137):</p>
                </Box>
              </Grid>
              <Grid item xs={3}>
                <TextField
                  value={resultC}
                  onChange={(e) => setResultC(e.target.value)}
                  fullWidth
                  variant="outlined"
                  size="small"
                  margin="dense"
                  disabled 
                />
              </Grid>

              <Grid item xs={3}>
                <FormControl fullWidth margin="dense">
                  <Select
                    value={unit}
                    onChange={handleUnitChange}
                    size="small"
                  >
                    <MenuItem value="Бк/м2">Бк/м2</MenuItem>
                    <MenuItem value="Бк/км2">Бк/км2</MenuItem>
                    <MenuItem value="Ки/км2">Ки/км2</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={6}>
                <Box  margin="dense">
                  <p> Среднеквадратичное отклонение</p>
                </Box>
              </Grid>

              <Grid item xs={3}>
                <TextField
                  value={deviationD}
                  onChange={(e) => setDeviationD(e.target.value)}
                  fullWidth
                  variant="outlined"
                  size="small"
                  margin="dense"
                  disabled 
                />
              </Grid>
              <Grid item xs={3}>
                <Box  margin="dense">
                  <p> {unit}</p>
                </Box>
              </Grid>
            </Grid>
          </Box>
        )}

        {tabIndex === 2 && (
          <Box>
            {/* Содержимое для "Заглубление по высоте" */}
            <p>Содержимое вкладки "Заглубление по высоте".</p>
          </Box>
        )}
        {tabIndex === 3 && (
          <Box>
            {/* Содержимое для "Плотность по поглощению" */}
            <p>Содержимое вкладки "Плотность по поглощению".</p>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Закрыть
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default SourceSearchDialog;
