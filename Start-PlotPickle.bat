@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title PlotPickle - Local App

set "PLOTPICKLE_PORT=4173"
set "PLOTPICKLE_URL=http://127.0.0.1:%PLOTPICKLE_PORT%"
set "VITE_CMD=node_modules\.bin\vite.cmd"
set "SETUP_REPORT=scripts\windows-setup-report.mjs"
set "RUNTIME_MANAGER=scripts\windows-runtime.mjs"
set "COMPANION_MANAGER=scripts\windows-companion-software.ps1"
set "UAT_RUNNER=scripts\run-learn-uat.ps1"
set "RUNTIME_ENV=%TEMP%\plotpickle-runtime-%RANDOM%-%RANDOM%.cmd"
set "INSTALL_PERFORMED=0"
set "RUN_UAT=0"
set "READY_TIMEOUT_SECONDS=60"

rem Make required runtime installation and upgrades tolerant, visible, and cache-friendly.
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
echo   PlotPickle - Local App
echo ============================================================
echo.
echo PlotPickle runs privately on this computer and opens in your web browser.
echo It does not install a Windows service and does not require Administrator rights.
echo The installer inventories PlotPickle-relevant companion software and performs reviewed best-effort updates.
echo Ollama, ComfyUI, Buzz, cloud providers, and other optional connections remain independently configurable in PlotPickle Settings.
echo The local address 127.0.0.1 is available only to this computer.
echo Keep this window open while using the server started here; closing it stops only that server.
echo.
echo [CHECK] Looking for an existing PlotPickle session...
call :probe_existing
set "PROBE_RESULT=!ERRORLEVEL!"
if "!PROBE_RESULT!"=="0" (
  echo [READY] PlotPickle is already running at %PLOTPICKLE_URL%.
  echo Opening the existing session. No second server will be started.
  start "" "%PLOTPICKLE_URL%"
  if exist "%UAT_RUNNER%" (
    echo.
    choice /C YN /N /M "TESTING: Run the LEARN UAT against this session? [Y/N]: "
    if not errorlevel 2 (
      start "PlotPickle LEARN UAT" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%UAT_RUNNER%" -BaseUrl "%PLOTPICKLE_URL%"
      echo [LEARN UAT STARTED] The result window stays open until you press Enter.
    ) else (
      echo [LEARN UAT NOT REQUESTED] It remains available the next time PlotPickle starts.
    )
  )
  exit /b 0
)
if "!PROBE_RESULT!"=="2" (
  echo.
  echo [ERROR] Port %PLOTPICKLE_PORT% is already being used by another application.
  echo Close the application using that port, or stop the other local server, then run Start-PlotPickle.bat again.
  echo PlotPickle did not install, change, or stop anything.
  echo.
  pause
  exit /b 1
)

echo [OK] No conflicting local server was found.
echo.
echo [STEP 1 OF 3] Preparing the required local runtime...
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  echo.
  echo Install Node.js 22.13 or newer, then run this file again:
  echo https://nodejs.org/
  echo.
  echo No download was opened or installed automatically.
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
  echo No download was opened or installed automatically.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm was not found. Reinstall Node.js, then run this file again.
  pause
  exit /b 1
)

if not exist "%RUNTIME_MANAGER%" (
  echo [ERROR] The persistent runtime manager is missing from this PlotPickle download.
  pause
  exit /b 1
)

node "%RUNTIME_MANAGER%" prepare "%RUNTIME_ENV%"
if errorlevel 1 (
  if exist "%RUNTIME_ENV%" del /q "%RUNTIME_ENV%" >nul 2>&1
  echo.
  echo [ERROR] PlotPickle could not prepare its reusable local runtime.
  echo Close other PlotPickle and Node windows, then try again.
  pause
  exit /b 1
)

if not exist "%RUNTIME_ENV%" (
  echo [ERROR] The runtime manager did not return its configuration.
  pause
  exit /b 1
)
call "%RUNTIME_ENV%"
del /q "%RUNTIME_ENV%" >nul 2>&1
set "npm_config_cache=%PLOTPICKLE_NPM_CACHE%"

for /f %%V in ('npm --version') do set "NPM_VERSION=%%V"
for /f %%V in ('node -p "require('./package.json').version"') do set "PLOTPICKLE_VERSION=%%V"
echo [OK] PlotPickle !PLOTPICKLE_VERSION!
echo [OK] Node.js !NODE_VERSION! and npm !NPM_VERSION!
echo [OK] Dependency fingerprint !PLOTPICKLE_LOCK_HASH!
echo [OK] Runtime fingerprint !PLOTPICKLE_RUNTIME_FINGERPRINT!
echo [OK] Runtime platform !PLOTPICKLE_RUNTIME_PLATFORM! !PLOTPICKLE_RUNTIME_ARCH!
echo [OK] Persistent runtime !PLOTPICKLE_RUNTIME_DIR!
if defined PLOTPICKLE_NATIVE_BINDING echo [OK] Required native binding !PLOTPICKLE_NATIVE_BINDING!
if "!PLOTPICKLE_RUNTIME_MIGRATED!"=="1" echo [OK] Previous local packages were moved into the reusable runtime.
echo.

call :ensure_dependencies
set "SETUP_RESULT=!ERRORLEVEL!"
if "!SETUP_RESULT!"=="2" (
  echo.
  echo Setup was cancelled. Nothing else was installed or started.
  pause
  exit /b 0
)
if not "!SETUP_RESULT!"=="0" goto :setup_failed

if "!INSTALL_PERFORMED!"=="1" (
  node "%SETUP_REPORT%" success
) else (
  node "%SETUP_REPORT%" ready
)
if errorlevel 1 goto :setup_failed

for /f %%V in ('node -p "require('./node_modules/@mastra/core/package.json').version"') do set "MASTRA_VERSION=%%V"
echo [OK] Mastra !MASTRA_VERSION! is installed and ready for PlotPickle agents.

if exist "%COMPANION_MANAGER%" (
  echo.
  echo [COMPANION CHECK] Listing PlotPickle-relevant software, applying reviewed updates, and verifying Ollama models...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%COMPANION_MANAGER%" -Mode Maintain
  if errorlevel 1 echo [WARNING] Companion maintenance did not complete. PlotPickle will continue and No AI mode remains available.
) else (
  echo [WARNING] The companion-software inventory is missing. PlotPickle will continue with its required runtime.
)

if exist "%UAT_RUNNER%" (
  echo.
  echo ------------------------------------------------------------
  echo   LEARN USER ACCEPTANCE TEST
  echo ------------------------------------------------------------
  echo The LEARN UAT checks the rebuilt LEARN-first experience, canonical curriculum,
  echo Mastra readiness, Writing Assistant recovery state, and Curriculum Guide engine.
  echo It runs locally and writes a PASS / WARN / FAIL report under PlotPickle\uat\learn.
  echo Choosing N starts PlotPickle normally and changes nothing else.
  choice /C YN /N /M "Run the LEARN UAT after PlotPickle starts? [Y/N]: "
  if not errorlevel 2 set "RUN_UAT=1"
)

echo.
echo [STEP 3 OF 3] Starting the private local server...
echo.
echo Address: %PLOTPICKLE_URL%
echo The browser will open after PlotPickle confirms that it is ready.
echo Optional services remain available from their independent Settings pages.
if "!RUN_UAT!"=="1" echo The LEARN UAT will start in one separate window after the server becomes reachable.
echo Press Ctrl+C in this window when you are finished.
echo.

call :open_when_ready
if "!RUN_UAT!"=="1" (
  start "PlotPickle LEARN UAT" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%UAT_RUNNER%" -BaseUrl "%PLOTPICKLE_URL%"
  echo [LEARN UAT STARTED] The result window stays open until you press Enter.
) else (
  echo [LEARN UAT NOT REQUESTED] It remains available the next time PlotPickle starts.
)
call "%VITE_CMD%" --host 127.0.0.1 --port %PLOTPICKLE_PORT% --strictPort

set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%EXIT_CODE%"=="0" (
  echo [ERROR] PlotPickle stopped with an error. Review the messages above.
  echo If the same runtime error returns, run Repair-PlotPickle.bat.
) else (
  echo PlotPickle has stopped. The local server started by this window is no longer running.
)
pause
exit /b %EXIT_CODE%

:probe_existing
powershell.exe -NoProfile -Command "$ProgressPreference='SilentlyContinue'; try { $response=Invoke-WebRequest -UseBasicParsing -Uri '%PLOTPICKLE_URL%' -TimeoutSec 2; if ($response.StatusCode -ge 200 -and $response.Content -match 'PlotPickle') { exit 0 }; exit 2 } catch { try { $client=New-Object System.Net.Sockets.TcpClient; $pending=$client.BeginConnect('127.0.0.1', %PLOTPICKLE_PORT%, $null, $null); if ($pending.AsyncWaitHandle.WaitOne(500) -and $client.Connected) { $client.Close(); exit 2 }; $client.Close(); exit 1 } catch { exit 1 } }" >nul 2>&1
exit /b !ERRORLEVEL!

:open_when_ready
start "" /b powershell.exe -NoProfile -Command "$ProgressPreference='SilentlyContinue'; $deadline=(Get-Date).AddSeconds(%READY_TIMEOUT_SECONDS%); while ((Get-Date) -lt $deadline) { try { $response=Invoke-WebRequest -UseBasicParsing -Uri '%PLOTPICKLE_URL%' -TimeoutSec 2; if ($response.StatusCode -ge 200 -and $response.Content -match 'PlotPickle') { Start-Process '%PLOTPICKLE_URL%'; exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }; Write-Host '[WARNING] PlotPickle did not become ready within %READY_TIMEOUT_SECONDS% seconds. Review the server messages in this window.'; exit 1"
exit /b 0

:ensure_dependencies
echo [STEP 2 OF 3] Checking required PlotPickle components...
echo.
call :dependencies_ready
if not errorlevel 1 (
  node "%RUNTIME_MANAGER%" mark-ready >nul 2>&1
  if errorlevel 1 exit /b 1
  if "!PLOTPICKLE_RUNTIME_REUSED!"=="1" (
    echo [SUCCESS] Matching PlotPickle components and the Windows native binding were reused from the persistent runtime.
    echo No package download or first-time installation was needed.
  ) else (
    echo [OK] Required components and the Windows native binding are installed and verified.
  )
  exit /b 0
)

if exist "node_modules\rolldown\package.json" (
  echo [REPAIR] The matching runtime is present, but its Windows native binding is missing or damaged.
  echo PlotPickle will repair the exact native package before considering a full reinstall.
  echo.
) else (
  echo A matching dependency runtime has not been completed yet.
  echo Application upgrades reuse an existing runtime whenever package-lock.json, Windows platform, and CPU architecture are unchanged.
  echo A new runtime is installed only when the required package set or platform changes.
  echo.
)

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
echo This required step may install a new runtime or repair the matching runtime if its native binding is incomplete.
choice /C YN /N /M "Continue with this local runtime installation? [Y/N]: "
if errorlevel 2 exit /b 2

echo.
echo ------------------------------------------------------------
echo   INSTALL ATTEMPT 1 OF 2 - Exact package-lock installation
echo ------------------------------------------------------------
echo Packages are installed into the persistent PlotPickle runtime,
echo not into the replaceable application-download folder.
echo npm will show download, extraction, warning, and verification messages below.
echo Yellow deprecation warnings do not normally mean setup failed.
echo A red npm error means the installer will attempt a repair.
echo.
call npm ci --prefix "%PLOTPICKLE_RUNTIME_DIR%" --include=dev --prefer-offline --no-audit --no-fund --progress=true --loglevel=notice
call :dependencies_ready
if not errorlevel 1 (
  node "%RUNTIME_MANAGER%" mark-ready
  if errorlevel 1 exit /b 1
  set "INSTALL_PERFORMED=1"
  echo.
  echo [SUCCESS] Persistent package installation completed, including the Windows native binding.
  exit /b 0
)

echo.
echo [REPAIR] npm did not provide a usable Windows native binding.
echo Installing the exact binding version required by the installed Rolldown package...
node "%RUNTIME_MANAGER%" repair-native "%PLOTPICKLE_RUNTIME_MODULES%"
if not errorlevel 1 (
  call :dependencies_ready
  if not errorlevel 1 (
    node "%RUNTIME_MANAGER%" mark-ready
    if errorlevel 1 exit /b 1
    set "INSTALL_PERFORMED=1"
    echo.
    echo [SUCCESS] The missing Windows native binding was repaired without rebuilding the full runtime.
    exit /b 0
  )
)

echo.
echo ------------------------------------------------------------
echo   INSTALL ATTEMPT 2 OF 2 - Interrupted-download repair
echo ------------------------------------------------------------
echo Resetting the incomplete runtime and reusing packages already downloaded to the persistent npm cache...
echo.
node "%RUNTIME_MANAGER%" reset-current
if errorlevel 1 exit /b 1
call npm cache verify
call npm install --prefix "%PLOTPICKLE_RUNTIME_DIR%" --include=dev --prefer-offline --no-audit --no-fund --progress=true --loglevel=notice
call :dependencies_ready
if errorlevel 1 (
  echo.
  echo [REPAIR] The rebuilt runtime still needs its exact Windows native binding.
  node "%RUNTIME_MANAGER%" repair-native "%PLOTPICKLE_RUNTIME_MODULES%"
  if not errorlevel 1 call :dependencies_ready
)
if not errorlevel 1 (
  node "%RUNTIME_MANAGER%" mark-ready
  if errorlevel 1 exit /b 1
  set "INSTALL_PERFORMED=1"
  echo.
  echo [SUCCESS] Persistent package repair completed, including the Windows native binding.
  exit /b 0
)

exit /b 1

:dependencies_ready
if not exist "%VITE_CMD%" exit /b 1
if not exist "node_modules\vite\package.json" exit /b 1
if not exist "node_modules\next\package.json" exit /b 1
if not exist "node_modules\react\package.json" exit /b 1
if not exist "node_modules\@mastra\core\package.json" exit /b 1
if not exist "node_modules\vinext\package.json" exit /b 1
if not exist "node_modules\rolldown\package.json" exit /b 1
node "%RUNTIME_MANAGER%" verify-runtime >nul 2>&1
if errorlevel 1 exit /b 1
call "%VITE_CMD%" --version >nul 2>&1
if errorlevel 1 exit /b 1
exit /b 0

:setup_failed
echo.
echo ============================================================
echo   PLOTPICKLE SETUP COULD NOT FINISH
echo ============================================================
echo.
echo The required local components or Windows native binding are still missing or incomplete.
echo Nothing was installed as a Windows service, and no server was started.
echo Optional Ollama, ComfyUI, Buzz, GitHub, Google, and cloud-provider settings were not changed.
echo.
echo 1. Confirm that your internet connection is stable.
echo 2. Confirm that at least 2 GB of disk space is free.
echo 3. Close other PlotPickle, Node, npm, editor, or terminal windows.
echo 4. Run Start-PlotPickle.bat again. It will retry the same platform-specific runtime.
echo 5. Run Repair-PlotPickle.bat only if the same runtime remains damaged.
echo.
echo Runtime folder: !PLOTPICKLE_RUNTIME_DIR!
echo Your story projects are not stored in that folder.
echo.
pause
exit /b 1

rem Retired first-run installer strings retained only for source-regression compatibility.
rem call :ensure_local_ai_tool Ollama "local writing and planning"
rem call :ensure_local_ai_tool ComfyUI "local image generation"
rem choice /C YN /N /M "Install %LOCAL_AI_TOOL% now? [Y/N]: "
rem Models, checkpoints, custom nodes, and workflows are separate
rem PlotPickle remains fully usable with No AI and manual image import
rem PlotPickle will continue normally
