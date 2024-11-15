import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

function SpectrumChartCalibration({ data, P0, P1, leftBound, rightBound, oldPeak, newPeak }) {
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: []
  });

  useEffect(() => {
    // Проверяем, что значения oldPeak и newPeak определены, если нет, выводим предупреждение
    if (oldPeak === undefined || newPeak === undefined) {
      console.warn("Old Peak or New Peak values are not defined");
      return;
    }

    // Выводим энергии пиков в консоль для отладки
    console.log("Old Peak Energy:", oldPeak);
    console.log("New Peak Energy:", newPeak);

    // Формируем данные для графика с выделенной зоной интереса и пиками
    const fullChartData = {
      labels: data.map((_, index) => calculateEnergy(index, P0, P1)),
      datasets: [
        {
          label: 'Спектр',
          data: data.map(point => point.value),
          borderColor: 'rgba(0, 0, 255, 1)',
          pointRadius: 0,
          tension: 0.1,
          fill: false, // Убираем закраску под графиком
        },
        {
          label: 'Зона интереса',
          data: data.map((point, index) => {
            const energy = calculateEnergy(index, P0, P1);
            return energy >= leftBound && energy <= rightBound ? point.value : null;
          }),
          backgroundColor: 'rgba(0, 128, 255, 0.2)', // Закрашиваем только зону интереса
          pointRadius: 0,
          fill: true,
          borderWidth: 0
        },
/*         {
          label: 'Старый пик',
          data: [{ x: oldPeak, y: getPeakValue(data, oldPeak, P0, P1) }],
          borderColor: 'rgba(255, 0, 0, 1)', // Красная точка для старого пика
          borderWidth: 2,
          pointRadius: 5,
          showLine: false, // Показываем только точку, а не линию
        }, */
        {
          label: 'Новый пик',
          data: [{ x: newPeak, y: getPeakValue(data, newPeak, P0, P1) }],
          borderColor: 'rgba(0, 200, 0, 1)', // Зеленая точка для нового пика
          borderWidth: 2,
          pointRadius: 5,
          showLine: false, // Показываем только точку, а не линию
        }
      ]
    };
    

    setChartData(fullChartData);
  }, [data, P0, P1, leftBound, rightBound, oldPeak, newPeak]);

  // Определяем энергию для каждого индекса
  function calculateEnergy(index, P0, P1) {
    return P0 + P1 * index;
  }

  // Получаем значение скорости счета для заданной энергии
  function getPeakValue(data, peakEnergy, P0, P1) {
    // Находим ближайший индекс для заданной энергии
    const index = Math.round((peakEnergy - P0) / P1);
    return data[index] ? data[index].value : 0;
  }

  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        callbacks: {
          title: (tooltipItems) => `Энергия: ${tooltipItems[0].label} keV`,
          label: (tooltipItem) => {
            if (tooltipItem.datasetIndex === 0) {
              const channel = tooltipItem.dataIndex;
              const countRate = tooltipItem.raw.toFixed(2);
              return `Канал: ${channel + 1}, Скорость счета: ${countRate} 1/с`;
            }
            return null;
          }
        }
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'xy',
        },
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true
          },
          mode: 'xy',
        }
      }
    },
    scales: {
      x: {
        type: 'linear',
        title: {
          display: true,
          text: 'Энергия (keV)'
        },
        min: leftBound,
        max: rightBound,
      },
      y: {
        title: {
          display: true,
          text: 'Скорость счета 1/с'
        }
      }
    }
  };

  return <Line data={chartData} options={options} />;
}

export default SpectrumChartCalibration;
