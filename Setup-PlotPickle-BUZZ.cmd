@echo off
setlocal
cd /d "%~dp0"
title PlotPickle / BUZZ One-Time Community Setup
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-buzz-community.ps1"
set "PLOTPICKLE_SETUP_EXIT=%ERRORLEVEL%"
echo.
if not "%PLOTPICKLE_SETUP_EXIT%"=="0" echo Setup stopped with exit code %PLOTPICKLE_SETUP_EXIT%.
pause
exit /b %PLOTPICKLE_SETUP_EXIT%
