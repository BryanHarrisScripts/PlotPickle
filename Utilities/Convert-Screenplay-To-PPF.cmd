@echo off
setlocal EnableExtensions
set "ROOT=%~dp0.."
set "PAUSE_ON_EXIT=0"

if "%~1"=="" (
  echo.
  echo PlotPickle - Convert Screenplay to PPF
  echo --------------------------------------
  echo Supported: Final Draft .fdx, Fountain .fountain/.spmd, plain .txt,
  echo and text-based PDF when pdftotext or mutool is available locally.
  echo Scanned PDFs are not OCR'd automatically.
  echo.
  set /p "INPUT=Screenplay file: "
  if not defined INPUT exit /b 1
  set "PAUSE_ON_EXIT=1"
) else (
  set "INPUT=%~1"
)

if not exist "%INPUT%" (
  echo.
  echo File not found: %INPUT%
  if "%PAUSE_ON_EXIT%"=="1" pause
  exit /b 1
)

pushd "%ROOT%" >nul
if not exist "node_modules\vite" (
  echo.
  echo PlotPickle dependencies are not ready. Run Utilities\Repair-PlotPickle.cmd,
  echo then try this converter again.
  popd >nul
  if "%PAUSE_ON_EXIT%"=="1" pause
  exit /b 1
)

if "%~1"=="" (
  node scripts\projects\convert-screenplay-to-ppf.mjs "%INPUT%"
) else (
  node scripts\projects\convert-screenplay-to-ppf.mjs %*
)
set "RESULT=%ERRORLEVEL%"
popd >nul

if not "%RESULT%"=="0" (
  echo.
  echo Conversion did not complete. The source screenplay was not changed.
)
if "%PAUSE_ON_EXIT%"=="1" pause
exit /b %RESULT%
