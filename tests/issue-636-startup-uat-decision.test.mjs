import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("startup asks for an explicit Y/N decision only after agent health finishes", async () => {
  const [entry, decision] = await Promise.all([
    read("build/startup-agent-diagnostics.ts"),
    read("build/startup-uat-decision.ts"),
  ]);

  const diagnostics = entry.indexOf("await runStartupAgentDiagnostics(baseUrl)");
  const offer = entry.indexOf("await offerStartupUatDecision(baseUrl)");
  assert.ok(diagnostics >= 0 && offer > diagnostics, "UAT decision must follow startup health diagnostics");
  assert.match(entry, /finally\s*\{[\s\S]*offerStartupUatDecision/);
  assert.match(decision, /Start the PlotPickle UAT Agent now\? \[Y\/N\]:/);
  assert.match(decision, /Please enter Y or N/);
});

test("Y launches the existing closed loop with reporting and repair while N leaves PlotPickle alone", async () => {
  const decision = await read("build/startup-uat-decision.ts");

  assert.match(decision, /answer === "n" \|\| answer === "no"/);
  assert.match(decision, /Not started\. PlotPickle will continue running normally/);
  assert.match(decision, /answer === "y" \|\| answer === "yes"/);
  assert.match(decision, /run-uat-closed-loop\.mjs/);
  assert.match(decision, /"--github-report"/);
  assert.match(decision, /"--repair"/);
  assert.match(decision, /spawn\(process\.execPath/);
});

test("the startup prompt is interactive and opt-in rather than an automatic CI or dev-server side effect", async () => {
  const decision = await read("build/startup-uat-decision.ts");

  assert.match(decision, /process\.env\.PLOTPICKLE_STARTUP_CONTRACT/);
  assert.match(decision, /process\.stdin\.isTTY === true/);
  assert.match(decision, /process\.stdout\.isTTY === true/);
  assert.match(decision, /startupUatPromptShown/);
});

test("focused Startup UAT owns the startup UAT decision regression", async () => {
  const registry = JSON.parse(await read("config/uat-autopilot-registry.json"));
  const startup = registry.areas.find((area) => area.id === "startup");
  assert.ok(startup?.tests.includes("tests/issue-636-startup-uat-decision.test.mjs"));
});
