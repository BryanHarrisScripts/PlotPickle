import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

test("Start-PlotPickle keeps the persistent helpers and offers the creative-writer UAT explicitly", async () => {
  const startup = await read("Start-PlotPickle.bat");

  assert.match(startup, /set "UAT_RUNNER=scripts\\run-creative-writer-uat\.ps1"/);
  assert.match(startup, /Run the Creative Writer UAT after PlotPickle starts/);
  assert.match(startup, /start "PlotPickle Creative Writer UAT"/);
  assert.match(startup, /STORY_BUILDER_AGENT/);
  assert.match(startup, /UI_CONTINUITY_AGENT/);
  assert.match(startup, /start_full_story_builder/);
  assert.match(startup, /start_ui_continuity_agent/);
  assert.match(startup, /AGENT [123] OF 3/);
});

test("the separate LEARN UAT remains available for focused curriculum verification", async () => {
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
