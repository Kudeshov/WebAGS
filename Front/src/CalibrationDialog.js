import React, { useState, useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField
} from '@mui/material';

function CalibrationDialog({ open, onClose, initialCoefficients, selectedDatabase, saveCollectionParams }) {
  const [P0, setP0] = useState(Number(initialCoefficients.P0));
  const [P1, setP1] = useState(Number(initialCoefficients.P1));

  // Обновляем значения P0 и P1 при изменении initialCoefficients
  useEffect(() => {
    setP0(Number(initialCoefficients.P0));
    setP1(Number(initialCoefficients.P1));
  }, [initialCoefficients]);

  const handleSave = () => {
    // Создаем объект с новыми коэффициентами
    const updatedCoefficients = {
      P0: parseFloat(P0),
      P1: parseFloat(P1)
    };

    // Добавляем отладочную информацию
    console.log("Сохраняем параметры коллекции:", {
      dbName: selectedDatabase,
      collectionId: initialCoefficients._id, // Если collectionId находится внутри initialCoefficients
      P0: updatedCoefficients.P0,
      P1: updatedCoefficients.P1
    });

    // Сохраняем их через переданную функцию
    saveCollectionParams(selectedDatabase, {
      _id: initialCoefficients._id, // Если collectionId передается как _id в initialCoefficients
      P0: updatedCoefficients.P0,
      P1: updatedCoefficients.P1
    });

    // Закрываем диалог с подтверждением (true означает, что нужно обновить значения)
    onClose(true, updatedCoefficients);
  };

  const handleCancel = () => {
    // Закрываем диалог без сохранения
    onClose(false);
  };

  return (
    <Dialog open={open} onClose={handleCancel}>
      <DialogTitle>Энергетическая калибровка</DialogTitle>
      <DialogContent>
        <TextField
          margin="dense"
          id="P0"
          label="P0"
          type="number"
          fullWidth
          variant="outlined"
          value={P0}
          onChange={(e) => setP0(Number(e.target.value))}
        />
        <TextField
          margin="dense"
          id="P1"
          label="P1"
          type="number"
          fullWidth
          variant="outlined"
          value={P1}
          onChange={(e) => setP1(Number(e.target.value))}
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
