@echo off
setlocal
if "%~1"=="" (
  echo Usage: PlotPickle start^|restart^|status^|recover-tunnel
  exit /b 2
)
powershell.exe -NoProfile -File "%~dp0scripts\engineering-team\windows\launcher\Invoke-PlotPickle.ps1" -Command "%~1"
exit /b %ERRORLEVEL%
