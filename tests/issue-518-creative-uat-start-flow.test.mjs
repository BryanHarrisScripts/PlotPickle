import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const dashboardUrl = new URL("../app/dashboard-story-library.tsx", import.meta.url);
const actionsUrl = new URL("../scripts/creative-uat/browser-actions.mjs", import.meta.url);
const runtimeUrl = new URL("../scripts/creative-uat/mcp-runtime.mjs", import.meta.url);
const powershellUrl = new URL("../scripts/run-creative-writer-uat.ps1", import.meta.url);
const dashboard = await readFile(dashboardUrl, "utf8");
const actions = await readFile(actionsUrl, "utf8");
const runtime = await readFile(runtimeUrl, "utf8");
const powershell = await readFile(powershellUrl, "utf8");

test("Creative UAT JavaScript helpers still parse", () => {
  for (const url of [actionsUrl, runtimeUrl]) {
    const check = spawnSync(process.execPath, ["--check", fileURLToPath(url)], { encoding: "utf8" });
    assert.equal(check.status, 0, check.stderr || check.stdout);
  }
});

test("Dashboard New Project uses the canonical application project action", () => {
  assert.match(dashboard, /data-project-action=\"new-project\"/);
  assert.match(dashboard, /canonicalAction\.click\(\)/);
  assert.match(dashboard, /onClick=\{startNewProject\}>\+ New Project/);
  assert.match(dashboard, /onClick=\{startNewProject\}>Create story/);
  assert.doesNotMatch(dashboard, /onClick=\{\(\) => onOpenSection\("storySetup"\)\}>\+ New Project/);
});

test("accessibility ref matching no longer accepts unrelated descriptive text", () => {
  assert.match(runtime, /roleCandidates = lines\.filter/);
  assert.match(runtime, /roleToken\.test\(item\)/);
  assert.doesNotMatch(runtime, /\.\.\.lines\.filter\(\(item\) => item\.toLowerCase\(\)\.includes\(String\(label\)\.toLowerCase\(\)\)\)\]\)/);
});

test("Creative UAT resolves exact labelled form controls before generic DOM fallback", () => {
  assert.match(actions, /const generatedId = 'field-' \+ wanted\.toLowerCase\(\)\.replace/);
  assert.match(actions, /document\.getElementById\(generatedId\)/);
  assert.match(actions, /labelNode\?\.htmlFor/);
  assert.match(actions, /exact labelled DOM input fallback/);
});

test("disabled optional state controls are skipped rather than timing out", () => {
  assert.match(actions, /async function visibleControlState/);
  assert.match(actions, /control\.disabled/);
  assert.match(actions, /availability\.found && availability\.disabled/);
  assert.match(actions, /Skipped disabled visible control/);
});

test("Dashboard recognition and Windows report output are resilient", () => {
  assert.match(actions, /PlotPickle Studio Dashboard/);
  assert.match(actions, /dashboardVisible \? 'dashboard' : ''/);
  assert.match(powershell, /UTF8Encoding\(\$false\)/);
  assert.match(powershell, /\[Console\]::OutputEncoding = \$utf8NoBom/);
  assert.match(powershell, /Get-Content -Raw -Encoding UTF8/);
});
