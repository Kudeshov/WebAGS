import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [simulationData, setSimulationData] = useState('');
  const [websocket, setWebsocket] = useState(null);
  const [flightId, setFlightId] = useState(null); // Состояние для хранения ID полета

  const startSimulation = () => {
    fetch('http://localhost:3001/start-flight-simulation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ dbName: "Могильник" })
    })
    .then(response => response.json()) // Преобразование ответа в JSON
    .then(data => {

      console.log('Ответ сервера', data);
      if (data && data.flightId) {
        console.log('data.flightId', data.flightId);
        setFlightId(data.flightId); // Сохраняем ID полета
        const ws = new WebSocket('ws://localhost:3001');
        setWebsocket(ws);
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          // Обработка данных, полученных через WebSocket
          console.log(data)
          setSimulationData(`Дата: ${data.datetime}, Координаты: широта ${data.lat}, долгота ${data.lon}, высота ${data.alt}`);
        };
  
        ws.onopen = () => {
          console.log('WebSocket соединение установлено');
        };
  
        ws.onerror = (error) => {
          console.error('Ошибка WebSocket:', error);
        };
      } else {
        console.error('Ошибка: ID полета не получен');
      }
    })
    .catch(error => {
      console.error('Ошибка запуска эмуляции:', error);
    });
  };

const stopSimulation = () => {
  if (!flightId) {
    console.error('Ошибка: ID симуляции отсутствует');
    return;
  }

  fetch('http://localhost:3001/stop-flight-simulation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ flightId })
  })
  .then(response => {
    if(response.ok) {
      // Действия после успешного останова симуляции
      setFlightId(null); // Сброс ID симуляции
      if (websocket) {
        websocket.close();
        setWebsocket(null);
      }
    } else {
      console.error('Ошибка остановки эмуляции: HTTP-статус', response.status);
    }
  })
  .catch(error => {
    console.error('Ошибка остановки эмуляции:', error);
  });
};

  return (
    <div className="App">
      <header className="App-header">
        <h1>Тестовое Приложение Эмуляции</h1>
        <button onClick={startSimulation}>Запуск Эмуляции</button>
        <button onClick={stopSimulation}>Останов Эмуляции</button>
        <div>
          Данные эмуляции: {simulationData}
        </div>
      </header>
    </div>
  );
}

export default App;