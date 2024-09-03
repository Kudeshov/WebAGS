@echo off
setlocal

REM Получаем текущую дату в формате YYYYMMDD с помощью PowerShell
for /f %%i in ('powershell -Command "Get-Date -Format yyyyMMdd"') do set mydate=%%i

REM Указываем имя архива
set "outputZip=webags_%mydate%.zip"

REM Перемещаемся в текущую директорию
cd /d "%~dp0"

REM Создаем zip-архив всех папок в текущей директории, исключая node_modules и гитовые папки

zip -r "%outputZip%" . -x "node_modules/*" ".git/*" "*/.git/*" "*/node_modules/*"

echo Архивирование завершено. Архив создан: %outputZip%
pause
