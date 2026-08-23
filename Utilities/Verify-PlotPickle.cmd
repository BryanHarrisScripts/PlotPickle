@echo off
setlocal
cd /d "%~dp0.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\run-plotpickle-full-check.ps1"
exit /b %ERRORLEVEL%
