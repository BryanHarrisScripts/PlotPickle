@echo off
setlocal EnableExtensions
cd /d "%~dp0.."
title PlotPickle - ComfyUI Verification

echo.
echo ============================================================
echo   PlotPickle - Focused ComfyUI Verification
echo ============================================================
echo.
echo This test exercises PlotPickle's real ComfyUI integration:
echo   - ComfyUI Desktop/local API startup readiness
echo   - ComfyUI OFF and ON routing
echo   - local ComfyUI health, nodes, checkpoints, and image render
echo   - live Ollama prompt to local ComfyUI image generation
echo   - cloud route configuration without spending credits
echo   - MiniMax H3-through-ComfyUI readiness
echo   - native H3 readiness and ON/OFF when installed

echo Paid cloud image and H3 generation are NOT run by this check.
echo Keep Start-PlotPickle.bat open while this test runs.
echo.

echo [1 OF 3] Verifying the ComfyUI integration contract...
node --test "%CD%\tests\comfyui-live-verification.test.mjs" "%CD%\tests\issue-973-comfyui-api-readiness.test.mjs"
if errorlevel 1 (
  echo.
  echo ComfyUI contract verification failed. Live testing was not started.
  set "EXIT_CODE=1"
  goto :finish
)

echo.
echo [2 OF 3] Ensuring the installed local ComfyUI API is ready...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\start-comfyui-background.ps1" -BaseUrl "http://127.0.0.1:8188" -ReadyTimeoutSeconds 90 -AllowDesktopLaunch
if errorlevel 1 (
  echo.
  echo ComfyUI Desktop may be installed, but its local API is not ready.
  echo Complete the first-run/local-instance guidance above, then run this check again.
  echo PlotPickle did not install a checkpoint or switch to paid cloud.
  set "EXIT_CODE=1"
  goto :finish
)

echo.
echo [3 OF 3] Running live local and configuration checks...
node "%CD%\scripts\verify-comfyui-live.mjs"
set "EXIT_CODE=%ERRORLEVEL%"

:finish
echo.
if "%EXIT_CODE%"=="0" (
  echo ComfyUI focused verification passed.
) else (
  echo One or more ComfyUI checks need attention. Review the results above.
)
echo.
echo Optional paid/live modes are available from the command line only:
echo   node scripts\verify-comfyui-live.mjs --live-cloud
echo   node scripts\verify-comfyui-live.mjs --live-paid-h3
echo   node scripts\verify-comfyui-live.mjs --live-native-h3
echo.
echo Press any key to close this window.
pause >nul
exit /b %EXIT_CODE%
