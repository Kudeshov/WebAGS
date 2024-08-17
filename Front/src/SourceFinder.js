import * as turf from '@turf/turf';

// Функция фильтрации спектра по диапазону энергий
const filterSpectrumByEnergyRange = (spectrum, energyRange, P0, P1) => {
  if (!spectrum || !spectrum.channels) return 0; // Проверяем наличие спектра и его каналов

  const { low, high } = energyRange;
  let filteredSum = 0;
  let count = 0;

  // Фильтруем каналы по диапазону энергий и суммируем интенсивности
  spectrum.channels.forEach((intensity, index) => {
    const energy = P0 + P1 * index;
    if (energy >= low && energy <= high) {
      filteredSum += intensity;
      count++;
    }
  });

  return count > 0 ? filteredSum / count : 0; // Среднее значение интенсивности
};

// Функция для проверки, имеют ли все точки одинаковые координаты
const allPointsHaveSameCoordinates = (points) => {
  const firstPoint = points[0];
  return points.every(point => point.lat === firstPoint.lat && point.lon === firstPoint.lon);
};

export const findSourceCoordinates = (
  measurements,
  energyRange,
  P0,
  P1,
  S = 1.51 * 1.51 * Math.PI * 1.0e-04,
  eps = 0.26,
  YE = 0.85
) => {
  const C = 4 * Math.PI / (YE * S * eps); // Константа для расчета активности

  // Если только одна точка — возвращаем её как координаты источника
  if (measurements.length === 1) {
    const { lat, lon, spectrum } = measurements[0];
    const intensity = filterSpectrumByEnergyRange(spectrum, energyRange, P0, P1);
    const activity = intensity * C; // Простая активность без учета ослабления
    return {
      coordinates: { lat, lon },
      activity: activity, // Рассчитанная активность
      deviation: 0, // Нет отклонения, так как всего одна точка
    };
  }

  // Проверяем, имеют ли все точки одинаковые координаты
  if (allPointsHaveSameCoordinates(measurements)) {
    const { lat, lon, spectrum } = measurements[0];
    const intensity = filterSpectrumByEnergyRange(spectrum, energyRange, P0, P1);
    const activity = intensity * C; // Простая активность без учета ослабления
    return {
      coordinates: { lat, lon },
      activity: activity, // Рассчитанная активность
      deviation: 0, // Нет отклонения, так как все точки совпадают
    };
  }

  // Находим минимальные и максимальные координаты
  const minLat = Math.min(...measurements.map(m => m.lat));
  const maxLat = Math.max(...measurements.map(m => m.lat));
  const minLon = Math.min(...measurements.map(m => m.lon));
  const maxLon = Math.max(...measurements.map(m => m.lon));

  // Создаём точки с фильтрованными спектрами
  const points = measurements.map(measurement => {
    const { lat, lon, spectrum } = measurement;
    const averageIntensity = filterSpectrumByEnergyRange(spectrum, energyRange, P0, P1);
    return turf.point([lon, lat], { intensity: averageIntensity });
  }).filter(point => point.properties.intensity > 0); // Фильтруем точки с нулевой интенсивностью

  if (points.length === 0) return null; // Если нет точек с интенсивностью, ничего не возвращаем

  // Создаём коллекцию точек
  const pointsCollection = turf.featureCollection(points);

  // Первый проход — грубая сетка (например, 21x21)
  const numCellsG = 25; // Количество ячеек грубой сетки

  // Функция для поиска источника по сетке
  const searchGrid = (minLat, maxLat, minLon, maxLon, numCells, pointsCollection) => {
    const latStep = (maxLat - minLat) / numCells;
    const lonStep = (maxLon - minLon) / numCells;

    // Интерполяция значений интенсивности на сетке
    const grid = turf.interpolate(pointsCollection, Math.max(latStep, lonStep), {
      gridType: 'point',
      property: 'intensity',
      units: 'degrees',
    });

    // Ищем ячейку с максимальной интенсивностью
    let maxIntensity = -Infinity;
    let sourcePoint = null;

    grid.features.forEach(feature => {
      const intensity = feature.properties.intensity;
      if (intensity > maxIntensity) {
        maxIntensity = intensity;
        sourcePoint = feature;
      }
    });

    if (!sourcePoint) {
      return null; // Если ничего не найдено
    }

    const [lon, lat] = sourcePoint.geometry.coordinates;

    return { lat, lon, grid };
  };

  // Первый проход — грубая сетка
  const firstSearchResult = searchGrid(minLat, maxLat, minLon, maxLon, numCellsG, pointsCollection);

  if (!firstSearchResult) {
    return null; // Если ничего не найдено
  }

  const { lat: roughLat, lon: roughLon } = firstSearchResult;

  // Определяем границы для детализированной сетки на основе грубого поиска
  const searchRadius = Math.max((maxLat - minLat) / numCellsG, (maxLon - minLon) / numCellsG) * 3;

  const detailedMinLat = roughLat - searchRadius;
  const detailedMaxLat = roughLat + searchRadius;
  const detailedMinLon = roughLon - searchRadius;
  const detailedMaxLon = roughLon + searchRadius;

  // Второй проход — детализированная сетка
  const secondSearchResult = searchGrid(
    detailedMinLat,
    detailedMaxLat,
    detailedMinLon,
    detailedMaxLon,
    numCellsG,
    pointsCollection
  );

  if (!secondSearchResult) {
    return null; // Если ничего не найдено
  }

  const { lat: detailedLat, lon: detailedLon, grid } = secondSearchResult;

  // Рассчитываем среднюю активность
  let activitySum = 0;
  let intensitySum = 0;

  grid.features.forEach(feature => {
    const intensity = feature.properties.intensity;
    activitySum += intensity * C; // Активность для каждой точки
    intensitySum += intensity;
  });

  const activity = intensitySum > 0 ? activitySum / intensitySum : 0; // Средняя активность

  // Рассчитываем отклонение как стандартное отклонение интенсивности
  let deviationSum = 0;

  grid.features.forEach(feature => {
    const intensity = feature.properties.intensity;
    const deviation = intensity - intensitySum / grid.features.length; // Отклонение интенсивности от средней
    deviationSum += deviation ** 2;
  });

  const deviation = intensitySum > 0 ? Math.sqrt(deviationSum / grid.features.length) * C : 0; // Стандартное отклонение, умноженное на константу C

  return {
    coordinates: { lat: detailedLat, lon: detailedLon },
    activity: activity, // Средняя активность (в γ/с)
    deviation: deviation, // Отклонение (в γ/с)
  };
};
