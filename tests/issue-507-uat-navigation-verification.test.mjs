import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import test from "node:test";

const runnerUrl = new URL("../scripts/run-local-browser-uat.mjs", import.meta.url);
const runner = await readFile(runnerUrl, "utf8");

test("local UAT runner still parses after navigation verification changes", () => {
  const check = spawnSync(process.execPath, ["--check", fileURLToPath(runnerUrl)], { encoding: "utf8" });
  assert.equal(check.status, 0, check.stderr || check.stdout);
});

test("successful clicks are verified against the actual application state", () => {
  assert.match(runner, /shellWorkspaceCount: document\.querySelectorAll\('\[data-workspace-id\]'\)\.length/);
  assert.match(runner, /dashboardReached = dashboardClicked[\s\S]*shellWorkspaceCount[\s\S]*stateMatchesScreen\(dashboard, dashboardState\)/);
  assert.match(runner, /state = clicked \? await pageState\(\) : \{\};/);
  assert.match(runner, /reached = clicked && stateMatchesScreen\(screen, state\);/);
});

test("a click that does not activate its target falls back to documented local navigation", () => {
  assert.match(runner, /const recoveryUrl = \(screen\)/);
  assert.match(runner, /method = "direct recovery navigation"/);
  assert.match(runner, /accepted the click but did not activate the target workspace/);
  assert.match(runner, /await navigate\(recoveryUrl\(screen\)\)/);
  assert.match(runner, /reached = stateMatchesScreen\(screen, state\)/);
});

test("splash entry is verified instead of treating browser_click success as Dashboard success", () => {
  assert.match(runner, /application shell did not become active/);
  assert.match(runner, /await navigate\(recoveryUrl\(dashboard\)\)/);
  assert.doesNotMatch(runner, /screen\.id === "dashboard"\) reached = true/);
});
