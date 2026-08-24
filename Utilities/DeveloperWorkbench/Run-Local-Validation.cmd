@echo off
setlocal
title PlotPickle Developer Workbench - Local Pre-CI Validation

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found on PATH.
  echo Install or repair Node.js, then try again.
  pause
  exit /b 1
)

node "%~dp0local-validation.mjs" %*
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if "%EXIT_CODE%"=="0" (
  echo Local pre-CI validation is GREEN.
) else (
  echo Local pre-CI validation is RED. Fix the local failure before using GitHub Actions as the final gate.
)
pause
exit /b %EXIT_CODE%
