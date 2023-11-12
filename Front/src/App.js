//import logo from './logo.svg';
import './App.css';
import MyMapComponent from './MyMapComponent';
import MyChartComponent from './MyChartComponent';
import CustomToolbar from './CustomToolbar';


function App() {
  return (
    <div className="App">
       <CustomToolbar/>
      <h1>Веб Аэрогаммасъемка</h1>
      {/* <MyChartComponent /> */}
      <MyMapComponent />
    </div>
  );
}

export default App;
