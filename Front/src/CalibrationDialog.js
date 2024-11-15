import React, { useState, useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField
} from '@mui/material';
import SpectrumChartCalibration from './SpectrumChartCalibration';

const calculateAverageSpectrum = (selectedPoints, P0, P1) => {
  if (!selectedPoints || selectedPoints.length === 0) {
    return [];
  }

  const sumSpectrum = Array(selectedPoints[0]?.spectrum?.channels.length || 0).fill(0);
  selectedPoints.forEach((point) => {
    point.spectrum.channels.forEach((value, index) => {
      sumSpectrum[index] += value;
    });
  });
  
  return sumSpectrum.map((value, index) => ({
    energy: P0 + P1 * index,
    value: value / selectedPoints.length,
    count: value
  }));
};

function CalibrationDialog({
  open,
  onClose,
  initialCoefficients,
  selectedDatabase,
  selectedPoints,
  saveCollectionParams,
  leftBound,
  rightBound,
  oldPeakEnergy, // добавляем старый пик
  newPeakEnergy  // добавляем новый пик
}) {
  const [P0, setP0] = useState(Number(initialCoefficients.P0));
  const [P1, setP1] = useState(Number(initialCoefficients.P1));
  const [averageSpectrum, setAverageSpectrum] = useState([]);


  console.log('Peaks', oldPeakEnergy,newPeakEnergy);

  useEffect(() => {
    setP0(Number(initialCoefficients.P0));
    setP1(Number(initialCoefficients.P1));
    
    if (selectedPoints && selectedPoints.length > 0) {
      const calculatedAverageSpectrum = calculateAverageSpectrum(
        selectedPoints, 
        parseFloat(initialCoefficients.P0), 
        parseFloat(initialCoefficients.P1)
      );
      setAverageSpectrum(calculatedAverageSpectrum);
    }
  }, [initialCoefficients, selectedPoints]);

  const handleSave = () => {
    const updatedCoefficients = {
      P0: parseFloat(P0),
      P1: parseFloat(P1)
    };

    saveCollectionParams(selectedDatabase, {
      _id: initialCoefficients._id,
      P0: updatedCoefficients.P0,
      P1: updatedCoefficients.P1
    });

    onClose(true, updatedCoefficients);
  };

  const handleCancel = () => {
    onClose(false);
  };

  const handleP0Change = (e) => {
    const value = e.target.value;
    if (!isNaN(value) && /^-?\d*\.?\d*$/.test(value)) {
      setP0(value);
    }
  };

  const handleP1Change = (e) => {
    const value = e.target.value;
    if (!isNaN(value) && /^-?\d*\.?\d*$/.test(value)) {
      setP1(value);
    }
  };

  return (
    <Dialog open={open} onClose={handleCancel}>
      <DialogTitle>Энергетическая калибровка</DialogTitle>
      <DialogContent>
        <TextField
          margin="dense"
          id="P0"
          label="P0"
          type="text"
          fullWidth
          variant="outlined"
          size="small"
          inputProps={{ inputMode: 'decimal' }}
          value={P0}
          onChange={handleP0Change}
        />
        <TextField
          margin="dense"
          id="P1"
          label="P1"
          type="text"
          fullWidth
          variant="outlined"
          size="small"
          inputProps={{ inputMode: 'decimal' }}
          value={P1}
          onChange={handleP1Change}
        />

        <SpectrumChartCalibration
          data={averageSpectrum}
          P0={parseFloat(P0)}
          P1={parseFloat(P1)}
          leftBound={parseFloat(leftBound)}
          rightBound={parseFloat(rightBound)}
          oldPeak={oldPeakEnergy} // передаем старый пик
          newPeak={newPeakEnergy}  // передаем новый пик
        />        
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} variant="outlined">Отмена</Button>
        <Button onClick={handleSave} variant="contained" color="primary">Сохранить</Button>
      </DialogActions>
    </Dialog>
  );
}

export default CalibrationDialog;
