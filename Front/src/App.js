//import logo from './logo.svg';
import './App.css';
import MyDataGrid from './MyDataGrid';
import MyMapComponent from './MyMapComponent';


function App() {
  return (
    <div className="App">
      <h1>Веб Аэрогаммасъемка</h1>
      <MyMapComponent />
      <MyDataGrid />
    </div>
  );
}

export default App;
