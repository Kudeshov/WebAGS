/* eslint-disable react-hooks/exhaustive-deps */

import React, { useState, useContext, useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
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

  const [cs137Isotope, setCs137Isotope] = useState(null); // Для закрепленного Cs-137
  const [selectedPeakcs137, setSelectedPeakcs137] = useState(null); // Для выбора пика

  const [isEnergyRangeValid, setIsEnergyRangeValid] = useState(true);
  const [showCalibrationMessage, setShowCalibrationMessage] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);
//  const [alphaValue, setAlphaValue] = useState(0.001);
  const [depthResult, setDepthResult] = useState(null);
  const [alphaValueCs137, setAlphaValueCs137] = useState(0.001); // Управляется пользователем
  const [alphaValueDepth, setAlphaValueDepth] = useState(depthResult?.alpha || 0.001); // Расчётное значение
 
  const [resultC, setResultC] = useState('');
  const [unit, setUnit] = useState('Бк/м2');
  const [deviationD, setDeviationD] = useState('');

  const [unitDepth, setUnitDepth] = useState("Бк/см²");
  const [eligible, setEligible] = useState(true);
  const [heightInterval, setHeightInterval] = useState(5); // Интервал высот, по умолчанию 5 м
  const [contaminationDensity, setContaminationDensity] = useState(null); // Результаты расчета
  const [heightIntervalsData, setHeightIntervalsData] = useState([]); // Данные для интервалов высот
  // Новые состояния для averagedSpectrum и globalPeakIndex
  const [globalPeakIndex, setGlobalPeakIndex] = useState(0);

  const { currentSensorType = "УДКГ-А01", globalSettings,
    sourceCoordinates, setSourceCoordinates, sourceActivity, setSourceActivity, sourceDeviation, setSourceDeviation } = useContext(FlightDataContext);
  const { validMeasurements, selectedCollection, setSelectedCollection, selectedPoints, isotopes, selectedDatabase } = useContext(FlightDataContext);
  const { P0 = 70, P1 = 11, _id: collectionId } = selectedCollection || {};  

  // Используем коэффициенты из selectedCollection для начального состояния
  const [calculatedCoefficients, setCalculatedCoefficients] = useState({ P0, P1 });
  const [calibrationDialogOpen, setCalibrationDialogOpen] = useState(false);
  const [useRefinedPeakAreaCalculation, setUseRefinedPeakAreaCalculation] = useState(false);

  // Поиск Cs-137 из списка изотопов, это будет фиксированный изотоп для остальных закладок
  useEffect(() => {
    const cs137 = isotopes.isotopes.find(i => i.id === "cs137");
    setCs137Isotope(cs137);
    if (cs137 && cs137.peaks.length > 0) {
        setSelectedPeakcs137(cs137.peaks[0]); // по умолчанию выбираем первый пик Cs-137
    } 
  }, [isotopes]);

  // функция для обновления значения Ca в зависимости от единицы измерения
  const updateDisplayedCa = (rawCa, unit) => {
    let convertedCa = Number(rawCa); // Приведение к числу
    
    if (isNaN(convertedCa)) {
      return "—"; // Возвращаем прочерк, если значение некорректно
    }
  
    if (unit === "Ки/м²") {
      convertedCa = convertedCa * 1e4 / 3.7e10; // перевод из Бк/см² в Ки/м²
    }
  
    return convertedCa.toExponential(2); // округляем до нужного формата
  };

  // обработчик для изменения единицы измерения
  const handleUnitDepthChange = (event) => {
    setUnitDepth(event.target.value);
  };
    

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
    //if (open) {
      //console.log('recalc');
      calculateValues();
      handleDepthAndEligibilityCheck();
      handleCalculateDensity();

      console.log('calculateContaminationDensity open');
      calculateContaminationDensity();

    //}
  }, [open, selectedZone, energyRange, validMeasurements, P0, P1, globalSettings, currentSensorType]);

  const smoothSpectrum = (spectrum) => {
    const smoothed = new Array(spectrum.length).fill(0);
    for (let i = 5; i < spectrum.length - 5; i++) {
      smoothed[i] =
        (1 / 429) *
        (-36 * spectrum[i - 5] +
          9 * spectrum[i - 4] +
          44 * spectrum[i - 3] +
          69 * spectrum[i - 2] +
          84 * spectrum[i - 1] +
          89 * spectrum[i] +
          84 * spectrum[i + 1] +
          69 * spectrum[i + 2] +
          44 * spectrum[i + 3] +
          9 * spectrum[i + 4] -
          36 * spectrum[i + 5]);
    }
    return smoothed;
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

    const smoothedSpectrum = smoothSpectrum(averagedSpectrum);

    // Определяем значения на границах
    const backgroundLeft = smoothedSpectrum[leftIndex];
    const backgroundRight = smoothedSpectrum[rightIndex];

    // Вычисляем площадь пика
    let peakArea = 0;
    for (let i = leftIndex; i < rightIndex; i++) {
        const energyStep = P1Numeric; // Шаг по энергии между соседними каналами
        const trapezoidHeight = (smoothedSpectrum[i] + smoothedSpectrum[i + 1]) / 2;
        peakArea += trapezoidHeight * energyStep;
    }

    //console.log('peakArea', peakArea);

    // Вычисляем площадь трапеции фона
    const trapezoidArea =
        ((backgroundLeft + backgroundRight) / 2) * (energyRange.high - energyRange.low);
    //console.log('trapezoidArea', trapezoidArea);

    // Рассчитываем скорректированную площадь
    const correctedPeakArea = peakArea - trapezoidArea;
    //console.log('correctedPeakArea', correctedPeakArea);    
  
    // Проверка на соответствие критерию
    const threshold = Math.sqrt(peakArea);
    if (correctedPeakArea <= threshold) {
        // Пик не найден или не соответствует критерию
        //console.log('Пик не найден или не соответствует критерию.');
        setCalculatedPeakCenter('');
       // setShowCalibrationMessage(false); // скрываем кнопку "Докалибровка"
        return;
    }
  
    let globalPeakValue = -Infinity;
    let globalPeakIndex = -1; // Индикатор отсутствия пика

    for (let i = leftIndex; i <= rightIndex; i++) {
      const v = smoothedSpectrum[i];
      if (v > globalPeakValue) {
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
      //console.log('Расчет peakEnergy дал неверное значение:', peakEnergy);
      //setPeakCenter('');
      return;
    }
  
    setAverageHeight(averageHeight.toFixed(2));
    setCalculatedPeakCenter(peakEnergy.toFixed(2)); // Сохраняем расчетный пик
    setPeakCenter(idealPeakCenter); // Используем паспортный пик по умолчанию
    //setAveragedSpectrum(averagedSpectrum);
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

    // Проверяем, найден ли расчетный пик
    if (calculatedPeakCenter === "" || calculatedPeakCenter === "Не найден") {
      //console.log('Пик не найден. Используются текущие коэффициенты P0 и P1.');
      setCalculatedCoefficients({ P0, P1, _id: collectionId });
      setCalibrationDialogOpen(true);
      return;
    }
    
    // Данные из состояния
    const idealCenter = parseFloat(idealPeakCenter); // Референсный пик (в кэВ)
    const calculatedCenter = parseFloat(calculatedPeakCenter); // Расчетный центр пика (в кэВ)
    
    // Определяем коэффициент: если определен globalSettings.calibrationCoeff, то используем его, иначе 0.5
    const calibrationCoeff = globalSettings.calibrationCoeff || 0.5;
  
    // Исходные значения для A и B (P1 и P0)
    //let A_old = P1; // A соответствует P1
    let B_old = P0; // B соответствует P0
    
    // Сдвиг на разницу между расчетным и референсным пиком, умноженный на calibrationCoeff
    const delta = (calculatedCenter - idealCenter) * calibrationCoeff; // модуль смещения
    const B_new = (B_old - delta).toFixed(2); // применяем смещение и округляем до сотых
  
    // Пересчитываем новое значение A
    const A_new = ((idealPeakCenter - B_new) / globalPeakIndex).toFixed(2); // пересчет A и округление до сотых
  
    //console.log('вызываем setCalculatedCoefficients с параметрами ', { P0: B_new, P1: A_new, _id: collectionId });
  
    // Устанавливаем новые коэффициенты
    setCalculatedCoefficients({ P0: B_new, P1: A_new, _id: collectionId });
    setCalibrationDialogOpen(true);
  };

  const handleTabChange = (event, newValue) => {
    setTabIndex(newValue);
  };
   

  const checkHeightMeasurements = (measurements, interval = 5) => {
    let nonEmptyIntervals = 0;
    const heightIntervals = measurements.reduce((acc, measure) => {
      const intervalIndex = Math.floor(measure.height / interval);
      acc[intervalIndex] = (acc[intervalIndex] || 0) + 1;
      return acc;
    }, {});

    Object.values(heightIntervals).forEach(count => {
      if (count >= 5) nonEmptyIntervals++;
    });
    
    return nonEmptyIntervals >= 3;
  };

  const handleDepthAndEligibilityCheck = () => {
    const isEligible = checkHeightMeasurements(validMeasurements);
    setEligible(isEligible);
  
    if (!isEligible) {
      setDepthResult(null);
      return;
    }
  
    const measurements = validMeasurements;
    const alphaOptions = [0.001, 0.2, 1, 4, 30];
    let bestAlpha = null;
    let minDa = Infinity;
    let bestKa = null;
  
    alphaOptions.forEach((alpha) => {
      const KaNumerator = measurements.reduce((sum, measurement) => {
        const H_i = measurement.dose;
        const H_star = calculateY(measurement.height, alpha); // Используем alpha
        return sum + H_star * H_i;
      }, 0);
  
      const KaDenominator = measurements.reduce((sum, measurement) => {
        const H_star = calculateY(measurement.height, alpha); // Используем alpha
        return sum + H_star * H_star;
      }, 0);
  
      const Ka = KaNumerator / KaDenominator;
  
      const Da = measurements.reduce((sum, measurement) => {
        const H_i = measurement.dose;
        const H_star = calculateY(measurement.height, alpha); // Используем alpha
        return sum + Math.pow(Ka * H_star - H_i, 2);
      }, 0) / (measurements.length - 1);
  
      if (Da < minDa) {
        minDa = Da;
        bestAlpha = alpha;
        bestKa = Ka;
      }
    });
  
    const densityCoefficient = getDensityCoefficient(bestAlpha);
    const Ca = bestKa / densityCoefficient;
  
    setDepthResult({ alpha: bestAlpha, Ca: Ca.toFixed(8) });
  };
  

  
  const calculateY = (h, alpha) => {
    let polynomial;
  
    switch (alpha) {
      case 0.001:
        polynomial = -9.775191e-25 * Math.pow(h, 6) +
                     3.121542e-20 * Math.pow(h, 5) -
                     3.935069e-16 * Math.pow(h, 4) +
                     2.576472e-12 * Math.pow(h, 3) -
                     8.458268e-9 * Math.pow(h, 2) +
                     7.551543e-5 * h +
                     0.9930782;
        break;
      case 0.2:
        polynomial = -1.381729e-24 * Math.pow(h, 6) +
                     4.809152e-20 * Math.pow(h, 5) -
                     6.609362e-16 * Math.pow(h, 4) +
                     4.662866e-12 * Math.pow(h, 3) -
                     1.715926e-8 * Math.pow(h, 2) +
                     1.095233e-4 * h +
                     0.9902729;
        break;
      case 1:
        polynomial = -3.579299e-24 * Math.pow(h, 6) +
                     1.238533e-19 * Math.pow(h, 5) -
                     1.693261e-15 * Math.pow(h, 4) +
                     1.176691e-11 * Math.pow(h, 3) -
                     4.379517e-8 * Math.pow(h, 2) +
                     1.849012e-4 * h +
                     0.9842871;
        break;
      case 4:
        polynomial = -9.192162e-24 * Math.pow(h, 6) +
                     3.050737e-19 * Math.pow(h, 5) -
                     3.998739e-15 * Math.pow(h, 4) +
                     2.658244e-11 * Math.pow(h, 3) -
                     9.529568e-8 * Math.pow(h, 2) +
                     2.960621e-4 * h +
                     0.9769177;
        break;
      case 30:
        polynomial = -1.882731e-23 * Math.pow(h, 6) +
                     6.209096e-19 * Math.pow(h, 5) -
                     8.019973e-15 * Math.pow(h, 4) +
                     5.176837e-11 * Math.pow(h, 3) -
                     1.766714e-7 * Math.pow(h, 2) +
                     4.377511e-4 * h +
                     0.9722361;
        break;
      default:
        polynomial = 1; // На случай ошибки
    }
  
    const H_star = 1 / Math.pow(polynomial, 2);
    //console.log(`calculateY (h=${h}, alpha=${alpha}):`, H_star); // Отладка calculateY
    return H_star;
  };
  
  const getDensityCoefficient = (alpha) => {
    switch (alpha) {
      case 0.001: return 29.834e-7;
      case 0.2: return 2692e-7;
      case 1: return 4812e-7;
      case 4: return 6339e-7;
      case 30: return 7609e-7;
      default: return 1;
    }
  };
  
  const calculatePeakArea = (spectrum) => {
    let peakArea = 0;
    const leftIndex = Math.ceil((energyRange.low - P0) / P1);
    const rightIndex = Math.floor((energyRange.high - P0) / P1);
  
    // Убедимся, что индексы находятся в допустимых пределах
    const validLeftIndex = Math.max(leftIndex, 0);
    const validRightIndex = Math.min(rightIndex, spectrum.length - 1);
  
    for (let i = validLeftIndex; i < validRightIndex; i++) {
      const energyStep = P1; // Шаг по энергии
      const trapezoidHeight = (spectrum[i] + spectrum[i + 1]) / 2;
      peakArea += trapezoidHeight * energyStep;
    }
  
    return peakArea;
  };

  const calculatePeakAreaForCs137 = (spectrum, globalSettings) => {
    if (!globalSettings || !globalSettings.sensorTypes || !globalSettings.sensorTypes[currentSensorType]) {
      console.error("Не найдены глобальные настройки или тип сенсора.");
      return 0;
    }
  
    const energyCs137 = 661.657; // Эталонная энергия Cs-137 (keV)
    const resolutionPercent = globalSettings.sensorTypes[currentSensorType].resolution / 100;
  
    // Расчёт FWHM и границ для Cs-137
    const FWHM_Cs137 = resolutionPercent * energyCs137;
    const sigmaCs137 = FWHM_Cs137 / 2.35;
    const leftBound = energyCs137 - 3 * sigmaCs137;
    const rightBound = energyCs137 + 3 * sigmaCs137;
  
    const P0 = globalSettings.P0 || 70; // Учитываем коэффициенты P0 и P1 из конфигурации
    const P1 = globalSettings.P1 || 11;
  
    // Вычисление индексов диапазона
    let leftIndex = Math.ceil((leftBound - P0) / P1);
    let rightIndex = Math.floor((rightBound - P0) / P1);
  
    // Ограничиваем индексы внутри допустимых каналов спектра
    leftIndex = Math.max(0, leftIndex);
    rightIndex = Math.min(spectrum.length - 1, rightIndex);
  
    // Вычисление площади пика
    let peakArea = 0;
    for (let i = leftIndex; i < rightIndex; i++) {
      const energyStep = P1; // Шаг по энергии
      const trapezoidHeight = (spectrum[i] + spectrum[i + 1]) / 2;
      peakArea += trapezoidHeight * energyStep;
    }
  
    return peakArea;
  };
  
  

  const calculateHeightIntervals = () => {

    if (selectedCollection?.is_online) {
      console.log("Пропуск загрузки данных для онлайн-полетов.");
      return;
    }

    if (!validMeasurements || validMeasurements.length === 0) {
        console.error("Массив validMeasurements пуст или отсутствует.");
        return [];
    }

    // Проверка первого элемента на наличие spectrum и channels
    const firstMeasurement = validMeasurements[0];
    if (!firstMeasurement.spectrum || !Array.isArray(firstMeasurement.spectrum.channels)) {
        console.error("Спектры отсутствуют для данного полета.");
        return [];
    }

    const intervals = {};

    validMeasurements.forEach(measurement => {
        if (measurement.height > 5) {
            const intervalIndex = Math.floor(measurement.height / heightInterval);
            if (!intervals[intervalIndex]) {
                intervals[intervalIndex] = { sumSpectrum: [], count: 0, heightSum: 0 };
            }

            measurement.spectrum.channels.forEach((value, index) => {
                if (!intervals[intervalIndex].sumSpectrum[index]) {
                    intervals[intervalIndex].sumSpectrum[index] = 0;
                }
                intervals[intervalIndex].sumSpectrum[index] += value;
            });

            intervals[intervalIndex].heightSum += measurement.height;
            intervals[intervalIndex].count++;
        }
    });

    const intervalResults = Object.entries(intervals).map(([index, data]) => {
        const averageSpectrum = data.sumSpectrum.map(value => value / data.count);
        const averageHeight = data.heightSum / data.count;
        return { intervalIndex: index, averageSpectrum, averageHeight };
    });

    return intervalResults;
  };

/*   const calculateContaminationDensity = (heightIntervalsData) => {
    console.log('calculateContaminationDensity 1');
    if (!heightIntervalsData || heightIntervalsData.length === 0) {
      return;
    }
    console.log('calculateContaminationDensity 2');
    console.log('heightIntervalsData', heightIntervalsData);

    
    
    const densities = heightIntervalsData.map(({ averageSpectrum, averageHeight }) => {
      const Sk = calculatePeakArea(averageSpectrum); // Площадь пика
      const Kha = calculateY(averageHeight, alphaValueDepth); // Используем alphaValueDepth
      console.log('averageHeight', averageHeight, 'alphaValueDepth', alphaValueDepth, "Kha", Kha);
      
      const Ck = Sk / Kha;
      console.log('averageHeight', averageHeight, 'alphaValueDepth', alphaValueDepth, "Kha", Kha, "Ck", Ck);
      return { intervalHeight: averageHeight, density: Ck };
    });

    console.log('densities', densities);
  
    const meanDensity = densities.reduce((sum, item) => sum + item.density, 0) / densities.length;
    const variance = densities.reduce((sum, item) => sum + Math.pow(item.density - meanDensity, 2), 0) / (densities.length - 1);
    const stdDeviation = Math.sqrt(variance);
    console.log('meanDensity', meanDensity);
    console.log('variance', variance);
    console.log('stdDeviation', stdDeviation);
    setContaminationDensity({
      densities,
      meanDensity: meanDensity.toFixed(8),
      stdDeviation: stdDeviation.toFixed(8),
    });
  };
   */

  const calculateContaminationDensity = (heightIntervalsData) => {
    if (!heightIntervalsData || heightIntervalsData.length === 0) {
      console.error("Нет данных для расчёта.");
      return;
    }
  
    const densities = heightIntervalsData.map(({ averageSpectrum, averageHeight }) => {
      const Sk = calculatePeakAreaForCs137(averageSpectrum, globalSettings); // Площадь пика
      const Kha = calculateY(averageHeight, alphaValueDepth); // Функция расчёта Kha
      const Ck = Sk / Kha;
  
      return { intervalHeight: averageHeight, density: Ck };
    });
  
    const meanDensity = densities.reduce((sum, item) => sum + item.density, 0) / densities.length;
    const variance = densities.reduce((sum, item) => sum + Math.pow(item.density - meanDensity, 2), 0) / (densities.length - 1);
    const stdDeviation = Math.sqrt(variance);
  
    setContaminationDensity({
      densities,
      meanDensity: meanDensity.toFixed(8),
      stdDeviation: stdDeviation.toFixed(8),
    });
  };
  


  const handleHeightIntervalChange = (event) => {
    setHeightInterval(parseInt(event.target.value, 10));
  };
  
/*   const handleRecalculate = () => {
    const heightIntervalsData = calculateHeightIntervals();
    calculateContaminationDensity(heightIntervalsData);
  }; */

  const [rawResultC, setRawResultC] = useState(0);
  const [rawDeviationD, setRawDeviationD] = useState(0);

  const handleCalculateDensity = () => {

    console.log('AlphaValue:', alphaValueCs137);
    console.log('ValidMeasurements:', validMeasurements);
   // console.log('HeightIntervalsData:', heightIntervalsData);
   // console.log('ContaminationDensity:', contaminationDensity);

    const contaminationDensities = validMeasurements.map((measurement) => {
      const { dose, height } = measurement;
      const Y = calculateY(height, alphaValueCs137); // Используем значение для МЭД
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

  useEffect(() => {
    if ((selectedCollection?.is_online) || (!selectedCollection)) {
      return;
    }
    const heightIntervals = calculateHeightIntervals();

    console.log('heightIntervals', heightIntervals);
    setHeightIntervalsData(heightIntervals);
    console.log('calculateContaminationDensity');
    calculateContaminationDensity(heightIntervals);
  }, [heightInterval, alphaValueDepth, validMeasurements]); // Зависимости
  
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

/*   useEffect(() => {
    if (open) {
      handleCalculateDensity(); // Выполняем расчет при открытии окна
    }
  }, [open]); */


  const handleAlphaChangeDepth = (event) => {
    const newAlphaValueDepth = event.target.value;
    setAlphaValueDepth(newAlphaValueDepth);
  };

  useEffect(() => {
    console.log('AlphaValue updated:', alphaValueCs137);
    handleCalculateDensity(); // Выполняем расчет при изменении коэффициента заглубления
  }, [alphaValueCs137]);

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

  useEffect(() => {
    // Если есть данные для расчёта
    if (validMeasurements && validMeasurements.length > 0) {
      const alphaOptions = [0.001, 0.2, 1, 4, 30];
      let bestAlpha = null;
      let minDa = Infinity;
  
      alphaOptions.forEach((alpha) => {
        const Da = validMeasurements.reduce((sum, measurement) => {
          const H_i = measurement.dose;
          const H_star = calculateY(measurement.height, alpha); // Рассчитываем K(h, α)
          const error = H_star - H_i;
          return sum + Math.pow(error, 2);
        }, 0);
  
        if (Da < minDa) {
          minDa = Da;
          bestAlpha = alpha;
        }
      });
  
      setAlphaValueDepth(bestAlpha); // Устанавливаем найденное значение
    }
  }, [validMeasurements]);
  

  return (
    <Dialog open={open} onClose={onClose}       PaperProps={{
      style: { width: '700px' },  
    }}>
      
      <Tabs value={tabIndex} onChange={handleTabChange} variant="fullWidth">
        <Tab label="Поиск точечного источника" />
        <Tab label="Плотность загрязнения Cs-137 (по МЭД)" />
        <Tab label="Заглубление Cs-137 в почве" />
        <Tab label="Плотность загрязнения Cs-137 (по спектру)" />
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
                      Расчетный пик:{" "}
                      {calculatedPeakCenter === "" || calculatedPeakCenter === "Не найден" ? (
                        <span style={{ color: "red" }}>Не найден</span>
                      ) : (
                        `${calculatedPeakCenter} keV`
                      )}
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
              selectedPoints={(selectedPoints && selectedPoints.length > 0) ? selectedPoints : validMeasurements}
              saveCollectionParams={saveCollectionParams}
              leftBound={energyRange.low}  // Передаем нижнюю границу
              rightBound={energyRange.high}  // Передаем верхнюю границу
              oldPeakEnergy={parseFloat(idealPeakCenter)}  // Передаем паспортный пик как oldPeakEnergy
              newPeakEnergy={parseFloat(calculatedPeakCenter)}  // Передаем расчетный пик как newPeakEnergy
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
              <FormControl fullWidth size="small" margin="dense">
                <InputLabel id="alphaValueCs137-label">Коэффициент заглубления α</InputLabel>
                <Select
                  labelId="alphaValueCs137-label"
                  value={alphaValueCs137}
                  onChange={(event) => setAlphaValueCs137(event.target.value)}
                  label="Коэффициент заглубления α"
                >
                  {/* Значения на выбор */}
                  {[0.001, 0.2, 1, 4, 30].map((value) => (
                    <MenuItem key={value} value={value}>
                      {value}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
{/*               <FormControl fullWidth variant="outlined" size="small">
                <Select
                  value={alphaValue}
                  onChange={handleAlphaChange} // Вызываем новый обработчик
                  size="small"
                >
                  <MenuItem value={0.001}>0,001</MenuItem>
                  <MenuItem value={0.2}>0,2</MenuItem>
                  <MenuItem value={1}>1</MenuItem>
                  <MenuItem value={4}>4</MenuItem>
                  <MenuItem value={30}>30</MenuItem>
                </Select>   
              </FormControl> */}
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
            {!eligible ? (
              <Typography color="error">
                Для работы алгоритма требуются измерения на различных высотах.
              </Typography>
            ) : (
              depthResult && (
                <>
                  <Typography>
                    <FormControl fullWidth size="small" margin="dense">
                      <InputLabel id="alphaValueDepth-label">Предполагаемый коэффициент заглубления α (1/см)</InputLabel>
                      <Select
                        labelId="alphaValueDepth-label"
                        value={alphaValueDepth}
                        onChange={(event) => setAlphaValueDepth(event.target.value)} // Пользовательский выбор
                        label="Предполагаемый коэффициент заглубления α (1/см)"
                      >
                        {[0.001, 0.2, 1, 4, 30].map((value) => (
                          <MenuItem key={value} value={value}>
                            {value}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>                    
                    
{/*                     <br />
                    Предполагаемый коэффициент заглубления α (1/см): {depthResult.alpha}<br /> */}
                    α = 0,001 1/см: объемное загрязнение<br />
                    α = 30 1/см: поверхностное загрязнение
                  </Typography>
                  <Grid container alignItems="center" spacing={1}>
                    <Grid item>
                      <Typography>
                        Плотность загрязнения (в приближении):
                      </Typography>
                    </Grid>
                    <Grid item>
                      <Typography>
                        {updateDisplayedCa(depthResult.Ca, unitDepth)}
                      </Typography>
                    </Grid>
                    <Grid item>
                      <FormControl margin="dense" size="small">
                        <Select
                          value={unitDepth}
                          onChange={handleUnitDepthChange}
                          size="small"
                        >
                          <MenuItem value="Бк/см²">Бк/см²</MenuItem>
                          <MenuItem value="Ки/м²">Ки/м²</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </>
              )
            )}
          </Box>
        )}

        {tabIndex === 3 && (
          <Box>   
            {!eligible ? (
              <Typography color="error">
                Для работы алгоритма требуются измерения на различных высотах.
              </Typography>
            ) : (
              /* contaminationDensity && */ (
                <Box>
                  <Grid container alignItems="center" spacing={1}>
                    <Grid item xs={6}>
                      <Box>
                        <p>Коэффициент заглубления α</p>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <FormControl fullWidth variant="outlined" size="small">
                        <Select
                          value={alphaValueDepth}
                          onChange={handleAlphaChangeDepth}
                          size="small"
                        >
                          <MenuItem value={0.001}>0,001</MenuItem>
                          <MenuItem value={0.2}>0,2</MenuItem>
                          <MenuItem value={1}>1</MenuItem>
                          <MenuItem value={4}>4</MenuItem>
                          <MenuItem value={30}>30</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                  <Typography>Результаты расчета плотности загрязнения:</Typography>
                  <Typography>Плотность загрязнения (в приближении Cs-137): {contaminationDensity.meanDensity} Бк/см²</Typography>
                  <Typography>Среднеквадратичное отклонение: {contaminationDensity.stdDeviation} Бк/см²</Typography>
                  <ul>
                    {contaminationDensity.densities.map(({ intervalHeight, density }, index) => (
                      <li key={index}>
                        Высота: {intervalHeight.toFixed(2)} м, Плотность: {density.toFixed(8)} Бк/см²
                      </li>
                    ))}
                  </ul>

                  <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      label="Интервал высот (м)"
                      type="number"
                      value={heightInterval}
                      onChange={handleHeightIntervalChange}
                    />
                  </Grid>
               
                </Grid>                  
                </Box>
              )
            )}

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
