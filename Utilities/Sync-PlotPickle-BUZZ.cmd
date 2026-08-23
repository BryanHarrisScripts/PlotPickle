@echo off
setlocal
cd /d "%~dp0.."
title PlotPickle / BUZZ Agent Sync
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\setup-buzz-community.ps1"
set "PLOTPICKLE_UTILITY_EXIT=%ERRORLEVEL%"
echo.
if not "%PLOTPICKLE_UTILITY_EXIT%"=="0" echo Sync stopped with exit code %PLOTPICKLE_UTILITY_EXIT%.
pause
exit /b %PLOTPICKLE_UTILITY_EXIT%
