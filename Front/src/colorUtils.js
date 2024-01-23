import { rgb } from 'd3-color';

export function getColor(value, doseLow, doseHigh) {
  const diff = 1 - (doseHigh - value) / (doseHigh - doseLow);
  let r = 0;
  let g = 0;
  let b = 255;

    //blue to green
    if (diff >= 0 && diff <= 0.33) {
      g = 255 * diff / 0.33;
      r = 0;
      b = 255 * (0.33 - diff) / 0.33;
    }
    //green to yellow
    else if (diff > 0.33 && diff <= 0.66) {
      b = 0;
      g = 255;
      r = 255 * (diff - 0.33) / 0.33;
    }
    //yellow to red
    else if (diff > 0.66 && diff <= 1) {
      g = 255 * (1 - diff) / 0.33;
      r = 255;
      b = 0;
    }

    const color = rgb(r, g, b);
    return color.toString();
}

export function createGradient(doseLow, doseHigh) {
  const steps = 10; // Количество шагов в градиенте
  let gradient = '';

  for (let i = 0; i <= steps; i++) {
    const value = doseLow + (doseHigh - doseLow) * (i / steps);
    const color = getColor(value, doseLow, doseHigh);
    gradient += `${color} ${i * 10}%,`;
  }
  return gradient.slice(0, -1); // Удаляем последнюю запятую
}

export function getColorT(value, thresholds, doseLow, doseHigh) {
  let r = 0, g = 0, b = 255; // Стартуем с синего

  if (value > doseLow && value <= thresholds.v0) {
    // Значение между doseLow и v0: синий
    r = 0; g = 0; b = 255;
  } else if (value > thresholds.v0 && value <= thresholds.v1) {
    // Переход от синего к зеленому
    let diff = (value - thresholds.v0) / (thresholds.v1 - thresholds.v0);
    r = 0; g = 255 * diff; b = 255 * (1 - diff);
  } else if (value > thresholds.v1 && value <= thresholds.v2) {
    // Переход от зеленого к желтому
    let diff = (value - thresholds.v1) / (thresholds.v2 - thresholds.v1);
    r = 255 * diff; g = 255; b = 0;
  } else if (value > thresholds.v2 && value <= thresholds.v3) {
    // Переход от желтого к красному
    let diff = (value - thresholds.v2) / (thresholds.v3 - thresholds.v2);
    r = 255; g = 255 * (1 - diff); b = 0;
  } else if (value > thresholds.v3 && value <= doseHigh) {
    // Значение больше v3: красный
    r = 255; g = 0; b = 0;
  }

  return rgb(r, g, b).toString();
}

export function createGradientT(thresholds, doseLow, doseHigh) {
  const steps = 100; // Большее количество шагов для плавного перехода
  let gradient = '';

  for (let i = 0; i <= steps; i++) {
    const value = doseLow + (doseHigh - doseLow) * (i / steps);
    const color = getColorT(value, thresholds, doseLow, doseHigh);
    gradient += `${color} ${i * 100 / steps}%,`;
  }

  return gradient.slice(0, -1); // Удаляем последнюю запятую
}

export function calculateColorThresholds(minDose, maxDose) {
  const roundedDownMinDoseValue = Math.floor(minDose * 100) / 100;
  const roundedUpMaxDoseValue = Math.ceil(maxDose * 100) / 100;
  console.log('calculateColorThresholds', minDose, maxDose, roundedDownMinDoseValue, roundedUpMaxDoseValue);
  return {
    v0: roundedDownMinDoseValue.toFixed(2),
    v1: (minDose + (maxDose - minDose) * 0.333333).toFixed(2),
    v2: (minDose + (maxDose - minDose) * 0.666666).toFixed(2),
    v3: roundedUpMaxDoseValue.toFixed(2),
  };
}

// Функция для расчета масштабированных пороговых значений цвета
export function calculateScaledThresholds(originalThresholds, originalMinDose, originalMaxDose, newMinDose, newMaxDose) {
  const originalRange = originalMaxDose - originalMinDose;
  const newRange = newMaxDose - newMinDose;

  // Масштабирование каждого порога
  const scaledThresholds = {
    v0: ((originalThresholds.v0 - originalMinDose) / originalRange) * newRange + newMinDose,
    v1: ((originalThresholds.v1 - originalMinDose) / originalRange) * newRange + newMinDose,
    v2: ((originalThresholds.v2 - originalMinDose) / originalRange) * newRange + newMinDose,
    v3: ((originalThresholds.v3 - originalMinDose) / originalRange) * newRange + newMinDose,
  };

  return scaledThresholds;
};
