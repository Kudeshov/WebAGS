/* eslint-disable react-hooks/exhaustive-deps */

import React, { useEffect, useState, useRef, useContext, useCallback  } from 'react';
import { MapContainer, TileLayer, CircleMarker, LayersControl, useMap } from 'react-leaflet';
import * as turf from '@turf/turf';  
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './MyMapComponent.css';
import { FeatureGroup } from 'react-leaflet';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
//import { HeatmapLayer } from 'react-leaflet-heatmap-layer-v3';
import { getColorT, calculateScaledThresholds } from './colorUtils';
import RectangularSelection from './RectangularSelection';
import { FlightDataContext } from './FlightDataContext';
import { createRoot } from 'react-dom/client';
import 'leaflet-easyprint';
import { convertDateTime } from './dateUtils';
import SpectrumChart from './SpectrumChart'; 
import crossIcon from './icons/radiation-alt.svg';

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const transformData = (data, globalSettings) => {
  if (data.length === 0) return;

  const flightStartTime = data.reduce((min, p) => p.datetime < min ? p.datetime : min, data[0].datetime);
  const flightStart = new Date(flightStartTime).getTime();

  let transformedData = data.map((measurement) => {
    const measurementTime = new Date(measurement.datetime).getTime();  
    const timeFromStart = (measurementTime - flightStart) / 1000;
    return {
      time: timeFromStart,
      МЭД: parseFloat(measurement.dose.toFixed(2)),
      Высота: parseFloat(measurement.height.toFixed(2)),  
    };
  });

  // Сортировка преобразованных данных по времени с начала полёта
  transformedData.sort((a, b) => a.time - b.time);

  // Если задано окно для отображения, фильтруем данные, чтобы оставить только последние N секунд
  if ( globalSettings.chartWindow ) {
    const lastNSeconds = globalSettings.chartWindow; // Предполагаем, что chartWindow содержит одно значение: N секунд
    const maxTime = transformedData[transformedData.length - 1].time; // Максимальное время из набора данных
    transformedData = transformedData.filter(item => (maxTime - item.time) <= lastNSeconds);
  }

  return transformedData;
};

const formatDateAxis = (tickItem) => {
  return Math.round(tickItem);
};   

function TimeLineChart({ data, globalSettings }) {
  const transformedData = transformData(data, globalSettings); // Преобразование данных
  if (!transformedData?.length) 
    return;
  return (
    <LineChart width={350} height={210} data={transformedData} margin={{ top: 5, right: -5, left: -5, bottom: 10 }}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis tickFormatter={formatDateAxis} dataKey="time" label={{ value: 'Время с начала полёта, с', position: 'insideBottomRight', offset: -5, dx: -50 }} />
      <YAxis yAxisId="left" label={{ value: 'Мощность дозы, мкЗв/час', angle: -90, position: 'insideLeft', offset: 15, dy: 80, style: { fill: 'green' } }} />
      <YAxis yAxisId="right" orientation="right" label={{ value: 'Высота, м', angle: -90, position: 'insideRight', offset: 15, dy: -25, style: { fill: 'blue' } }} />
      <Tooltip />
      <Line yAxisId="left" type="linear" dataKey="МЭД" stroke="green" strokeWidth={2} dot={false} isAnimationActive={false}  />
      <Line yAxisId="right" type="linear" dataKey="Высота" stroke="blue" strokeWidth={2} dot={false} isAnimationActive={false}  />
    </LineChart>
  );
}


function MapEffect({ setMapInstance }) {
  const map = useMap();
  React.useEffect(() => {
    if (map) {
      setMapInstance(map);
    }
  }, [map, setMapInstance]);
  
  return null;
}

function MyMapComponent({ chartOpen, heightFilterActive }) {

  const [mapInstance, setMapInstance] = React.useState(null);
  const googleMapsUrl = 'http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=ru';
  const googleSatelliteUrl = 'http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&hl=ru';
  const { selectedCollection } = useContext(FlightDataContext);
  const { validMeasurements } = useContext(FlightDataContext);
  const { measurements } = useContext(FlightDataContext);
  const { geoCenter } = useContext(FlightDataContext);
  const { minDoseValue, maxDoseValue } = useContext(FlightDataContext);
  const { setSaveMapAsImage } = useContext(FlightDataContext);
  const { sourceCoordinates, sourceActivity, sourceDeviation } = useContext(FlightDataContext);
  const { setMapBounds } = useContext(FlightDataContext);
  
  const [spectrumData, setSpectrumData] = useState(null);
  const infoPanelRef = useRef(null); // Ссылка на DOM-элемент панели
  const spectrumPanelRef = useRef(null); 
  const timeLineRef = useRef(null); 

  const { colorThresholds } = useContext(FlightDataContext);

  const [averageMeasurement, setAverageMeasurement] = useState(null);
  const [averageDiapasone, setAverageDiapasone] = useState(null);
  const [isIsolineLayerActive, setIsIsolineLayerActive] = useState(false);
  const [cachedIsolines, setCachedIsolines] = useState(null);
  const isolineLayerRef = useRef(null);
  const [isIsobandLayerActive, setIsIsobandLayerActive] = useState(false);
  const [cachedIsobands, setCachedIsobands] = useState(null);
  const isobandLayerRef = useRef(null);
  const [selectMode, setSelectMode] = useState(false);    
  const { selectedPoints, setSelectedPoints } = useContext(FlightDataContext);
  const { setSelectionSource } = useContext(FlightDataContext);
  const { globalSettings } = useContext(FlightDataContext);
  const { selectedDatabase } = useContext(FlightDataContext);

  useEffect(() => {
    if (mapInstance && sourceCoordinates) {
      const crossMarker = addCrossMarker(mapInstance, sourceCoordinates);
      
      return () => {
        mapInstance.removeLayer(crossMarker);
      };
    }
  }, [mapInstance, sourceCoordinates]);
  
  const addCrossMarker = (map, coordinates) => {
    // Создание иконки маркера
    const crossMarker = L.marker(coordinates, {
      icon: L.icon({
        iconUrl: crossIcon, // Укажите путь к иконке
        iconSize: [32, 32], // Размер иконки
        iconAnchor: [16, 16], // Центр иконки будет на координатах
      }),
    }).addTo(map);
  
    // Добавление всплывающего окна с информацией о источнике
    crossMarker.bindTooltip(`
      <div style="text-align: left;">
        <strong>Координаты:</strong><br>
        ${sourceCoordinates.lat.toFixed(6)}, ${sourceCoordinates.lon.toFixed(6)}<br>
        <strong>Активность:</strong><br>
        ${sourceActivity}<br>
        <strong>Отклонение:</strong><br>
        ${sourceDeviation}
      </div>
    `, { 
      permanent: false, // Всплывающее окно не будет постоянным
      direction: 'top', // Всплывающее окно будет отображаться сверху
      className: 'source-tooltip' // CSS класс для стилизации всплывающего окна
    });
  
    return crossMarker;
  };
  
  const handlePointClick = (event, measurement) => {
    
    const nativeEvent = event.originalEvent || event;
    const isCtrlPressed = nativeEvent.ctrlKey; // Проверяем, нажата ли клавиша Ctrl
    //console.log('isCtrlPressed', isCtrlPressed);
  
    if (isCtrlPressed) {
      // Добавляем точку в массив, если Ctrl нажат
      setSelectedPoints(prevPoints => [...prevPoints, measurement]);
    } else {
      // Заменяем массив одной точкой, если Ctrl не нажат
      setSelectedPoints([measurement]);
    }
    setSelectionSource('map'); // Установка источника выбора в 'map'
  };

  useEffect(() => {
    // This assumes there's an array of selected points
    if (selectedPoints.length > 0) {
      // Calculate sums and ranges
      let sumDose = 0, /* sumDoseW = 0,  */sumGeiger1 = 0, sumGeiger2 = 0, sumGMDose1 = 0, sumGMDose2 = 0;
      let minTime = new Date('9999-12-31T23:59:59Z'), maxTime = new Date('1000-01-01T00:00:00Z');
      let minLat = Infinity, maxLat = -Infinity;
      let minLong = Infinity, maxLong = -Infinity;
  
        // Iterate over selectedPoints to accumulate values and find min/max
        selectedPoints.forEach(point => {
          sumDose += parseFloat(point.dose);
          //sumDoseW += point.dosew;
          sumGeiger1 += point.geiger1;
          sumGeiger2 += point.geiger2;
          sumGMDose1 += point.gmdose1;
          sumGMDose2 += point.gmdose2;   

        const pointTime = new Date(point.datetime);
        if (pointTime < minTime) minTime = pointTime;
        if (pointTime > maxTime) maxTime = pointTime;
        minLat = Math.min(minLat, point.lat);
        maxLat = Math.max(maxLat, point.lat);
        minLong = Math.min(minLong, point.lon);
        maxLong = Math.max(maxLong, point.lon);
      });
  
      // Calculate averages
      const avgDose = sumDose / selectedPoints.length;
      //const avgCountW = sumDoseW / selectedPoints.length;
      const avgGeiger1 = sumGeiger1 / selectedPoints.length;
      const avgGeiger2 = sumGeiger2 / selectedPoints.length;
      const avgGMDose1 = sumGMDose1 / selectedPoints.length;
      const avgGMDose2 = sumGMDose2 / selectedPoints.length;
      // Create ranges for time, latitude, and longitude
      const timeRange = [minTime, maxTime];
      const latRange = [minLat, maxLat];
      const longRange = [minLong, maxLong];
  
      // Create the averageMeasurement object
      const tempAverageMeasurement = {
        dose: avgDose,
        //dosew: avgCountW,
        timeRange: timeRange,
        latRange: latRange,
        longRange: longRange,
        geiger1: avgGeiger1,
        geiger2: avgGeiger2,
        gmdose1: avgGMDose1,
        gmdose2: avgGMDose2,
        // ... other averaged values and ranges
      };
      setAverageMeasurement(tempAverageMeasurement)
    }
  }, [selectedPoints]); // This useEffect should depend on selectedPoints array

  const calculateAverageSpectrum = useCallback((selectedPoints) => {

    if (selectedPoints.length === 0 || !selectedCollection) {
      return [];
    }
  
    // Проверяем, есть ли спектр у первой выбранной точки и содержит ли он массив каналов
    const hasSpectrumChannels = selectedPoints[0].spectrum && Array.isArray(selectedPoints[0].spectrum.channels);

    // Если нет спектра или каналов, возвращаем пустой массив
    if (!hasSpectrumChannels) {
      return [];
    }
    // Используем значения по умолчанию, если P0 или P1 отсутствуют
    const { P0 = 70, P1 = 11 } = selectedCollection || {};
  
    // Инициализация массива для суммы спектра
    const sumSpectrum = Array(selectedPoints[0].spectrum.channels.length).fill(0);
  
    // Суммирование спектров всех выбранных точек
    selectedPoints.forEach(point => {
      point.spectrum.channels.forEach((value, index) => {
        sumSpectrum[index] += value;
      });
    });
  
    // Вычисление среднего значения спектра
    const avgSpectrum = sumSpectrum.map((value, index) => ({
      energy: P0 + P1 * index, // Преобразование номера канала в энергию
      value: value / selectedPoints.length, // Среднее значение
      count: value // Неусредненное суммарное значение
    }));
    return avgSpectrum;
  }, [selectedCollection]);
  
  useEffect(() => {
    // Вызывается каждый раз при изменении selectedPoints
    if (selectedCollection) {
      const avgSpectrumData = calculateAverageSpectrum(selectedPoints);
      setSpectrumData(avgSpectrumData); // Прямое присвоение обработанных данных
      // Обновление панели спектра
      const totalHeight = selectedPoints.reduce((acc, point) => acc + point.height, 0);
      const averageHeight = totalHeight / selectedPoints.length;
      const times = selectedPoints.map(point => new Date(point.datetime).getTime());
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const timeInterval = (maxTime - minTime) / 1000; // Разница в секундах
      //console.log(selectedPoints, timeInterval)
      // Обновление панели спектра
      if (spectrumPanelRef.current && spectrumPanelRef.current._root) {
        spectrumPanelRef.current._root.render(
          <SpectrumChart
            averageHeight={averageHeight}
            timeInterval={timeInterval} // Передаем вычисленный интервал времени
            selectedCollection={selectedCollection}
            data={avgSpectrumData}
            isLoading={false}
          />
        );
      }
    }
  }, [selectedPoints, calculateAverageSpectrum, selectedCollection]);

  useEffect(() => {
    if (selectedPoints.length > 0) {
      let minDose = Infinity, maxDose = -Infinity;
      let minCountW = Infinity, maxCountW = -Infinity;
      let minLat = Infinity, maxLat = -Infinity;
      let minLong = Infinity, maxLong = -Infinity;
      let minAlt = Infinity, maxAlt = -Infinity;
      let minHeight = Infinity, maxHeight = -Infinity;
      let minTime = new Date('9999-12-31T23:59:59Z'), maxTime = new Date('1000-01-01T00:00:00Z');
  
      selectedPoints.forEach(point => {
        minDose = Math.min(minDose, parseFloat(point.dose));
        maxDose = Math.max(maxDose, parseFloat(point.dose));
        minCountW = Math.min(minCountW, point.countw);
        maxCountW = Math.max(maxCountW, point.countw);
        const pointTime = new Date(point.datetime);
        minTime = minTime > pointTime ? pointTime : minTime;
        maxTime = maxTime < pointTime ? pointTime : maxTime;
        minLat = Math.min(minLat, point.lat);
        maxLat = Math.max(maxLat, point.lat);
        minLong = Math.min(minLong, point.lon);
        maxLong = Math.max(maxLong, point.lon);
        minAlt = Math.min(minAlt, point.alt);
        maxAlt = Math.max(maxAlt, point.alt);
        minHeight = Math.min(minHeight, point.height);
        maxHeight = Math.max(maxHeight, point.height);
      });
  
      setAverageDiapasone({
        doseRange: [minDose, maxDose],
        countwRange: [minCountW, maxCountW],
        latRange: [minLat, maxLat],
        longRange: [minLong, maxLong],
        timeRange: [minTime, maxTime],
        altRange: [minAlt, maxAlt],
        heightRange: [minHeight, maxHeight]
      });
    }
  }, [selectedPoints]);

  useEffect(() => {
    mapInstance?.setView([geoCenter.lat, geoCenter.lng], mapInstance.getZoom());
  }, [mapInstance, geoCenter]);

  useEffect(() => {
    if (selectMode) {
      document.body.classList.add('selection-mode-active');
    } else {
      document.body.classList.remove('selection-mode-active');
    }
  }, [selectMode]);

  const handleSelectionComplete = (bounds) => {
    // Разбиваем bounds на отдельные переменные для удобства
    const { _southWest, _northEast } = bounds;

    // Сохраняем bounds в контексте
    setMapBounds(bounds);
  
    // Фильтруем измерения, чтобы найти те, которые находятся внутри прямоугольника
    const selected = validMeasurements.filter((measurement) => {
      return (
        measurement.lat >= _southWest.lat &&
        measurement.lat <= _northEast.lat &&
        measurement.lon >= _southWest.lng &&
        measurement.lon <= _northEast.lng
      );
    });
  
    // Обновляем состояние selectedPoints
    setSelectedPoints(selected);
    setSelectionSource('map'); // Установка источника выбора в 'map'
  };

  const mapRef = useRef(null);

  useEffect(() => {
    const mapElement = document.getElementById('map');
    if (selectMode) {
      mapElement.style.cursor = 'crosshair';
    } else {
      mapElement.style.cursor = ''; // Resets to default cursor
      setMapBounds(null);
    }
  }, [selectMode]);

  const hideSpectrumPanel = () => {
    if (spectrumPanelRef.current) {
      spectrumPanelRef.current.style.display = 'none';
    }
  };

  const showSpectrumPanel = () => {
    if (spectrumPanelRef.current) {
      spectrumPanelRef.current.style.display = 'block';
    }
  };
  
  const hideTimeLine = () => {
    if (timeLineRef.current) {
      timeLineRef.current.style.display = 'none';
    }
  };

  const showTimeLine = () => {
    if (timeLineRef.current) {
      timeLineRef.current.style.display = 'block';
    }
  };

  useEffect(() => {
    if (chartOpen) {
      showSpectrumPanel()
    } else {
      hideSpectrumPanel()
    }
  }, [chartOpen]);

  useEffect(() => {
    if (selectedCollection?.is_online) {
      showTimeLine()
    } else {
      hideTimeLine()
    }
  }, [selectedCollection?.is_online]);

  const selectedDatabaseRef = useRef(selectedDatabase);

  // Обновляем ссылку при каждом изменении selectedDatabase
  useEffect(() => {
    selectedDatabaseRef.current = selectedDatabase;
  }, [selectedDatabase]);

    // Функция для формирования имени файла
    const generateFileName = useCallback(() => {
      const date = new Date();
      const formatDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
      const formatTime = `${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}${date.getSeconds().toString().padStart(2, '0')}`;
      const dbName = selectedDatabaseRef.current; // Используем значение из ссылки
      if (dbName) {
        return `${dbName}_${formatDate}_${formatTime}`;
      }
      return `map_${formatDate}_${formatTime}`;
    }, []);
  
  function createInfoControl(map, panelRef) {
    var control = L.control({ position: 'bottomright' });
  
    control.onAdd = function() {
      if (!panelRef.current) {
        panelRef.current = L.DomUtil.create('div', 'simple-panel');
        L.DomEvent.disableClickPropagation(panelRef.current);
        panelRef.current.innerHTML = '<strong>Выберите точку на карте</strong>';
      }
      return panelRef.current;
    };
  
    control.addTo(map);

    const printPlugin = L.easyPrint({
      title: 'Моя карта',
      position: 'topright',
      sizeModes: ['Current', 'A4Landscape', 'A4Portrait'],
      filename: generateFileName(),
      exportOnly: true,
      hideControlContainer: true,
      hidden: true // Скрываем кнопку на карте
    }).addTo(map);

    // Задаем функцию в контекст
    setSaveMapAsImage(() => () => {
      // Устанавливаем актуальное имя файла непосредственно перед сохранением
      printPlugin.options.filename = generateFileName();
      printPlugin.printMap('CurrentSize', printPlugin.options.filename);
    });
  }

  function createSpectrumControl(map) {
    const spectrumControl = L.control({ position: 'bottomright' });
  
    spectrumControl.onAdd = function () {
      spectrumPanelRef.current = L.DomUtil.create('div', 'spectrum-panel');
      L.DomEvent.disableClickPropagation(spectrumPanelRef.current);
      // Создаем корень для рендеринга компонента
      const root = createRoot(spectrumPanelRef.current);
      const totalHeight = selectedPoints.reduce((acc, point) => acc + point.height, 0);
      const averageHeight = totalHeight / selectedPoints.length;
      const times = selectedPoints.map(point => new Date(point.datetime).getTime());
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const timeInterval = (maxTime - minTime) / 1000; // Разница в секундах
      //console.log(selectedPoints, timeInterval)

      spectrumPanelRef.current._root = root; // Сохраняем корень в свойстве для последующего доступа
      root.render(<SpectrumChart  timeInterval={timeInterval}  averageHeight={averageHeight} selectedCollection={selectedCollection} data={spectrumData}/*  isLoading={isLoading} */ />);
      return spectrumPanelRef.current;
    };
  
    spectrumControl.addTo(map);
        // Изначально скрываем панель
    if (spectrumPanelRef.current && !chartOpen) {
      spectrumPanelRef.current.style.display = 'none';
    }
  }

  useEffect(() => {
    if (measurements && measurements.length > 0) {
      // Обновляем TimeLineChart с новыми данными и показываем панель
      if (timeLineRef.current && timeLineRef.current._root) {
        timeLineRef.current._root.render(
          <TimeLineChart data={measurements} globalSettings={globalSettings} />
        );
        if (timeLineRef.current && selectedCollection?.is_online) {
          timeLineRef.current.style.display = 'block';
        }
      }
    } else {
      
      if (timeLineRef.current && !selectedCollection?.is_online) { 
        timeLineRef.current.style.display = 'none';
      }

      // Скрываем TimeLineChart, если validMeasurements пуст
      if (timeLineRef.current && !measurements?.length) { 
        timeLineRef.current.style.display = 'none';
      }
    }
  }, [measurements, globalSettings]);
  
  
  function createTimeLineControl(map) {

    if (timeLineRef.current)
    {
      if (timeLineRef.current && !selectedCollection?.is_online) {
        timeLineRef.current.style.display = 'none';
      }
      return timeLineRef.current; 
    }

    const timeLineControl = L.control({ position: 'bottomright' });
    timeLineControl.onAdd = function () {
      timeLineRef.current = L.DomUtil.create('div', 'time-line-panel');
      L.DomEvent.disableClickPropagation(timeLineRef.current);
      // Создаем корень для рендеринга компонента
      const root = createRoot(timeLineRef.current);
      timeLineRef.current._root = root; // Сохраняем корень в свойстве для последующего доступа
      root.render(<TimeLineChart data={measurements} globalSettings={globalSettings}/>);
      return timeLineRef.current;
    };
  
    timeLineControl.addTo(map);
    // Изначально скрываем панель
    if (timeLineRef.current && !selectedCollection?.is_online) {
      timeLineRef.current.style.display = 'none';
    }
  }

  useEffect(() => {
    if (mapInstance) {
      createSpectrumControl(mapInstance);
      createInfoControl(mapInstance, infoPanelRef);
      createTimeLineControl(mapInstance);
    }
  }, [mapInstance]);

  useEffect(() => {
    // Обновляем содержимое панели при изменении selectedMeasurement или altitudeSource
    if (infoPanelRef.current && averageMeasurement && averageDiapasone) {
      const altitudeLabel = globalSettings.altitudeSource === 'barometric' ? 'Высота баром.' : 'Высота GPS.';
      const altitudeRange = globalSettings.altitudeSource === 'barometric' ? averageDiapasone.heightRange : averageDiapasone.altRange;
//Мощность дозы (по окну): ${parseFloat(averageMeasurement.dosew).toFixed(2)} мкЗв/час<br>
//Мощность дозы (по окну): ${parseFloat(averageMeasurement.dosew).toFixed(2)} мкЗв/час<br>
//Счёт в окне: ${averageDiapasone.countwRange[0]} - ${averageDiapasone.countwRange[1]} имп/с<br>
//Счёт в окне: ${averageDiapasone.countwRange[0]} имп/с<br>
      if (selectedPoints.length > 1) {
        infoPanelRef.current.innerHTML = `
          Количество измерений: ${selectedPoints.length}<br>
          Дата: ${convertDateTime(averageDiapasone.timeRange[0])} -  ${convertDateTime(averageDiapasone.timeRange[1])}<br>
          Время измерения: ${(averageDiapasone.timeRange[1].getTime() - averageDiapasone.timeRange[0].getTime()) / 1000} сек<br>
          
          Долгота: ${averageDiapasone.longRange[0].toFixed(6)} - ${averageDiapasone.longRange[1].toFixed(6)}<br>
          Широта: ${averageDiapasone.latRange[0].toFixed(6)} - ${averageDiapasone.latRange[1].toFixed(6)}<br>
          ${altitudeLabel}: ${altitudeRange[0].toFixed(2)} - ${altitudeRange[1].toFixed(2)} м<br>
          МЭД: ${parseFloat(averageMeasurement.dose).toFixed(2)} мкЗв/час<br>
          Счётчик ГМ1: ${averageMeasurement.geiger1.toFixed(6)} имп/с<br>
          Счётчик ГМ2: ${averageMeasurement.geiger2.toFixed(6)} имп/с<br>
          Мощность дозы ГМ: ${averageMeasurement.gmdose1.toFixed(6)} мкЗв/час`
        ;
      } else {
        infoPanelRef.current.innerHTML = `
          Дата: ${convertDateTime(averageDiapasone.timeRange[0])}<br>
          Время измерения: 1 сек<br>
          
          Долгота: ${averageDiapasone.longRange[0].toFixed(6)}<br>
          Широта: ${averageDiapasone.latRange[0].toFixed(6)} <br>
          ${altitudeLabel}: ${altitudeRange[0].toFixed(2)} м<br>
          МЭД: ${parseFloat(averageMeasurement.dose).toFixed(2)} мкЗв/час<br>
          Счётчик ГМ1: ${averageMeasurement.geiger1} имп/с<br>
          Счётчик ГМ2: ${averageMeasurement.geiger2} имп/с<br>
          Мощность дозы ГМ1: ${averageMeasurement.gmdose1} мкЗв/час`        
      }
    }
  }, [averageMeasurement, averageDiapasone, selectedPoints.length, globalSettings.altitudeSource]);


const [previousValidMeasurements, setPreviousValidMeasurements] = useState();
const [previousValidMeasurementsBand, setPreviousValidMeasurementsBand] = useState();

const hasSufficientBoundingBoxSize = (measurements, minWidth = 0.000073, minHeight = 0.000045) => {
  // Получаем минимальные и максимальные значения широты и долготы
  const latitudes = measurements.map(m => m.lat);
  const longitudes = measurements.map(m => m.lon);
  
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);

  // Вычисляем ширину и высоту прямоугольника, охватывающего все точки
  const width = maxLon - minLon;
  const height = maxLat - minLat;

  // Проверяем, что прямоугольник имеет достаточные размеры
  return width >= minWidth && height >= minHeight;
};


useEffect(() => {
  if (!isIsolineLayerActive) {
    return;
  }

  if (previousValidMeasurements === validMeasurements) {
    return;
  }

  setPreviousValidMeasurements(validMeasurements);

  if (!validMeasurements || validMeasurements.length < 10 || !hasSufficientBoundingBoxSize(validMeasurements)) {
    setCachedIsolines({
      lines: [],
      minDose: null,
      maxDose: null
    });
    return;
  }

  // Создание коллекции точек для интерполяции
  const points = validMeasurements.map(m => turf.point([m.lon, m.lat], { dose: m.dose }));

  // Вычисляем границы (bbox) реальных точек
  const [minX, minY, maxX, maxY] = turf.bbox(turf.featureCollection(points));

  // Вычисляем размеры прямоугольника
  const width = maxX - minX;
  const height = maxY - minY;

  // Определяем коэффициенты для буфера по осям X и Y
  const bufferXPercentage = 0.04; // Например, 4% от ширины
  const bufferYPercentage = 0.03; // Например, 3% от высоты

  // Вычисляем буфер в зависимости от размеров прямоугольника
  const bufferX = width * bufferXPercentage;
  const bufferY = height * bufferYPercentage;

  // Вычисляем среднее значение дозы по реальным измерениям
  const averageDose = validMeasurements.reduce((sum, m) => sum + m.dose, 0) / validMeasurements.length;

  // Добавляем фальшивые точки немного за границы реальных данных
  const fakePoints = [
    turf.point([minX - bufferX, minY - bufferY], { dose: averageDose }), // Нижний левый угол
    turf.point([maxX + bufferX, minY - bufferY], { dose: averageDose }), // Нижний правый угол
    turf.point([minX - bufferX, maxY + bufferY], { dose: averageDose }), // Верхний левый угол
    turf.point([maxX + bufferX, maxY + bufferY], { dose: averageDose })  // Верхний правый угол
  ];

  // Объединяем реальные точки с фальшивыми
  const pointsCollection = turf.featureCollection([...points, ...fakePoints]);

  const cellSize = 0.003; // Размер ячейки для интерполяции

  // Выполнение интерполяции
  const interpolated = turf.interpolate(pointsCollection, cellSize, {
    gridType: 'point',
    property: 'dose'
  });

  // Получение минимального и максимального значений дозы после интерполяции
  const minDose = Math.min(...interpolated.features.map(f => f.properties.dose));
  const maxDose = Math.max(...interpolated.features.map(f => f.properties.dose));

  // Расчет равномерно распределенных уровней изолиний
  const numBreaks = 11; // Количество уровней изолиний
  const breaks = Array.from({ length: numBreaks }, (_, i) => 
    minDose + (maxDose - minDose) * (i / (numBreaks - 1))
  );

  // Создание изолиний на основе рассчитанных уровней
  const lines = turf.isolines(interpolated, breaks, { zProperty: 'dose' });

  // Кэширование рассчитанных изолиний
  setCachedIsolines({
    lines: lines,
    minDose: minDose,
    maxDose: maxDose
  });

}, [validMeasurements, previousValidMeasurements, isIsolineLayerActive]);

  

  useEffect(() => {
    if (isIsolineLayerActive && mapInstance) {
      // Удалить предыдущий слой изолиний, если он существует
      if (isolineLayerRef.current) {
        isolineLayerRef.current.remove();
      }

      // Создать новый слой изолиний из кешированных данных
      if (cachedIsolines)  {
        const colorThresholdsIsolines = calculateScaledThresholds(colorThresholds, minDoseValue, maxDoseValue, cachedIsolines.minDose, cachedIsolines.maxDose);
        isolineLayerRef.current = L.geoJSON(cachedIsolines.lines, {
          style: feature => {
            // Применение цвета к изолиниям на основе значения дозы 
            const doseValue = feature.properties.dose;
            return {
              //color: getColor(doseValue, cachedIsolines.minDose, cachedIsolines.maxDose),
              color: getColorT(doseValue, colorThresholdsIsolines, cachedIsolines.minDose, cachedIsolines.maxDose),
              weight: 2,
              opacity: 0.6
            };
          }
        }).addTo(mapInstance);
        if (measurementsLayerRef.current) {
          measurementsLayerRef.current.bringToFront();
        }
      }

    } else {
      // Удалить слой изолиний при деактивации
      if (isolineLayerRef.current) {
        isolineLayerRef.current.remove();
        isolineLayerRef.current = null;
      }
    }
  }, [isIsolineLayerActive, cachedIsolines, mapInstance, colorThresholds, maxDoseValue, minDoseValue]);    


  const tooltipRef = useRef(null);

  // Функция для поиска точек, попадающих в полигон
  const findPointsInPolygon = (polygon, points) => {
    return points.filter(point => {
      const pt = turf.point([point.lon, point.lat]);
      return turf.booleanPointInPolygon(pt, polygon);
    });
  };
  
  useEffect(() => {
    if (isIsobandLayerActive && mapInstance) {
      // Удалить предыдущий слой изобендов, если он существует
      if (isobandLayerRef.current) {
        isobandLayerRef.current.remove();
      }
  
      // Создать новый слой изобендов из кешированных данных
      if (cachedIsobands) {
  
        isobandLayerRef.current = L.geoJSON(cachedIsobands.bands, {
          style: feature => {
            const doseRange = feature.properties.dose.split('-').map(Number);
            const doseValue = (doseRange[0] + doseRange[1]) / 2;
            const colorThresholdsIsobands = calculateScaledThresholds(
              colorThresholds, minDoseValue, maxDoseValue, cachedIsobands.minDose, cachedIsobands.maxDose
            );
            const fillColor = getColorT(doseValue, colorThresholdsIsobands, cachedIsobands.minDose, cachedIsobands.maxDose);
            return {
              color: fillColor,
              weight: 0,
              fillColor: fillColor,
              fillOpacity: 0.5
            };
          },
          onEachFeature: (feature, layer) => {
            // Добавляем обработчик для изменения курсора при наведении на полигон
            layer.on('mouseover', function () {
              mapInstance.getContainer().style.cursor = 'crosshair'; // Изменение курсора
            });
  
            // Возвращаем курсор к исходному состоянию, когда мышь уходит с полигона
            layer.on('mouseout', function () {
              mapInstance.getContainer().style.cursor = ''; // Возвращение к исходному виду
              if (tooltipRef.current) {
                mapInstance.removeLayer(tooltipRef.current); // Удаляем тултип, когда мышь уходит с полигона
                tooltipRef.current = null; // Обнуляем реф
              }
            });
          }
        }).addTo(mapInstance);
  
        // Обработчик наведения мыши на слой изобендов
        isobandLayerRef.current.on('mousemove', function (e) {
          const { latlng } = e;  // Проверяем, есть ли latlng
          if (!latlng || !latlng.lat || !latlng.lng) {
            return;  // Выходим из обработчика, если нет валидных координат
          }
  
          const layer = e.layer;
          const polygon = layer.feature.geometry;
  
          // Проверка, что тултип существует и его надо удалить
          if (tooltipRef.current) {
            mapInstance.removeLayer(tooltipRef.current);
            tooltipRef.current = null;
          }
  
          // Создаем новый тултип для текущего полигона
          tooltipRef.current = L.tooltip({
            permanent: false,
            direction: 'top',
            className: 'med-tooltip',
          });
  
          // Добавляем тултип на карту, только если есть валидные точки
          const pointsInPolygon = findPointsInPolygon(polygon, validMeasurements);
  
          if (pointsInPolygon.length > 0) {
            // Рассчитываем минимальное, максимальное и среднее значения дозы
            const minDose = Math.min(...pointsInPolygon.map(p => p.dose));
            const maxDose = Math.max(...pointsInPolygon.map(p => p.dose));
            const avgDose = pointsInPolygon.reduce((sum, p) => sum + p.dose, 0) / pointsInPolygon.length;
  
            // Обновляем тултип с новыми данными и отображаем его
            tooltipRef.current
              .setLatLng(latlng)  // Устанавливаем корректные координаты
              .setContent(`
                Диапазон МЭД: ${minDose.toFixed(2)} - ${maxDose.toFixed(2)} мкЗв/час<br>
                Средняя МЭД: ${avgDose.toFixed(2)} мкЗв/час
              `)
              .addTo(mapInstance);
          }
        });
  
        if (measurementsLayerRef.current) {
          measurementsLayerRef.current.bringToFront();
        }
      }
  
    } else {
      // Удалить слой изобендов при деактивации
      if (isobandLayerRef.current) {
        isobandLayerRef.current.remove();
        isobandLayerRef.current = null;
      }
      // Удаляем тултип, если слой изобендов отключен
      if (tooltipRef.current) {
        mapInstance.removeLayer(tooltipRef.current);
        tooltipRef.current = null;
      }
    }
  }, [isIsobandLayerActive, cachedIsobands, mapInstance, colorThresholds, maxDoseValue, minDoseValue]);
  

useEffect(() => {
  if (!isIsobandLayerActive) {
    return;
  }

  if (previousValidMeasurementsBand === validMeasurements) {
    return;
  }

  setPreviousValidMeasurementsBand(validMeasurements);

  if (!validMeasurements || validMeasurements.length < 10 || !hasSufficientBoundingBoxSize(validMeasurements)) {
    setCachedIsobands({
      bands: [],
      minDose: null,
      maxDose: null
    });
    return;
  }

  // Создание коллекции точек для интерполяции
  const points = validMeasurements.map(m => turf.point([m.lon, m.lat], { dose: m.dose }));

  // Вычисляем границы (bbox) реальных точек
  const [minX, minY, maxX, maxY] = turf.bbox(turf.featureCollection(points));

  // Вычисляем размеры прямоугольника
  const width = maxX - minX;
  const height = maxY - minY;

  // Определяем коэффициенты для буфера по осям X и Y
  const bufferXPercentage = 0.04; // Например, 5% от ширины
  const bufferYPercentage = 0.03; // Например, 2% от высоты

  // Вычисляем буфер в зависимости от размеров прямоугольника
  const bufferX = width * bufferXPercentage;
  const bufferY = height * bufferYPercentage;

  // Вычисляем среднее значение дозы по реальным измерениям
  const averageDose = validMeasurements.reduce((sum, m) => sum + m.dose, 0) / validMeasurements.length;

  // Добавляем фальшивые точки немного за границы реальных данных
  const fakePoints = [
    turf.point([minX - bufferX, minY - bufferY], { dose: averageDose }), // Нижний левый угол
    turf.point([maxX + bufferX, minY - bufferY], { dose: averageDose }), // Нижний правый угол
    turf.point([minX - bufferX, maxY + bufferY], { dose: averageDose }), // Верхний левый угол
    turf.point([maxX + bufferX, maxY + bufferY], { dose: averageDose })  // Верхний правый угол
  ];

  // Объединяем реальные точки с фальшивыми
  const pointsCollection = turf.featureCollection([...points, ...fakePoints]);

  const cellSize = 0.003;

  // Выполнение интерполяции
  const interpolated = turf.interpolate(pointsCollection, cellSize, {
    gridType: 'point',
    property: 'dose'
  });

  // Получение минимального и максимального значений дозы после интерполяции
  const minDose = Math.min(...interpolated.features.map(f => f.properties.dose));
  const maxDose = Math.max(...interpolated.features.map(f => f.properties.dose));

  // Расчет равномерно распределенных уровней изобендов
  const numBreaks = 11; // Количество уровней изобендов
  const breaks = Array.from({ length: numBreaks }, (_, i) =>
    minDose + (maxDose - minDose) * (i / (numBreaks - 1))
  );

  // Создание изобендов на основе рассчитанных уровней
  const bands = turf.isobands(interpolated, breaks, { zProperty: 'dose' });

  // Кэширование рассчитанных изобендов
  setCachedIsobands({
    bands: bands,
    minDose: minDose,
    maxDose: maxDose
  });

}, [validMeasurements, previousValidMeasurementsBand, isIsobandLayerActive]);
  

const measurementsLayerRef = useRef(null);

const toggleSelectMode = () => {
  setSelectMode(!selectMode);
};

useEffect(() => {
  if (mapInstance) {
    if (!mapInstance.selectionModeControl) {
      createSelectionModeControl(mapInstance, toggleSelectMode);
    }
  }
}, [mapInstance]);

useEffect(() => {
  if (mapInstance?.selectionModeControl) {
    const container = mapInstance.selectionModeControl.getContainer();
    if (container) {
      container.innerHTML = getSvgContent(selectMode);
      container.title = updateTitle(selectMode);
    }
  }
}, [selectMode]);

const getSvgContent = (selectMode) => {
  return selectMode
    ? '<svg width="24" height="24" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!-- Font Awesome Pro 5.15.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) --><path d="M360.543 188.156c-17.46-28.491-54.291-37.063-82.138-19.693-15.965-20.831-42.672-28.278-66.119-20.385V60.25c0-33.222-26.788-60.25-59.714-60.25S92.857 27.028 92.857 60.25v181.902c-20.338-13.673-47.578-13.89-68.389 1.472-26.556 19.605-32.368 57.08-13.132 83.926l114.271 159.5C136.803 502.673 154.893 512 174 512h185.714c27.714 0 51.832-19.294 58.145-46.528l28.571-123.25a60.769 60.769 0 0 0 1.57-13.723v-87c0-45.365-48.011-74.312-87.457-53.343zM82.097 275.588l28.258 39.439a7.999 7.999 0 1 0 14.503-4.659V60.25c0-37.35 55.428-37.41 55.428 0V241.5a8 8 0 0 0 8 8h7.144a8 8 0 0 0 8-8v-36.25c0-37.35 55.429-37.41 55.429 0v36.25a8 8 0 0 0 8 8H274a8 8 0 0 0 8-8v-21.75c0-37.351 55.429-37.408 55.429 0v21.75a8 8 0 0 0 8 8h7.143a8 8 0 0 0 8-8c0-37.35 55.429-37.41 55.429 0v87c0 2.186-.25 4.371-.742 6.496l-28.573 123.251C383.717 471.055 372.626 480 359.715 480H174c-8.813 0-17.181-4.332-22.381-11.588l-114.283-159.5c-22.213-31.004 23.801-62.575 44.761-33.324zM180.285 401v-87a8 8 0 0 1 8-8h7.144a8 8 0 0 1 8 8v87a8 8 0 0 1-8 8h-7.144a8 8 0 0 1-8-8zm78.572 0v-87a8 8 0 0 1 8-8H274a8 8 0 0 1 8 8v87a8 8 0 0 1-8 8h-7.143a8 8 0 0 1-8-8zm78.572 0v-87a8 8 0 0 1 8-8h7.143a8 8 0 0 1 8 8v87a8 8 0 0 1-8 8h-7.143a8 8 0 0 1-8-8z"/></svg>' 
    : '<svg width="24" height="24" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!-- Font Awesome Pro 5.15.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) --><path d="M464 64H48C21.5 64 0 85.5 0 112v288c0 26.5 21.5 48 48 48h416c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48zm16 336c0 8.8-7.2 16-16 16H48c-8.8 0-16-7.2-16-16V112c0-8.8 7.2-16 16-16h416c8.8 0 16 7.2 16 16v288z"/></svg>';
};

// Функция для обновления хинта
const updateTitle = ( selectMode ) => {
  return selectMode
    ? "Перейти в режим навигации" 
    : "Перейти в режим выделения"; 
}

function createSelectionModeControl(map, onToggleSelectMode) {
  const SelectionModeControl = L.Control.extend({
    onAdd: function(map) {
      const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
      container.style.backgroundColor = 'white';
      container.style.width = '30px';
      container.style.height = '30px';
      container.style.display = 'flex';
      container.style.alignItems = 'center'; // Центрирование по вертикали
      container.style.justifyContent = 'center'; // Центрирование по горизонтали
      container.title = updateTitle(selectMode);
      container.innerHTML = getSvgContent(selectMode); // Инициализация с текущим состоянием selectMode
      // Стили для эффекта затемнения при наведении
      container.onmouseover = function() {
        this.style.backgroundColor = 'rgba(244,244,244)'; // Затемнение
      };
      container.onmouseout = function() {
        this.style.backgroundColor = 'white'; // Возвращение к исходному состоянию
      };
      container.onclick = function() {
        setSelectMode(prevSelectMode => !prevSelectMode);
      };
      return container;
    },
    onRemove: function(map) {
      // Удаление обработчиков событий и дополнительной очистки
    }
  });

  // Создание и добавление нового контрола
  const selectionModeControl = new SelectionModeControl({ position: 'topleft' });
  selectionModeControl.addTo(map);
  // Сохранение ссылки на контрол в свойство карты
  map.selectionModeControl = selectionModeControl;
}

useEffect(() => {
  if (!measurementsLayerRef.current || !colorThresholds) {
    return;
  }

  measurementsLayerRef.current.clearLayers(); // Очищаем текущие слои

  // Пересоздаем маркеры с новым стилем
  validMeasurements.forEach(measurement => {
    if (measurement.lat <= 0 || measurement.lon <= 0) {
      return; // Пропускаем маркеры с "плохими" координатами
    }
    const color = getColorT(measurement.dose, colorThresholds, minDoseValue, maxDoseValue);
    const isSelected = selectedPoints.some(p => p.id === measurement.id);
    const markerStyle = {
      color: isSelected ? 'purple' : color, // Фиолетовая обводка для выбранного маркера
      fillColor: color,
      fillOpacity: 1,
      radius: isSelected ? 7 : 5, // Больший радиус для выбранного маркера
    }; 


    L.circleMarker([measurement.lat, measurement.lon], markerStyle)
    .addTo(measurementsLayerRef.current)
    .on('click', (event) => handlePointClick(event, measurement));
  });

}, [validMeasurements, colorThresholds, selectedPoints, minDoseValue, maxDoseValue]);


const [windowSize, setWindowSize] = useState({
  width: window.innerWidth,
  height: window.innerHeight,
});

useEffect(() => {
  const handleResize = () => {
    setWindowSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  };

  window.addEventListener('resize', handleResize);

  return () => {
    window.removeEventListener('resize', handleResize);
  };
}, []);

useEffect(() => {
  if (mapInstance) {
    mapInstance.invalidateSize();
  }
}, [windowSize, mapInstance]);

  return (
    <div>
    <MapContainer
      whenCreated={(mapInstance) => {
        mapRef.current = mapInstance;
      }}
      id="map" 
      center={[globalSettings.latInit, globalSettings.lonInit]}
      zoom={18} 
      style={{ width: '100%', height: 'calc(100vh - 64px)' }}> {/* Убедитесь, что высота вычисляется правильно */}

    <MapEffect setMapInstance={setMapInstance} />

    <LayersControl position="topright">
      <LayersControl.Overlay name="Marker with popup">
        <LayersControl.BaseLayer name="OpenStreetMap">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer checked name="Google Карта">
          <TileLayer
            url={googleMapsUrl}
            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
            maxZoom={21}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Google Спутник">
          <TileLayer
            url={googleSatelliteUrl}
            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
            maxZoom={21}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name='Esri World Imagery'>
                    <TileLayer
                        url='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                        maxZoom={18}
                    />
        </LayersControl.BaseLayer>        
      </LayersControl.Overlay>

      <LayersControl.Overlay checked name="Измерения">
        <FeatureGroup ref={measurementsLayerRef}>
        {
        validMeasurements
          .filter(measurement => measurement.lat > 0 && measurement.lon > 0) // Фильтруем "плохие" координаты
          .map((measurement) => {
              if (minDoseValue === null || maxDoseValue === null) return null;
              const color = getColorT(measurement.dose, colorThresholds, minDoseValue, maxDoseValue);
              const isSelected = selectedPoints.some(p => p.id === measurement.id);
              const markerStyle = {
                color: isSelected ? 'purple' : color, // Фиолетовая обводка для выбранного маркера
                fillColor: color,
                fillOpacity: 1,
                radius: isSelected ? 7 : 5, // Больший радиус для выбранного маркера
            };

              const markerKey = `${measurement.id}-${isSelected}`;
              return (
                  <CircleMarker
                      key={markerKey}
                      center={[measurement.lat, measurement.lon]}
                      {...markerStyle}
                      eventHandlers={{
                        click: (event) => handlePointClick(event, measurement),
                      }}
                  >
                  </CircleMarker>
              );
          })}
        </FeatureGroup>        
      </LayersControl.Overlay>

{/*    
      <LayersControl.Overlay name="Тепловая карта">
        <HeatmapLayer
          points={heatPoints}
          longitudeExtractor={m => m[1]}
          latitudeExtractor={m => m[0]}
          intensityExtractor={m => parseFloat(m[2])}
          radius={25}
          blur={20}
          useLocalExtrema={false}
        />
      </LayersControl.Overlay>*/}

      <LayersControl.Overlay name="Изолинии">
        <FeatureGroup
          eventHandlers={{
          add: (e) =>  {
            setIsIsolineLayerActive(true)
          }, 
          remove: () => setIsIsolineLayerActive(false)
        }}>
        </FeatureGroup>
      </LayersControl.Overlay>

      <LayersControl.Overlay name="Изобанды (послойная окраска)">
        <FeatureGroup
          zIndex={40}
          eventHandlers={{
          add: (e) =>  {
            setIsIsobandLayerActive(true)
          }, 
          remove: () => setIsIsobandLayerActive(false)
        }}>
        </FeatureGroup>
      </LayersControl.Overlay>        

    </LayersControl>

    <RectangularSelection 
        active={selectMode} 
        onSelectionComplete={handleSelectionComplete}
    />
  </MapContainer>

  </div>    
  );
}

export default MyMapComponent;
