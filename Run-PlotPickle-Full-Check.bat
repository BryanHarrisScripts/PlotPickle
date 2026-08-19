@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title PlotPickle - Full Verification

set "PS_ARGS="
:parse_args
if "%~1"=="" goto run_check
if /I "%~1"=="--github-report" (
  set "PS_ARGS=%PS_ARGS% -GitHubReport"
  shift
  goto parse_args
)
if /I "%~1"=="--repair" (
  set "PS_ARGS=%PS_ARGS% -Repair"
  shift
  goto parse_args
)
if /I "%~1"=="--retest-of" (
  shift
  if not "%~1"=="" set "PS_ARGS=%PS_ARGS% -RetestOf "%~1""
  shift
  goto parse_args
)
echo Unknown Full Verification option: %~1
exit /b 2

:run_check
echo.
echo ============================================================
echo   PlotPickle - Full Verification
echo ============================================================
echo.
echo STANDALONE: You do not need to run Start-PlotPickle.bat first.
echo Full Verification starts and owns the local app server when browser checks need it.
echo.
echo This checks architecture, curriculum, the production build, local AI/Pi,
echo BUZZ, visual UI/UX UAT, and the Writer-in-Residence journey in one pass.
echo Deterministic checks own PASS/FAIL. Agent review is advisory and is saved separately.
echo A deterministic watchdog stops a silent verification harness instead of letting this window hang forever.
echo.
echo Optional modes:
echo   --github-report          one sanitized commit-linked GitHub review comment
echo   --repair                 run bounded Pi repair only after deterministic failure
echo   --retest-of RUN_ID       link this new run to an earlier immutable result
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-plotpickle-full-check.ps1" %PS_ARGS%
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if "%EXIT_CODE%"=="0" (
  echo All full-verification checks passed.
) else (
  echo One or more checks need attention. Review the summary above and the Verification Inbox.
)
echo.
echo Press any key to close this window.
pause >nul
exit /b %EXIT_CODE%
