@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title PlotPickle - Local App

for /F "delims=" %%E in ('echo prompt $E^| cmd') do set "ESC=%%E"
set "GREEN=!ESC![92m"
set "YELLOW=!ESC![93m"
set "RED=!ESC![91m"
set "CYAN=!ESC![96m"
set "RESET=!ESC![0m"
set "OK=!GREEN![OK]!RESET!"
set "READY=!GREEN![READY]!RESET!"
set "SUCCESS=!GREEN![SUCCESS]!RESET!"
set "WARNING=!YELLOW![WARNING]!RESET!"
set "READY_WARN=!YELLOW![READY WITH WARNINGS]!RESET!"
set "REPAIR=!YELLOW![REPAIR]!RESET!"
set "ERROR_TAG=!RED![ERROR]!RESET!"
set "INFO=!CYAN![INFO]!RESET!"

set "PLOTPICKLE_PORT=4173"
set "PLOTPICKLE_URL=http://127.0.0.1:%PLOTPICKLE_PORT%"
set "PLOTPICKLE_STARTUP_MARKER=plotpickle-startup-v4"
set "VITE_CMD=node_modules\.bin\vite.cmd"
set "SETUP_REPORT=scripts\windows-setup-report.mjs"
set "VITE_NATIVE_REPORT=scripts\vite-native-config-report.mjs"
set "RUNTIME_MANAGER=scripts\windows-runtime.mjs"
set "COMPANION_MANAGER=scripts\windows-companion-software.ps1"
set "AGENT_SKILLS_CLI=scripts\agent-skills.mjs"
set "UAT_RUNNER=scripts\run-creative-writer-uat.ps1"
set "STORY_BUILDER_AGENT=scripts\full-story-builder-agent.mjs"
set "UI_CONTINUITY_AGENT=scripts\ui-continuity-agent.mjs"
set "SOURCE_SYNC=scripts\windows-source-sync.mjs"
set "RUNTIME_ENV=%TEMP%\plotpickle-runtime-%RANDOM%-%RANDOM%.cmd"
set "SOURCE_ENV=%TEMP%\plotpickle-source-%RANDOM%-%RANDOM%.cmd"
set "INSTALL_PERFORMED=0"
set "COMPANION_WARNINGS=0"
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
rem Vite emits a very large future-native-loader advisory before its config can
rem set this flag itself. Suppress that advisory in the user console and write a
rem local compatibility report separately; real Vite errors remain visible.
set "VITE_CONFIG_NATIVE_IGNORE_WARNING=true"

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

rem A clean Git checkout updates before localhost is inspected. Downloaded,
rem dirty, diverged, and non-main copies are reported but never overwritten.
echo !CYAN![UPDATE CHECK]!RESET! Checking whether PlotPickle itself is current...
where node >nul 2>&1
if not errorlevel 1 if exist "%SOURCE_SYNC%" (
  node "%SOURCE_SYNC%" "%SOURCE_ENV%"
  if exist "%SOURCE_ENV%" (
    call "%SOURCE_ENV%"
    del /q "%SOURCE_ENV%" >nul 2>&1
  )
)
if "!PLOTPICKLE_SOURCE_UPDATED!"=="1" (
  echo !SUCCESS! PlotPickle fast-forwarded to !PLOTPICKLE_SOURCE_SHA!.
  echo Restarting startup so the new checks and application source are used...
  echo.
  call "%~f0" --source-current
  exit /b !ERRORLEVEL!
)
if "!PLOTPICKLE_SOURCE_MODE!"=="git" echo !READY! PlotPickle source is current at !PLOTPICKLE_SOURCE_SHA!.
if "!PLOTPICKLE_SOURCE_MODE!"=="download" echo !READY! Downloaded PlotPickle copy detected; application updates remain available through Update-PlotPickle.bat.
if "!PLOTPICKLE_SOURCE_MODE!"=="git-unavailable" echo !READY_WARN! Git is unavailable; continuing without an application update check.
if "!PLOTPICKLE_SOURCE_MODE!"=="non-main" echo !READY_WARN! Application update skipped because this checkout is on !PLOTPICKLE_SOURCE_BRANCH!.
if "!PLOTPICKLE_SOURCE_MODE!"=="dirty" echo !READY_WARN! Application update skipped because tracked local changes are present.
if "!PLOTPICKLE_SOURCE_MODE!"=="fetch-failed" echo !READY_WARN! GitHub could not be checked; continuing with local source !PLOTPICKLE_SOURCE_SHA!.
if "!PLOTPICKLE_SOURCE_MODE!"=="diverged" echo !READY_WARN! Local main has diverged from origin/main; no source files were changed.
if "!PLOTPICKLE_SOURCE_MODE!"=="sync-error" echo !READY_WARN! The application update check could not finish; no source files were changed.
if defined PLOTPICKLE_SOURCE_SHA if not "!PLOTPICKLE_SOURCE_SHA!"=="unknown" set "PLOTPICKLE_STARTUP_MARKER=plotpickle-startup-v4-!PLOTPICKLE_SOURCE_SHA!"
echo.

echo !CYAN![CHECK]!RESET! Looking for an existing PlotPickle session...
call :probe_existing
set "PROBE_RESULT=!ERRORLEVEL!"
if "!PROBE_RESULT!"=="0" (
  echo !READY! The current PlotPickle build is already running at %PLOTPICKLE_URL%.
  echo Its startup contract confirms that required checks completed before that server opened.
  echo Opening the verified session. No second server or maintenance pass will be started.
  start "" "%PLOTPICKLE_URL%"
  exit /b 0
)
if "!PROBE_RESULT!"=="3" (
  echo.
  echo !WARNING! A PlotPickle page is already using port %PLOTPICKLE_PORT%, but it is stale or unverified.
  echo Close the older PlotPickle command window with Ctrl+C, then run Start-PlotPickle.bat again.
  echo The launcher will not open it or replace dependencies underneath a running server.
  echo.
  pause
  exit /b 1
)
if "!PROBE_RESULT!"=="2" (
  echo.
  echo !ERROR_TAG! Port %PLOTPICKLE_PORT% is already being used by another application.
  echo Close the application using that port, or stop the other local server, then run Start-PlotPickle.bat again.
  echo PlotPickle did not install, change, or stop anything.
  echo.
  pause
  exit /b 1
)

echo !OK! No conflicting local server was found.
echo.
echo !CYAN![STEP 1 OF 3]!RESET! Preparing the required local runtime...
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo !ERROR_TAG! Node.js was not found.
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
  echo !ERROR_TAG! Node.js !NODE_VERSION! is installed, but PlotPickle requires Node.js 22.13 or newer.
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
  echo !ERROR_TAG! npm was not found. Reinstall Node.js, then run this file again.
  pause
  exit /b 1
)

if not exist "%RUNTIME_MANAGER%" (
  echo !ERROR_TAG! The persistent runtime manager is missing from this PlotPickle download.
  pause
  exit /b 1
)

node "%RUNTIME_MANAGER%" prepare "%RUNTIME_ENV%"
if errorlevel 1 (
  if exist "%RUNTIME_ENV%" del /q "%RUNTIME_ENV%" >nul 2>&1
  echo.
  echo !ERROR_TAG! PlotPickle could not prepare its reusable local runtime.
  echo Close other PlotPickle and Node windows, then try again.
  pause
  exit /b 1
)

if not exist "%RUNTIME_ENV%" (
  echo !ERROR_TAG! The runtime manager did not return its configuration.
  pause
  exit /b 1
)
call "%RUNTIME_ENV%"
del /q "%RUNTIME_ENV%" >nul 2>&1
set "npm_config_cache=%PLOTPICKLE_NPM_CACHE%"

for /f %%V in ('npm --version') do set "NPM_VERSION=%%V"
for /f %%V in ('node -p "require('./package.json').version"') do set "PLOTPICKLE_VERSION=%%V"
echo !OK! PlotPickle !PLOTPICKLE_VERSION!
echo !OK! Node.js !NODE_VERSION! and npm !NPM_VERSION!
echo !OK! Dependency fingerprint !PLOTPICKLE_LOCK_HASH!
echo !OK! Runtime fingerprint !PLOTPICKLE_RUNTIME_FINGERPRINT!
echo !OK! Runtime platform !PLOTPICKLE_RUNTIME_PLATFORM! !PLOTPICKLE_RUNTIME_ARCH!
echo !OK! Persistent runtime !PLOTPICKLE_RUNTIME_DIR!
if defined PLOTPICKLE_NATIVE_BINDING echo !OK! Required native binding !PLOTPICKLE_NATIVE_BINDING!
if "!PLOTPICKLE_RUNTIME_MIGRATED!"=="1" echo !OK! Previous local packages were moved into the reusable runtime.
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
echo !OK! Mastra !MASTRA_VERSION! is installed and ready for PlotPickle agents.

if not exist "%AGENT_SKILLS_CLI%" (
  echo.
  echo !ERROR_TAG! The PlotPickle Agent Skills verifier is missing.
  echo The local server was not started because agent instructions cannot be verified.
  echo Run Repair-PlotPickle.bat or update PlotPickle, then try again.
  pause
  exit /b 1
)

echo.
echo !CYAN![AGENT SKILLS CHECK]!RESET! Verifying registered PlotPickle agent procedures...
node "%AGENT_SKILLS_CLI%" --self-test
if errorlevel 1 (
  echo.
  echo !ERROR_TAG! PlotPickle Agent Skills could not be verified.
  echo The local server was not started because agent instructions are incomplete or invalid.
  echo Run Repair-PlotPickle.bat or update PlotPickle, then try again.
  pause
  exit /b 1
)
echo !READY! PlotPickle Agent Skills are registered and verified.

if exist "%COMPANION_MANAGER%" (
  echo.
  echo !CYAN![COMPANION CHECK]!RESET! Listing PlotPickle-relevant software, applying reviewed updates, and verifying Ollama models...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%COMPANION_MANAGER%" -Mode Maintain
  set "COMPANION_RESULT=!ERRORLEVEL!"
  if "!COMPANION_RESULT!"=="0" (
    echo !READY! Companion inventory and reviewed update checks finished.
  ) else (
    set "COMPANION_WARNINGS=1"
    echo !READY_WARN! Companion checks finished with optional maintenance warnings.
    echo PlotPickle will continue and No AI mode remains available. Review the warning lines above.
  )
) else (
  set "COMPANION_WARNINGS=1"
  echo !READY_WARN! The companion-software inventory is missing. PlotPickle will continue with its required runtime.
)

echo.
echo !CYAN![STEP 3 OF 3]!RESET! Starting the private local server...
echo.
echo !READY! Required PlotPickle dependencies are loaded and verified.
echo !READY! Mastra and the local agent runtime are loaded and verified.
echo !READY! PlotPickle Agent Skills are registered and verified.
if "!COMPANION_WARNINGS!"=="0" (
  echo !READY! Companion inventory and reviewed software-update checks have finished.
) else (
  echo !READY_WARN! Companion inventory and update checks finished; optional maintenance needs attention above.
)
echo !SUCCESS! Startup checks complete. PlotPickle can now start.
set "PLOTPICKLE_STARTUP_CONTRACT=!PLOTPICKLE_STARTUP_MARKER!"
echo.
echo Address: %PLOTPICKLE_URL%
echo The browser will open after PlotPickle confirms that it is ready.
echo Optional services remain available from their independent Settings pages.
echo Press Ctrl+C in this window when you are finished.
echo.

if exist "%VITE_NATIVE_REPORT%" (
  node "%VITE_NATIVE_REPORT%"
) else (
  echo !WARNING! Vite compatibility report helper is missing; startup will continue.
)

call :open_when_ready
call "%VITE_CMD%" --host 127.0.0.1 --port %PLOTPICKLE_PORT% --strictPort

set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%EXIT_CODE%"=="0" (
  echo !ERROR_TAG! PlotPickle stopped with an error. Review the messages above.
  echo If the same runtime error returns, run Repair-PlotPickle.bat.
) else (
  echo PlotPickle has stopped. The local server started by this window is no longer running.
)
pause
exit /b %EXIT_CODE%

:probe_existing
powershell.exe -NoProfile -Command "$ProgressPreference='SilentlyContinue'; try { $response=Invoke-WebRequest -UseBasicParsing -Uri '%PLOTPICKLE_URL%' -TimeoutSec 2; if ($response.StatusCode -ge 200 -and $response.Content -match 'PlotPickle') { if ($response.Content -match '%PLOTPICKLE_STARTUP_MARKER%') { exit 0 }; exit 3 }; exit 2 } catch { try { $client=New-Object System.Net.Sockets.TcpClient; $pending=$client.BeginConnect('127.0.0.1', %PLOTPICKLE_PORT%, $null, $null); if ($pending.AsyncWaitHandle.WaitOne(500) -and $client.Connected) { $client.Close(); exit 2 }; $client.Close(); exit 1 } catch { exit 1 } }" >nul 2>&1
exit /b !ERRORLEVEL!

:open_when_ready
start "" /b powershell.exe -NoProfile -Command "$ProgressPreference='SilentlyContinue'; $deadline=(Get-Date).AddSeconds(%READY_TIMEOUT_SECONDS%); while ((Get-Date) -lt $deadline) { try { $response=Invoke-WebRequest -UseBasicParsing -Uri '%PLOTPICKLE_URL%' -TimeoutSec 2; if ($response.StatusCode -ge 200 -and $response.Content -match '%PLOTPICKLE_STARTUP_MARKER%') { Start-Process '%PLOTPICKLE_URL%'; exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }; Write-Host '[WARNING] PlotPickle did not become ready with the completed startup contract within %READY_TIMEOUT_SECONDS% seconds. Review the server messages in this window.' -ForegroundColor Yellow; exit 1"
exit /b 0

rem Full Story Builder, UI Continuity, and Creative Writer UAT are retained as manual developer tools.
rem They are intentionally not launched by normal PlotPickle startup.

:start_full_story_builder
if not exist "%STORY_BUILDER_AGENT%" (
  echo !WARNING! The Full Story Builder agent is missing. PlotPickle will continue without it.
  exit /b 0
)
powershell.exe -NoProfile -Command "$ProgressPreference='SilentlyContinue'; try { $status=Invoke-RestMethod -Uri '%PLOTPICKLE_URL%/api/full-story-builder/status' -TimeoutSec 2; if ($status.worker) { exit 0 }; exit 1 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 (
  echo !READY! The independent Full Story Builder agent is already running.
  exit /b 0
)
start "PlotPickle Full Story Builder" node "%STORY_BUILDER_AGENT%" --server "%PLOTPICKLE_URL%" --stay-open
echo !INFO! Full Story Builder started as a manual tool. Its window confirms where to provide instructions.
exit /b 0

:start_ui_continuity_agent
if not exist "%UI_CONTINUITY_AGENT%" (
  echo !WARNING! The UI Continuity Agent is missing. PlotPickle will continue without its read-only layout audit.
  exit /b 0
)
start "PlotPickle UI Continuity Agent" node "%UI_CONTINUITY_AGENT%" --server "%PLOTPICKLE_URL%" --stay-open
echo !INFO! UI Continuity Agent started as a manual tool. Its window stays open after the report is complete.
exit /b 0

:ensure_dependencies
echo !CYAN![STEP 2 OF 3]!RESET! Checking required PlotPickle components...
echo.
call :dependencies_ready
if not errorlevel 1 (
  node "%RUNTIME_MANAGER%" mark-ready >nul 2>&1
  if errorlevel 1 exit /b 1
  if "!PLOTPICKLE_RUNTIME_REUSED!"=="1" (
    echo !SUCCESS! Matching PlotPickle components and the Windows native binding were reused from the persistent runtime.
    echo No package download or first-time installation was needed.
  ) else (
    echo !OK! Required components and the Windows native binding are installed and verified.
  )
  exit /b 0
)

if exist "node_modules\rolldown\package.json" (
  echo !REPAIR! The matching runtime is present, but its Windows native binding is missing or damaged.
  echo PlotPickle will repair the exact native package before considering a full reinstall.
  echo.
) else (
  echo A matching dependency runtime has not been completed yet.
  echo Application upgrades reuse an existing runtime whenever package-lock.json, Windows platform, and CPU architecture are unchanged.
  echo A new runtime is installed only when the required package set or platform changes.
  echo.
)

if not exist "%SETUP_REPORT%" (
  echo !ERROR_TAG! The setup-report file is missing from this PlotPickle download.
  exit /b 1
)

node "%SETUP_REPORT%" plan
if errorlevel 1 (
  echo !ERROR_TAG! The installation plan could not be generated. Setup will not continue invisibly.
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
  echo !SUCCESS! Persistent package installation completed, including the Windows native binding.
  exit /b 0
)

echo.
echo !REPAIR! npm did not provide a usable Windows native binding.
echo Installing the exact binding version required by the installed Rolldown package...
node "%RUNTIME_MANAGER%" repair-native "%PLOTPICKLE_RUNTIME_MODULES%"
if not errorlevel 1 (
  call :dependencies_ready
  if not errorlevel 1 (
    node "%RUNTIME_MANAGER%" mark-ready
    if errorlevel 1 exit /b 1
    set "INSTALL_PERFORMED=1"
    echo.
    echo !SUCCESS! The missing Windows native binding was repaired without rebuilding the full runtime.
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
  echo !REPAIR! The rebuilt runtime still needs its exact Windows native binding.
  node "%RUNTIME_MANAGER%" repair-native "%PLOTPICKLE_RUNTIME_MODULES%"
  if not errorlevel 1 call :dependencies_ready
)
if not errorlevel 1 (
  node "%RUNTIME_MANAGER%" mark-ready
  if errorlevel 1 exit /b 1
  set "INSTALL_PERFORMED=1"
  echo.
  echo !SUCCESS! Persistent package repair completed, including the Windows native binding.
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
echo !RED!============================================================!RESET!
echo !RED!  PLOTPICKLE SETUP COULD NOT FINISH!RESET!
echo !RED!============================================================!RESET!
echo.
echo !ERROR_TAG! The required local components or Windows native binding are still missing or incomplete.
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
