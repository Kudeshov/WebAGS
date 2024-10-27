import * as turf from '@turf/turf';
const integrate = require('integrate-adaptive-simpson');
const R = 6371000.0; // Радиус Земли в метрах

export const findSourceCoordinates3D = (measurements, energyRange, peakEnergy, P0, P1, mapBounds, useRefinedPeakAreaCalculation, RCs137, peakChannel) => {
  const wL = Math.round((energyRange.low - P0) / P1);
  const wH = Math.round((energyRange.high - P0) / P1);

  // Физические параметры
  let mu = 0.00995; 
  let eps = 0.26; 
  const S = (1.51 * 1.51 * Math.PI) * 1.0e-4; 
  const YE = 0.85; 
  let C = 4 * Math.PI / (YE * S * eps);

  // Функция установки энергии
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

  // Устанавливаем значения mu и eps на основе энергии пика
  setEnergy(peakEnergy);

  const NSamples = measurements.length - 2;
  console.log('NSamples ', NSamples);

  //  Вычисление интенсивностей для всех измерений
    const intensities = measurements.map((measurement) => {
      if (useRefinedPeakAreaCalculation) {
        return calculatePeakArea(measurement.spectrum.channels, peakChannel, RCs137, P0, P1, true);
      } else {
        const spectrum = measurement.spectrum.channels.slice(wL, wH + 1);
        return spectrum.reduce((sum, value) => sum + value, 0); // Сумма интенсивностей
      }
    });

  mapBounds = defineBounds(measurements, mapBounds);

  console.log('mapBounds ', mapBounds);
  console.log('Исходные координаты точки 0, градусы', measurements[0].lat, measurements[0].lon);

  // Определяем грубую сетку, без преобразования координат
  const nx = 21;
  const ny = 21;

  let xmar = (mapBounds._northEast.lat - mapBounds._southWest.lat) / (nx - 1);
  let ymar = (mapBounds._northEast.lng - mapBounds._southWest.lng) / (ny - 1);

  let sourceCoordinates = { lat: 0, lon: 0 };

  let A = new Array(nx * ny).fill(0);
  let AMean = new Array(nx * ny).fill(0);
  let D = new Array(nx * ny).fill(0);

  const { J0, K0 } = cellSelect(mapBounds._southWest.lat, mapBounds._southWest.lng, nx, ny, xmar, ymar, measurements, intensities, C, mu, A, AMean, D, NSamples, useRefinedPeakAreaCalculation, RCs137, peakChannel, P0, P1);

  console.log('Грубая оценка - индексы квадрата', J0, K0);

  const X0 = mapBounds._southWest.lat + J0 * xmar;
  const Y0 = mapBounds._southWest.lng + K0 * ymar;

  xmar = 2 * xmar / (nx - 1);
  ymar = 2 * ymar / (ny - 1);

  const refinedSelect = cellSelect(X0 - xmar, Y0 - ymar, nx, ny, xmar, ymar, measurements, intensities, C, mu, A, AMean, D, NSamples, useRefinedPeakAreaCalculation, RCs137, peakChannel, P0, P1);
 
  const X01 = refinedSelect.J0 * xmar;
  const Y01 = refinedSelect.K0 * ymar;

// const refinedSelect = { J0, K0 };
  
  sourceCoordinates.lat = X0 ; //+X01;
  sourceCoordinates.lon = Y0; //+Y01;
 
  console.log('Координаты источника: ', sourceCoordinates);

  const bestIndex = refinedSelect.J0 * ny + refinedSelect.K0;
  let a3 = 0;

  let minDist = Infinity;
  let closestIndex = -1;

  for (let ns = 1; ns < measurements.length - 1; ns++) {
    const dist = (measurements[ns].lat - X0) ** 2 + 
                 (measurements[ns].lon - Y0) ** 2 + 
                 (measurements[ns].height - 0) ** 2;

    const closestInd = ns * nx * ny + refinedSelect.J0 * ny + refinedSelect.K0;

    if (dist < minDist) {
      if (A[closestInd] !== 0) {
        minDist = dist;
        closestIndex = ns;
      }
    }
  }

  if (closestIndex !== -1) {
    const closestInd = closestIndex * nx * ny + bestIndex;
    a3 = A[closestInd];
  } else {
    console.log("Ненулевое значение в массиве A не найдено.");
    a3 = 0;
  }

  const ind = bestIndex;
  const da = 3.84 * Math.sqrt(D[ind] / NSamples);

  console.log('Финальный результат: Activity a3 (nearest point):', a3, 'Deviation:', da);

  return {
    coordinates: sourceCoordinates,
    activity: a3,
    deviation: da
  };
};

/**
 * Вычисление интеграла затухания сигнала между двумя точками (сэмплами).
 * @param {number} x1 - Координата X первой точки.
 * @param {number} y1 - Координата Y первой точки.
 * @param {number} z1 - Координата Z первой точки.
 * @param {number} x2 - Координата X второй точки.
 * @param {number} y2 - Координата Y второй точки.
 * @param {number} z2 - Координата Z второй точки.
 * @param {number} X - Координата X текущей ячейки сетки.
 * @param {number} Y - Координата Y текущей ячейки сетки.
 * @param {number} Z - Координата Z текущей ячейки (обычно 0).
 * @param {number} mu - Коэффициент затухания среды.
 * @param {number} NN - Количество промежуточных шагов для интегрирования.
 * @returns {number} - Значение интеграла затухания между двумя сэмплами.
 */
const calculateIntegralTr = (x1, y1, z1, x2, y2, z2, X, Y, Z, mu, NN) => {
  let Integral = 0;  // Инициализируем интеграл
 
  // Вычисляем половину расстояния между двумя точками
  let dx = (x2 - x1) / 2.0;
  let dy = (y2 - y1) / 2.0;
  let dz = (z2 - z1) / 2.0;

  // Вычисляем шаг по каждой координате
  let ddx = dx / NN;
  let ddy = dy / NN;
  let ddz = dz / NN;

  // Цикл по промежуточным точкам между сэмплами
  for (let ii = 0; ii < NN; ii++) {
    // Промежуточные координаты
    let x = x1 + ii * ddx;
    let y = y1 + ii * ddy;
    let z = z1 + ii * ddz;

    // Вычисляем расстояние до текущей ячейки сетки
    let ri = (x - X) ** 2 + (y - Y) ** 2 + (z - Z) ** 2;
    let r = Math.sqrt(ri);  // Вычисляем расстояние r
    let Fi1 = Math.exp(-mu * r) / ri;  // Вычисляем затухание Fi1

    // Переходим на следующий шаг
    x += ddx;
    y += ddy;
    z += ddz;

    // Вычисляем расстояние и затухание для следующей промежуточной точки
    ri = (x - X) ** 2 + (y - Y) ** 2 + (z - Z) ** 2;
    r = Math.sqrt(ri);
    let Fi2 = Math.exp(-mu * r) / ri;  // Вычисляем затухание Fi2

    // Усредняем Fi1 и Fi2 и добавляем в интеграл
    Integral += (Fi1 + Fi2) / 2.0;
  }

  return Integral;  // Возвращаем результат интегрирования
};


let cnt = 0; 

const calculateIntegralSimpson = (x1, y1, z1, x2, y2, z2, X, Y, Z, mu) => {

    // Преобразование координат X и Y в метры
    const { x: X1m, y: Y1m } = degToMeters(x1, y1); // Точка 1 в метрах
    const { x: X2m, y: Y2m } = degToMeters(x2, y2); // Точка 2 в метрах
    const { x: Xm, y: Ym } = degToMeters(X, Y);     // Ячейка в сетке в метрах
  // Определяем функцию, которую будем интегрировать
  const integrand = (t) => {
    // Промежуточные координаты с параметром t [0, 1] для линейной интерполяции между двумя точками
        const xt = X1m + t * (X2m - X1m);
        const yt = Y1m + t * (Y2m - Y1m);
        const zt = z1 + t * (z2 - z1);

        // Расстояние до текущей ячейки
        const distanceSquared = (xt - Xm) ** 2 + (yt - Ym) ** 2 + (zt - Z) ** 2;
        const r = Math.sqrt(distanceSquared);

    // Если r близко к 0, возвращаем небольшое значение, чтобы избежать деления на 0
    if (r === 0) return 1e-10;

    if (cnt < 10 /* && (mu * r)>1 */ ) {
      console.log('mu * r=', mu * r, 'mu=', mu, 'r=', r, 'zt=', zt, 'Math.exp(-mu * r) / r ** 2', Math.exp(-mu * r) / r ** 2);
      cnt ++;
    }

    // Возвращаем экспоненциальное затухание
    return Math.exp(-mu * r) / r ** 2;
  };

  // Вычисляем интеграл на интервале [0, 1] с использованием библиотеки
  const tolerance = 1e-8;
  const result = integrate(integrand, 0, 1, tolerance);
  
  return result;
};

/**
 * Функция для поиска ячейки сетки с минимальным отклонением интенсивности сигнала.
 * @param {number} Xb - Начальная координата X зоны поиска.
 * @param {number} Yb - Начальная координата Y зоны поиска.
 * @param {number} nx - Количество ячеек по оси X.
 * @param {number} ny - Количество ячеек по оси Y.
 * @param {number} xmar - Шаг по оси X между ячейками.
 * @param {number} ymar - Шаг по оси Y между ячейками.
 * @param {Array} measurements - Массив с измерениями.
 * @param {number} wL - Нижняя граница диапазона энергии.
 * @param {number} wH - Верхняя граница диапазона энергии.
 * @param {number} C - Константа для расчета интенсивности.
 * @param {number} mu - Коэффициент затухания.
 * @param {number} F_Fi - Коэффициента для преобразования координат широты.
 * @param {Array} A - Массив значений интенсивности для каждой ячейки.
 * @param {Array} AMean - Массив средних значений интенсивности для каждой ячейки.
 * @param {Array} D - Массив отклонений для каждой ячейки.
 * @param {number} NSamples - Количество сэмплов (точек измерений).
 * @returns {Object} - Объект с координатами ячейки с минимальным отклонением.
 */
const cellSelect = (Xb, Yb, nx, ny, xmar, ymar, measurements, intensities, C, mu, A, AMean, D, NSamples, useRefinedPeakAreaCalculation, RCs137, peakChannel, P0, P1) => {
  cnt = 0;
  let J0 = 0, K0 = 0;  // Инициализация переменных для хранения индексов лучшей ячейки
  let Dmin = Infinity;  // Начальное значение для минимального отклонения (для поиска минимума)
  const NStep = 1000;  // Количество шагов для нормализации интеграла
  const NN = Math.floor(NStep / 2);  // Количество промежуточных шагов для интегрирования
  let first33times = 3;
  console.log('nx, ny', nx, ny);
  // Основные циклы по сетке
  for (let j = 0; j < nx; j++) {
    const X = Xb + j * xmar;  // Вычисляем текущую координату X для ячейки
    for (let k = 0; k < ny; k++) {
      const Y = Yb + k * ymar;  // Вычисляем текущую координату Y для ячейки
      let D_local = 0;  // Локальное отклонение для текущей ячейки
      let index = j * ny + k;  // Индекс текущей ячейки

      // Цикл по сэмплам измерений (исключаем первый и последний сэмпл)
      for (let ns = 1; ns < measurements.length - 1; ns++) {

        const intensity = intensities[ns]; // Используем предрасчитанное значение интенсивности

        const measurement = measurements[ns];

/*         // Расчет интенсивности (стандартный или уточненный)
       let intensity;
        if (useRefinedPeakAreaCalculation) {
          intensity = calculatePeakArea(measurement.spectrum.channels, peakChannel, RCs137, P0, P1, true);
        } else {
          const spectrum = measurement.spectrum.channels.slice(wL, wH + 1);
          intensity = spectrum.reduce((sum, value) => sum + value, 0); // Сумма интенсивностей
        } */ 

        //const spectrum = measurement.spectrum.channels.slice(wL, wH + 1);
        //const intensity = spectrum.reduce((sum, value) => sum + value, 0);  // Сумма интенсивностей

        // Вычисление интеграла для предыдущего и следующего сэмплов
        let Integral = calculateIntegralSimpson(
          measurements[ns - 1].lat, measurements[ns - 1].lon, measurements[ns - 1].height,
          measurement.lat, measurement.lon, measurement.height,
          X, Y, 0, mu, NN
        );

        Integral += calculateIntegralSimpson(
          measurement.lat, measurement.lon, measurement.height,
          measurements[ns + 1].lat, measurements[ns + 1].lon, measurements[ns + 1].height,
          X, Y, 0, mu, NN
        );

        Integral /= 2; //NStep;  // Нормализуем интеграл по количеству шагов

        //let A_value=0;

        const ind = ns * nx * ny + index;
        if (Integral !== 0) {
          A[ind] = C * intensity / Integral;
          AMean[index] += A[ind];
        }
        D_local += (A[ind] - intensity) ** 2;

        if (first33times>0) 
        { 
          console.log('Проход ', 3-first33times,  ' Integral', Integral, ' C', C, ' intensity', intensity, 
            ' A_value', A[ind], ' ind', ind, 'D_local', D_local);
          first33times--;
        }
      }

      // Усредняем значения для текущей ячейки
      AMean[index] /= NSamples;
      D[index] = D_local / (NSamples - 1);

      // Поиск ячейки с минимальным отклонением
      if (D_local < Dmin) {

        Dmin = D_local;  // Обновляем минимальное отклонение
        console.log('DMin обновлен',  Dmin);
        J0 = j;  // Сохраняем индекс по X
        K0 = k;  // Сохраняем индекс по Y
      }
    }
  }

  return { J0, K0 };  // Возвращаем индексы ячейки с минимальным отклонением
};


/* 
const transform = (measurements, mapBounds) => {


  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  // Находим минимальные и максимальные значения широты и долготы
  for (const measurement of measurements) {
    const { lat, lon } = measurement;
    if (lat < minX) minX = lat;
    if (lat > maxX) maxX = lat;
    if (lon < minY) minY = lon;
    if (lon > maxY) maxY = lon;
  }

  console.log('minX, minY, maxX, maxY', minX, minY, maxX, maxY);
  console.log('mapBounds', mapBounds);
  let Xzone_b, Yzone_b, Xzone_e, Yzone_e;

  if (mapBounds && mapBounds._southWest && mapBounds._northEast) {
    const { _southWest, _northEast } = mapBounds;

    // Проверка на то, является ли выделенная область точкой или прямой
    const isPointOrLine =
      _southWest.lat === _northEast.lat || _southWest.lng === _northEast.lng;

    if (!isPointOrLine) {
      // Если область не является точкой или прямой, используем её
      Xzone_b = _southWest.lat;
      Yzone_b = _southWest.lng;
      Xzone_e = _northEast.lat;
      Yzone_e = _northEast.lng;

      // Корректируем минимальные значения по границам зоны поиска
      if (minX > Xzone_b) minX = Xzone_b;
      if (minY > Yzone_b) minY = Yzone_b;
    } else {
      // Если область является точкой или прямой, используем данные измерений
      console.log("Область поиска является точкой или прямой. Используем измерения.");
      Xzone_b = minX;
      Yzone_b = minY;
      Xzone_e = maxX;
      Yzone_e = maxY;
    }
  } else {
    // Если границы карты не заданы, используем данные из measurements
    Xzone_b = minX;
    Yzone_b = minY;
    Xzone_e = maxX;
    Yzone_e = maxY;
  }

  // Средняя широта для корректировки долготы
  const latMid = (Xzone_b + Xzone_e) / 2.0;
  const latFactor = Math.cos(latMid * Math.PI / 180); // Учитываем изменение масштаба для долготы в зависимости от широты

  // Преобразуем координаты измерений
  measurements.forEach((measurement) => {
    // Преобразование широты (длина одного градуса широты ~111 км)
    measurement.lat = (measurement.lat - minX) * (Math.PI / 180) * R;

    // Преобразование долготы с учетом широты
    measurement.lon = (measurement.lon - minY) * (Math.PI / 180) * R * latFactor;
  });

  // Преобразуем границы зоны поиска
  Xzone_e = (Xzone_e - minX) * (Math.PI / 180) * R; // Преобразование широты в метры
  Yzone_e = (Yzone_e - minY) * (Math.PI / 180) * R * latFactor; // Преобразование долготы с учетом широты

  return { Xzone_b: 0, Yzone_b: 0, Xzone_e, Yzone_e, minX, minY };
}; */


/**
 * Преобразование координат в метры с учетом кривизны Земли
 * @param {number} lat - широта в градусах
 * @param {number} lon - долгота в градусах
 * @returns {object} - координаты в метрах {x, y}
 */
function degToMeters(lat, lon) {
    const x = lat * (Math.PI / 180) * R;
    const y = lon * (Math.PI / 180) * R * Math.cos(lat * Math.PI / 180);
    return { x, y };
}


/**
 * Определение области поиска (bounds) по всем измерениям, если mapBounds не задан или вырожден.
 * @param {Array} measurements - Массив с измерениями (точки с координатами lat, lon).
 * @param {object} mapBounds - Область карты (границы) с параметрами _southWest и _northEast.
 * @returns {object} - Объект с корректными границами зоны поиска {_southWest: {lat, lng}, _northEast: {lat, lng}}.
 */
function defineBounds(measurements, mapBounds) {
  let minLat = Infinity, maxLat = -Infinity;
  let minLon = Infinity, maxLon = -Infinity;

  // Находим минимальные и максимальные значения широты и долготы по измерениям
  for (const measurement of measurements) {
      const { lat, lon } = measurement;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
  }

  console.log('minLat, minLon, maxLat, maxLon (по измерениям)', minLat, minLon, maxLat, maxLon);

  // Проверяем, задан ли mapBounds и не является ли область точкой или прямой
  if (mapBounds && mapBounds._southWest && mapBounds._northEast) {
      const { _southWest, _northEast } = mapBounds;

      const isPointOrLine = (_southWest.lat === _northEast.lat || _southWest.lng === _northEast.lng);

      if (!isPointOrLine) {
          // Если область корректная (не вырожденная), возвращаем mapBounds
          return mapBounds;
      }
  }

  // Если область не задана или вырожденная, возвращаем диапазон по измерениям
  return {
      _southWest: { lat: minLat, lng: minLon },
      _northEast: { lat: maxLat, lng: maxLon }
  };
}
 
/* // Функция для расчета фонового уровня с использованием трапецеидального интегрирования
const calculateBackgroundLevel = (spectrum, Nleft, Nright) => {
  const halfWidth = Math.floor((Nright - Nleft) / 2);
  const backgroundLeft = spectrum.slice(Nleft - halfWidth, Nleft).reduce((sum, value) => sum + value, 0);
  const backgroundRight = spectrum.slice(Nright, Nright + halfWidth).reduce((sum, value) => sum + value, 0);
  return (backgroundLeft + backgroundRight);
};

// Функция для расчета площади пика с учетом фонового уровня
const calculatePeakArea = (spectrum, Nleft, Nright, backgroundLevel) => {
  const peakSum = spectrum.slice(Nleft, Nright + 1).reduce((sum, value) => sum + value, 0);
  const peakArea = peakSum - backgroundLevel;
  
  // Если результат отрицательный, возвращаем 0
  return peakArea > 0 ? peakArea : 0;
};
 */

// Функция сглаживания спектра
const smoothSpectrum = (spectrum) => {
  const smoothed = [];
  for (let i = 5; i < spectrum.length - 5; i++) {
    smoothed[i] = (1 / 429) * (
      -36 * spectrum[i - 5] + 9 * spectrum[i - 4] + 44 * spectrum[i - 3] +
      69 * spectrum[i - 2] + 84 * spectrum[i - 1] + 89 * spectrum[i] +
      84 * spectrum[i + 1] + 69 * spectrum[i + 2] + 44 * spectrum[i + 3] +
      9 * spectrum[i + 4] - 36 * spectrum[i + 5]
    );
  }
  return smoothed;
};

// Функция для уточнения канала центра пика
const refinePeakCenter = (spectrum, originalPeakChannel, usePointSourceAlgorithm) => {
  if (usePointSourceAlgorithm) {
    const smoothed = smoothSpectrum(spectrum);
    const maxChannel = smoothed.indexOf(Math.max(...smoothed));
    return maxChannel >= 0 ? maxChannel : originalPeakChannel;
  }
  return originalPeakChannel;
};

// Функция для определения границ пика
const calculatePeakBounds = (N0Star, E0, RCs137, a, b) => {
  const resolutionAtE0 = RCs137 / Math.sqrt(E0);
  const width = Math.round((3 * (resolutionAtE0 * Math.sqrt(661.7) / Math.sqrt(E0) * N0Star) / 2.35) + 1);

  let Nleft = N0Star - width;
  let Nright = N0Star + width;

  // Проверка четности разности
  if ((Nright - Nleft) % 2 !== 0) {
    Nleft -= 1;
  }

  return { Nleft, Nright };
};

// Функция для расчета фонового уровня
const calculateBackgroundLevel = (spectrum, Nleft, Nright) => {
  const halfWidth = Math.floor((Nright - Nleft) / 2);

  const backgroundLeft = spectrum.slice(Nleft - halfWidth, Nleft).reduce((sum, value) => sum + value, 0);
  const backgroundRight = spectrum.slice(Nright, Nright + halfWidth).reduce((sum, value) => sum + value, 0);

  return backgroundLeft + backgroundRight;
};

// Основная функция для расчета площади пика
const calculatePeakArea = (spectrum, peakChannel, RCs137, a, b, usePointSourceAlgorithm) => {
  // Уточняем канал центра пика
  const N0Star = refinePeakCenter(spectrum, peakChannel, usePointSourceAlgorithm);
  const E0 = a * N0Star + b;

  // Определяем границы пика
  const { Nleft, Nright } = calculatePeakBounds(N0Star, E0, RCs137, a, b);

  // Вычисляем фоновый уровень
  const backgroundLevel = calculateBackgroundLevel(spectrum, Nleft, Nright);

  // Рассчитываем площадь пика
  const peakSum = spectrum.slice(Nleft, Nright + 1).reduce((sum, value) => sum + value, 0);
  const peakArea = peakSum - backgroundLevel;

  // Проверка на отрицательные значения площади
  return peakArea > 0 ? peakArea : 0;
};


export const findSourceCoordinatesInterpolate = (validMeasurements, energyRange, peakEnergy, P0, P1, mapBounds, useRefinedPeakAreaCalculation, RCs137, peakChannel) => {
  if (!validMeasurements || validMeasurements.length < 10) {
    return null; // Недостаточно данных для анализа
  }

  // Преобразование диапазона энергий в индексы спектральных каналов
  const leftIndex = Math.ceil((energyRange.low - P0) / P1);
  const rightIndex = Math.floor((energyRange.high - P0) / P1);

  console.log('leftIndex, rightIndex', leftIndex, rightIndex);

  // Физические параметры
  let mu = 0.00995; 
  let eps = 0.26; 
  const S = (1.51 * 1.51 * Math.PI) * 1.0e-4; 
  const YE = 0.85; 
  let C = 4 * Math.PI / (YE * S * eps);

  // Функция установки энергии
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

  // Устанавливаем значения mu и eps на основе энергии пика
  setEnergy(peakEnergy);

  // Определение области поиска
  if (!mapBounds || !mapBounds._southWest || !mapBounds._northEast) {
    mapBounds = defineBounds(validMeasurements, mapBounds);
  }

  const cellSize = 0.003; // Размер ячейки для интерполяции

  console.log('Определённый peakChannel:', peakChannel);

  // Создаем коллекцию точек, где в качестве свойства используем либо сумму сигналов спектра, либо площадь пика
  const pointsCollection = turf.featureCollection(
    validMeasurements.map((m) => {
      const intensity = useRefinedPeakAreaCalculation
        ? calculatePeakArea(m.spectrum.channels, peakChannel, RCs137, P0, P1, true) // Уточнённый расчет площади пика
        : m.spectrum.channels.slice(leftIndex, rightIndex + 1).reduce((sum, value) => sum + value, 0); // Стандартный расчет как сумма сигналов

      return turf.point([m.lon, m.lat], { intensity });
    })
  );

  const bounds = turf.bbox(pointsCollection);
  const expandedBounds = [
    bounds[0] - 0.01, // Уменьшаем минимальную долготу
    bounds[1] - 0.01, // Уменьшаем минимальную широту
    bounds[2] + 0.01, // Увеличиваем максимальную долготу
    bounds[3] + 0.01  // Увеличиваем максимальную широту
  ];

  // Выполнение интерполяции
  const interpolated = turf.interpolate(pointsCollection, cellSize, { gridType: 'point', property: 'intensity', bbox: expandedBounds });

  // Найти точку с максимальной интерполированной интенсивностью
  let maxInterpolatedIntensity = -Infinity;
  let maxInterpolatedPoint = null;
  for (const feature of interpolated.features) {
    if (feature.properties.intensity > maxInterpolatedIntensity) {
      maxInterpolatedIntensity = feature.properties.intensity;
      maxInterpolatedPoint = feature;
    }
  }

  if (!maxInterpolatedPoint) {
    return null; // Не удалось найти точку с максимальной интенсивностью
  }

  const [maxLon, maxLat] = maxInterpolatedPoint.geometry.coordinates;
  // Преобразование координат максимальной точки в метры
  const maxCoordsMeters = degToMeters(maxLat, maxLon);

  // Считаем расстояния до всех точек и сортируем их, чтобы найти 10 ближайших
  const distances = validMeasurements.map((measurement, index) => {
    const measurementMeters = degToMeters(measurement.lat, measurement.lon);
    const distanceSquared = (measurementMeters.x - maxCoordsMeters.x) ** 2 + 
                            (measurementMeters.y - maxCoordsMeters.y) ** 2 + 
                            measurement.height ** 2;
    return { distance: Math.sqrt(distanceSquared), index };
  }).sort((a, b) => a.distance - b.distance);

  // Берем 10 ближайших точек
  const closestPoints = distances.slice(0, 10);

  // Рассчитываем активность источника на основе ближайших 10 точек
  let totalActivity = 0;
  let totalSquaredDeviation = 0;

  closestPoints.forEach(({ distance, index }) => {
    const measurement = validMeasurements[index];
    const { spectrum } = measurement;

    let intensity;

    if (useRefinedPeakAreaCalculation) {
      intensity = calculatePeakArea(spectrum.channels, peakChannel, RCs137, P0, P1, true);
    } else {
      intensity = spectrum.channels.slice(leftIndex, rightIndex + 1).reduce((sum, value) => sum + value, 0);
    }

    console.log('distance, intensity', distance, intensity);

    // Формула для расчета активности
    const activity = intensity / (eps * S * YE * Math.exp(-mu * distance) / (4 * Math.PI * distance ** 2));
    totalActivity += activity;
    totalSquaredDeviation += (activity - totalActivity / closestPoints.length) ** 2;
  });

  const deviation = Math.sqrt(totalSquaredDeviation / closestPoints.length);

  console.log('Финальный результат: Activity:', totalActivity / closestPoints.length, 'Deviation:', deviation);

  return {
    coordinates: { lat: maxLat, lon: maxLon },
    activity: totalActivity / closestPoints.length,
    deviation: deviation
  };
};
