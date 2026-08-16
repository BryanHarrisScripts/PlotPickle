@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title PlotPickle - Full Verification

echo.
echo ============================================================
echo   PlotPickle - Full Verification
echo ============================================================
echo.
echo This checks architecture, curriculum, the production build, local AI/Pi,
echo BUZZ, visual UI/UX UAT, and the Writer-in-Residence journey in one pass.
echo PlotPickle will be started automatically when the browser checks need it.
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
