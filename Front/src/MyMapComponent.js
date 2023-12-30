import React, { useEffect, useState, useRef, useContext } from 'react';
import { MapContainer, TileLayer, CircleMarker, LayersControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './MyMapComponent.css';
import { FeatureGroup } from 'react-leaflet';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { HeatmapLayer } from 'react-leaflet-heatmap-layer-v3';
import { getColor } from './colorUtils';
import RectangularSelection from './RectangularSelection';
import { ReactComponent as RectangleIcon } from './icons/rectangle-landscape.svg';
import ReactDOM from 'react-dom';
import { FlightDataContext } from './FlightDataContext';

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
        {isLoading ? 'Загрузка...' : <SpectrumChart data={data} />}
      </div>
    </div>
  );
}

function SpectrumChart({ data }) {
  return (
    <LineChart width={330} height={200} data={data} isAnimationActive={false}>
      <Line type="monotone" dataKey="value" stroke="#8884d8" isAnimationActive={false} />
      <CartesianGrid stroke="#ccc" />
      <XAxis 
        dataKey="channel" 
         label={{ value: "Энергия (keV)", position: "bottom", offset: -6, style: { fontSize: 12 } }}  
      />
      <YAxis >
      </YAxis>
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

/*   const { selectedCollection } = useContext(FlightDataContext); */
  const { selectedFlight } = useContext(FlightDataContext);

  const googleMapsUrl = 'http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=ru';
  const googleSatelliteUrl = 'http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&hl=ru';

  const { measurements } = useContext(FlightDataContext);
  const { validMeasurements } = useContext(FlightDataContext);
    
  const { geoCenter } = useContext(FlightDataContext);

  const { minDoseValue, maxDoseValue } = useContext(FlightDataContext);

  const [spectrumData, setSpectrumData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMeasurement, setSelectedMeasurement] = useState(null);
  const panelRef = useRef(null); // Ссылка на DOM-элемент панели
  const spectrumPanelRef = useRef(null); 
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  const { heightFrom } = useContext(FlightDataContext);
  const { heightTo } = useContext(FlightDataContext);

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

/*   function SpectrumControlComponent({ data, isLoading }) {
    // Компонент для рендеринга внутри элемента управления Leaflet
    return (
      <div>
        
        <SpectrumChartWithLabel data={data} isLoading={isLoading} />
      </div>
    );
  } */
  
  const handlePointClick = (measurement) => {
    if (isCtrlPressed) {
      // Добавляем точку в массив, если Ctrl нажат
      setSelectedPoints(prevPoints => [...prevPoints, measurement]);
    } else {
      // Заменяем массив одной точкой, если Ctrl не нажат
      setSelectedPoints([measurement]);
    }
  
    fetchSpectrumData(measurement);
  };

  useEffect(() => {

    console.log('validMeasurements ', validMeasurements);

    if (!measurements.length) return;
    if (!validMeasurements.length) return;

    mapInstance?.setView([geoCenter.lat, geoCenter.lng], mapInstance.getZoom());

  }, [measurements, mapInstance, validMeasurements, geoCenter]);
  
  
  const [selectedPoints, setSelectedPoints] = useState([]);

  const fetchSpectrumData = (measurement) => {
    if (!selectedFlight) return;
  
    setSelectedMeasurement(measurement);
    setIsLoading(true);
    fetch(`http://localhost:3001/api/spectrum/${selectedFlight}/${measurement.id}`)
      .then(response => response.json())
      .then(data => {
        const preparedData = data.spectrum.map((value, index) => ({
          channel: index,
          value,
        }));
        setSpectrumData(preparedData);
        console.log('preparedData length ', preparedData.length);
        

        setIsLoading(false);
  
        // Создаем панель графика, если она еще не существует
        if (!spectrumPanelRef.current) {
          console.log('Create spectrum panel');
          createSpectrumPanel(mapInstance);
        }
        
        console.log('Update spectrum panel');
        // Обновляем панель графика
        updateSpectrumPanel(preparedData, isLoading);
      });
  };
  

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

  
  function createSpectrumPanel(map) {
    const spectrumControl = L.control({ position: 'bottomright' });
  
    spectrumControl.onAdd = function() {
      spectrumPanelRef.current = L.DomUtil.create('div', 'spectrum-panel');
      ReactDOM.render(
        <SpectrumChartWithLabel data={spectrumData} isLoading={false} />,
        spectrumPanelRef.current
      );
      return spectrumPanelRef.current;
    };
  
    spectrumControl.addTo(map);
  }

  const updateSpectrumPanel = (data, isLoading) => {
    if (spectrumPanelRef.current) {
      ReactDOM.render(
        <SpectrumChartWithLabel data={data} isLoading={false} />,
        spectrumPanelRef.current
      );
    }
  }

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

/*   useEffect(() => {
    console.log('mapInstance', mapInstance);
    if (mapInstance && spectrumData) {
      createSpectrumPanel(mapInstance, spectrumData, isLoading);
    }
  }, [mapInstance, spectrumData, isLoading]); */
  
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

  useEffect(() => {
    if (mapInstance) {
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
  
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  }

  useEffect(() => {
    // Обновляем содержимое панели при изменении selectedMeasurement
    if (panelRef.current && selectedMeasurement) {
      panelRef.current.innerHTML = `
        Дата: ${convertDateTime(selectedMeasurement.datetime)}<br>
        Время измерения: 1 сек<br>
        Счёт в окне: ${selectedMeasurement.countw} имп/с<br>
        Высота GPS: ${selectedMeasurement.alt.toFixed(2)} м<br>
        Высота баром.: ${selectedMeasurement.height.toFixed(2)} м<br>
        Долгота: ${selectedMeasurement.lon.toFixed(6)}<br>
        Широта: ${selectedMeasurement.lat.toFixed(6)}<br>
        Мощность дозы (полином): ${parseFloat(selectedMeasurement.dose).toFixed(3)} мкЗв/час<br>
        Мощность дозы (по окну): ${parseFloat(selectedMeasurement.dosew).toFixed(5)} мкЗв/час<br>
        Счётчик ГМ1: ${selectedMeasurement.geiger1} имп/с<br>
        Счётчик ГМ2: ${selectedMeasurement.geiger2} имп/с<br>
        Мощность дозы ГМ: 0 мкЗв/час
      `;
    }
  }, [selectedMeasurement]);

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
