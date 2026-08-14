import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const launcher = await readFile(new URL("../Start-PlotPickle.bat", import.meta.url), "utf8");

test("Windows startup opens PlotPickle without dormant companion-agent windows", () => {
  assert.match(launcher, /set "STORY_BUILDER_AGENT=scripts\\full-story-builder-agent\.mjs"/);
  assert.match(launcher, /set "UI_CONTINUITY_AGENT=scripts\\ui-continuity-agent\.mjs"/);
  assert.match(launcher, /set "UAT_RUNNER=scripts\\run-creative-writer-uat\.ps1"/);

  const normalStartup = launcher.slice(0, launcher.indexOf(":probe_existing"));
  assert.doesNotMatch(normalStartup, /call :start_full_story_builder/);
  assert.doesNotMatch(normalStartup, /call :start_ui_continuity_agent/);
  assert.doesNotMatch(normalStartup, /Run the Creative Writer UAT after PlotPickle starts/);
  assert.doesNotMatch(normalStartup, /PlotPickle Creative Writer UAT/);
  assert.doesNotMatch(normalStartup, /\[AGENT [123] OF 3/);

  assert.match(launcher, /Mastra .* is installed and ready for PlotPickle agents/);
  assert.match(launcher, /\[READY\] Mastra and the local agent runtime are loaded and verified/);
  assert.match(launcher, /call "%VITE_CMD%" --host 127\.0\.0\.1 --port %PLOTPICKLE_PORT% --strictPort/);
});

test("retired startup helpers remain available only as manual developer tools", () => {
  assert.match(launcher, /Full Story Builder, UI Continuity, and Creative Writer UAT are retained as manual developer tools/);
  assert.match(launcher, /:start_full_story_builder/);
  assert.match(launcher, /:start_ui_continuity_agent/);
  assert.match(launcher, /\[MANUAL TOOL STARTED\] Full Story Builder/);
  assert.match(launcher, /\[MANUAL TOOL STARTED\] UI Continuity Agent/);
});
