import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("normal startup diagnostics finish after agent health without offering UAT", async () => {
  const entry = await read("build/startup-agent-diagnostics.ts");

  assert.match(entry, /await runStartupAgentDiagnostics\(baseUrl\)/);
  assert.doesNotMatch(entry, /offerStartupUatDecision|startup-uat-decision|Start the PlotPickle UAT Agent now/);
  assert.doesNotMatch(entry, /finally\s*\{[\s\S]*UatDecision/);
});

test("the retired startup UAT prompt helper is not part of the product anymore", async () => {
  const retired = new URL("../build/startup-uat-decision.ts", import.meta.url);
  await assert.rejects(access(retired), /ENOENT/);
});

test("Full Check owns deliberate verification instead of everyday startup", async () => {
  const [launcher, fullCheck] = await Promise.all([
    read("Start-PlotPickle.bat"),
    read("scripts/run-plotpickle-full-check.ps1"),
  ]);

  assert.doesNotMatch(launcher, /Start the PlotPickle UAT Agent now|run-uat-closed-loop\.mjs|--github-report.*--repair/);
  assert.match(fullCheck, /8 of 9 - Exhaustive code-aware UI and UX UAT/);
  assert.match(fullCheck, /run-exhaustive-ui-uat\.mjs", "--github-report"/);
  assert.match(fullCheck, /9 of 9 - Writer-in-Residence/);
});

test("focused Startup UAT owns the normal-startup separation regression", async () => {
  const registry = JSON.parse(await read("config/uat-autopilot-registry.json"));
  const startup = registry.areas.find((area) => area.id === "startup");
  assert.ok(startup?.tests.includes("tests/issue-636-startup-uat-decision.test.mjs"));
});
