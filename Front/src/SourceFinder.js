// sourceFinder.js
export const findSourceCoordinates = (validMeasurements, energyRange, P0, P1) => {
    let weightedLatSum = 0;
    let weightedLonSum = 0;
    let totalWeight = 0;
  
    const leftIndex = Math.ceil((energyRange.low - P0) / P1);
    const rightIndex = Math.floor((energyRange.high - P0) / P1);
  
    validMeasurements.forEach(measure => {
      const { lat, lon, spectrum: { channels } } = measure;
  
      // Рассчитываем суммарную интенсивность в заданном диапазоне энергий
      let intensitySum = 0;
      for (let i = leftIndex; i <= rightIndex; i++) {
        intensitySum += channels[i];
      }
  
      // Используем интенсивность как вес для координат
      weightedLatSum += lat * intensitySum;
      weightedLonSum += lon * intensitySum;
      totalWeight += intensitySum;
    });
  
    if (totalWeight === 0) {
      return null; // Нет значимых данных для поиска источника
    }
  
    // Вычисляем средневзвешенные координаты
    const sourceLat = weightedLatSum / totalWeight;
    const sourceLon = weightedLonSum / totalWeight;
  
    return { lat: sourceLat, lon: sourceLon };
  };
  