@echo off
setlocal
cd /d "%~dp0"
title PlotPickle / BUZZ Community Cleanup
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Clean-PlotPickle-BUZZ.ps1"
set "PLOTPICKLE_UTILITY_EXIT=%ERRORLEVEL%"
echo.
if not "%PLOTPICKLE_UTILITY_EXIT%"=="0" echo Cleanup stopped with exit code %PLOTPICKLE_UTILITY_EXIT%.
pause
exit /b %PLOTPICKLE_UTILITY_EXIT%
