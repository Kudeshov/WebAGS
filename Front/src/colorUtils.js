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


/* 
export function getColor(value, doseLow, doseHigh) {
    const diff = 1 - (doseHigh - value) / (doseHigh - doseLow);
    let r = 0;
    let g = 0;
    let b = 255;
  
    //blue to green
    if (diff >= 0 && diff <= 0.25) {
      g = 255 * diff / 0.25;
      r = 0;
      b = 255 * (0.25 - diff) / 0.25;
    }
    //green to yellow
    else if (diff > 0.25 && diff <= 0.5) {
      b = 0;
      g = 255;
      r = 255 * (diff - 0.25) / 0.25;
    }
    //yellow
    else if (diff > 0.5 && diff <= 0.75) {
      r = 255;
      g = 255;
      b = 0;
    }
    //yellow to red
    else if (diff > 0.75 && diff <= 1) {
      g = 255 * (1 - diff) / 0.25;
      r = 255;
      b = 0;
    }
  
    const color = rgb(r, g, b);
    return color.toString();
  } */