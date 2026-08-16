import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Windows launcher is portable, double-click friendly, and keeps the console open", async () => {
  const launcher = await read("Run-PlotPickle-Full-Check.bat");

  assert.match(launcher, /cd \/d "%~dp0"/i);
  assert.match(launcher, /powershell\.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\\run-plotpickle-full-check\.ps1"/i);
  assert.match(launcher, /pause >nul/i);
  assert.match(launcher, /exit \/b %EXIT_CODE%/i);
  assert.doesNotMatch(launcher, /C:\\Users\\/i);
});

test("full verification runs the five requested checks in the intended order", async () => {
  const runner = await read("scripts/run-plotpickle-full-check.ps1");
  const commands = [
    "ensure-local-repair-model.mjs",
    "run-uat-repair-agent.mjs",
    "verify-buzz-live-activity.mjs",
    "run-exhaustive-ui-uat.mjs",
    "run-writer-in-residence.mjs",
  ];

  let previous = -1;
  for (const command of commands) {
    const index = runner.indexOf(command);
    assert.ok(index > previous, `${command} should appear after the previous verification step`);
    previous = index;
  }

  assert.match(runner, /--worker", "pi"/);
  assert.match(runner, /--preflight", "--require-ready"/);
  assert.match(runner, /run-exhaustive-ui-uat\.mjs", "--github-report"/);
  assert.match(runner, /run-writer-in-residence\.mjs", "--github-report"/);
});

test("full verification starts the official app when needed and waits for localhost readiness", async () => {
  const runner = await read("scripts/run-plotpickle-full-check.ps1");

  assert.match(runner, /http:\/\/127\.0\.0\.1:4173/);
  assert.match(runner, /Start-PlotPickle\.bat/);
  assert.match(runner, /Test-PlotPickleReady/);
  assert.match(runner, /Start-Process -FilePath "cmd\.exe"/);
  assert.match(runner, /while \(\(Get-Date\) -lt \$Deadline\)/);
  assert.match(runner, /BLOCKED/);
});

test("full verification records every result and fails visibly when any check needs attention", async () => {
  const runner = await read("scripts/run-plotpickle-full-check.ps1");

  assert.match(runner, /Start-Transcript/);
  assert.match(runner, /plotpickle-full-check-\$Stamp\.log/);
  assert.match(runner, /FINAL SUMMARY/);
  assert.match(runner, /Where-Object \{ \$_\.Status -ne "PASS" \}/);
  assert.match(runner, /Nothing was hidden or treated as a pass/);
  assert.match(runner, /exit \$FinalExitCode/);
  assert.doesNotMatch(runner, /C:\\Users\\/i);
});

test("one-click runner does not add cloud fallback or model download behavior", async () => {
  const runner = await read("scripts/run-plotpickle-full-check.ps1");

  assert.doesNotMatch(runner, /api\.openai\.com|api\.anthropic\.com|openrouter\.ai/i);
  assert.doesNotMatch(runner, /ollama\s+pull|lms\s+get/i);
});

test("focused Startup UAT owns the one-click verification regression", async () => {
  const registry = JSON.parse(await read("config/uat-autopilot-registry.json"));
  const startup = registry.areas.find((area) => area.id === "startup");
  assert.ok(startup);
  assert.ok(startup.tests.includes("tests/issue-699-one-click-full-verification.test.mjs"));
});
