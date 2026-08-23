import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

test("Start-PlotPickle no longer offers or launches the Creative Writer UAT during normal startup", async () => {
  const startup = await read("Start-PlotPickle.bat");
  const normalStartup = startup.slice(0, startup.indexOf(":probe_existing"));

  assert.match(startup, /set "UAT_RUNNER=scripts\\run-creative-writer-uat\.ps1"/);
  assert.doesNotMatch(normalStartup, /Run the Creative Writer UAT after PlotPickle starts/);
  assert.doesNotMatch(normalStartup, /start "PlotPickle Creative Writer UAT"/);
  assert.doesNotMatch(normalStartup, /AGENT [123] OF 3/);
  assert.match(startup, /Creative Writer UAT are retained as manual developer tools/);
});

test("the separate LEARN and Creative Writer UAT tools remain available for deliberate testing", async () => {
  const [learnRunner, creativeWriterRunner] = await Promise.all([
    read("scripts/run-learn-uat.ps1"),
    read("scripts/run-creative-writer-uat.ps1"),
  ]);

  assert.match(learnRunner, /foundation-architecture\.test\.mjs/);
  assert.match(learnRunner, /\/api\/writing-assistant\/status/);
  assert.match(learnRunner, /Mastra readiness/);
  assert.match(learnRunner, /Curriculum Guide engine/);
  assert.match(learnRunner, /LEARN UAT RESULT/);
  assert.match(learnRunner, /PASS/);
  assert.match(learnRunner, /WARN/);
  assert.match(learnRunner, /FAIL/);
  assert.match(creativeWriterRunner, /Creative Writer UAT/);
});
