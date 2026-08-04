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
  assert.match(launcher, /\[STEP 1 OF 3\] Preparing the required local runtime/);
  assert.match(launcher, /\[STEP 2 OF 3\] Checking required PlotPickle components/);
  assert.match(launcher, /\[STEP 3 OF 3\] Starting the private local server/);
  assert.match(launcher, /does not install a Windows service/);
  assert.match(launcher, /does not require Administrator rights/);
  assert.match(launcher, /closing it stops only that server/);
});

test("routine startup leaves optional services inside independent Settings pages", async () => {
  const launcher = await source("Start-PlotPickle.bat");
  const executable = executableLines(launcher);

  assert.match(launcher, /optional connections are configured inside PlotPickle Settings/i);
  assert.match(launcher, /Optional services remain available from their independent Settings pages/);
  assert.doesNotMatch(executable, /install-local-ai-tool\.ps1|install-buzz-desktop\.ps1/i);
  assert.doesNotMatch(executable, /ensure_local_ai_tool|ensure_buzz_desktop/i);
  assert.doesNotMatch(executable, /Install (?:Ollama|ComfyUI|Buzz Desktop).*\[Y\/N\]/i);
  assert.doesNotMatch(executable, /start\s+""\s+"https:\/\/nodejs\.org\//i);
});

test("startup reuses an existing PlotPickle session and rejects a foreign port owner", async () => {
  const launcher = await source("Start-PlotPickle.bat");

  for (const contract of [
    ":probe_existing",
    "Invoke-WebRequest",
    "$response.Content -match 'PlotPickle'",
    "System.Net.Sockets.TcpClient",
    'if "!PROBE_RESULT!"=="0"',
    "PlotPickle is already running",
    "No second server will be started",
    'if "!PROBE_RESULT!"=="2"',
    "Port %PLOTPICKLE_PORT% is already being used by another application",
  ]) assert.ok(launcher.includes(contract), `Missing duplicate-instance contract: ${contract}`);
});

test("browser launch waits for confirmed loopback readiness with a bounded timeout", async () => {
  const launcher = await source("Start-PlotPickle.bat");

  for (const contract of [
    'set "READY_TIMEOUT_SECONDS=60"',
    ":open_when_ready",
    "AddSeconds(%READY_TIMEOUT_SECONDS%)",
    "Start-Sleep -Milliseconds 500",
    "Start-Process '%PLOTPICKLE_URL%'",
    "did not become ready within %READY_TIMEOUT_SECONDS% seconds",
    'call "%VITE_CMD%" --host 127.0.0.1 --port %PLOTPICKLE_PORT% --strictPort',
  ]) assert.ok(launcher.includes(contract), `Missing readiness contract: ${contract}`);

  assert.doesNotMatch(launcher, /Start-Sleep -Seconds 4/);
  assert.doesNotMatch(launcher, /--host 0\.0\.0\.0/);
});

test("required runtime consent and repair remain visible and recoverable", async () => {
  const launcher = await source("Start-PlotPickle.bat");

  for (const contract of [
    'choice /C YN /N /M "Continue with this local runtime installation? [Y/N]: "',
    'node "%RUNTIME_MANAGER%" verify-runtime',
    'node "%RUNTIME_MANAGER%" repair-native "%PLOTPICKLE_RUNTIME_MODULES%"',
    'node "%RUNTIME_MANAGER%" reset-current',
    "Repair-PlotPickle.bat",
    "Your story projects are not stored in that folder",
  ]) assert.ok(launcher.includes(contract), `Missing required-runtime recovery: ${contract}`);
});
