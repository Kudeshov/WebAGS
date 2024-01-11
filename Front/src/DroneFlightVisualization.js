import React, { useContext } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { FlightDataContext } from './FlightDataContext';
import { getColorT } from './colorUtils';
import { AxesHelper } from 'three';
import { GridHelper } from 'three';

const Point = ({ position, color }) => (
  <mesh position={position}>
    <sphereGeometry args={[1, 16, 16]} /> {/* Использование sphereGeometry */}
    <meshBasicMaterial color={color} />
  </mesh>
);

const scaleCoordinates = (lat, lon, alt, centerLat, centerLon) => {
  const latScale = 111000; // Примерно 111 км на градус широты
  const lonScale = Math.cos(centerLat * Math.PI / 180) * 111000; // Учитывает изменение длины градуса долготы в зависимости от широты

  return [
    (lat - centerLat) * latScale, // X-ось
    alt,                          // Y-ось
    (lon - centerLon) * lonScale  // Z-ось
  ];
};

const DroneFlight3D = ({ heightFilterActive, heightFrom, heightTo }) => {
  const { minDoseValue, maxDoseValue } = useContext(FlightDataContext);
  const { validMeasurements } = useContext(FlightDataContext);
  const { geoCenter } = useContext(FlightDataContext);
  const { colorThresholds } = useContext(FlightDataContext);
  return (
    <Canvas camera={{ position: [-150, 100, -100], fov: 45 }}> 
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <primitive object={new AxesHelper(10)} />
      <primitive object={new GridHelper(200, 20)} rotation={[0, 0, 0]} />
      {validMeasurements.map((vmeasurement, index) => (
        <Point
          key={index}
          position={scaleCoordinates( vmeasurement.lat, vmeasurement.lon, vmeasurement.alt, geoCenter.lat, geoCenter.lng)}
          color={getColorT(vmeasurement.dose, colorThresholds, minDoseValue, maxDoseValue)}
        />
      ))}
      <OrbitControls />
    </Canvas>
  );
};

export default DroneFlight3D;