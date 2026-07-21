@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title PlotPickle Playhouse Local Server

set "PLOTPICKLE_PORT=4173"
set "PLOTPICKLE_URL=http://127.0.0.1:%PLOTPICKLE_PORT%"
set "VITE_CMD=node_modules\.bin\vite.cmd"

rem Make first-time installation more tolerant of slow or interrupted networks.
set "NODE_ENV=development"
set "npm_config_fetch_retries=5"
set "npm_config_fetch_retry_factor=2"
set "npm_config_fetch_retry_mintimeout=20000"
set "npm_config_fetch_retry_maxtimeout=120000"
set "npm_config_audit=false"
set "npm_config_fund=false"
set "npm_config_update_notifier=false"

echo.
echo ============================================================
echo   PlotPickle Playhouse - Local Server
echo ============================================================
echo.
echo This window runs PlotPickle on your computer.
echo Keep it open while you use the application.
echo Errors and server messages will appear here.
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found.
  echo.
  echo Install Node.js 22.13 or newer, then run this file again:
  echo https://nodejs.org/
  echo.
  start "" "https://nodejs.org/"
  pause
  exit /b 1
)

for /f %%V in ('node -p "process.versions.node"') do set "NODE_VERSION=%%V"
node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit(major > 22 || (major === 22 && minor >= 13) ? 0 : 1)"
if errorlevel 1 (
  echo Node.js !NODE_VERSION! is installed, but PlotPickle requires Node.js 22.13 or newer.
  echo.
  echo Download the current Node.js version here:
  echo https://nodejs.org/
  echo.
  start "" "https://nodejs.org/"
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js, then run this file again.
  pause
  exit /b 1
)

call :ensure_dependencies
if errorlevel 1 goto :setup_failed

echo.
echo Starting PlotPickle at %PLOTPICKLE_URL%
echo Your browser will open automatically.
echo Press Ctrl+C in this window when you are finished.
echo.

start "" /b powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 4; Start-Process '%PLOTPICKLE_URL%'"
call "%VITE_CMD%" --host 127.0.0.1 --port %PLOTPICKLE_PORT%

set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%EXIT_CODE%"=="0" (
  echo PlotPickle stopped with an error. Review the messages above.
) else (
  echo PlotPickle has stopped.
)
pause
exit /b %EXIT_CODE%

:ensure_dependencies
call :dependencies_ready
if not errorlevel 1 (
  echo PlotPickle components are ready.
  exit /b 0
)

if exist "node_modules" (
  echo An incomplete PlotPickle component folder was detected.
  echo Repairing the interrupted installation...
) else (
  echo First-time setup: installing PlotPickle components...
)
echo This may take several minutes on the first run.
echo.

call npm ci --include=dev --prefer-offline --no-audit --no-fund
call :dependencies_ready
if not errorlevel 1 exit /b 0

echo.
echo The first installation attempt did not complete.
echo Retrying while preserving any packages that were already downloaded...
echo.
call npm cache verify
call npm install --include=dev --prefer-offline --no-audit --no-fund
call :dependencies_ready
if not errorlevel 1 exit /b 0

exit /b 1

:dependencies_ready
if not exist "%VITE_CMD%" exit /b 1
if not exist "node_modules\vite\package.json" exit /b 1
if not exist "node_modules\next\package.json" exit /b 1
if not exist "node_modules\react\package.json" exit /b 1
if not exist "node_modules\vinext\package.json" exit /b 1
call "%VITE_CMD%" --version >nul 2>&1
if errorlevel 1 exit /b 1
exit /b 0

:setup_failed
echo.
echo ============================================================
echo   PlotPickle setup could not finish
echo ============================================================
echo.
echo The required Vite component is still missing or incomplete.
echo.
echo 1. Confirm that your internet connection is stable.
echo 2. Close any other PlotPickle, Node, npm, editor, or terminal windows.
echo 3. Run Start-PlotPickle.bat again. It will retry the repair.
echo.
echo If Windows continues to report EPERM, restart the computer,
echo delete only the node_modules folder inside PlotPickle, and run
echo Start-PlotPickle.bat again. Your PlotPickle project data is not stored there.
echo.
pause
exit /b 1
