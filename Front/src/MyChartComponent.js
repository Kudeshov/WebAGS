import React, { useEffect, useState } from 'react';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';

function MyChartComponent() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch("http://localhost:3001/api/data")
      .then(response => response.json())
      .then(fetchedData => {
        // Преобразование формата даты и времени для удобства
        const formattedData = fetchedData.map(item => ({
          datetime: new Date(item.datetime).toLocaleString(),
          spectrumValue: item.spectrumValue,
        }));
        setData(formattedData);
      });
  }, []);

  return (
    <div style={{ width: '100%', height: '400px' }}>
      <LineChart width={800} height={400} data={data}>
        <Line type="monotone" dataKey="spectrumValue" stroke="#8884d8" />
        <CartesianGrid stroke="#ccc" />
        <XAxis dataKey="datetime" />
        <YAxis />
        <Tooltip />
      </LineChart>
    </div>
  );
}

export default MyChartComponent;
