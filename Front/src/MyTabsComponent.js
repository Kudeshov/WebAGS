import React, { useState, useEffect, useContext } from 'react';
import { Tabs, Tab } from '@mui/material';
import { FlightContext } from './App';
import Typography from '@mui/material/Typography'; // Import Typography

const MyTabsComponent = () => {

  const { selectedFlight } = useContext(FlightContext);

  const [selectedTab, setSelectedTab] = useState(0);
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/collection/${selectedFlight}`);
        if (!response.ok) {
          throw new Error(`Ошибка HTTP: статус ${response.status}`);
        }
        const jsonData = await response.json();
        setData(jsonData);
      } catch (error) {
        console.error('Ошибка при получении данных:', error);
      }
    };

    fetchData();
  }, [selectedTab]);

  const handleChange = (event, newValue) => {
    setSelectedTab(newValue);
  };

  return (
    <div>
      <Tabs value={selectedTab} onChange={handleChange}>
        <Tab label="Данные измерения"> 
        </Tab>

        <Tab label="Настройки карты" />
        <Tab label="Поиск источника" />
      </Tabs>

      {selectedTab === 0 && (
        <Typography component="div" sx={{ p: 3 }}>
          {/* Отображение данных для первой вкладки */}
          <p>Время измерения: 1 сек <br />
             Счёт в окне: 92 имп/с<br />
              Высота: 7.6 м<br />
              Мощность дозы на высоте 1м: 0.978695 мкЗв/час<br />
              Счётик ГМ: 0 имп/с<br />
              Мощность Дозы ГМ: 0 мкЗв/час<br /></p>
        </Typography>
      )}

      {selectedTab === 1 && (
        <Typography component="div" sx={{ p: 3 }}>
          {/* Контент для второй вкладки */}
          <p>Настройки карты...</p>
        </Typography>
      )}

      {selectedTab === 2 && (
        <Typography component="div" sx={{ p: 3 }}>
          {/* Контент для третьей вкладки */}
          <p>Поиск источника...</p>
        </Typography>
      )}
    </div>
  );
};

export default MyTabsComponent;