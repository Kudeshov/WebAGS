import React, { useState, useEffect } from 'react';
import { Rectangle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

const RectangularSelection = ({ active, onSelectionComplete }) => {
  const [rectBounds, setRectBounds] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPoint, setStartPoint] = useState(null);

  const map = useMapEvents({
    mousedown: (e) => {
      if (!active) return;

      map.dragging.disable();
      setStartPoint(e.latlng);
      setIsSelecting(true);
      setRectBounds(new L.LatLngBounds(e.latlng, e.latlng));
    },
    mousemove: (e) => {
      if (isSelecting && startPoint) {
        setRectBounds(new L.LatLngBounds(startPoint, e.latlng));
      }
    },
    mouseup: () => {
      if (!active) return;

      map.dragging.enable();
      if (isSelecting && rectBounds) {
        onSelectionComplete(rectBounds);
        setIsSelecting(false);
      }
    }
  });

  useEffect(() => {
    // Дополнительная логика при необходимости
  }, [rectBounds, isSelecting]);

  return (
    rectBounds ? <Rectangle bounds={rectBounds} color="blue" /> : null
  );
};

export default RectangularSelection;
