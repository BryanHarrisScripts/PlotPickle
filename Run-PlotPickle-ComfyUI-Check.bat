@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title PlotPickle - ComfyUI Verification

echo.
echo ============================================================
echo   PlotPickle - Focused ComfyUI Verification
echo ============================================================
echo.
echo This test exercises PlotPickle's real ComfyUI integration:
echo   - ComfyUI OFF and ON routing
echo   - local ComfyUI health, nodes, checkpoints, and image render
echo   - live Ollama prompt to local ComfyUI image generation
echo   - cloud route configuration without spending credits
echo   - MiniMax H3-through-ComfyUI readiness
echo   - native H3 readiness and ON/OFF when installed

echo Paid cloud image and H3 generation are NOT run by this check.
echo Keep Start-PlotPickle.bat and ComfyUI open while this test runs.
echo.

node "%~dp0scripts\verify-comfyui-live.mjs"
set "EXIT_CODE=%ERRORLEVEL%"

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
