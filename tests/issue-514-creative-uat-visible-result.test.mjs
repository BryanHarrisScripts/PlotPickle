import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Creative Writer UAT keeps PASS results visible until Enter", async () => {
  const script = await source("scripts/run-creative-writer-uat.ps1");
  assert.match(script, /function Show-CreativeUatResult/);
  assert.match(script, /Read-Host "Press Enter to close the Creative Writer UAT window"/);
  assert.match(script, /Status: COMPLETE - Creative Writer acceptance report produced/);
  assert.match(script, /Show-CreativeUatResult\s*\nexit 0/);
});

test("Creative Writer UAT keeps failures visible instead of throwing out of the launched window", async () => {
  const script = await source("scripts/run-creative-writer-uat.ps1");
  assert.match(script, /function Stop-CreativeUat/);
  assert.match(script, /trap \{\s*Stop-CreativeUat \$_\.Exception\.Message 1\s*\}/s);
  assert.match(script, /FAIL: \$Message/);
  assert.match(script, /ended without producing an acceptance report/);
  assert.match(script, /reported a blocking product-flow failure/);
  assert.doesNotMatch(script, /throw "Creative Writer UAT reported a blocking product-flow failure/);
});

test("Creative Writer UAT always exposes report trace and log paths", async () => {
  const script = await source("scripts/run-creative-writer-uat.ps1");
  for (const contract of ["Report: $reportPath", "Trace:  $tracePath", "Log:    $logPath", "Workspace: $artifactRoot"]) {
    assert.ok(script.includes(contract), `Missing visible UAT evidence contract: ${contract}`);
  }
});
