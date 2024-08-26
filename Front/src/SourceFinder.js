const integrate = require('integrate-adaptive-simpson');

export const findSourceCoordinates3D = (measurements, energyRange, peakEnergy, P0, P1, mapBounds) => {
  const wL = Math.round((energyRange.low - P0) / P1);
  const wH = Math.round((energyRange.high - P0) / P1);

  // Физические параметры
  let mu = 0.00995; 
  let eps = 0.26; 
  const S = (1.51 * 1.51 * Math.PI) * 1.0e-4; 
  const YE = 0.85; 
  let C = 4 * Math.PI / (YE * S * eps);

  console.log('Предварительное вычисление C=',C,' YE=',YE,' eps=',eps);

  // Константы преобразования
  const Mr = 6367449.0;
  const LDEG = 110900.0;

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

  console.log('Вычисление C=',C,'peakEnergy=',peakEnergy,' YE=',YE,' eps=',eps);

  // Определение количества используемых сэмплов, исключая первый и последний элементы
  const NSamples = measurements.length - 2;


  console.log('Количество точек без двух крайних NSamples=',NSamples);

  // Преобразуем координаты 
  console.log( 'Исходные координаты точки 0, градусы', measurements[0].lat, measurements[0].lon );
  const { Xzone_b, Yzone_b, Xzone_e, Yzone_e, minX, minY } = transform(measurements, mapBounds);
  console.log( 'Преобразованные координаты точки 0, метры', measurements[0].lat, measurements[0].lon );
  console.log('Прямоугольник в м: Xzone_b ', Xzone_b,'Xzone_e ', Xzone_e, 'Yzone_b ', Yzone_b, 'Yzone_e ', Yzone_e);
 
 
  const nx = 21;
  const ny = 21;

  let xmar = (Xzone_e - Xzone_b) / (nx - 1);
  let ymar = (Yzone_e - Yzone_b) / (ny - 1);
  
  console.log( 'Шаг грубой сетки, м (x,y)', xmar, ymar );
  let sourceCoordinates = { lat: 0, lon: 0 };

  let A = new Array(nx * ny).fill(0);
  let AMean = new Array(nx * ny).fill(0);
  let D = new Array(nx * ny).fill(0);

  // Вызов функции для начальной грубой сетки
  console.log('Xzone_b, Yzone_b, nx, ny, xmar, ymar', Xzone_b, Yzone_b, nx, ny, xmar, ymar);
  console.log('wL, wH, C, mu', wL, wH, C, mu);

  const { J0, K0 } = cellSelect(Xzone_b, Yzone_b, nx, ny, xmar, ymar, measurements, wL, wH, C, mu, LDEG, A, AMean, D, NSamples);

  console.log( 'Грубая оценка - индексы квадрата', J0, K0 );
  // Плотная сетка на основе первых вычислений
  const X0 = Xzone_b + J0 * xmar;
  const Y0 = Yzone_b + K0 * ymar;
  
  xmar = 2 * xmar / (nx - 1);
  ymar = 2 * ymar / (ny - 1);

  console.log( 'Шаг плотной сетки, м (x,y)', xmar, ymar );

  const refinedSelect = cellSelect(X0 - xmar, Y0 - ymar, nx, ny, xmar, ymar, measurements, wL, wH, C, mu, LDEG, A, AMean, D, NSamples);

  console.log( 'Уточненная оценка, индексы квадрата', refinedSelect );
//  console.log( 'A', A );

  sourceCoordinates.lat = (X0 / ((Math.PI / 180) * 6371000)) + minX;  // Обратное преобразование широты
  sourceCoordinates.lon = (Y0 / ((Math.PI / 180) * 6371000 * Math.cos(minX * Math.PI / 180))) + minY;  // Обратное преобразование долготы с учетом широты
  
  console.log( 'Координаты источника: ', sourceCoordinates );

  const bestIndex = refinedSelect.J0 * ny + refinedSelect.K0;

  let a3 = 0;
  /* 
  let totalD = 0.0;

  // 1. Расчет активности a1 (по формуле, аналогичной C++)
  let sda = 0.0;
  let a1 = 0.0;
  for (let i = 0; i < NSamples; i++) {
    sda += 1 / dA[i * nx * ny + bestIndex];
  }

  for (let i = 0; i < NSamples; i++) {
    const index = i * nx * ny + bestIndex;
    a1 += A[index] / (dA[index] * sda);
  } */

  // 2. Расчет активности по ближайшей точке (a3)
/*   let minDist = Infinity;
  let closestIndex = 0;

  for (let i = 0; i < NSamples; i++) {
    const dist = (measurements[i].lat - X0) ** 2 + (measurements[i].lon - Y0) ** 2;
    if (dist < minDist) {
      minDist = dist;
      closestIndex = i;
    }
  }

  const closestInd = closestIndex * nx * ny + bestIndex;
  a3 = A[closestInd]; */

  
  let minDist = Infinity;
  let closestIndex = -1;
  // Поиск ближайшей точки с ненулевым значением A
  console.log('---Поиск ближайшей точки с ненулевым значением A---');
  for (let ns = 1; ns < measurements.length - 1; ns++) {
    const dist = (measurements[ns].lat - X0) ** 2 + (measurements[ns].lon - Y0) ** 2;
    const closestInd = ns * nx * ny + refinedSelect.J0 * ny + refinedSelect.K0; // Правильный индекс для точки 
    if (dist < minDist) {
      if ( A[closestInd] !== 0 )
      {
        console.log('dist', dist, 'minDist', minDist, 'A[closestInd]', A[closestInd], measurements[ns]);
        minDist = dist;
        closestIndex = ns;
      }
      else
      {
        console.log('В точке dist ',dist, ' closestInd ', closestInd, ' нулевое значение А', measurements[ns], ''); 
      }
    }
  }

  // Если найдено ненулевое значение
  if (closestIndex !== -1) {
    const closestInd = closestIndex * nx * ny + bestIndex;
    a3 = A[closestInd];
  } else {
    console.log("Ненулевое значение в массиве A не найдено.");
    a3 = 0; // Обработка случая, если ненулевые значения не найдены
  }
 
  // 3. Вычисление отклонения da
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

  // Определяем функцию, которую будем интегрировать
  const integrand = (t) => {
    // Промежуточные координаты с параметром t [0, 1] для линейной интерполяции между двумя точками
    const x = x1 + t * (x2 - x1);
    const y = y1 + t * (y2 - y1);
    const z = z1 + t * (z2 - z1);

    // Вычисляем расстояние до текущей ячейки сетки
    const r = Math.sqrt((x - X) ** 2 + (y - Y) ** 2 + (z - Z) ** 2);

    // Если r близко к 0, возвращаем небольшое значение, чтобы избежать деления на 0
    if (r === 0) return 1e-10;

    if (cnt < 10 /* && (mu * r)>1 */ ) {
      console.log('mu * r=', mu * r, 'mu=', mu, 'r=', r, 'z=', z, 'Math.exp(-mu * r) / r ** 2', Math.exp(-mu * r) / r ** 2);
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
 * @param {number} LDEG - Коэффициент для преобразования координат долготы.
 * @param {Array} A - Массив значений интенсивности для каждой ячейки.
 * @param {Array} AMean - Массив средних значений интенсивности для каждой ячейки.
 * @param {Array} D - Массив отклонений для каждой ячейки.
 * @param {number} NSamples - Количество сэмплов (точек измерений).
 * @returns {Object} - Объект с координатами ячейки с минимальным отклонением.
 */
const cellSelect = (Xb, Yb, nx, ny, xmar, ymar, measurements, wL, wH, C, mu, LDEG, A, AMean, D, NSamples) => {
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
        const measurement = measurements[ns];
        const spectrum = measurement.spectrum.channels.slice(wL, wH + 1);
        const intensity = spectrum.reduce((sum, value) => sum + value, 0);  // Сумма интенсивностей

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

/*         if (first3times>0) // отладка
          { 
 
            let Integral1 = calculateIntegralTr(
              measurements[ns - 1].lat, measurements[ns - 1].lon, measurements[ns - 1].alt,
              measurements[ns].lat, measurements[ns].lon, measurements[ns].alt,
              X, Y, 0, mu, NN
            );
    
            Integral1 += calculateIntegralTr(
              measurements[ns].lat, measurements[ns].lon, measurements[ns].alt,
              measurements[ns + 1].lat, measurements[ns + 1].lon, measurements[ns + 1].alt,
              X, Y, 0, mu, NN
            );
    
            Integral1 /=  NStep;  // Нормализуем интеграл по количеству шагов
            console.log('Integral compare Trap / Simps', Integral , Integral1);
          } */
        
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

        /* 
        if (Integral===0)
        {
          console.log('null integral');
        }
        else
        {
          // Рассчитываем значение A и среднее AMean
          A_value = C * intensity / Integral;  // Интенсивность для текущей ячейки
 
          A[index] = A_value;  // Сохраняем значение A для текущей ячейки
          AMean[index] += A_value;  // Обновляем среднее значение интенсивности

          if (first3times>0) // отладка - показать первые три расчета
          { 
            console.log('Проход ', 4-first3times,  'A_value = C * intensity / Integral; Integral', Integral, ' C', C, ' intensity', intensity, 
              ' A_value', A_value, ' index', index);
            first3times--;
          }
        }
 
        // Добавляем квадрат отклонения в локальное значение D_local
        D_local += (A_value - intensity) ** 2;*/

        
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

const transform = (measurements, mapBounds) => {
  const R = 6371000.0; // Радиус Земли в метрах
  //const LDEG = 111320.0; // Средняя длина одного градуса долготы на экваторе в метрах

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
};
