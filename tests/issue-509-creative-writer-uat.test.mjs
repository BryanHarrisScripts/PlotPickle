import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const runnerUrl = new URL("../scripts/run-creative-writer-uat.mjs", import.meta.url);
const runner = await readFile(runnerUrl, "utf8");
const actionsUrl = new URL("../scripts/creative-uat/browser-actions.mjs", import.meta.url);
const actions = await readFile(actionsUrl, "utf8");
const runtimeUrl = new URL("../scripts/creative-uat/mcp-runtime.mjs", import.meta.url);
const runtime = await readFile(runtimeUrl, "utf8");
const fixture = await readFile(new URL("../scripts/creative-uat/fixture.mjs", import.meta.url), "utf8");
const smokeRunner = await readFile(new URL("../scripts/run-local-browser-uat.mjs", import.meta.url), "utf8");
const pluginConfig = await readFile(new URL("../tools/agent-plugins/plotpickle-workflow-tester/mcp.json", import.meta.url), "utf8");

test("Creative Writer UAT modules parse as valid JavaScript", () => {
  for (const url of [runnerUrl, actionsUrl, runtimeUrl]) {
    const check = spawnSync(process.execPath, ["--check", fileURLToPath(url)], { encoding: "utf8" });
    assert.equal(check.status, 0, check.stderr || check.stdout);
  }
});

test("creative UAT follows one disposable visual-writing story end to end", () => {
  for (const stage of [
    "New Project", "Story Setup", "Concept Canvas", "World and Location", "Character Identity", "Story Moment",
    "Persistence Check", "Storyboard Direction", "Write Screenplay", "Edit and Revision", "Graphic Novel", "Build",
    "Feedback", "Refine", "Return to Graphic Novel",
  ]) assert.match(runner, new RegExp(stage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(runner, /first-time visual creative writer\/director/);
  assert.match(runner, /Concept -> Explore -> Compare -> Direct -> Refine -> Approve -> Reuse/);
});

test("creative UAT uses visible controls first and verifies persisted project evidence", () => {
  assert.match(actions, /async function clickVisible/);
  assert.match(actions, /async function fillByLabel/);
  assert.match(actions, /browser_click/);
  assert.match(actions, /browser_type/);
  assert.match(actions, /localStorage\.getItem\('plotpickle\.project\.v1'\)/);
  assert.match(runner, /state\.title === fixture\.title/);
  assert.match(runner, /state\.characterCount >= 1/);
  assert.match(runner, /state\.locationCount >= 1/);
  assert.match(runner, /state\.screenplayCount >= 2/);
});

test("World and Location activation is verified before downstream continuity checks", () => {
  assert.match(actions, /activeStorySection/);
  assert.match(actions, /visibleLocationCount/);
  assert.match(actions, /async function clickExactStorySection/);
  assert.match(actions, /Used exact Story Rail control/);
  assert.match(actions, /Retried visible \$\{label\} control through the DOM because Playwright reported success without creating a location/);
  assert.match(actions, /label === "Create the first location" \|\| label === "Add location"/);
});

test("character and world visuals are first-class writing inputs", () => {
  assert.match(runner, /World and Location/);
  assert.match(runner, /Character Identity/);
  assert.match(fixture, /visualLanguage/);
  assert.match(runner, /Character identity and Location\/World direction are treated as writing, not Settings/);
});

test("creative UAT is local-only and separates product findings from runner findings", () => {
  assert.match(runner, /## Product Flow findings/);
  assert.match(runner, /## Runner \/ Infrastructure findings/);
  assert.match(runner, /Missing candidate-generation material is reported as a product WARN/);
  assert.match(runner, /Existing user projects outside the isolated UAT browser context are not modified/);
  assert.doesNotMatch(`${runner}\n${actions}\n${runtime}`, /OPENAI_API_KEY|api\.openai\.com/);
});

test("existing fast smoke gate remains available and Agent Plugin stays isolated", () => {
  assert.match(smokeRunner, /const smokeJourney = \[/);
  assert.match(smokeRunner, /const fullJourney = \[/);
  assert.match(pluginConfig, /--isolated/);
  assert.match(pluginConfig, /@playwright\/mcp@0\.0\.78/);
});
