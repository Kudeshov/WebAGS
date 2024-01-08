import React, { useContext } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { FlightDataContext } from './FlightDataContext';
import { getColor } from './colorUtils';
import { AxesHelper } from 'three';
import { GridHelper } from 'three';

const Point = ({ position, color }) => (
  <mesh position={position}>
    <sphereGeometry args={[1, 16, 16]} /> {/* Использование sphereGeometry */}
    <meshBasicMaterial color={color} />
  </mesh>
);

/* const scaleCoordinates = (lat, lon, alt, centerLat, centerLon) => {
  const latScale = 111000; // Примерно 111 км на градус широты
  const lonScale = Math.cos(centerLat * Math.PI/180) * 111000; // Учитывает изменение длины градуса долготы в зависимости от широты
  return [
    (lat - centerLat) * latScale,
    (lon - centerLon) * lonScale,
    alt
  ];
}; */

const scaleCoordinates = (lat, lon, alt, centerLat, centerLon) => {
  const latScale = 111000; // Примерно 111 км на градус широты
  const lonScale = Math.cos(centerLat * Math.PI / 180) * 111000; // Учитывает изменение длины градуса долготы в зависимости от широты

  return [
    (lat - centerLat) * latScale, // X-ось
    alt,                         // Y-ось
    (lon - centerLon) * lonScale  // Z-ось
  ];
};

const DroneFlight3D = ({ heightFilterActive, heightFrom, heightTo }) => {
  const { minDoseValue, maxDoseValue } = useContext(FlightDataContext);
  const { validMeasurements } = useContext(FlightDataContext);
  const { geoCenter } = useContext(FlightDataContext);

  // Фильтрация данных, если активен фильтр по высоте
/*   const filteredMeasurements = heightFilterActive 
    ? validMeasurements.filter(measurement => 
        measurement.height >= heightFrom && measurement.height <= heightTo)
    : validMeasurements;
 */
  return (
    <Canvas camera={{ position: [-150, 100, -100], fov: 45 }}>  {/* [180, 0, 100]  [0, -180, 100]*/}
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <primitive object={new AxesHelper(10)} />
      {/* Поворот сетки для размещения в плоскости XY */}
      <primitive object={new GridHelper(200, 20)} rotation={[0, 0, 0]} /> {/*  Math.PI / 2 */}
      {validMeasurements.map((vmeasurement, index) => (
        <Point
          key={index}
          position={scaleCoordinates( vmeasurement.lat, vmeasurement.lon, vmeasurement.alt, geoCenter.lat, geoCenter.lng)}
          color={getColor(vmeasurement.dose, minDoseValue, maxDoseValue)}
        />
      ))}
      <OrbitControls />
    </Canvas>
  );
};

export default DroneFlight3D;