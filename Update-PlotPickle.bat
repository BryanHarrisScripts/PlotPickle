@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title PlotPickle Playhouse Updater

set "UPDATER=scripts\windows-update.ps1"
set "TEMP_UPDATER=%TEMP%\plotpickle-update-%RANDOM%-%RANDOM%.ps1"

cls
echo.
echo ============================================================
echo   PlotPickle Playhouse - Guided In-Place Updater
echo ============================================================
echo.
echo This updater replaces PlotPickle program files while preserving:
echo   - the reusable dependency runtime in %%LOCALAPPDATA%%\PlotPickle
echo   - browser-stored PlotPickle projects
echo   - exported .plotpickle.json files
echo   - local .env configuration files
echo.
echo Close the PlotPickle local-server window before continuing.
echo.

if not exist "%UPDATER%" (
  echo [ERROR] The updater script is missing: %UPDATER%
  pause
  exit /b 1
)

copy /y "%UPDATER%" "%TEMP_UPDATER%" >nul
if errorlevel 1 (
  echo [ERROR] The updater could not prepare its temporary working copy.
  pause
  exit /b 1
)

if "%~1"=="" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%TEMP_UPDATER%" -InstallRoot "%CD%"
) else (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%TEMP_UPDATER%" -InstallRoot "%CD%" -ZipPath "%~1"
)

set "EXIT_CODE=%ERRORLEVEL%"
del /q "%TEMP_UPDATER%" >nul 2>&1

echo.
if "%EXIT_CODE%"=="0" (
  echo PlotPickle updater has finished.
) else (
  echo PlotPickle update did not complete. Review the message above.
)
echo.
pause
exit /b %EXIT_CODE%
