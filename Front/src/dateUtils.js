export function convertDateTime(dateTimeString) {

  if (!dateTimeString)
    return;
  const date = new Date(dateTimeString);

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Месяцы начинаются с 0
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');

  return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
}

export function convertToTime(dateTimeStr) {
  const date = new Date(dateTimeStr);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  
  return `${hours}:${minutes}:${seconds}`;
}

export function convertDateTimeWithoutSeconds(dateTimeString) {
  if (!dateTimeString) return;

  const date = new Date(dateTimeString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Месяцы начинаются с 0
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  // Возвращаем строку даты и времени без секунд
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}
