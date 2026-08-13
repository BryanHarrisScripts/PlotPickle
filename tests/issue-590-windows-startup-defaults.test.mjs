import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const launcher = await readFile(new URL("../Start-PlotPickle.bat", import.meta.url), "utf8");

test("Windows startup restores the established local defaults and working server path", () => {
  assert.match(launcher, /set "STORY_BUILDER_AGENT=scripts\\full-story-builder-agent\.mjs"/);
  assert.match(launcher, /set "UI_CONTINUITY_AGENT=scripts\\ui-continuity-agent\.mjs"/);
  assert.match(launcher, /set "UAT_RUNNER=scripts\\run-creative-writer-uat\.ps1"/);
  assert.match(launcher, /call :start_full_story_builder/);
  assert.match(launcher, /call :start_ui_continuity_agent/);
  assert.match(launcher, /start "PlotPickle Full Story Builder" node "%STORY_BUILDER_AGENT%" --server "%PLOTPICKLE_URL%" --stay-open/);
  assert.match(launcher, /start "PlotPickle UI Continuity Agent" node "%UI_CONTINUITY_AGENT%" --server "%PLOTPICKLE_URL%" --stay-open/);
  assert.match(launcher, /call "%VITE_CMD%" --host 127\.0\.0\.1 --port %PLOTPICKLE_PORT% --strictPort/);
});
