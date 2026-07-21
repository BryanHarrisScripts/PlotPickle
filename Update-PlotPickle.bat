@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title PlotPickle Playhouse Updater

set "UPDATER=scripts\update-plotpickle.ps1"

cls
echo.
echo ============================================================
echo   PlotPickle Playhouse - In-Place Updater
echo ============================================================
echo.
echo This updater replaces PlotPickle program files while preserving:
echo   - the existing node_modules component folder
echo   - the npm download cache
echo   - local installation fingerprints
echo   - browser-stored PlotPickle projects
echo.
echo Close the PlotPickle local-server window before continuing.
echo.

if not exist "%UPDATER%" (
  echo [ERROR] The updater script is missing: %UPDATER%
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%UPDATER%"
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if "%EXIT_CODE%"=="0" (
  echo [SUCCESS] PlotPickle program files were updated in place.
  echo Run Start-PlotPickle.bat to verify components and start the app.
) else if "%EXIT_CODE%"=="2" (
  echo Update cancelled. No PlotPickle files were changed.
) else (
  echo [ERROR] The update did not complete. Review the message above.
)
echo.
pause
exit /b %EXIT_CODE%
