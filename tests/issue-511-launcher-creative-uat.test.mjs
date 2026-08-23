import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const launcher = await readFile(new URL("../Start-PlotPickle.bat", import.meta.url), "utf8");

test("Windows launcher defaults the temporary UAT control to Creative Writer acceptance", () => {
  assert.match(launcher, /set "UAT_RUNNER=scripts\\run-creative-writer-uat\.ps1"/);
  assert.match(launcher, /Run the Creative Writer UAT after PlotPickle starts\? \[Y\/N\]/);
  assert.match(launcher, /PlotPickle Creative Writer UAT/);
  assert.match(launcher, /New Project through Graphic Novel/);
  assert.match(launcher, /does not require ChatGPT or Codex quota/i);
});

test("both existing-session and fresh-start paths invoke the Creative Writer runner directly", () => {
  const launches = launcher.match(/-File "%UAT_RUNNER%" -BaseUrl "%PLOTPICKLE_URL%"/g) || [];
  assert.equal(launches.length, 2);
  assert.doesNotMatch(launcher, /-File "%UAT_RUNNER%"[^\r\n]*-Scope smoke/);
  assert.doesNotMatch(launcher, /set "UAT_RUNNER=scripts\\run-local-uat\.ps1"/);
});
