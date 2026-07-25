@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title PlotPickle Lighthouse Audit

set "INTERACTIVE=0"
if "%~1"=="" set "INTERACTIVE=1"

where node >nul 2>nul
if errorlevel 1 goto missing_node
where npm >nul 2>nul
if errorlevel 1 goto missing_node

node -e "const [major,minor]=process.versions.node.split('.').map(Number);process.exit(major>22||(major===22&&minor>=13)?0:1)"
if errorlevel 1 goto old_node

if not exist "package.json" (
  echo.
  echo PlotPickle package.json was not found.
  echo Keep Run-Lighthouse.bat in the extracted PlotPickle source folder.
  goto failed
)

if not exist "node_modules\.bin\vinext.cmd" (
  echo.
  echo PlotPickle dependencies are not installed yet.
  echo Installing them with npm ci. Ubuntu and WSL are not used.
  echo.
  call npm ci
  if errorlevel 1 goto failed
)

set "MODE=%~1"
if not defined MODE goto menu
goto choose_command

:menu
echo.
echo ==========================================
echo        PlotPickle Lighthouse Audit
echo ==========================================
echo.
echo  1. Desktop and mobile audit
echo  2. Desktop audit only
echo  3. Mobile audit only
echo  4. ZIP the latest completed audit
echo  Q. Exit
echo.
set /p "MODE=Choose an option: "
if /I "%MODE%"=="1" set "MODE=all"
if /I "%MODE%"=="2" set "MODE=desktop"
if /I "%MODE%"=="3" set "MODE=mobile"
if /I "%MODE%"=="4" set "MODE=zip"
if /I "%MODE%"=="Q" exit /b 0

:choose_command
if /I "%MODE%"=="all" set "NPM_COMMAND=audit:lighthouse"
if /I "%MODE%"=="desktop" set "NPM_COMMAND=audit:lighthouse:desktop"
if /I "%MODE%"=="mobile" set "NPM_COMMAND=audit:lighthouse:mobile"
if /I "%MODE%"=="zip" set "NPM_COMMAND=audit:lighthouse:zip"

if not defined NPM_COMMAND (
  echo.
  echo Unknown option: %MODE%
  echo Use all, desktop, mobile, or zip.
  goto failed
)

echo.
echo Running npm run %NPM_COMMAND% using native Windows tools...
echo.
call npm run %NPM_COMMAND%
if errorlevel 1 goto failed

echo.
echo Lighthouse finished successfully.
echo Reports are stored in reports\lighthouse\
if "%INTERACTIVE%"=="1" pause
exit /b 0

:missing_node
echo.
echo Node.js and npm are required but were not found.
echo Install Node.js 22.13.0 or newer, then run this file again.
goto failed

:old_node
echo.
echo PlotPickle requires Node.js 22.13.0 or newer.
echo Your installed version is:
node --version
goto failed

:failed
echo.
echo The Lighthouse audit did not complete.
if "%INTERACTIVE%"=="1" pause
exit /b 1
