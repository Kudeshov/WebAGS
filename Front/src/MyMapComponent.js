import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, LayersControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './MyMapComponent.css';
import { rgb } from 'd3-color';
import 'leaflet.heat';
import { FeatureGroup } from 'react-leaflet';

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



function MyMapComponent() {
  const googleMapsUrl = 'http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=ru';
  const googleSatelliteUrl = 'http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&hl=ru';

  const [measurements, setMeasurements] = useState([]);
  const [mapCenter, setMapCenter] = useState(initialCenter);

  const [minSpectrumValue, setMinSpectrumValue] = useState(null);
  const [maxSpectrumValue, setMaxSpectrumValue] = useState(null);

  function MyHeatmapLayer({ measurements, isVisible }) {
    const map = useMap();
    const [heatLayer, setHeatLayer] = useState(null);
  
    useEffect(() => {
      if (!map || !measurements) return;
  
      const heatData = measurements.map(measurement => {
        const intensity = (measurement.spectrumValue - minSpectrumValue) / (maxSpectrumValue - minSpectrumValue);
        return [measurement.lat, measurement.lon, intensity];
      });
  
      const heat = L.heatLayer(heatData, { radius: 25 });
      setHeatLayer(heat);
  
      return () => {
        map.removeLayer(heat);
      };
    }, [map, measurements]);
  
    useEffect(() => {
      if (heatLayer) {
        if (isVisible) {
          heatLayer.addTo(map);
        } else {
          map.removeLayer(heatLayer);
        }
      }
    }, [map, heatLayer, isVisible]);
  
    return <FeatureGroup />;
  }


  useEffect(() => {
    fetch("http://localhost:3001/api/data")
      .then(response => response.json())
      .then(data => {
        setMeasurements(data);
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

    <LayersControl.Overlay checked name="Тепловая карта">
      <MyHeatmapLayer measurements={measurements} isVisible={true} />
    </LayersControl.Overlay>  
    <LayersControl.Overlay name="Точки">
      <FeatureGroup>
        {measurements.map((measurement, index) => {
          const color = getColor(measurement.spectrumValue, minSpectrumValue, maxSpectrumValue);
          return (
            <CircleMarker
              key={index}
              center={[measurement.lat, measurement.lon]}
              color={color}
              radius={5}
            >
            </CircleMarker>
          );
        })}
      </FeatureGroup>
    </LayersControl.Overlay>

    </LayersControl>


    </MapContainer> 
  );
}

export default MyMapComponent;
