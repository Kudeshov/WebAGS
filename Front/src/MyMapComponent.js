import React, { useEffect, useState, useRef, useContext } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, LayersControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './MyMapComponent.css';
import { FeatureGroup } from 'react-leaflet';
import { FlightContext } from './App';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { HeatmapLayer } from 'react-leaflet-heatmap-layer-v3';
import { useTheme } from '@mui/material/styles';
//import '@bopen/leaflet-area-selection/dist/index.css';
import { getColor } from './colorUtils';
import RectangularSelection from './RectangularSelection';
import { ReactComponent as RectangleIcon } from './icons/rectangle-landscape.svg';

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

function ChangeMapView({ coords }) {
  const map = useMap();
  map.setView(coords, map.getZoom());
  return null;
}

function SpectrumChartWithLabel({ data, isLoading }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '350px', height: '200px' }}>
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

function MyMapComponent() {
  const [selectMode, setSelectMode] = useState(false);

  // Функция для переключения режима выделения
  const toggleSelectMode = () => {
    setSelectMode(!selectMode);
  };
  const { selectedFlight } = useContext(FlightContext);
  const googleMapsUrl = 'http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=ru';
  const googleSatelliteUrl = 'http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&hl=ru';

  const [measurements, setMeasurements] = useState([]);
  const [mapCenter, setMapCenter] = useState(initialCenter);

  const [minSpectrumValue, setMinSpectrumValue] = useState(null);
  const [maxSpectrumValue, setMaxSpectrumValue] = useState(null);

  useEffect(() => {
    if (!selectedFlight) return;
  
    const apiUrl = `http://localhost:3001/api/data/${selectedFlight}`;
  
    fetch(apiUrl)
      .then(response => response.json())
      .then(data => {
        setMeasurements(data);
       //setIsHeatmapLayerSelected(false);
        console.log("Data from API:", data);
  
        if (data.length > 0) {
          const spectrumValues = data.map(measurement => measurement.spectrumValue);
          setMinSpectrumValue(Math.min(...spectrumValues));
          setMaxSpectrumValue(Math.max(...spectrumValues));
  
          // Фильтрация данных для исключения нулевых значений широты и долготы
          const filteredData = data.filter(measurement => measurement.lat !== 0 && measurement.lon !== 0);
  
          if (filteredData.length > 0) {
            // Найти минимальную и максимальную широту и долготу
            const latitudes = filteredData.map(measurement => measurement.lat);
            const longitudes = filteredData.map(measurement => measurement.lon);
            const minLat = Math.min(...latitudes);
            const maxLat = Math.max(...latitudes);
            const minLng = Math.min(...longitudes);
            const maxLng = Math.max(...longitudes);
  
            // Вычислить средние значения для широты и долготы
            const centerLat = (minLat + maxLat) / 2;
            const centerLng = (minLng + maxLng) / 2;
            console.log( centerLat, centerLng );
            // Установить центр карты
            setMapCenter({
              lat: centerLat,
              lng: centerLng
            });
          }
        }
      });
  }, [selectedFlight]);
  
  const [selectedPoints, setSelectedPoints] = useState([]);

  const [spectrumData, setSpectrumData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSpectrumData = (id) => {
    if (!selectedFlight) return;
    setIsLoading(true); // устанавливаем перед запросом
    fetch(`http://localhost:3001/api/spectrum/${selectedFlight}/${id}`)

  //  fetch(`http://localhost:3001/api/spectrum/${id}`)
      .then(response => response.json())
      .then(data => {
        const preparedData = data.spectrum.map((value, index) => ({
          channel: index,
          value,
        }));
        setSpectrumData(preparedData);
        setIsLoading(false); // устанавливаем после успешного выполнения
      });
  };  

/*   const measurementsRef = useRef([]);

  useEffect(() => {
      measurementsRef.current = measurements;
  }, [measurements]); */

  useEffect(() => {
    if (selectMode) {
      document.body.classList.add('selection-mode-active');
    } else {
      document.body.classList.remove('selection-mode-active');
    }
  }, [selectMode]);


  const heatPoints = measurements.map(measurement => {
    const intensity = (measurement.spectrumValue - minSpectrumValue) / (maxSpectrumValue - minSpectrumValue);
    return [measurement.lat, measurement.lon, intensity];
  });


  const theme = useTheme();
  const appBarHeight = theme.mixins.toolbar.minHeight;

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

/*   useEffect(() => {
    if (mapRef.current) {
      const mapContainer = mapRef.current.getContainer();
      if (selectMode) {
        mapContainer.style.cursor = 'crosshair';
      } else {
        mapContainer.style.cursor = 'grab'; // or 'default', depending on your preference
      }
    }
  }, [selectMode]); */

  useEffect(() => {
    const mapElement = document.getElementById('map');
    if (selectMode) {
      mapElement.style.cursor = 'crosshair';
    } else {
      mapElement.style.cursor = ''; // Resets to default cursor
    }
  }, [selectMode]);

  return (
    <MapContainer ref={mapRef} id="map" center={initialCenter} zoom={18} style={{ /* cursor: selectMode ? 'crosshair' : 'default',  */width: '100%', height:  window.innerHeight - appBarHeight - 8  }}>
    <ChangeMapView coords={mapCenter} />

    <LayersControl position="topright">
      <LayersControl.Overlay name="Marker with popup">
        <LayersControl.BaseLayer checked name="OpenStreetMap">
          <TileLayer
            //attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer checked name="Google Карта">
          <TileLayer
            url={googleMapsUrl}
            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
            maxZoom={19}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Google Спутник">
          <TileLayer
            url={googleSatelliteUrl}
            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
            maxZoom={19}
          />
        </LayersControl.BaseLayer>

        <LayersControl.BaseLayer name='Esri World Imagery'>
                    <TileLayer
                        url='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                        maxZoom={19}
                    />
        </LayersControl.BaseLayer>        
      </LayersControl.Overlay>

      <LayersControl.Overlay checked name="Измерения">
        <FeatureGroup>
          {measurements.map((measurement, index) => {
              const isSelected = selectedPoints.some(p => p.id === measurement.id);
              
              //const isSelected = selectedPointsRef.current.some(p => p.id === measurement.id);

              const color = getColor(measurement.spectrumValue, minSpectrumValue, maxSpectrumValue);
              return (
                  <CircleMarker
                      key={index}
                      center={[measurement.lat, measurement.lon]}
                      //color={isSelected ? 'red' : color} // Если точка выделена, делаем ее красной
                      radius={isSelected ? 7 : 5} // Если точка выделена, увеличиваем ее радиус
                      color={ color} // Если точка выделена, делаем ее красной
                      //radius={ 5} // Если точка выделена, увеличиваем ее радиус
                      eventHandlers={{
                          click: () => fetchSpectrumData(measurement.id),
                      }}
                  >
                    <Popup>
                      <div style={{ width: '400px', height: '200px' }}>
                        {isLoading ? 'Загрузка...' : <SpectrumChartWithLabel data={spectrumData} />}
                      </div>
                    </Popup>          
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
        title="Выделить" // Добавляем всплывающую подсказку здесь
      >
        <RectangleIcon style={{ fill: selectMode ? 'blue' : 'gray', width: 27, height: 27 }} />
      </button>
    </div>


  </MapContainer>
  );
}

export default MyMapComponent;
