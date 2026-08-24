import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

function executableLines(batch) {
  return batch
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^rem(?:\s|$)/i.test(line) && !/^::/.test(line))
    .join("\n");
}

test("Windows startup uses the current PlotPickle name and a concise three-step flow", async () => {
  const launcher = await source("Start-PlotPickle.bat");

  assert.match(launcher, /title PlotPickle - Local App/);
  assert.match(launcher, /PlotPickle - Local App/);
  assert.doesNotMatch(launcher, /PlotPickle Playhouse - Local Server/);
  assert.match(launcher, /\[STEP 1 OF 3\].*Preparing the required local runtime/);
  assert.match(launcher, /\[STEP 2 OF 3\].*Checking required PlotPickle components/);
  assert.match(launcher, /\[STEP 3 OF 3\].*Starting the private local server/);
  assert.match(launcher, /does not install a Windows service/);
  assert.match(launcher, /does not require Administrator rights/);
  assert.match(launcher, /closing it stops only that server/);
});

test("routine startup defers optional companion maintenance until the local app is ready", async () => {
  const [launcher, deferred] = await Promise.all([
    source("Start-PlotPickle.bat"),
    source("scripts/windows-companion-maintenance-after-ready.ps1"),
  ]);
  const executable = executableLines(launcher);

  assert.match(launcher, /other optional connections remain independently configurable in PlotPickle Settings/i);
  assert.match(launcher, /Optional services remain available from their independent Settings pages/);
  assert.match(launcher, /COMPANION_MANAGER=scripts\\windows-companion-software\.ps1/);
  assert.match(launcher, /COMPANION_AFTER_READY=scripts\\windows-companion-maintenance-after-ready\.ps1/);
  assert.match(launcher, /call :start_deferred_companion_maintenance/);
  assert.match(launcher, /start "" \/b powershell\.exe[^\n]+%COMPANION_AFTER_READY%/i);
  assert.doesNotMatch(executable, /powershell\.exe[^\n]+-File "%COMPANION_MANAGER%" -Mode Maintain/i);
  assert.match(deferred, /Test-PlotPickleReady/);
  assert.match(deferred, /-Mode Maintain -NoPrompt/);
  assert.ok(deferred.indexOf("Test-PlotPickleReady") < deferred.indexOf("-Mode Maintain -NoPrompt"));
  assert.doesNotMatch(executable, /install-local-ai-tool\.ps1|install-buzz-desktop\.ps1/i);
  assert.doesNotMatch(executable, /ensure_local_ai_tool|ensure_buzz_desktop/i);
  assert.doesNotMatch(executable, /Install (?:Ollama|ComfyUI|Buzz Desktop).*\[Y\/N\]/i);
  assert.doesNotMatch(executable, /start\s+""\s+"https:\/\/nodejs\.org\//i);
});

test("startup reuses only a current verified PlotPickle session and rejects stale or foreign port owners", async () => {
  const launcher = await source("Start-PlotPickle.bat");

  for (const contract of [
    ":probe_existing",
    "Invoke-WebRequest",
    "$response.Content -match 'PlotPickle'",
    "$response.Content -match '%PLOTPICKLE_STARTUP_MARKER%'",
    "System.Net.Sockets.TcpClient",
    'if "!PROBE_RESULT!"=="0"',
    "The current PlotPickle build is already running",
    "No second server or maintenance pass will be started",
    'if "!PROBE_RESULT!"=="3"',
    "stale or unverified",
    'if "!PROBE_RESULT!"=="2"',
    "Port %PLOTPICKLE_PORT% is already being used by another application",
  ]) assert.ok(launcher.toLowerCase().includes(contract.toLowerCase()), `Missing duplicate-instance contract: ${contract}`);
});

test("browser launch waits for confirmed loopback readiness with a bounded timeout", async () => {
  const launcher = await source("Start-PlotPickle.bat");

  for (const contract of [
    'set "READY_TIMEOUT_SECONDS=60"',
    ":open_when_ready",
    "AddSeconds(%READY_TIMEOUT_SECONDS%)",
    "Start-Sleep -Milliseconds 500",
    "Start-Process -FilePath $edge -ArgumentList $arguments -PassThru",
    "'--app='+$base",
    "'--user-data-dir='+$env:PLOTPICKLE_BROWSER_PROFILE",
    "did not become ready with the completed startup contract within %READY_TIMEOUT_SECONDS% seconds",
    'call "%VITE_CMD%" --host 127.0.0.1 --port %PLOTPICKLE_PORT% --strictPort',
  ]) assert.ok(launcher.includes(contract), `Missing readiness contract: ${contract}`);

  const openWhenReadyLabel = launcher.indexOf("\n:open_when_ready\n");
  const deferredLabel = launcher.indexOf("\n:start_deferred_companion_maintenance\n", openWhenReadyLabel);
  assert.ok(openWhenReadyLabel >= 0 && deferredLabel > openWhenReadyLabel, "Owned-browser startup labels must remain ordered and discoverable");
  const openWhenReady = launcher.slice(openWhenReadyLabel, deferredLabel);
  assert.match(openWhenReady, /\) \| Where-Object/);
  assert.match(openWhenReady, /\} \| ConvertTo-Json \| Set-Content/);
  assert.doesNotMatch(openWhenReady, /\^\|/);
  assert.doesNotMatch(launcher, /Start-Sleep -Seconds 4/);
  assert.doesNotMatch(launcher, /--host 0\.0\.0\.0/);
  assert.doesNotMatch(executableLines(launcher), /Start-Process\s+'%PLOTPICKLE_URL%'/i);
});

test("required runtime consent and repair remain visible and recoverable", async () => {
  const launcher = await source("Start-PlotPickle.bat");

  for (const contract of [
    'choice /C YN /N /M "Continue with this local runtime installation? [Y/N]: "',
    'node "%RUNTIME_MANAGER%" verify-runtime',
    'node "%RUNTIME_MANAGER%" repair-native "%PLOTPICKLE_RUNTIME_MODULES%"',
    'node "%RUNTIME_MANAGER%" reset-current',
    "Utilities\\Repair-PlotPickle.cmd",
    "Your story projects are not stored in that folder",
  ]) assert.ok(launcher.includes(contract), `Missing required-runtime recovery: ${contract}`);
});
