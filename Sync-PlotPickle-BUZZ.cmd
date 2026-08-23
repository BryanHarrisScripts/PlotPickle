@echo off
setlocal
cd /d "%~dp0"
title PlotPickle / BUZZ Agent Sync
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Utilities\Sync-PlotPickle-BUZZ.ps1"
set "PLOTPICKLE_SYNC_EXIT=%ERRORLEVEL%"
echo.
if not "%PLOTPICKLE_SYNC_EXIT%"=="0" echo Sync stopped with exit code %PLOTPICKLE_SYNC_EXIT%.
pause
exit /b %PLOTPICKLE_SYNC_EXIT%
