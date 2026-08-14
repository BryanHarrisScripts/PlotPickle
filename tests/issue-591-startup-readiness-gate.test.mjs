import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("startup checks application updates before deciding whether localhost is reusable", async () => {
  const [launcher, sync] = await Promise.all([
    read("Start-PlotPickle.bat"),
    read("scripts/windows-source-sync.mjs"),
  ]);

  const updateCheck = launcher.indexOf("[UPDATE CHECK]");
  const sessionCheck = launcher.indexOf("[CHECK]");
  assert.ok(updateCheck >= 0 && sessionCheck > updateCheck);
  assert.match(launcher, /SOURCE_SYNC=scripts\\windows-source-sync\.mjs/);
  assert.match(launcher, /PLOTPICKLE_SOURCE_UPDATED/);
  assert.match(launcher, /call "%~f0" --source-current/);

  assert.match(sync, /result\.branch !== "main"|result\.branch/);
  assert.match(sync, /status", "--porcelain", "--untracked-files=no/);
  assert.match(sync, /fetch", "--quiet", "origin", "main/);
  assert.match(sync, /NETWORK_GIT_TIMEOUT_MS = 8_000/);
  assert.match(sync, /timeout: options\.timeoutMs \?\? LOCAL_GIT_TIMEOUT_MS/);
  assert.match(sync, /GIT_TERMINAL_PROMPT: "0"/);
  assert.match(sync, /GCM_INTERACTIVE: "Never"/);
  assert.match(sync, /merge-base", "--is-ancestor", "HEAD", "origin\/main/);
  assert.match(sync, /merge", "--ff-only", "origin\/main/);
  assert.doesNotMatch(sync, /reset\s+--hard|clean\s+-f|checkout\s+-f|push\s+--force/);
});

test("only a server carrying the completed current startup contract may open", async () => {
  const [layout, viteConfig, launcher] = await Promise.all([
    read("app/layout.tsx"),
    read("vite.config.ts"),
    read("Start-PlotPickle.bat"),
  ]);

  assert.match(layout, /data-plotpickle-startup=\{__PLOTPICKLE_STARTUP_CONTRACT__\}/);
  assert.match(viteConfig, /define:\s*\{/);
  assert.match(viteConfig, /__PLOTPICKLE_STARTUP_CONTRACT__:\s*JSON\.stringify/);
  assert.match(viteConfig, /process\.env\.PLOTPICKLE_STARTUP_CONTRACT/);
  assert.match(viteConfig, /plotpickle-unverified-startup/);
  assert.match(launcher, /PLOTPICKLE_STARTUP_MARKER=plotpickle-startup-v3/);
  assert.match(launcher, /PLOTPICKLE_STARTUP_CONTRACT=!PLOTPICKLE_STARTUP_MARKER!/);
  assert.match(launcher, /\$response\.Content -match '%PLOTPICKLE_STARTUP_MARKER%'/);
  assert.match(launcher, /exit 3/);
  assert.match(launcher, /stale or unverified/i);
  assert.match(launcher, /will not open it or replace dependencies underneath a running server/);
});

test("browser launch follows dependency, companion and aggregate readiness reporting", async () => {
  const launcher = await read("Start-PlotPickle.bat");
  const required = launcher.indexOf("call :ensure_dependencies");
  const report = launcher.indexOf('node "%SETUP_REPORT%" ready');
  const mastra = launcher.indexOf("Mastra !MASTRA_VERSION! is installed and ready");
  const companions = launcher.indexOf('-File "%COMPANION_MANAGER%" -Mode Maintain');
  const complete = launcher.indexOf("Startup checks complete. PlotPickle can now start");
  const compatibilityReport = launcher.indexOf('node "%VITE_NATIVE_REPORT%"');
  const watcher = launcher.indexOf("call :open_when_ready");
  const server = launcher.indexOf('call "%VITE_CMD%" --host 127.0.0.1');

  assert.ok(required >= 0 && report > required && mastra > report && companions > mastra);
  assert.ok(complete > companions && compatibilityReport > complete && watcher > compatibilityReport && server > watcher);
  assert.match(launcher, /echo !READY! Required PlotPickle dependencies are loaded and verified/);
  assert.match(launcher, /echo !READY_WARN! Companion checks finished with optional maintenance warnings/);
});

test("companion maintenance reports optional failures truthfully without blocking core mode", async () => {
  const manager = await read("scripts/windows-companion-software.ps1");
  assert.match(manager, /MaintenanceWarningCount/);
  assert.match(manager, /function Write-MaintenanceWarning/);
  assert.match(manager, /\[READY WITH WARNINGS\] Companion inventory and maintenance finished/);
  assert.match(manager, /No AI mode and manual workflows remain available/);
  assert.match(manager, /exit 10/);
  assert.match(manager, /\[READY\] Companion inventory and reviewed maintenance finished without detected failures/);
});
