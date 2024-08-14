// sourceFinder.js
export const findSourceCoordinates = (measurements, energyRange, P0, P1) => {
    const wL = Math.round((energyRange.low - P0) / P1);
    const wH = Math.round((energyRange.high - P0) / P1);

    // Физические параметры
    const mu = 0.00995; 
    const eps = 0.26; 
    const S = (1.51 * 1.51 * Math.PI) * 1.0e-4; 
    const YE = 0.85; 
    const C = 4 * Math.PI / (YE * S * eps);

    // Границы зоны поиска
    let Xzone_b = Math.min(...measurements.map(m => m.lat));
    let Xzone_e = Math.max(...measurements.map(m => m.lat));
    let Yzone_b = Math.min(...measurements.map(m => m.lon));
    let Yzone_e = Math.max(...measurements.map(m => m.lon));

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

                const ri = (measurement.lat - X) ** 2 + (measurement.lon - Y) ** 2 + (measurement.alt - measurement.height) ** 2;
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

    return {
        coordinates: sourceCoordinates,
        activity: a3,
        deviation: da
    };
}
