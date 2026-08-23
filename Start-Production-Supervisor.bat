@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title PlotPickle Production Supervisor

set "PLOTPICKLE_PORT=4173"
set "PLOTPICKLE_URL=http://127.0.0.1:%PLOTPICKLE_PORT%"
set "SUPERVISOR=scripts\production-supervisor-agent.mjs"
set "VISUAL_AGENT=scripts\visual-production-agent.mjs"
set "VIDEO_AGENT=scripts\video-production-agent.mjs"

cls
echo.
echo ============================================================
echo   PlotPickle Production Supervisor
echo ============================================================
echo.
echo This local-only companion coordinates PlotPickle agent status and evidence.
echo It starts bounded Visual and Video Production agents using routes already selected in Settings.
echo It does not approve canon, expose credentials, publish, install software, or authorize paid generation.
echo Local image work may run when ready; H3 video remains blocked until exact per-job paid and data-sharing consent exists.
echo The windows remain open so results and recovery information stay visible.
echo.

if not exist "%SUPERVISOR%" (
  echo [ERROR] The Production Supervisor script is missing.
  pause
  exit /b 1
)
if not exist "%VISUAL_AGENT%" (
  echo [ERROR] The Visual Production Agent script is missing.
  pause
  exit /b 1
)
if not exist "%VIDEO_AGENT%" (
  echo [ERROR] The Video Production Agent script is missing.
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Start PlotPickle normally after installing its required runtime.
  pause
  exit /b 1
)

start "PlotPickle Visual Production Agent" node "%VISUAL_AGENT%" --server "%PLOTPICKLE_URL%" --stay-open
start "PlotPickle Video Production Agent" node "%VIDEO_AGENT%" --server "%PLOTPICKLE_URL%" --stay-open
node "%SUPERVISOR%" --server "%PLOTPICKLE_URL%" --stay-open
set "EXIT_CODE=%ERRORLEVEL%"
exit /b %EXIT_CODE%
