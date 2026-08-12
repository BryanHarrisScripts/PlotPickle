import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

test("Start-PlotPickle launches one LEARN UAT instead of the three legacy agents", async () => {
  const startup = await read("Start-PlotPickle.bat");

  assert.match(startup, /set "UAT_RUNNER=scripts\\run-learn-uat\.ps1"/);
  assert.match(startup, /Run the LEARN UAT after PlotPickle starts/);
  assert.match(startup, /start "PlotPickle LEARN UAT"/);
  assert.doesNotMatch(startup, /STORY_BUILDER_AGENT/);
  assert.doesNotMatch(startup, /UI_CONTINUITY_AGENT/);
  assert.doesNotMatch(startup, /start_full_story_builder/);
  assert.doesNotMatch(startup, /start_ui_continuity_agent/);
  assert.doesNotMatch(startup, /AGENT [123] OF 3/);
});

test("LEARN UAT reports PASS WARN FAIL and checks the rebuilt local teaching path", async () => {
  const runner = await read("scripts/run-learn-uat.ps1");

  assert.match(runner, /foundation-architecture\.test\.mjs/);
  assert.match(runner, /\/api\/writing-assistant\/status/);
  assert.match(runner, /Mastra readiness/);
  assert.match(runner, /Curriculum Guide engine/);
  assert.match(runner, /LEARN UAT RESULT/);
  assert.match(runner, /PASS/);
  assert.match(runner, /WARN/);
  assert.match(runner, /FAIL/);
});
