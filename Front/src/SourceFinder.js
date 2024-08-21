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
  const numCellsG = 21; // Количество ячеек грубой сетки

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

export const findSourceCoordinates3D = (measurements, energyRange, peakEnergy, P0, P1, mapBounds) => {
  const wL = Math.round((energyRange.low - P0) / P1);
  const wH = Math.round((energyRange.high - P0) / P1);
  //mu 0.01016956080127993 C 103182.87103046606 eps 0.2000228280042107
  // Физические параметры
  let mu = 0.00995; 
  let eps = 0.26; 
  const S = (1.51 * 1.51 * Math.PI) * 1.0e-4; 
  const YE = 0.85; 
  let C = 4 * Math.PI / (YE * S * eps);

  // Константы преобразования
  const Mr = 6367449.0;
  const LDEG = 110900.0;

  // Добавляем вызов setEnergy для установки значений mu и eps
  const setEnergy = (energy) => {
      const w = [13.6759, 135.0362, -18.74111, 24.51013, -4.12014, -2.89794, 0.89535];
      let Sum = 0.0;
      const EMev = energy / 1000.0;  // Преобразование энергии в МэВ

      if (EMev >= 0.1 && EMev <= 0.2) {
          eps = (-1.28879 * EMev + 1.0503);
      }
      if (EMev > 0.2) {
          eps = 1.0 / Math.pow(-0.384 * EMev * EMev + 2.8682 * EMev + 0.579, 2.0);
      }

      for (let i = 0; i < 7; i++) {
          Sum += w[i] * Math.pow(EMev, i);
      }

      mu = 1.0 / (10.0 * Math.sqrt(Sum));
      C = 4 * Math.PI / (YE * S * eps);  // Обновляем C с новым eps
  };

  // Вызываем setEnergy с энергией из peakEnergy
  console.log(peakEnergy);
  console.log('before mu', mu, 'C', C, 'eps', eps);
  setEnergy(peakEnergy);  
  console.log('after mu', mu, 'C', C, 'eps', eps);

  // Проверяем, задан ли mapBounds, и корректны ли его координаты
  let Xzone_b, Xzone_e, Yzone_b, Yzone_e;
  
  if (
      mapBounds &&
      mapBounds._southWest &&
      mapBounds._northEast &&
      mapBounds._southWest.lat !== 0 &&
      mapBounds._northEast.lat !== 0 &&
      mapBounds._southWest.lng !== 0 &&
      mapBounds._northEast.lng !== 0 &&
      mapBounds._southWest.lat !== mapBounds._northEast.lat && // Проверяем, что координаты lat не равны
      mapBounds._southWest.lng !== mapBounds._northEast.lng    // Проверяем, что координаты lng не равны
  ) {
      // Если mapBounds задан и содержит валидные координаты, используем их
      const { _southWest, _northEast } = mapBounds;
      Xzone_b = _southWest.lat;
      Xzone_e = _northEast.lat;
      Yzone_b = _southWest.lng;
      Yzone_e = _northEast.lng;
  } else {
      // Если mapBounds не задан или содержит нулевые координаты, вычисляем границы по точкам
      Xzone_b = Math.min(...measurements.map(m => m.lat));
      Xzone_e = Math.max(...measurements.map(m => m.lat));
      Yzone_b = Math.min(...measurements.map(m => m.lon));
      Yzone_e = Math.max(...measurements.map(m => m.lon));
  }

  // Преобразование координат
  const fi = (Xzone_b + Xzone_e) / 2;
  const F_Fi = (Math.PI / 180) * Math.cos(fi * Math.PI / 180) * Mr;

  Xzone_b *= F_Fi;
  Xzone_e *= F_Fi;
  Yzone_b *= LDEG;
  Yzone_e *= LDEG;

  const nx = 21;
  const ny = 21;

  let xmar = (Xzone_e - Xzone_b) / (nx - 1);
  let ymar = (Yzone_e - Yzone_b) / (ny - 1);
  
  let minD = Infinity;
  let sourceCoordinates = { lat: 0, lon: 0 };

  let A = new Array(nx * ny).fill(0);
  let AMean = new Array(nx * ny).fill(0);
  let D = new Array(nx * ny).fill(0);

  let sda = 0.0;
  let a1 = 0.0, a2 = 0.0, a3 = 0.0, da = 0.0;
  let bestJ = 0, bestK = 0;

  // Основной цикл по сетке
  for (let j = 0; j < nx; j++) {
      for (let k = 0; k < ny; k++) {
          const X = Xzone_b + j * xmar;
          const Y = Yzone_b + k * ymar;
          let D_local = 0;
          let integralSum = 0;
          let intensitySum = 0;
          let sumA = 0;

          for (let ns = 0; ns < measurements.length; ns++) {
              const measurement = measurements[ns];
              const spectrum = measurement.spectrum.channels.slice(wL, wH + 1);
              const intensity = spectrum.reduce((sum, value) => sum + value, 0);

              const ri = (measurement.lat * F_Fi - X) ** 2 + (measurement.lon * LDEG - Y) ** 2 + (measurement.alt) ** 2;
              const r = Math.sqrt(ri);
              const Integral = Math.exp(-mu * r) / ri;

              const A_value = C * intensity / Integral;
              sumA += A_value;

              const index = j * ny + k;
              A[index] = A_value;
              AMean[index] += A_value;
              D_local += (A_value - intensity) ** 2;

              intensitySum += intensity;
              integralSum += Integral;
          }

          const index = j * ny + k;
          AMean[index] /= measurements.length;

          for (let ns = 0; ns < measurements.length; ns++) {
              const index = ns * nx * ny + j * ny + k;
              D[index] += (A[index] - AMean[index]) ** 2;
          }

          D[index] /= (measurements.length - 1);

          if (D_local < minD) {
              minD = D_local;
              bestJ = j;
              bestK = k;
              sourceCoordinates.lat = X;
              sourceCoordinates.lon = Y;
          }
      }
  }

  const bestIndex = bestJ * ny + bestK;
  for (let ns = 0; ns < measurements.length; ns++) {
      sda += 1 / D[bestIndex];
  }

  for (let ns = 0; ns < measurements.length; ns++) {
      const index = ns * nx * ny + bestJ * ny + bestK;
      a1 += A[index] / (D[bestIndex] * sda);
  }

  a2 = AMean[bestIndex];
  a3 = A[bestIndex];
  da = 3.84 * Math.sqrt(D[bestIndex] / measurements.length);

  // Обратное преобразование координат
  sourceCoordinates.lat /= F_Fi;
  sourceCoordinates.lon /= LDEG;

  return {
      coordinates: sourceCoordinates,
      activity: a3,
      deviation: da
  };
}
