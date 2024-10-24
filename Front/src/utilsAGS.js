// utilsAGS.js
export const calculatePeakBounds = (energyPeak, spectrometerResolutionPercent) => {
    const spectrometerResolution = spectrometerResolutionPercent / 100; // Преобразуем в коэффициент
  
    // Эталонная энергия для Cs-137
    const energyCs137 = 661.7; // кэВ
  
    // Ширина пика на полувысоте для Cs-137
    const FWHM_Cs137 = spectrometerResolution * energyCs137;
  
    // Стандартное отклонение для Cs-137 (sigma)
    const sigmaCs137 = FWHM_Cs137 / 2.35;
  
    // Стандартное отклонение для произвольной энергии на основе зависимости 1/sqrt(E)
    const sigmaCurrent = sigmaCs137 * Math.sqrt(energyPeak / energyCs137);
  
    // Границы пика ±3sigma
    const leftBound = energyPeak - 3 * sigmaCurrent;
    const rightBound = energyPeak + 3 * sigmaCurrent;
  
    return {
      leftBound: leftBound.toFixed(2), // округление до 2 знаков
      rightBound: rightBound.toFixed(2)
    };
  };
  