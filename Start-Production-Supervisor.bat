@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title PlotPickle Production Supervisor

set "PLOTPICKLE_PORT=4173"
set "PLOTPICKLE_URL=http://127.0.0.1:%PLOTPICKLE_PORT%"
set "SUPERVISOR=scripts\production-supervisor-agent.mjs"

cls
echo.
echo ============================================================
echo   PlotPickle Production Supervisor
echo ============================================================
echo.
echo This local-only companion coordinates PlotPickle agent status and evidence.
echo It does not approve canon, expose credentials, publish, install software, or authorize paid generation.
echo The window remains open so results and recovery information stay visible.
echo.

if not exist "%SUPERVISOR%" (
  echo [ERROR] The Production Supervisor script is missing.
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Start PlotPickle normally after installing its required runtime.
  pause
  exit /b 1
)

node "%SUPERVISOR%" --server "%PLOTPICKLE_URL%" --stay-open
set "EXIT_CODE=%ERRORLEVEL%"
exit /b %EXIT_CODE%
