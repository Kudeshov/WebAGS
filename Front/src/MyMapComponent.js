  import React, { useEffect, useState, useRef, useContext } from 'react';
  import { MapContainer, TileLayer, CircleMarker, LayersControl, useMap, GeoJSON } from 'react-leaflet';
  import * as turf from '@turf/turf';  
  import 'leaflet/dist/leaflet.css';
  import L from 'leaflet';
  import './MyMapComponent.css';
  import { FeatureGroup } from 'react-leaflet';
  import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
  import { HeatmapLayer } from 'react-leaflet-heatmap-layer-v3';
  import { getColor } from './colorUtils';
  import RectangularSelection from './RectangularSelection';
  import { ReactComponent as RectangleIcon } from './icons/rectangle-landscape.svg';
  //import ReactDOM from 'react-dom';
  import { FlightDataContext } from './FlightDataContext';
  import { createRoot } from 'react-dom/client';

  delete L.Icon.Default.prototype._getIconUrl;

  L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
  });

  const initialCenter = {
    lat: 55.704034038232834,
    lng: 37.62119540524117
  };

  function SpectrumChartWithLabel({ data, isLoading }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', width: '293px', height: '200px' }}>
        <div style={{
          transform: 'rotate(-90deg)',
          transformOrigin: 'left top',
          width: '60px',
          height: '50px',
          textAlign: 'center',
          fontSize: '12px',
          marginLeft: '-10px', // Отрицательный отступ для компенсации ширины после вращения
          marginBottom: '-140px',
          marginRight: '-85px', // Дополнительный отступ от графика
          whiteSpace: 'nowrap'
        }}>
          Скорость счета 1/с
        </div>
        <div style={{ width: '100%', height: '100%' }}>
          {/* isLoading ? 'Загрузка...' :  */<SpectrumChart data={data} />}
        </div>
      </div>
    );
  }

  const formatXAxis = (tickItem) => {
    // Задайте интервал, до которого вы хотите округлить (например, 400)
    const interval = 400;
    // Округляем до ближайшего интервала
    return Math.round(tickItem / interval) * interval;
  }

  function SpectrumChart({ data }) {
    return (
      <LineChart width={330} height={200} data={data}>
        <Line 
          type="monotone" 
          dataKey="value" 
          stroke="#0000FF" // Синий цвет линии
          dot={false} // Отключить отображение точек
          isAnimationActive={false}
        />
        <CartesianGrid stroke="#ccc" />
        <XAxis 
          tickFormatter={formatXAxis}
          dataKey="energy" // Использование 'energy' в качестве ключа
          label={{ value: "Энергия (keV)", position: "bottom", offset: -6, style: { fontSize: 12 } }}  
        />
        <YAxis />
        <Tooltip />
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
    const [selectMode, setSelectMode] = useState(false);

    // Функция для переключения режима выделения
    const toggleSelectMode = () => {
      setSelectMode(!selectMode);
    };

    const { selectedCollection } = useContext(FlightDataContext);
    const { selectedFlight } = useContext(FlightDataContext);

    const googleMapsUrl = 'http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=ru';
    const googleSatelliteUrl = 'http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&hl=ru';

    const { measurements } = useContext(FlightDataContext);
    const { validMeasurements } = useContext(FlightDataContext);
      
    const { geoCenter } = useContext(FlightDataContext);

    const { minDoseValue, maxDoseValue } = useContext(FlightDataContext);

    const [spectrumData, setSpectrumData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
/*     const [selectedMeasurement, setSelectedMeasurement] = useState(null); */
    const panelRef = useRef(null); // Ссылка на DOM-элемент панели
    const spectrumPanelRef = useRef(null); 
    const [isCtrlPressed, setIsCtrlPressed] = useState(false);

    const { heightFrom } = useContext(FlightDataContext);
    const { heightTo } = useContext(FlightDataContext);

    const [averageMeasurement, setAverageMeasurement] = useState(null);
    const [averageDiapasone, setAverageDiapasone] = useState(null);

    const [isIsolineLayerActive, setIsIsolineLayerActive] = useState(false);
    const [cachedIsolines, setCachedIsolines] = useState(null);
    const isolineLayerRef = useRef(null);

    useEffect(() => {
      console.log('изолинии: isIsolineLayerActive && cachedIsolines && mapInstance ', 
        isIsolineLayerActive, 
        cachedIsolines,
        mapInstance);

      if (isIsolineLayerActive && cachedIsolines && mapInstance) {
        // Удалить предыдущий слой изолиний, если он существует
        if (isolineLayerRef.current) {
          isolineLayerRef.current.remove();
        }

        // Создать новый слой изолиний из кешированных данных
        isolineLayerRef.current = L.geoJSON(cachedIsolines).addTo(mapInstance);
      } else {
        // Удалить слой изолиний при деактивации
        if (isolineLayerRef.current) {
          isolineLayerRef.current.remove();
          isolineLayerRef.current = null;
        }
      }
    }, [isIsolineLayerActive, cachedIsolines, mapInstance]);

    useEffect(() => {
      const handleKeyDown = (e) => {
        if (e.ctrlKey) {
          setIsCtrlPressed(true);
        }
      };
    
      const handleKeyUp = (e) => {
        if (e.key === "Control") {
          setIsCtrlPressed(false);
        }
      };
    
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
    
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      };
    }, []);  

    const [selectedPoints, setSelectedPoints] = useState([]);

    
    const handlePointClick = (measurement) => {
      if (isCtrlPressed) {
        // Добавляем точку в массив, если Ctrl нажат
        setSelectedPoints(prevPoints => [...prevPoints, measurement]);
      } else {
        // Заменяем массив одной точкой, если Ctrl не нажат
        setSelectedPoints([measurement]);
      }
    };


    useEffect(() => {
      // This assumes there's an array of selected points
      console.log('Calc average, selectedPoints', selectedPoints);
      if (selectedPoints.length > 0) {

        console.log('Calc average, selectedPoints.length > 0', selectedPoints);
        // Calculate sums and ranges
        let sumDose = 0, sumDoseW = 0, sumGeiger1 = 0, sumGeiger2 = 0, sumGMDose1 = 0, sumGMDose2 = 0;
        let minTime = new Date('9999-12-31T23:59:59Z'), maxTime = new Date('1000-01-01T00:00:00Z');
        let minLat = Infinity, maxLat = -Infinity;
        let minLong = Infinity, maxLong = -Infinity;
    
        // Iterate over selectedPoints to accumulate values and find min/max
        selectedPoints.forEach(point => {
          sumDose += parseFloat(point.dose);
          sumDoseW += point.dosew;
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
        const avgCountW = sumDoseW / selectedPoints.length;
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
          dosew: avgCountW,
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
    
        // Now use averageMeasurement to update the panel content
        // You would replace selectedMeasurement with averageMeasurement here
      }
    }, [selectedPoints]); // This useEffect should depend on selectedPoints array


    const calculateAverageSpectrum = (selectedPoints) => {
      if (selectedPoints.length === 0) {
        return [];
      }
    
      const { P0, P1 } = selectedCollection; // Получение параметров P0 и P1
      // Инициализация массива для суммы спектра
      const sumSpectrum = Array(selectedPoints[0].spectrum.channels.length).fill(0);
    
      // Суммирование спектров всех выбранных точек
      selectedPoints.forEach(point => {
        point.spectrum.channels.forEach((value, index) => {
          sumSpectrum[index] += value;
        });
      });
    
      // Вычисление среднего значения спектра
      const avgSpectrumGood = sumSpectrum.map(value => value / selectedPoints.length);
      
      const avgSpectrum = sumSpectrum.map((value, index) => ({
        energy: P0 + P1 * index, // Преобразование номера канала в энергию
        value: value / selectedPoints.length
      }));

      console.log(avgSpectrumGood, avgSpectrum);

      return avgSpectrum;
    };
    
    useEffect(() => {
      // Вызывается каждый раз при изменении selectedPoints
      const avgSpectrumData = calculateAverageSpectrum(selectedPoints);
    
      setSpectrumData(avgSpectrumData); // Прямое присвоение обработанных данных
    
      // Обновление панели графика
      if (spectrumPanelRef.current && spectrumPanelRef.current._root) {
        spectrumPanelRef.current._root.render(
          <SpectrumChartWithLabel data={avgSpectrumData} isLoading={false} />
        );
      }
    }, [selectedPoints]);
    

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

      console.log('validMeasurements ', validMeasurements);

      if (!measurements.length) return;
      if (!validMeasurements.length) return;

      mapInstance?.setView([geoCenter.lat, geoCenter.lng], mapInstance.getZoom());

    }, [measurements, mapInstance, validMeasurements, geoCenter]);


    useEffect(() => {

      console.log('validMeasurements has changed');


    }, [ validMeasurements ]);
    
  

    useEffect(() => {
      if (selectMode) {
        document.body.classList.add('selection-mode-active');
      } else {
        document.body.classList.remove('selection-mode-active');
      }
    }, [selectMode]);

    const heatPoints = measurements.map(measurement => {
      const intensity = (measurement.dose - minDoseValue) / (maxDoseValue - minDoseValue);
      return [measurement.lat, measurement.lon, intensity];
    });

    const handleSelectionComplete = (bounds) => {
      console.log('Selected Bounds:', bounds);
    
      // Разбиваем bounds на отдельные переменные для удобства
      const { _southWest, _northEast } = bounds;
    
      // Фильтруем измерения, чтобы найти те, которые находятся внутри прямоугольника
      const selected = measurements.filter((measurement) => {
        return (
          measurement.lat >= _southWest.lat &&
          measurement.lat <= _northEast.lat &&
          measurement.lon >= _southWest.lng &&
          measurement.lon <= _northEast.lng
        );
      });
    
      // Обновляем состояние selectedPoints
      setSelectedPoints(selected);
    };

    const mapRef = useRef(null);

    useEffect(() => {
      const mapElement = document.getElementById('map');
      if (selectMode) {
        mapElement.style.cursor = 'crosshair';
      } else {
        mapElement.style.cursor = ''; // Resets to default cursor
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

    useEffect(() => {
      console.log('chartOpen ',chartOpen);
      if (chartOpen) {
        showSpectrumPanel()
      } else {
        hideSpectrumPanel()
      }
    }, [chartOpen]);

    
    function createSimpleControl(map, panelRef) {
      var control = L.control({ position: 'bottomright' });
    
      control.onAdd = function() {
        if (!panelRef.current) {
          panelRef.current = L.DomUtil.create('div', 'simple-panel');
          panelRef.current.innerHTML = '<strong>Выберите точку на карте</strong>';
        }
        return panelRef.current;
      };
    
      control.addTo(map);
    }

    function createSpectrumControl(map) {
      const spectrumControl = L.control({ position: 'bottomright' });
    
      spectrumControl.onAdd = function () {
        spectrumPanelRef.current = L.DomUtil.create('div', 'spectrum-panel');
        // Создаем корень для рендеринга компонента
        const root = createRoot(spectrumPanelRef.current);
        spectrumPanelRef.current._root = root; // Сохраняем корень в свойстве для последующего доступа
        root.render(<SpectrumChartWithLabel data={spectrumData} isLoading={isLoading} />);
        return spectrumPanelRef.current;
      };
    
      spectrumControl.addTo(map);
        // Изначально скрываем панель
    if (spectrumPanelRef.current && !chartOpen) {
      spectrumPanelRef.current.style.display = 'none';
  }
    }

    useEffect(() => {
      if (mapInstance) {
        createSpectrumControl(mapInstance);
        createSimpleControl(mapInstance, panelRef);
      }
    }, [mapInstance]);

    function convertDateTime(dateTimeString) {

      if (!dateTimeString)
        return;
      const date = new Date(dateTimeString);
    
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Месяцы начинаются с 0
      const year = date.getFullYear();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const seconds = date.getSeconds().toString().padStart(2, '0');
    
      return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
    }

    useEffect(() => {
      // Обновляем содержимое панели при изменении selectedMeasurement
      if (panelRef.current && averageMeasurement && averageDiapasone) {
        if (selectedPoints.length>1) {
        panelRef.current.innerHTML = `
          Количество измерений: ${selectedPoints.length}<br>
          Дата: ${convertDateTime(averageDiapasone.timeRange[0])} -  ${convertDateTime(averageDiapasone.timeRange[1])}<br>
          Время измерения: ${(averageDiapasone.timeRange[1].getTime() - averageDiapasone.timeRange[0].getTime()) / 1000} сек<br>
          Счёт в окне: ${averageDiapasone.countwRange[0]} - ${averageDiapasone.countwRange[1]} имп/с<br>
          Высота баром.: ${averageDiapasone.heightRange[0].toFixed(2)} - ${averageDiapasone.heightRange[1].toFixed(2)} м<br>
          Долгота: ${averageDiapasone.longRange[0].toFixed(6)} - ${averageDiapasone.longRange[1].toFixed(6)}<br>
          Широта: ${averageDiapasone.latRange[0].toFixed(6)} - ${averageDiapasone.latRange[1].toFixed(6)}<br>
          Высота GPS.: ${averageDiapasone.altRange[0].toFixed(2)} - ${averageDiapasone.altRange[1].toFixed(2)} м<br>
          Мощность дозы (полином): ${parseFloat(averageMeasurement.dose).toFixed(3)} мкЗв/час<br>
          Мощность дозы (по окну): ${parseFloat(averageMeasurement.dosew).toFixed(3)} мкЗв/час<br>
          
          Счётчик ГМ1: ${averageMeasurement.geiger1.toFixed(6)} имп/с<br>
          Счётчик ГМ2: ${averageMeasurement.geiger2.toFixed(6)} имп/с<br>
          Мощность дозы ГМ: ${averageMeasurement.gmdose1.toFixed(6)} мкЗв/час`
        ;
        }
        else
        {
          panelRef.current.innerHTML = `
          Дата: ${convertDateTime(averageDiapasone.timeRange[0])}<br>
          Время измерения: 1 сек<br>
          Счёт в окне: ${averageDiapasone.countwRange[0]} имп/с<br>
          Высота баром.: ${averageDiapasone.heightRange[0].toFixed(2)} м<br>
          Долгота: ${averageDiapasone.longRange[0].toFixed(6)}<br>
          Широта: ${averageDiapasone.latRange[0].toFixed(6)} <br>
          Высота GPS.: ${averageDiapasone.altRange[0].toFixed(2)} м<br>
          Мощность дозы (полином): ${parseFloat(averageMeasurement.dose).toFixed(3)} мкЗв/час<br>
          Мощность дозы (по окну): ${parseFloat(averageMeasurement.dosew).toFixed(3)} мкЗв/час<br>
          
          Счётчик ГМ1: ${averageMeasurement.geiger1} имп/с<br>
          Счётчик ГМ2: ${averageMeasurement.geiger2} имп/с<br>
          Мощность дозы ГМ1: ${averageMeasurement.gmdose1} мкЗв/час`        
        }
      }
    }, [averageMeasurement]);

    function createGradient(doseLow, doseHigh) {
      const steps = 10; // Количество шагов в градиенте
      let gradient = '';
    
      for (let i = 0; i <= steps; i++) {
        const value = doseLow + (doseHigh - doseLow) * (i / steps);
        const color = getColor(value, doseLow, doseHigh);
        gradient += `${color} ${i * 10}%,`;
      }
    
      return gradient.slice(0, -1); // Удаляем последнюю запятую
    }

    const legendControlRef = useRef(null);


    const updateLegend = (minValue, maxValue) => {
      if (legendControlRef.current) {
        const div = legendControlRef.current.getContainer();
        const gradientStyle = `background: linear-gradient(to right, ${createGradient(minValue, maxValue)});`;
    
        div.style.display = 'flex'; // Устанавливаем div как флекс контейнер
        div.style.flexDirection = 'column'; // Элементы будут расположены в колонку (один за другим)
        div.style.alignItems = 'center'; // Выравниваем элементы по центру по горизонтали
        div.style.marginLeft = '10';
        
        

        div.innerHTML = `
          <div style="width: 120px; height: 15px; ${gradientStyle}"></div>
          <div style="width: 120px; display: flex; justify-content: space-between; margin-top: 3px;">
            <span>${minValue.toFixed(3)}</span>
            <span>${maxValue.toFixed(3)}</span>
          </div>
        `;
      }
    };

    const [previousValidMeasurements, setPreviousValidMeasurements] = useState();

    useEffect(() => {

      if (previousValidMeasurements === validMeasurements) {
        // Выполните действия, когда validMeasurements изменились
        console.log('validMeasurements не изменились');
        return;
      }

      setPreviousValidMeasurements(validMeasurements);

      if (!validMeasurements || validMeasurements.length === 0) {
        console.log("Нет данных для измерений");
        return;
      }
  
      const minDose = Math.min(...validMeasurements.map(m => m.dose));
      const maxDose = Math.max(...validMeasurements.map(m => m.dose));
  
      // Нормализация данных
      console.log("Нормализация данных minDose maxDose", minDose, maxDose);
      const normalizedPoints = validMeasurements.map(m => ({
        ...m,
        normalizedDose: ((m.dose - minDose) / (maxDose - minDose)) * 10
      }));

      console.log("Нормализация данных normalizedPoints.length", normalizedPoints.length );
  
      const pointsCollection = turf.featureCollection(
        normalizedPoints.map(m => turf.point([m.lon, m.lat], { dose: m.normalizedDose }))
      );

      console.log("Нормализация данных pointsCollection.length", pointsCollection );

  
      //const bbox = turf.bbox(pointsCollection);
      const cellSize = 0.004; // Размер ячейки
  
      const interpolated = turf.interpolate(pointsCollection, cellSize, { gridType: 'point', property: 'dose' });
      // Уровни изолиний
      const breaks = [0, 0.5, 1, 1.25, 1.5, 2, 2.25, 3, 4, 5, 6, 7, 8, 9, 10];

      var lines = turf.isolines(interpolated, breaks, {zProperty: 'dose'});

      console.log("setCachedIsolines ", lines); 

      setCachedIsolines(lines);

/*       const isolineLayer = L.geoJSON(lines).addTo(map);

      return () => isolineLayer.remove(); */
      
    }, [validMeasurements, previousValidMeasurements ]); 

    /* 
    function IsolineLayer({ validMeasurements }) {
      const map = useMap();
      useEffect(() => {

        if (previousValidMeasurements === validMeasurements) {
          // Выполните действия, когда validMeasurements изменились
          console.log('validMeasurements не изменились');
          return;
        }

        // setPreviousValidMeasurements(validMeasurements);

        if (!validMeasurements || validMeasurements.length === 0) {
          console.log("Нет данных для измерений");
          return;
        }
    
        const minDose = Math.min(...validMeasurements.map(m => m.dose));
        const maxDose = Math.max(...validMeasurements.map(m => m.dose));
    
        // Нормализация данных
        console.log("Нормализация данных minDose maxDose", minDose, maxDose);
        const normalizedPoints = validMeasurements.map(m => ({
          ...m,
          normalizedDose: ((m.dose - minDose) / (maxDose - minDose)) * 10
        }));

        console.log("Нормализация данных normalizedPoints.length", normalizedPoints.length );
    
        const pointsCollection = turf.featureCollection(
          normalizedPoints.map(m => turf.point([m.lon, m.lat], { dose: m.normalizedDose }))
        );

        console.log("Нормализация данных pointsCollection.length", pointsCollection );
  
    
        //const bbox = turf.bbox(pointsCollection);
        const cellSize = 0.004; // Размер ячейки
    
        const interpolated = turf.interpolate(pointsCollection, cellSize, { gridType: 'point', property: 'dose' });
        // Уровни изолиний
        const breaks = [0, 0.5, 1, 1.25, 1.5, 2, 2.25, 3, 4, 5, 6, 7, 8, 9, 10];

        var lines = turf.isolines(interpolated, breaks, {zProperty: 'dose'});

        console.log("test lines", lines); 

        setCachedIsolines(lines);

        const isolineLayer = L.geoJSON(lines).addTo(map);

        return () => isolineLayer.remove();
        
      }, [validMeasurements ]); 
      
      return null;
    }
     */

    useEffect(() => {
    if (mapInstance && minDoseValue != null && maxDoseValue != null) {
      if (!legendControlRef.current) {
        const legendControl = L.control({ position: 'bottomleft' });
    
        legendControl.onAdd = function (map) {
          const div = L.DomUtil.create('div', 'info legend');
          legendControlRef.current = legendControl;
          return div;
        };
    
        legendControl.addTo(mapInstance);
      }

      // Обновляем легенду
      updateLegend(minDoseValue, maxDoseValue);
    }
  }, [mapInstance, minDoseValue, maxDoseValue]);

    return (
      <div>
      <MapContainer 
        whenCreated={(mapInstance) => {
          console.log('Map created. Instance:', mapInstance);
          mapRef.current = mapInstance;
        }}
        id="map" 
        center={initialCenter} 
        zoom={18} 
        style={{ width: '100%', height:  window.innerHeight - 64   }}>
      <MapEffect setMapInstance={setMapInstance} />
  {/*     <ChangeMapView coords={mapCenter} /> */}

      <LayersControl position="topright">
        <LayersControl.Overlay name="Marker with popup">
          <LayersControl.BaseLayer checked name="OpenStreetMap">
            <TileLayer
              //attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={21}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Google Карта">
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
                          maxZoom={21}
                      />
          </LayersControl.BaseLayer>        
        </LayersControl.Overlay>

        <LayersControl.Overlay checked name="Измерения">
          <FeatureGroup>
          {validMeasurements

            .filter(measurement => 
              !heightFilterActive || // Apply filter only if heightFilterActive is true
              (measurement.height >= heightFrom && measurement.height <= heightTo)
            )
            .map((measurement) => {
                if (minDoseValue === null || maxDoseValue === null) return null;
                const color = getColor(measurement.dose, minDoseValue, maxDoseValue);
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
                          click: () => handlePointClick(measurement),
                        }}
                    >
                    </CircleMarker>
                );
            })}
          </FeatureGroup>        
        </LayersControl.Overlay>

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
        </LayersControl.Overlay>

{/*         <LayersControl.Overlay 
          name="Изолинии" 
          checked={isIsolineLayerActive}
          onActive={() => setIsIsolineLayerActive(true)}
          onInactive={() => setIsIsolineLayerActive(false)}
        >
          <FeatureGroup>
            <IsolineLayer validMeasurements={validMeasurements} />
          </FeatureGroup>
        </LayersControl.Overlay>  */}      

{/*             <LayersControl.Overlay 
              name="Изолинии" 
              checked={isIsolineLayerActive}
              onActive={() => setIsIsolineLayerActive(true)}
              onInactive={() => setIsIsolineLayerActive(false)}
            > */}

            <LayersControl.Overlay
              name="Изолинии"
/*               eventHandlers={{
                add: (e) =>  {
                  console.log("Added Layer Изолинии:", e);
                  setIsIsolineLayerActive(true)
                }, 
                remove: () => setIsIsolineLayerActive(false)
              }} */
            >
              <FeatureGroup
                eventHandlers={{
                add: (e) =>  {
                  console.log("Added Layer Изолинии:", e);
                  setIsIsolineLayerActive(true)
                }, 
                remove: () => setIsIsolineLayerActive(false)
              }}>
                 
              </FeatureGroup>
            </LayersControl.Overlay>


      </LayersControl>

      <RectangularSelection 
          active={selectMode} 
          onSelectionComplete={handleSelectionComplete}
      />

      <div style={{ position: 'absolute', top: '66px', right: '10px', zIndex: 600 }}>
        <button 
          className={`selection-toggle-button ${selectMode ? 'active' : ''}`} 
          onClick={toggleSelectMode}
          title="Выделить"
        >
          <RectangleIcon style={{ fill: selectMode ? 'blue' : 'gray', width: 27, height: 27 }} />
        </button>
      </div>
    </MapContainer>

    </div>    
    );
  }

  export default MyMapComponent;
