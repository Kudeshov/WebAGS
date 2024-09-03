import React, { createContext, useState, useEffect, useCallback } from 'react';
import { calculateColorThresholds } from './colorUtils';
import { ExportToCsv } from 'export-to-csv-fix-source-map';
import { convertDateTime } from './dateUtils';

export const FlightDataContext = createContext();

export const FlightDataProvider = ({ children, heightFilterActive, onHeightFilterActive, childrenolorOverrideActive, onColorOverrideActive }) => {
  const [selectedDatabase, setSelectedDatabase] = useState(null);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [onlineMeasurements, setOnlineMeasurements] = useState([]);
  const [databaseName, setDatabaseName] = useState('');
  const [currentSensorType, setCurrentSensorType] = useState("УДКГ-А01");
  const [validMeasurements, setValidMeasurements] = useState([]);
  const [selectedPoints, setSelectedPoints] = useState([]);
  const [selectionSource, setSelectionSource] = useState('table'); // 'map' или 'table'

  const [minDoseValue, setMinDoseValue] = useState(0);
  const [maxDoseValue, setMaxDoseValue] = useState(3);

  const [geoCenter, setGeoCenter] = useState({
    lat: 55.704034038232834,
    lng: 37.62119540524117
  });
  // Глобальные состояния для хранения значений высот полета
  const [heightFrom, setHeightFrom] = useState(0);
  const [heightTo, setHeightTo] = useState(1000);

  const [heightFilterFrom, setHeightFilterFrom] = useState(0);
  const [heightFilterTo, setHeightFilterTo] = useState(1000);

  const [localHeightFrom, setLocalHeightFrom] = useState(0);
  const [localHeightTo, setLocalHeightTo] = useState(1000);

  const [saveMapAsImage, setSaveMapAsImage] = useState(() => {});

  const [minDoseValueR, setMinDoseValueR] = useState(0); //округленные до 2 знаков значения доз для отображения в слайдере
  const [maxDoseValueR, setMaxDoseValueR] = useState(0);
 
  const [onlineFlightId, setOnlineFlightId] = useState(null); // Состояние для хранения ID онлайн полета

  const [sourceCoordinates, setSourceCoordinates] = useState(null); // Состояние для хранения найденных координат источника
  const [sourceActivity, setSourceActivity] = useState(0); // Состояние для активности
  const [sourceDeviation, setSourceDeviation] = useState(0); // Состояние для погрешности

  const [mapBounds, setMapBounds] = useState(null); // Состояние для хранения выделенной области

  const [globalSettings, setGlobalSettings] = useState({
    latInit: 55.704034038232834,
    lonInit: 37.62119540524117
  }); // Инициализация состояния для хранения глобальных настроек

  // Локальные состояния для выпадающего списка зон интереса
  const [doseType, setDoseType] = useState(1); // Выбранное значение по умолчанию

  useEffect(() => {
    const fetchSettings = () => {
      fetch('/api/settings')
        .then(response => response.json())
        .then(data => {
          setGlobalSettings(data); // Сохранение полученных настроек в состояние
          //console.log('Настройки загружены:', data, data.latInit);

          setGeoCenter({ lat: data.latInit, lng: data.lonInit });
        })
        .catch(error => console.error('Ошибка при получении настроек:', error));
    };

    fetchSettings();
  }, []); // Пустой массив зависимостей означает, что эффект выполнится один раз при монтировании компонента

  const [colorThresholds, setColorThresholds ] = useState({
    v0: 0,
    v1: 1,
    v2: 2,
    v3: 3,
  });

  const date = new Date();
  const formatDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  const formatTime = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;  
  
  const saveDataToFile = useCallback(() => {
  const optionsCSV = {
    filename: `${databaseName}_${formatDate}_${formatTime}`,
    fieldSeparator: ';',
    quoteStrings: '"',
    decimalSeparator: '.',
    showLabels: true, 
    useTextFile: false,
    useBom: true,
/*     useKeysAsHeaders: true, */
    headers: ['Дата и время', 'Широта', 'Долгота', 'Высота GPS', 'Барометрическая высота', 'Мощность дозы по окну', 'Доза']
  };

  
    const formattedData = validMeasurements.map(item => ({
      datetime: convertDateTime(item.datetime),
      lat: item.lat,
      lon: item.lon,
      alt: item.alt, // Высота GPS
      height: item.height, // Барометрическая высота
      //dosew: item.dosew, // Мощность дозы по окну
      dose: item.dose
    })); 

    const csvExporter = new ExportToCsv(optionsCSV);
    csvExporter.generateCsv(formattedData);
  }, [validMeasurements]);

  const [isLoadingFlight, setIsLoadingFlight] = useState(false);

  const fetchCollections = useCallback(() => {
    //console.log('вызвана fetchCollections, onlineFlightID', onlineFlightId);
    if (!onlineFlightId && selectedDatabase) {
      fetch(`/api/collection/${selectedDatabase}`)
        .then(response => response.json())
        .then(collections => {
          // Автоматически выбираем первую коллекцию из списка
          if (collections && collections.length > 0) {
            setSelectedCollection(collections[0]);
          } else {
            setSelectedCollection(null);
          }
        })
        .catch(error => console.error('Ошибка при загрузке списка коллекций:', error));
    }
  }, [selectedDatabase/* , onlineFlightId */]);

  useEffect(() => {
    //console.log('вызвана fetchCollections из useEffect')
    fetchCollections();
  }, [fetchCollections]);

  const fetchMeasurements = useCallback(() => {
    if (selectedDatabase && selectedCollection && !onlineFlightId) {
      setIsLoadingFlight(true); // Начинаем загрузку
      setSourceCoordinates(null);
      setMapBounds(null);
      setSourceActivity(0);
      setSourceDeviation(0);
      const apiUrl = `/api/data/${selectedDatabase}/${selectedCollection?._id || null}`;
      fetch(apiUrl)
        .then(response => response.json())
        .then(data => {

          //console.log(data.length);
          //onHeightFilterActive(true);

          //onColorOverrideActive(true);
          let validData = data; //.filter(/*m => m.lat >= 0 && m.lon >= 0 && m.dose >= 0*  && m.countw<1000000 */);

          updateValidMeasurements(validData, true, true, true);
          //setValidMeasurements(validData);
          updateMeasurements(validData);
          //setMeasurements(data);
        }).finally(() => {
          setIsLoadingFlight(false); // Заканчиваем загрузку
        });
    }
  }, [selectedDatabase, selectedCollection]);
  
  useEffect(() => {
    fetchMeasurements();
  }, [fetchMeasurements]);

  useEffect(() => {
    // Функция для запроса статуса онлайн-полета и загрузки данных измерений
    const fetchOnlineFlightData = async () => {
      try {
        // Запрашиваем статус онлайн-полета
        const statusResponse = await fetch('/api/online-flight-status');
        const statusData = await statusResponse.json();
        if (statusData && statusData.active) {
          //console.log('statusData', statusData);
          
          setOnlineFlightId(statusData._id); // Сохраняем ID активного онлайн-полета
          //console.log('1',statusData.dbName);
          setSelectedDatabase(statusData.dbName); // Устанавливаем активную базу данных
          setSelectedCollection(statusData);
          // Загружаем данные текущего онлайн-полета
          

          const apiUrl = `/api/data/${statusData.dbName}/${statusData?._id || null}`;

          const measurementsResponse = await fetch(apiUrl); 
          const measurementsData = await measurementsResponse.json();
          //console.log('Загружаем данные текущего онлайн-полета', measurementsData);
          setOnlineMeasurements(measurementsData); // Сохраняем данные измерений онлайн-полета
          
          setValidMeasurements(measurementsData);
        } else {
          //console.log('Онлайн-полет не активен');
        }
      } catch (error) {
        console.error('Ошибка при загрузке данных онлайн-полета:', error);
      }
    };
  
    // Вызываем функцию при инициализации компонента
    fetchOnlineFlightData();
  }, []); // Пустой массив зависимостей означает, что эффект выполнится один раз при монтировании компонента
  

  useEffect(() => {
    if (onlineFlightId) {
      setGeoCenter({ lat: globalSettings.latInit, lng: globalSettings.lonInit });
    }
  }, [onlineFlightId, globalSettings.latInit, globalSettings.lonInit]);
  

  const filterMeasurementsByHeight = useCallback(() => {
    let validData = measurements.filter(m => m.lat > 0 && m.lon > 0 /*&& m.dosep >= 0  && && m.dosew >= 0 && m.countw<1000000*/);
    if (heightFilterActive) {
    validData = validData.filter(m => 
      (m.height >= heightFilterFrom && m.height <= heightFilterTo)) 
    }
    console.log('filter by height', validData.length);
    // setValidMeasurements(validData);
    updateValidMeasurements(validData, false, false, false);
  }, [measurements, heightFilterFrom, heightFilterTo, heightFilterActive, doseType]);

  useEffect(() => {
    updateMeasurements(measurements);
  }, [doseType]);

  const filterMeasurementsByDoseType = useCallback(() => {
    let validData = measurements.filter(m => m.lat > 0 && m.lon > 0 /* && m.dosep >= 0 && m.dosew >= 0  && m.countw<1000000*/);
    //console.log('filter by DoseType', validData.length);
    if (heightFilterActive) {
    validData = validData.filter(m => 
      (m.height >= heightFilterFrom && m.height <= heightFilterTo)) 
    }
    //console.log('filter by ByDoseType');
    //setValidMeasurements(validData);
    updateValidMeasurements(validData, true, false, false);
  }, [measurements, doseType]);

  useEffect(() => {
    filterMeasurementsByDoseType();
  }, [doseType, measurements]);

  useEffect(() => {
    if (onlineMeasurements.length > 0) {
      const nonZeroCoordinates = onlineMeasurements.filter(m => m.lat > 0 && m.lon > 0);
      if (nonZeroCoordinates.length === 1) {
        const firstValidMeasurement = nonZeroCoordinates[0];
        //console.log('Найдена единственная ненулевая точка отсчета, координаты установлены в ', firstValidMeasurement.lat, firstValidMeasurement.lon);
        setGeoCenter({ lat: firstValidMeasurement.lat, lng: firstValidMeasurement.lon });
      }
    }
  }, [onlineMeasurements]);

  useEffect(() => {
    filterMeasurementsByHeight()
  }, [heightFilterFrom, heightFilterTo, filterMeasurementsByHeight]); 

  useEffect(() => {
    const newThresholds = calculateColorThresholds(minDoseValue, maxDoseValue);
    setMinDoseValueR(parseFloat(newThresholds.v0));
    setMaxDoseValueR(parseFloat(newThresholds.v3));
  }, [minDoseValue, maxDoseValue]);


  useEffect(() => {
    if (onlineFlightId) {
      setMinDoseValue(0);
      setMaxDoseValue(3);
      setColorThresholds({
        v0: 0,
        v1: 1,
        v2: 2,
        v3: 3,
      });
      setHeightFrom(0);
      setHeightTo(100); 
      setHeightFilterFrom(0);
      setHeightFilterTo(100);
    }
  }, [onlineFlightId]); 
 
 
  const updateValidMeasurements = (inMeasurements, needRecalcDoses, needRecalcHeight, needRecalcCenter) => {
    // Проверяем, определен ли массив measurements и не пустой ли он
    if (!inMeasurements || inMeasurements.length === 0) {
      setValidMeasurements([]);
      return; // Завершаем функцию
    }
    console.log('updateValidMeasurements', doseType, onlineFlightId);
    if (globalSettings && globalSettings.sensorTypes && currentSensorType && globalSettings.sensorTypes[currentSensorType]) {
      
      // Находим зону интересов по текущему doseType
      const zoneOfInterest = globalSettings.sensorTypes[currentSensorType].zonesOfInterest.find(zone => zone.id === doseType - 2);
  
    //  console.log('doseType, Зона интересов', doseType, zoneOfInterest);
  
      // Извлекаем значения P0 и P1, если они есть в selectedCollection, иначе используем значения по умолчанию
      const { P0 = 70, P1 = 11 } = selectedCollection || {};
  
      const updatedMeasurements = inMeasurements.map(measurement => {
        // Логика изменения поля dose в зависимости от значения doseType
        if (doseType === 1 && (!onlineFlightId) ) {
          return {
            ...measurement,
            dose: measurement.dose1 // Присваиваем dose значение dosew
          };
        }
  
        if (doseType === 2 &&  (!onlineFlightId))  {
          return {
            ...measurement,
            dose: measurement.dosep // Присваиваем dose значение dose1
          };
        }
  
        // Если doseType больше 3, то применяем расчет на основе спектра
        if (zoneOfInterest) {
          const leftE = parseInt(zoneOfInterest.leftE, 10);
          const rightE = parseInt(zoneOfInterest.rightE, 10);
  
        //  console.log('leftE rightE', leftE, rightE);
  
          const { spectrum } = measurement;
  
          // Проверяем, есть ли данные о спектре
          if (spectrum && spectrum.channels) {
           // console.log('spectrum.channels', spectrum.channels);
  
            // Пересчитываем диапазон энергий в индексы каналов
            const leftIndex = Math.ceil((leftE - P0) / P1);
            const rightIndex = Math.floor((rightE - P0) / P1);
  
            //  console.log('leftIndex rightIndex', leftIndex, rightIndex);
  
            // Считаем количество сигналов в диапазоне индексов
            const spectrumInRange = spectrum.channels.slice(leftIndex, rightIndex + 1);
            const signalCountInWindow = spectrumInRange.reduce((acc, count) => acc + count, 0);
  
            // Возвращаем обновленное измерение с измененным полем dose
            return {
              ...measurement,
              dose: signalCountInWindow // Изменяем поле dose на вычисленное значение
            };
          }
        }
  
        // Если нет зоны интересов или спектральных данных, возвращаем измерение без изменений
        return { ...measurement };
      });
  
      // Обновляем состояние validMeasurements с новыми значениями
      setValidMeasurements(updatedMeasurements);
  
      if (updatedMeasurements.length > 0 && needRecalcDoses) {
        const doses = updatedMeasurements.map(m => m.dose);
        const newMinDoseValue = Math.min(...doses);
        const newMaxDoseValue = Math.max(...doses);
        //console.log('newMinDoseValue, newMaxDoseValue', newMinDoseValue, newMaxDoseValue);
        setMinDoseValue(newMinDoseValue);
        setMaxDoseValue(newMaxDoseValue);
  
        const newColorThresholds = calculateColorThresholds(newMinDoseValue, newMaxDoseValue);
        setColorThresholds(newColorThresholds);
      }

      if (updatedMeasurements.length > 0 && needRecalcCenter) {
        console.log('needRecalcCenter', onlineFlightId, updatedMeasurements.length);
        if (!onlineFlightId) {

          const nonZeroCoordinates = updatedMeasurements.filter(m => m.lat > 0 && m.lon > 0);
          const latitudes = nonZeroCoordinates.map(m => m.lat);
          const longitudes = nonZeroCoordinates.map(m => m.lon);
          const centerLat = (Math.min(...latitudes) + Math.max(...latitudes)) / 2;
          const centerLng = (Math.min(...longitudes) + Math.max(...longitudes)) / 2;
          console.log('GeoCenter', centerLat, centerLng, 'nonZeroCoordinates',nonZeroCoordinates);
          setGeoCenter({ lat: centerLat, lng: centerLng });
        }
      }
        
      if (updatedMeasurements.length > 0 && needRecalcHeight) {
        // Находим минимальное и максимальное значение высоты
        const heights = updatedMeasurements.map(m => m.height); // Предполагаем, что данные о высоте хранятся в свойстве height
        const minHeight = Math.min(...heights);
        const maxHeight = Math.max(...heights);
        setHeightFrom(minHeight);
        setHeightTo(maxHeight);
        setHeightFilterFrom(minHeight);
        setHeightFilterTo(maxHeight);
        setLocalHeightFrom(minHeight);
        setLocalHeightTo(maxHeight);
      }
  
      //console.log(updatedMeasurements);
    }
  };
  
  const updateMeasurements = (measurements) => {

    console.log('measurements.length ', measurements.length);
    // Проверяем, определен ли массив measurements и не пустой ли он
    if (!measurements || measurements.length === 0) {
      setMeasurements([]);
      return; // Завершаем функцию
    }
  

    if (globalSettings && globalSettings.sensorTypes && currentSensorType && globalSettings.sensorTypes[currentSensorType]) {
      
      // Находим зону интересов по текущему doseType
      const zoneOfInterest = globalSettings.sensorTypes[currentSensorType].zonesOfInterest.find(zone => zone.id === doseType - 2);
  
      // Извлекаем значения P0 и P1, если они есть в selectedCollection, иначе используем значения по умолчанию
      const { P0 = 70, P1 = 11 } = selectedCollection || {};
  
      const updatedMeasurements = measurements.map(measurement => {
        // Логика изменения поля dose в зависимости от значения doseType
        if (doseType === 1) {
          return {
            ...measurement,
            dose: measurement.dose1 // Присваиваем dose значение dosew
          };
        }
  
        if (doseType === 2) {
          return {
            ...measurement,
            dose: measurement.dosep // Присваиваем dose значение dose1
          };
        }
  
        // Если doseType больше 3, то применяем расчет на основе спектра
        if (zoneOfInterest) {
          const leftE = parseInt(zoneOfInterest.leftE, 10);
          const rightE = parseInt(zoneOfInterest.rightE, 10);
  
        //  console.log('leftE rightE', leftE, rightE);
  
          const { spectrum } = measurement;
  
          // Проверяем, есть ли данные о спектре
          if (spectrum && spectrum.channels) {
       //     console.log('spectrum.channels', spectrum.channels);
  
            // Пересчитываем диапазон энергий в индексы каналов
            const leftIndex = Math.ceil((leftE - P0) / P1);
            const rightIndex = Math.floor((rightE - P0) / P1);
  
      //      console.log('leftIndex rightIndex', leftIndex, rightIndex);
  
            // Считаем количество сигналов в диапазоне индексов
            const spectrumInRange = spectrum.channels.slice(leftIndex, rightIndex + 1);
            const signalCountInWindow = spectrumInRange.reduce((acc, count) => acc + count, 0);
  
            // Возвращаем обновленное измерение с измененным полем dose
            return {
              ...measurement,
              dose: signalCountInWindow // Изменяем поле dose на вычисленное значение
            };
          }
        }
  
        // Если нет зоны интересов или спектральных данных, возвращаем измерение без изменений
        return { ...measurement };
      });
  
      console.log('updatedMeasurements', updatedMeasurements);
      // Обновляем состояние validMeasurements с новыми значениями
      setMeasurements(updatedMeasurements);
    }
  };  

  return (
    <FlightDataContext.Provider value={{
      selectedDatabase,
      setSelectedDatabase,
      selectedCollection,
      currentSensorType,
      setCurrentSensorType,
      setSelectedCollection,
      measurements,
      setMeasurements,
      minDoseValue,
      maxDoseValue,
      geoCenter,
      validMeasurements,
      setValidMeasurements,
      heightFrom, 
      setHeightFrom,
      heightTo, 
      setHeightTo,
      heightFilterFrom, 
      setHeightFilterFrom,
      heightFilterTo, 
      setHeightFilterTo,
      localHeightFrom, 
      setLocalHeightFrom,
      localHeightTo, 
      setLocalHeightTo,
      saveMapAsImage,
      setSaveMapAsImage,
      colorThresholds,
      children,
      setColorThresholds,
      minDoseValueR, //округленные до 2 знаков значения доз для отображения в слайдере
      maxDoseValueR, 
      selectedPoints,
      setSelectedPoints,
      selectionSource, 
      setSelectionSource,
      isLoadingFlight,
      onlineMeasurements,
      setOnlineMeasurements,
      onlineFlightId,
      setOnlineFlightId,
      globalSettings,
      setGlobalSettings,
      sourceCoordinates,            // координаты источника
      setSourceCoordinates,         // координаты источника - сеттер
      sourceActivity,
      setSourceActivity,
      sourceDeviation,
      setSourceDeviation,
      saveDataToFile,
      databaseName,
      setDatabaseName,
      mapBounds,                    // координаты выбранной на карте области
      setMapBounds,
      doseType, 
      setDoseType
    }}>
      {children}
    </FlightDataContext.Provider>
  );
};
