@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title PlotPickle - Full Verification

echo.
echo ============================================================
echo   PlotPickle - Full Verification
echo ============================================================
echo.
echo This will run Pi readiness, BUZZ verification, exhaustive UI/UX UAT,
echo and Writer-in-Residence. PlotPickle will be started automatically if needed.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-plotpickle-full-check.ps1"
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if "%EXIT_CODE%"=="0" (
  echo All full-verification checks passed.
) else (
  echo One or more checks need attention. Review the summary above.
)
echo.
echo Press any key to close this window.
pause >nul
exit /b %EXIT_CODE%
