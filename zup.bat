@echo off
setlocal

REM ����砥� ⥪���� ���� � �ଠ� YYYYMMDD � ������� PowerShell
for /f %%i in ('powershell -Command "Get-Date -Format yyyyMMdd"') do set mydate=%%i

REM ����뢠�� ��� ��娢�
set "outputZip=webags_%mydate%.zip"

REM ��६�頥��� � ⥪���� ��४���
cd /d "%~dp0"

REM ������� zip-��娢 ��� ����� � ⥪�饩 ��४�ਨ, �᪫��� node_modules � ��⮢� �����

zip -r "%outputZip%" . -x "node_modules/*" ".git/*" "*/.git/*" "*/node_modules/*"

echo ��娢�஢���� �����襭�. ��娢 ᮧ���: %outputZip%
pause
