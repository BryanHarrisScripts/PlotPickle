import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #86 defines the packaged Windows interaction release gate", async () => {
  const smoke = await source("scripts/windows-interaction-smoke.mjs");
  for (const contract of [
    "PLOTPICKLE_HOME",
    "Page.addScriptToEvaluateOnNewDocument",
    "Runtime.exceptionThrown",
    "Runtime.consoleAPICalled",
    "Network.responseReceived",
    "Network.loadingFailed",
    "button, a[href]",
    "input[type='checkbox']",
    "input[type='radio']",
    "summary",
    "select",
    "Failed to execute 'removeChild'",
    "skippedActions",
    "maximumActions",
    "maximumStates",
    "taskkill.exe",
    "windows-interaction-smoke.json",
    "windows-interaction-smoke.md",
  ]) assert.ok(smoke.includes(contract), `Windows interaction smoke is missing: ${contract}`);

  assert.match(smoke, /externalOrCostlyAction/);
  assert.match(smoke, /directMutationAction/);
  assert.match(smoke, /terminateProcessTree/);
  assert.match(smoke, /process\.exit\(124\)/);
});

test("issue #86 gates the clean extracted Windows package on the interaction crawl", async () => {
  const workflow = await source(".github/workflows/release-candidate.yml");
  const extraction = workflow.indexOf("Clean-machine extraction and dependency test (Windows)");
  const interaction = workflow.indexOf("Run packaged Windows interaction smoke");

  assert.ok(extraction >= 0, "The Windows clean-machine extraction step is missing.");
  assert.ok(interaction > extraction, "The interaction smoke must run after clean extraction and dependency installation.");
  assert.match(workflow, /node scripts\/windows-interaction-smoke\.mjs/);
  assert.match(workflow, /PLOTPICKLE_SMOKE_TOTAL_TIMEOUT_MS/);
  assert.match(workflow, /name: plotpickle-windows-interaction-smoke-/);
  assert.match(workflow, /reports\/windows-interaction-smoke\//);
});

test("issue #86 keeps CI bounded and does not run Lighthouse", async () => {
  const [quality, release] = await Promise.all([
    source(".github/workflows/quality.yml"),
    source(".github/workflows/release-candidate.yml"),
  ]);

  assert.match(quality, /cancel-in-progress: true/);
  assert.match(quality, /timeout-minutes: 20/);
  assert.match(quality, /node --check scripts\/windows-interaction-smoke\.mjs/);
  assert.match(release, /cancel-in-progress: true/);
  assert.match(release, /timeout-minutes: 30/);
  assert.doesNotMatch(`${quality}\n${release}`, /npm run audit:lighthouse|Lighthouse all-route smoke/);
});

test("issue #86 retires the unsupported Lighthouse runner instead of presenting it as valid", async () => {
  const [runner, launcher, docs] = await Promise.all([
    source("scripts/lighthouse-audit.mjs"),
    source("Run-Lighthouse.bat"),
    source("public/docs/readme/COLLABORATION-AND-DEVELOPMENT.md"),
  ]);

  assert.match(runner, /Lighthouse runner has been retired/);
  assert.match(runner, /never provided a trustworthy packaged-runtime release gate/);
  assert.doesNotMatch(runner, /vite preview|lighthouse@/);
  assert.match(launcher, /Lighthouse runner has been retired/);
  assert.match(docs, /Lighthouse runner is retired/);
  assert.match(docs, /Windows packaged interaction release gate/);
  assert.match(docs, /tabs, pills, buttons, menus/);
});
