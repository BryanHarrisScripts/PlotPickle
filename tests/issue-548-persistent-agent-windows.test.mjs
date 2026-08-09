import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("#548 gives all three startup agents a clear loaded, instruction and completion lifecycle", async () => {
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
  assert.match(continuity, /This read-only audit starts automatically/);
  assert.match(uat, /AGENT LOADED: PlotPickle Creative Writer UAT/);
  assert.match(uat, /do not type test instructions here/);
});

test("#548 keeps companion windows open without blocking the PlotPickle server", async () => {
  const [batch, builder, continuity, status, uat] = await Promise.all([
    read("Start-PlotPickle.bat"),
    read("scripts/full-story-builder-agent.mjs"),
    read("scripts/ui-continuity-agent.mjs"),
    read("lib/agent-window-status.mjs"),
    read("scripts/run-creative-writer-uat.ps1"),
  ]);

  assert.match(batch, /start "PlotPickle Full Story Builder" node .* --stay-open/);
  assert.match(batch, /start "PlotPickle UI Continuity Agent" node .* --stay-open/);
  assert.match(batch, /\[AGENT 3 OF 3 STARTED\] Creative Writer UAT/);
  assert.match(batch, /\[AGENT 3 OF 3 NOT REQUESTED\] Creative Writer UAT/);
  assert.doesNotMatch(batch, /start "PlotPickle (?:Full Story Builder|UI Continuity Agent)" \/wait/);
  assert.match(builder, /process\.argv\.includes\("--stay-open"\)/);
  assert.match(continuity, /argv\.includes\("--stay-open"\)/);
  assert.match(status, /Press Enter when you want to close this window/);
  assert.match(uat, /Read-Host "Press Enter to close the Creative Writer UAT window"/);
});

test("#548 is registered in the complete suite, diagnostics and Visual gate", async () => {
  const [packageJson, diagnostics, workflow] = await Promise.all([
    read("package.json"),
    read("config/developer-diagnostics.json"),
    read(".github/workflows/visual.yml"),
  ]);
  const pkg = JSON.parse(packageJson);
  assert.match(pkg.scripts.test, /tests\/issue-548-persistent-agent-windows\.test\.mjs/);
  assert.equal(pkg.scripts["test:persistent-agent-windows"], "node --test tests/issue-548-persistent-agent-windows.test.mjs");
  assert.match(diagnostics, /"id": "startup-agent-windows"/);
  assert.match(diagnostics, /"startup\.agent-windows"/);
  assert.match(workflow, /tests\/issue-548-persistent-agent-windows\.test\.mjs/);
});
