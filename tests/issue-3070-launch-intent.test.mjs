import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const read = name => readFile(new URL(`../${name}`, import.meta.url), "utf8");

test("#3070 plain local PowerShell invocation is Normal, DeveloperSession is explicit and mutually exclusive", async () => {
  const [entry, home] = await Promise.all([read("PlotPickle.ps1"), read("GIT-PlotPickle.ps1")]);
  assert.match(entry, /\[switch\]\$DeveloperSession/u);
  assert.match(entry, /& \$launcher --normal/u);
  assert.match(entry, /& \$launcher --developer-session/u);
  assert.match(entry, /& \$launcher --conversational-uat/u);
  assert.match(entry, /& \$launcher --webmcp-testing/u);
  assert.match(entry, /\$DeveloperSession\.IsPresent/u);
  assert.match(entry, /\$explicitModes\.Count -gt 1/u);
  assert.match(home, /\$launchArgs\.DeveloperSession = \$true/u);
  assert.match(home, /\$launchArgs\.ConversationalUAT = \$true/u);
  assert.match(home, /& \$repoLauncher @launchArgs/u);
  assert.match(home, /& \$git\.Source pull --ff-only/u);
  assert.doesNotMatch(entry + home, /CODEX_CREDITS|CHATGPT_WORK|infer.*(git|credits)|Read-Host/iu);
});

test("#3070 batch launch markers bind exact version, product mode, caller intent and real Vite runtime", async () => {
  const batch = await read("Start-PlotPickle.bat");
  const first = batch.indexOf('set "PLOTPICKLE_LAUNCH_INTENT=local-human"');
  const modes = batch.indexOf('if /I "%~1"=="--developer-session"');
  const marker = batch.indexOf('set "PLOTPICKLE_STARTUP_MARKER=!PLOTPICKLE_STARTUP_MARKER!-!PLOTPICKLE_LAUNCH_INTENT!-vite-source"');
  const probe = batch.indexOf("call :probe_existing");
  assert.ok(first >= 0 && modes > first && marker > modes && probe > marker);
  assert.match(batch, /if \/I not "%~1"=="--source-current" set "PLOTPICKLE_LAUNCH_INTENT=local-human"/u);
  assert.match(batch, /call "%~f0" --source-current/u);
  assert.match(batch, /--developer-session" \([\s\S]*?PLOTPICKLE_STARTUP_TESTING_MODE=conversational-uat[\s\S]*?PLOTPICKLE_LAUNCH_INTENT=explicit-developer/u);
  assert.match(batch, /PLOTPICKLE_LAUNCH_INTENT=explicit-webmcp/u);
  assert.match(batch, /PLOTPICKLE_LAUNCH_INTENT=explicit-uat/u);
  assert.match(batch, /\[MODE\] intent=!PLOTPICKLE_LAUNCH_INTENT!/u);
  assert.match(batch, /\[RUNTIME\] Vite source development server/u);
  assert.match(batch, /Production-built server: NOT VERIFIED/u);
  assert.match(batch, /set "NODE_ENV=development"/u);
  assert.match(batch, /call "%VITE_CMD%" --host 127\.0\.0\.1 --port %PLOTPICKLE_PORT% --strictPort/u);
  assert.match(batch, /running a different startup mode/u);
  assert.match(batch, /will not open it or replace dependencies underneath a running server/u);
  assert.match(batch, /if "!PROBE_RESULT!"=="2"[\s\S]*?Port %PLOTPICKLE_PORT% is already being used by another application/u);
  assert.doesNotMatch(batch, /taskkill.*PLOTPICKLE_STARTUP|NODE_ENV=production|vinext start --/iu);
});

test("#3070 Windows PowerShell actually delegates Normal and explicitly selected modes; ambiguous switches fail before launch", { skip: process.platform !== "win32" }, async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-3070-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await copyFile(new URL("../PlotPickle.ps1", import.meta.url), path.join(root, "PlotPickle.ps1"));
  await writeFile(path.join(root, "Start-PlotPickle.bat"), "@echo off\r\necho FAKE-LAUNCH=%~1\r\nexit /b 0\r\n");
  const invoke = (...args) => execFileSync("powershell.exe", [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(root, "PlotPickle.ps1"), ...args,
  ], { encoding: "utf8", timeout: 20_000, windowsHide: true });
  assert.match(invoke(), /FAKE-LAUNCH=--normal/u);
  assert.match(invoke("-HumanTesting"), /FAKE-LAUNCH=--normal/u);
  assert.match(invoke("-DeveloperSession"), /FAKE-LAUNCH=--developer-session/u);
  assert.match(invoke("-ConversationalUAT"), /FAKE-LAUNCH=--conversational-uat/u);
  assert.match(invoke("-WebMCPTesting"), /FAKE-LAUNCH=--webmcp-testing/u);
  assert.throws(() => invoke("-DeveloperSession", "-HumanTesting"), /Choose only one startup mode/u);
});
