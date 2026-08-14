import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("#548 helper implementations remain available for deliberate manual use", async () => {
  const [builder, continuity, uat, status] = await Promise.all([
    read("scripts/full-story-builder-agent.mjs"),
    read("scripts/ui-continuity-agent.mjs"),
    read("scripts/run-creative-writer-uat.ps1"),
    read("lib/agent-window-status.mjs"),
  ]);

  for (const phrase of ["AGENT LOADED", "Instructions required", "Instructions:", "AGENT COMPLETED", "AGENT NEEDS ATTENTION"]) {
    assert.ok(status.includes(phrase) || uat.includes(phrase), `Missing shared lifecycle phrase: ${phrase}`);
  }
  assert.match(builder, /Learn > Full Story Builder/);
  assert.match(builder, /WAITING FOR INSTRUCTIONS/);
  assert.match(builder, /Open completed story/);
  assert.match(continuity, /WORKING AUTOMATICALLY/);
  assert.match(uat, /AGENT LOADED: PlotPickle Creative Writer UAT/);
});

test("normal PlotPickle startup no longer opens the three helper windows", async () => {
  const batch = await read("Start-PlotPickle.bat");
  const normalStartup = batch.slice(0, batch.indexOf(":probe_existing"));

  assert.doesNotMatch(normalStartup, /call :start_full_story_builder/);
  assert.doesNotMatch(normalStartup, /call :start_ui_continuity_agent/);
  assert.doesNotMatch(normalStartup, /start "PlotPickle Creative Writer UAT"/);
  assert.doesNotMatch(normalStartup, /Run the Creative Writer UAT after PlotPickle starts/);
  assert.doesNotMatch(normalStartup, /\[AGENT [123] OF 3/);
  assert.match(batch, /retained as manual developer tools/);
});

test("#550 Production Supervisor remains separate and paid generation consent-gated", async () => {
  const [launcher, supervisor, video] = await Promise.all([
    read("Start-Production-Supervisor.bat"),
    read("scripts/production-supervisor-agent.mjs"),
    read("scripts/video-production-agent.mjs"),
  ]);
  assert.match(launcher, /VIDEO_AGENT=scripts\\video-production-agent\.mjs/);
  assert.match(launcher, /start "PlotPickle Video Production Agent" node "%VIDEO_AGENT%" --server "%PLOTPICKLE_URL%" --stay-open/);
  assert.match(launcher, /does not .*authorize paid generation/i);
  assert.match(supervisor, /video-and-animatic-production/);
  assert.match(video, /Automatic startup never grants paid consent or data-sharing consent/);
  assert.match(video, /Submission remains a separate explicit production action/);
  assert.doesNotMatch(video, /method:\s*["']POST["'][\s\S]{0,160}\/api\/local-ai\/generate\/video/);
});

test("#548 remains available as a focused manual-tool regression", async () => {
  const packageJson = await read("package.json");
  const pkg = JSON.parse(packageJson);
  assert.equal(pkg.scripts["test:persistent-agent-windows"], "node --test tests/issue-548-persistent-agent-windows.test.mjs");
});
