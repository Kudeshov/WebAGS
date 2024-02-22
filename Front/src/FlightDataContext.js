import React, { createContext, useState, useEffect, useCallback } from 'react';
import { calculateColorThresholds } from './colorUtils';
import { ExportToCsv } from 'export-to-csv-fix-source-map';
import { convertDateTime } from './dateUtils';

/* const initialCenter = {
  lat: 55.704034038232834,
  lng: 37.62119540524117
}; */

export const FlightDataContext = createContext();

export const FlightDataProvider = ({ children, heightFilterActive, onHeightFilterActive, childrenolorOverrideActive, onColorOverrideActive }) => {
  const [selectedDatabase, setSelectedDatabase] = useState(null);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [onlineMeasurements, setOnlineMeasurements] = useState([]);

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

  const [globalSettings, setGlobalSettings] = useState({
    latInit: 55.704034038232834,
    lonInit: 37.62119540524117
  }); // Инициализация состояния для хранения глобальных настроек

  const [isSettingsLoading, setIsSettingsLoading] = useState(false); // Состояние для отслеживания загрузки настроек

    useEffect(() => {
      const fetchSettings = () => {
        setIsSettingsLoading(true); // Начало загрузки
        fetch('/api/settings')
          .then(response => response.json())
          .then(data => {
            setGlobalSettings(data); // Сохранение полученных настроек в состояние
            console.log('Настройки загружены:', data, data.latInit);
            // Здесь вы можете инициализировать другие состояния значениями из настроек, если это необходимо

            setGeoCenter({ lat: data.latInit, lng: data.lonInit });
          })
          .catch(error => console.error('Ошибка при получении настроек:', error))
          .finally(() => setIsSettingsLoading(false)); // Загрузка завершена
      };

      fetchSettings();
    }, []); // Пустой массив зависимостей означает, что эффект выполнится один раз при монтировании компонента

  const [colorThresholds, setColorThresholds ] = useState({
    v0: 0,
    v1: 1,
    v2: 2,
    v3: 3,
  });


  const optionsCSV = {
    filename: 'exported_data',
    fieldSeparator: ';',
    quoteStrings: '"',
    decimalSeparator: '.',
    showLabels: true, 
    useTextFile: false,
    useBom: true,
/*     useKeysAsHeaders: true, */
    headers: ['Дата и время', 'Широта', 'Долгота', 'Высота GPS', 'Барометрическая высота', 'Мощность дозы по окну', 'Доза']
  };

  // Функция для сохранения данных в файл
  const saveDataToFile = useCallback(() => {
    const formattedData = validMeasurements.map(item => ({
      datetime: convertDateTime(item.datetime),
      lat: item.lat,
      lon: item.lon,
      alt: item.alt, // Высота GPS
      height: item.height, // Барометрическая высота
      dosew: item.dosew, // Мощность дозы по окну
      dose: item.dose
    }));

    const csvExporter = new ExportToCsv(optionsCSV);
    csvExporter.generateCsv(formattedData);
  }, [validMeasurements]);

  const [isLoadingFlight, setIsLoadingFlight] = useState(false);

  const fetchCollections = useCallback(() => {
    console.log('вызвана fetchCollections, onlineFlightID', onlineFlightId);
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
  }, [selectedDatabase]);

  useEffect(() => {
    //console.log('вызвана fetchCollections из useEffect')
    fetchCollections();
  }, [fetchCollections]);

  const fetchMeasurements = useCallback(() => {
    if (selectedDatabase && selectedCollection && !onlineFlightId) {
      setIsLoadingFlight(true); // Начинаем загрузку
      const apiUrl = `/api/data/${selectedDatabase}/${selectedCollection?._id || null}`;
      fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
          onHeightFilterActive(true);

          onColorOverrideActive(true);
          let validData = data.filter(m => m.lat >= 0 && m.lon >= 0 && m.dose >= 0 && m.dosew >= 0 && m.countw<1000000);
          setValidMeasurements(validData);

          if (validData.length > 0) {
            const doses = validData.map(m => m.dose);
            const newMinDoseValue = Math.min(...doses);
            const newMaxDoseValue = Math.max(...doses);
            setMinDoseValue(newMinDoseValue);
            setMaxDoseValue(newMaxDoseValue);

            const newColorThresholds = calculateColorThresholds(newMinDoseValue, newMaxDoseValue);
            setColorThresholds(newColorThresholds);

            if (!onlineFlightId) {
              const latitudes = validData.map(m => m.lat);
              const longitudes = validData.map(m => m.lon);
              const centerLat = (Math.min(...latitudes) + Math.max(...latitudes)) / 2;
              const centerLng = (Math.min(...longitudes) + Math.max(...longitudes)) / 2;
              setGeoCenter({ lat: centerLat, lng: centerLng });
            }
            // Находим минимальное и максимальное значение высоты
            const heights = validData.map(m => m.height); // Предполагаем, что данные о высоте хранятся в свойстве height
            const minHeight = Math.min(...heights);
            const maxHeight = Math.max(...heights);
            setHeightFrom(minHeight);
            setHeightTo(maxHeight);
            setHeightFilterFrom(minHeight);
            setHeightFilterTo(maxHeight);
            setLocalHeightFrom(minHeight);
            setLocalHeightTo(maxHeight);    
            setLocalHeightFrom(minHeight);
            setLocalHeightTo(maxHeight);
          }
          setMeasurements(data);
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
          console.log('statusData', statusData);
          
          setOnlineFlightId(statusData._id); // Сохраняем ID активного онлайн-полета
          setSelectedDatabase(statusData.dbName); // Устанавливаем активную базу данных
          setSelectedCollection(statusData);
          // Загружаем данные текущего онлайн-полета
          
          const measurementsResponse = await fetch('/api/online-measurements');
          const measurementsData = await measurementsResponse.json();
          console.log('Загружаем данные текущего онлайн-полета', measurementsData);
          setOnlineMeasurements(measurementsData); // Сохраняем данные измерений онлайн-полета
          setValidMeasurements(measurementsData);
        } else {
          console.log('Онлайн-полет не активен');
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
  }, [onlineFlightId]);
  

  const filterMeasurementsByHeight = useCallback(() => {
    let validData = measurements.filter(m => m.lat >= 0 && m.lon >= 0 && m.dose >= 0 && m.dosew >= 0 && m.countw<1000000);
    if (heightFilterActive) {
    validData = validData.filter(m => 
      (m.height >= heightFilterFrom && m.height <= heightFilterTo)) 
    }
    //console.log('filter by height');
    setValidMeasurements(validData);
  }, [measurements, heightFilterFrom, heightFilterTo, heightFilterActive]);

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

  return (
    <FlightDataContext.Provider value={{
      selectedDatabase,
      setSelectedDatabase,
      selectedCollection,
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
      setGlobalSettings
    }}>
      {children}
    </FlightDataContext.Provider>
  );
};
