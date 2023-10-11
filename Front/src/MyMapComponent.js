import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, LayersControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './MyMapComponent.css';
import { rgb } from 'd3-color';
import 'leaflet.heat';
import { FeatureGroup } from 'react-leaflet';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { EditControl } from 'react-leaflet-draw';

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

function getColor(value, doseLow, doseHigh) {
  const diff = 1 - (doseHigh - value) / (doseHigh - doseLow);
  let r = 0;
  let g = 0;
  let b = 255;

  //blue to green
  if (diff >= 0 && diff <= 0.25) {
    g = 255 * diff / 0.25;
    r = 0;
    b = 255 * (0.25 - diff) / 0.25;
  }
  //green to yellow
  else if (diff > 0.25 && diff <= 0.5) {
    b = 0;
    g = 255;
    r = 255 * (diff - 0.25) / 0.25;
  }
  //yellow
  else if (diff > 0.5 && diff <= 0.75) {
    r = 255;
    g = 255;
    b = 0;
  }
  //yellow to red
  else if (diff > 0.75 && diff <= 1) {
    g = 255 * (1 - diff) / 0.25;
    r = 255;
    b = 0;
  }

  const color = rgb(r, g, b);
  return color.toString();
}

function SpectrumChart({ data }) {
  return (
    <LineChart width={300} height={200} data={data} isAnimationActive={false}>
      <Line type="monotone" dataKey="value" stroke="#8884d8" isAnimationActive={false} />
      <CartesianGrid stroke="#ccc" />
      <XAxis dataKey="channel" />
      <YAxis />
      <Tooltip />
    </LineChart>
  );
}

function MyMapComponent() {
  const googleMapsUrl = 'http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=ru';
  const googleSatelliteUrl = 'http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&hl=ru';

  const [measurements, setMeasurements] = useState([]);
  const [mapCenter, setMapCenter] = useState(initialCenter);
  const [isHeatmapVisible, setIsHeatmapVisible] = useState(true);

  const [minSpectrumValue, setMinSpectrumValue] = useState(null);
  const [maxSpectrumValue, setMaxSpectrumValue] = useState(null);

  const [selectedPoints, setSelectedPoints] = useState([]);

  function MyHeatmapLayer({ measurements, isVisible }) {
  const map = useMap();
  const [heatLayer, setHeatLayer] = useState(null);

  useEffect(() => {
    if (!map || !measurements) return;

    const heatData = measurements.map(measurement => {
      const intensity = (measurement.spectrumValue - minSpectrumValue) / (maxSpectrumValue - minSpectrumValue);
      return [measurement.lat, measurement.lon, intensity];
    });

    const heat = L.heatLayer(heatData, { radius: 15 });

    if (isVisible) {
      heat.addTo(map);
    }

    setHeatLayer(heat);

    return () => {
      map.removeLayer(heat);
    };
  }, [map, measurements, isVisible]);

  return <FeatureGroup />;
  }

  useEffect(() => {
    fetch("http://localhost:3001/api/data")
      .then(response => response.json())
      .then(data => {
        setMeasurements(data);
        console.log("Data from API:", data);
        if (data.length > 0) {
          const spectrumValues = data.map(measurement => measurement.spectrumValue);
          setMinSpectrumValue(Math.min(...spectrumValues));
          setMaxSpectrumValue(Math.max(...spectrumValues));
          setMapCenter({
            lat: data[0].lat,
            lng: data[0].lon
          });
        }
      });
  }, []);

  const [spectrumData, setSpectrumData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const fetchSpectrumData = (id) => {
    setIsLoading(true); // устанавливаем перед запросом
    fetch(`http://localhost:3001/api/spectrum/${id}`)
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

  const measurementsRef = useRef([]);
   useEffect(() => {
      measurementsRef.current = measurements;
  }, [measurements]);

  function handleRectangleCreate(event) {
    console.log("Rectangle created!");
    console.log("Measurements at filter time:", measurementsRef.current);
    const layer = event.layer;
    const bounds = layer.getBounds();
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    const selected = measurementsRef.current.filter(point => 
        point.lat >= sw.lat && point.lat <= ne.lat && 
        point.lon >= sw.lng && point.lon <= ne.lng
    );

    setSelectedPoints(selected);
    console.log(selected);
    // Сохраняем прямоугольник в состояние
    setRectangles(prev => [...prev, event.layer]);
  }

//  console.log("Measurements length:", measurements.length);


const [rectangles, setRectangles] = useState([]);
  // Функция для удаления последнего прямоугольника
function removeLastRectangle() {
  if (rectangles.length === 0) return;

  const lastRectangle = rectangles[rectangles.length - 1];
  lastRectangle.remove();  // Удаляем слой с карты
  setRectangles(prev => prev.slice(0, -1));  // Убираем последний слой из массива
}

// Функция для удаления всех прямоугольников
function removeAllRectangles() {
  for (let rectangle of rectangles) {
      rectangle.remove();
  }
  setRectangles([]);
}

  return (
     <MapContainer center={initialCenter} zoom={18} style={{ width: '100%', height: '600px' }}>

      <ChangeMapView coords={mapCenter} />
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Карта">
          <TileLayer
            url={googleMapsUrl}
            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
            maxZoom={21}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Спутник">
          <TileLayer
            url={googleSatelliteUrl}
            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
            maxZoom={21}
          />
        </LayersControl.BaseLayer>

        <LayersControl.Overlay
          checked
          name="Тепловая карта"
          eventHandlers={{
            add: () => setIsHeatmapVisible(true),
            remove: () => setIsHeatmapVisible(false)
          }}
        >
          <MyHeatmapLayer measurements={measurements} isVisible={isHeatmapVisible} />
        </LayersControl.Overlay> 

        <LayersControl.Overlay name="Точки">
          <FeatureGroup>

          <EditControl
            position="topright"
            onCreated={handleRectangleCreate}
            draw={{
                rectangle: true,
                polyline: false,
                circle: false,
                circlemarker: false,
                marker: false,
                polygon: false
            }}
            edit={{
                edit: false, // Отключение редактирования
                remove: false // Отключение удаления
            }}
          />

            {measurements.map((measurement, index) => {
                const isSelected = selectedPoints.some(p => p.id === measurement.id);
                const color = getColor(measurement.spectrumValue, minSpectrumValue, maxSpectrumValue);
                return (
                    <CircleMarker
                        key={index}
                        center={[measurement.lat, measurement.lon]}
                        color={isSelected ? 'red' : color} // Если точка выделена, делаем ее красной
                        radius={isSelected ? 7 : 5} // Если точка выделена, увеличиваем ее радиус
                        eventHandlers={{
                            click: () => fetchSpectrumData(measurement.id),
                        }}
                    >
                    <Popup>
                        <div style={{ width: '400px', height: '200px' }}>
                            {isLoading ? 'Загрузка...' : <SpectrumChart data={spectrumData} />}
                        </div>
                    </Popup>               
                    </CircleMarker>
                );
            })}
          </FeatureGroup>          
        </LayersControl.Overlay>
    </LayersControl>

    <button style={{ position: 'absolute', top: '10px', left: '50px', zIndex: 1000 }} onClick={removeLastRectangle}>
    Удалить последний прямоугольник
</button>
<button style={{ position: 'absolute', top: '40px', left: '50px', zIndex: 1000 }} onClick={removeAllRectangles}>
    Удалить все прямоугольники
</button>
    </MapContainer> 
  );
}

export default MyMapComponent;
