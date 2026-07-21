@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title PlotPickle Playhouse Local Server

set "PLOTPICKLE_PORT=4173"
set "PLOTPICKLE_URL=http://127.0.0.1:%PLOTPICKLE_PORT%"
set "VITE_CMD=node_modules\.bin\vite.cmd"
set "SETUP_REPORT=scripts\windows-setup-report.mjs"
set "INSTALL_STATE_DIR=.plotpickle"
set "LOCK_HASH_FILE=%INSTALL_STATE_DIR%\package-lock.sha256"
set "INSTALL_PERFORMED=0"
set "UPGRADE_PERFORMED=0"

rem Make installation and upgrades more tolerant and visible.
set "NODE_ENV=development"
set "npm_config_fetch_retries=5"
set "npm_config_fetch_retry_factor=2"
set "npm_config_fetch_retry_mintimeout=20000"
set "npm_config_fetch_retry_maxtimeout=120000"
set "npm_config_audit=false"
set "npm_config_fund=false"
set "npm_config_update_notifier=false"
set "npm_config_progress=true"
set "npm_config_loglevel=notice"
set "npm_config_color=always"
set "FORCE_COLOR=1"

cls
echo.
echo ============================================================
echo   PlotPickle Playhouse - Local Server
echo ============================================================
echo.
echo PlotPickle runs on this computer and opens in your web browser.
echo It does not install a Windows service and does not require Administrator rights.
echo The local address 127.0.0.1 is private to this computer.
echo Keep this window open while using PlotPickle; closing it stops the server.
echo.
echo [STEP 1 OF 4] Checking Node.js, npm, and PlotPickle version...
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  echo.
  echo Install Node.js 22.13 or newer, then run this file again:
  echo https://nodejs.org/
  echo.
  start "" "https://nodejs.org/"
  pause
  exit /b 1
)

for /f %%V in ('node -p "process.versions.node"') do set "NODE_VERSION=%%V"
node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit(major > 22 || (major === 22 && minor >= 13) ? 0 : 1)"
if errorlevel 1 (
  echo [ERROR] Node.js !NODE_VERSION! is installed, but PlotPickle requires Node.js 22.13 or newer.
  echo.
  echo Download the current Node.js version here:
  echo https://nodejs.org/
  echo.
  start "" "https://nodejs.org/"
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm was not found. Reinstall Node.js, then run this file again.
  pause
  exit /b 1
)

for /f %%V in ('npm --version') do set "NPM_VERSION=%%V"
for /f %%V in ('node -p "require('./package.json').version"') do set "PLOTPICKLE_VERSION=%%V"
echo [OK] PlotPickle !PLOTPICKLE_VERSION!
echo [OK] Node.js !NODE_VERSION!
echo [OK] npm !NPM_VERSION!
echo.

call :ensure_dependencies
set "SETUP_RESULT=!ERRORLEVEL!"
if "!SETUP_RESULT!"=="2" (
  echo.
  echo Setup or upgrade was cancelled. Nothing else was installed or started.
  pause
  exit /b 0
)
if not "!SETUP_RESULT!"=="0" goto :setup_failed

echo.
echo [STEP 3 OF 4] Verifying installed components and reporting results...
echo.
if "!INSTALL_PERFORMED!"=="1" (
  node "%SETUP_REPORT%" success
) else if "!UPGRADE_PERFORMED!"=="1" (
  echo ============================================================
  echo   SUCCESS - PLOTPICKLE UPGRADE COMPLETED
  echo ============================================================
  echo.
  echo Application files and npm components now match PlotPickle !PLOTPICKLE_VERSION!.
  echo Existing components were reused wherever possible.
  echo.
  node "%SETUP_REPORT%" ready
) else (
  node "%SETUP_REPORT%" ready
)
if errorlevel 1 goto :setup_failed

echo.
echo [STEP 4 OF 4] Starting the private local server...
echo.
echo Address: %PLOTPICKLE_URL%
echo Only this computer can use this 127.0.0.1 address.
echo Your browser will open automatically.
echo Press Ctrl+C in this window when you are finished.
echo.

start "" /b powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 4; Start-Process '%PLOTPICKLE_URL%'"
call "%VITE_CMD%" --host 127.0.0.1 --port %PLOTPICKLE_PORT%

set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%EXIT_CODE%"=="0" (
  echo [ERROR] PlotPickle stopped with an error. Review the messages above.
) else (
  echo PlotPickle has stopped. The local server is no longer running.
)
pause
exit /b %EXIT_CODE%

:ensure_dependencies
echo [STEP 2 OF 4] Checking PlotPickle components and upgrade state...
echo.
call :core_dependencies_ready
if errorlevel 1 goto :full_install

call :lock_matches
if not errorlevel 1 (
  echo [OK] Required components are installed and match this PlotPickle version.
  exit /b 0
)

echo A PlotPickle program update changed the component definition.
echo Existing components will be reused; npm will update only what changed.
echo This is not a new first-time installation.
echo.
if not exist "%SETUP_REPORT%" (
  echo [ERROR] The setup-report file is missing from this PlotPickle download.
  exit /b 1
)
node "%SETUP_REPORT%" plan
if errorlevel 1 exit /b 1
echo.
choice /C YN /N /M "Continue with this PlotPickle component upgrade? [Y/N]: "
if errorlevel 2 exit /b 2

echo.
echo ------------------------------------------------------------
echo   COMPONENT UPGRADE - Reusing the existing installation
 echo ------------------------------------------------------------
echo npm will compare package-lock.json with the installed components.
echo Unchanged packages remain available and the npm cache will be reused.
echo.
call npm install --include=dev --prefer-offline --no-audit --no-fund --progress=true --loglevel=notice
call :core_dependencies_ready
if errorlevel 1 goto :full_install
call :write_lock_hash
if errorlevel 1 exit /b 1
set "UPGRADE_PERFORMED=1"
echo.
echo [SUCCESS] PlotPickle components were upgraded in place.
exit /b 0

:full_install
if exist "node_modules" (
  echo An incomplete or incompatible PlotPickle component folder was detected.
  echo The installer will repair it instead of trying to start a broken server.
) else (
  echo First-time setup is required.
)
echo.

if not exist "%SETUP_REPORT%" (
  echo [ERROR] The setup-report file is missing from this PlotPickle download.
  exit /b 1
)

node "%SETUP_REPORT%" plan
if errorlevel 1 (
  echo [ERROR] The installation plan could not be generated. Setup will not continue invisibly.
  exit /b 1
)
echo.
choice /C YN /N /M "Continue with this local installation? [Y/N]: "
if errorlevel 2 exit /b 2

echo.
echo ------------------------------------------------------------
echo   INSTALL ATTEMPT 1 OF 2 - Clean package installation
echo ------------------------------------------------------------
echo npm will show download, extraction, warning, and verification messages below.
echo Yellow deprecation warnings do not normally mean setup failed.
echo A red npm error means the installer will attempt a repair.
echo.
call npm ci --include=dev --prefer-offline --no-audit --no-fund --progress=true --loglevel=notice
call :core_dependencies_ready
if not errorlevel 1 (
  call :write_lock_hash
  if errorlevel 1 exit /b 1
  set "INSTALL_PERFORMED=1"
  echo.
  echo [SUCCESS] Clean package installation completed.
  exit /b 0
)

echo.
echo ------------------------------------------------------------
echo   INSTALL ATTEMPT 2 OF 2 - Interrupted-download repair
echo ------------------------------------------------------------
echo Reusing packages already downloaded to the npm cache...
echo.
call npm cache verify
call npm install --include=dev --prefer-offline --no-audit --no-fund --progress=true --loglevel=notice
call :core_dependencies_ready
if not errorlevel 1 (
  call :write_lock_hash
  if errorlevel 1 exit /b 1
  set "INSTALL_PERFORMED=1"
  echo.
  echo [SUCCESS] Package repair completed.
  exit /b 0
)
exit /b 1

:core_dependencies_ready
if not exist "%VITE_CMD%" exit /b 1
if not exist "node_modules\vite\package.json" exit /b 1
if not exist "node_modules\next\package.json" exit /b 1
if not exist "node_modules\react\package.json" exit /b 1
if not exist "node_modules\vinext\package.json" exit /b 1
call "%VITE_CMD%" --version >nul 2>&1
if errorlevel 1 exit /b 1
exit /b 0

:current_lock_hash
set "CURRENT_LOCK_HASH="
if not exist "package-lock.json" exit /b 1
for /f "tokens=1" %%H in ('certutil -hashfile "package-lock.json" SHA256 ^| findstr /R /V "hash CertUtil"') do if not defined CURRENT_LOCK_HASH set "CURRENT_LOCK_HASH=%%H"
if not defined CURRENT_LOCK_HASH exit /b 1
exit /b 0

:lock_matches
if not exist "%LOCK_HASH_FILE%" exit /b 1
call :current_lock_hash
if errorlevel 1 exit /b 1
set /p "INSTALLED_LOCK_HASH=" < "%LOCK_HASH_FILE%"
if /I "!CURRENT_LOCK_HASH!"=="!INSTALLED_LOCK_HASH!" exit /b 0
exit /b 1

:write_lock_hash
call :current_lock_hash
if errorlevel 1 (
  echo [ERROR] package-lock.json could not be fingerprinted.
  exit /b 1
)
if not exist "%INSTALL_STATE_DIR%" mkdir "%INSTALL_STATE_DIR%" >nul 2>&1
> "%LOCK_HASH_FILE%" echo !CURRENT_LOCK_HASH!
if not exist "%LOCK_HASH_FILE%" (
  echo [ERROR] The dependency fingerprint could not be saved.
  exit /b 1
)
exit /b 0

:setup_failed
echo.
echo ============================================================
echo   PLOTPICKLE SETUP OR UPGRADE COULD NOT FINISH
echo ============================================================
echo.
echo The required local components are still missing, incomplete, or incompatible.
echo Nothing was installed as a Windows service, and no server was started.
echo.
echo 1. Confirm that your internet connection is stable.
echo 2. Confirm that at least 2 GB of disk space is free.
echo 3. Close other PlotPickle, Node, npm, editor, or terminal windows.
echo 4. Run Start-PlotPickle.bat again. It will retry the repair.
echo.
echo If Windows continues to report EPERM, restart the computer,
echo delete only the node_modules folder inside PlotPickle, and run
echo Start-PlotPickle.bat again. Your PlotPickle project data is not stored there.
echo.
pause
exit /b 1
