@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title PlotPickle Playhouse Repair

set "RUNTIME_MANAGER=scripts\windows-runtime.mjs"

cls
echo.
echo ============================================================
echo   PlotPickle Playhouse - Runtime Repair
echo ============================================================
echo.
echo This repair removes only the dependency runtime required by the
echo current package-lock fingerprint, then starts PlotPickle so the
echo packages can be installed again.
echo.
echo It does NOT delete:
echo   - PlotPickle program files
echo   - browser-stored story projects
echo   - exported .plotpickle.json files
echo   - runtimes used by other PlotPickle versions
echo.
choice /C YN /N /M "Reset the current PlotPickle runtime? [Y/N]: "
if errorlevel 2 (
  echo Repair cancelled.
  pause
  exit /b 0
)

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is required to repair PlotPickle.
  pause
  exit /b 1
)

if not exist "%RUNTIME_MANAGER%" (
  echo [ERROR] The runtime manager is missing: %RUNTIME_MANAGER%
  pause
  exit /b 1
)

echo.
echo Resetting the current dependency runtime...
node "%RUNTIME_MANAGER%" reset-current
if errorlevel 1 (
  echo.
  echo [ERROR] The runtime could not be reset.
  echo Close PlotPickle, Node, npm, and editor windows, then try again.
  pause
  exit /b 1
)

echo.
echo [SUCCESS] The current runtime was reset.
echo Start-PlotPickle.bat will now reinstall only this dependency set.
echo.
call Start-PlotPickle.bat
exit /b %ERRORLEVEL%
