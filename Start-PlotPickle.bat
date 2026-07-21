@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title PlotPickle Playhouse Local Server

set "PLOTPICKLE_PORT=4173"
set "PLOTPICKLE_URL=http://127.0.0.1:%PLOTPICKLE_PORT%"

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
  echo Install Node.js 22 or newer, then run this file again:
  echo https://nodejs.org/
  echo.
  start "" "https://nodejs.org/"
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%V in ('node -p "process.versions.node"') do set "NODE_MAJOR=%%V"
if !NODE_MAJOR! LSS 22 (
  echo Node.js !NODE_MAJOR! is installed, but PlotPickle requires Node.js 22 or newer.
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

if not exist "node_modules" (
  echo First-time setup: installing PlotPickle components...
  echo This step only runs again after a fresh download or dependency update.
  echo.
  call npm ci
  if errorlevel 1 (
    echo.
    echo PlotPickle setup did not complete. Review the error above.
    pause
    exit /b 1
  )
)

echo.
echo Starting PlotPickle at %PLOTPICKLE_URL%
echo Your browser will open automatically.
echo Press Ctrl+C in this window when you are finished.
echo.

start "PlotPickle Browser" cmd /c "timeout /t 4 /nobreak >nul & start \"\" \"%PLOTPICKLE_URL%\""
call npm run dev -- --host 127.0.0.1 --port %PLOTPICKLE_PORT%

set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%EXIT_CODE%"=="0" (
  echo PlotPickle stopped with an error. Review the messages above.
) else (
  echo PlotPickle has stopped.
)
pause
exit /b %EXIT_CODE%
