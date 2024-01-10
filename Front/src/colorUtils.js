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