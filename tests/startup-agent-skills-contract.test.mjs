import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Windows startup verifies Agent Skills before opening the local server", async () => {
  const launcher = await source("Start-PlotPickle.bat");

  assert.match(launcher, /set "AGENT_SKILLS_CLI=scripts\\agent-skills\.mjs"/);
  assert.match(launcher, /node "%AGENT_SKILLS_CLI%" --self-test/);
  assert.match(launcher, /PlotPickle Agent Skills are registered and verified/);
  assert.match(launcher, /PlotPickle Agent Skills could not be verified/);

  const verifyIndex = launcher.indexOf('node "%AGENT_SKILLS_CLI%" --self-test');
  const serverIndex = launcher.indexOf('call "%VITE_CMD%" --host 127.0.0.1 --port %PLOTPICKLE_PORT% --strictPort');
  assert.ok(verifyIndex >= 0, "startup must run the Agent Skills self-test");
  assert.ok(serverIndex > verifyIndex, "Agent Skills must be verified before the local server starts");
});

test("Windows startup v4 rejects sessions created under older startup contracts", async () => {
  const launcher = await source("Start-PlotPickle.bat");

  assert.match(launcher, /set "PLOTPICKLE_STARTUP_MARKER=plotpickle-startup-v4"/);
  assert.match(launcher, /set "PLOTPICKLE_STARTUP_MARKER=plotpickle-startup-v4-!PLOTPICKLE_SOURCE_SHA!"/);
  assert.doesNotMatch(launcher, /plotpickle-startup-v3/);
  assert.match(launcher, /\$response\.Content -match '%PLOTPICKLE_STARTUP_MARKER%'/);
});

test("normal startup remains a lightweight three-step launch instead of running Full Verification", async () => {
  const launcher = await source("Start-PlotPickle.bat");

  assert.match(launcher, /\[STEP 1 OF 3\].*Preparing the required local runtime/);
  assert.match(launcher, /\[STEP 2 OF 3\].*Checking required PlotPickle components/);
  assert.match(launcher, /\[STEP 3 OF 3\].*Starting the private local server/);
  assert.doesNotMatch(launcher, /run-plotpickle-full-check|run-exhaustive-ui-uat|run-writer-in-residence|npm run build/i);
});
