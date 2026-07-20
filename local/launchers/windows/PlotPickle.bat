@echo off
setlocal

title PlotPickle Local Server

set "ROOT=%~dp0"
set "PHP=%ROOT%runtime\php\php.exe"
set "ROUTER=%ROOT%server\router.php"
set "HOST=127.0.0.1"
set "PORT=48721"
set "URL=http://%HOST%:%PORT%"

if not exist "%PHP%" (
  where php >nul 2>nul
  if errorlevel 1 (
    echo PlotPickle could not find PHP.
    echo Reinstall the portable package or install PHP 8.2 or newer.
    pause
    exit /b 1
  )
  set "PHP=php"
)

if not exist "%ROUTER%" (
  echo PlotPickle's local server files are missing.
  pause
  exit /b 1
)

cls
echo ==============================================================
echo                    PLOTPICKLE LOCAL
echo ==============================================================
echo.
echo This window runs PlotPickle's private local server.
echo Please leave it open while you are using PlotPickle.
echo.
echo PlotPickle will open in your browser at:
echo   %URL%
echo.
echo Your projects and automatic backups are stored inside:
echo   %ROOT%data
echo.
echo Server activity and helpful error messages will appear below.
echo Closing this window safely stops PlotPickle Local.
echo ==============================================================
echo.

start "PlotPickle" "%URL%"
"%PHP%" -S %HOST%:%PORT% "%ROUTER%"

echo.
echo PlotPickle Local has stopped.
pause
