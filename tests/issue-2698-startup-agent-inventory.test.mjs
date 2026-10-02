import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { reportStartupAgentInventory } from "../build/startup/agent-inventory.mjs";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const ready = { ready: true, runtime: "mastra", mode: "embedded", agents: ["curriculum-guide", "foundations-planner"] };

test("#2698 configured agents report registration without generating a response", () => {
  const previous = globalThis.fetch;
  let requests = 0;
  const output = [];
  globalThis.fetch = () => { requests++; throw new Error("Startup must not contact a provider"); };
  try {
    const status = { ...ready, provider: { configured: true, modelAvailable: true } };
    assert.deepEqual(reportStartupAgentInventory(status, (line) => output.push(line)), { healthy: true, inferenceAttempted: false });
    assert.equal(requests, 0);
    assert.ok(output.includes("Sage registration: READY"));
    assert.ok(output.includes("Inference tests: NOT RUN (explicit diagnostics only)"));
    assert.doesNotMatch(output.join("\n"), /response.*PASS|OVERALL: HEALTHY/);
  } finally { globalThis.fetch = previous; }
});

test("#2698 unavailable runtime and missing registrations stay visibly unavailable", () => {
  for (const status of [{ ...ready, ready: false }, { ...ready, mode: "external" }, { ...ready, agents: [] }]) {
    const output = [];
    assert.equal(reportStartupAgentInventory(status, (line) => output.push(line)).healthy, false);
    assert.ok(output.includes("RUNTIME INVENTORY: NEEDS ATTENTION"));
    assert.ok(output.some((line) => line.endsWith("UNAVAILABLE")));
  }
});

test("#2698 automatic plugin selects inventory while explicit inference diagnostics remain available", async () => {
  const [entry, adapter, runtime, windows] = await Promise.all([
    read("build/startup-agent-diagnostics.ts"), read("build/startup-agent-diagnostics-runtime-v6.ts"),
    read("build/mastra-agent-runtime.ts"), read("tests/issue-2698-windows-startup-proof.mjs"),
  ]);
  assert.match(entry, /await runStartupAgentInventory\(\)/);
  assert.doesNotMatch(entry, /await runStartupAgentDiagnostics|fetch\(/);
  assert.match(entry, /export \{ runStartupAgentDiagnostics \}/);
  assert.match(adapter, /reportStartupAgentInventory\(mastraRuntimeStatus\(\)\)/);
  assert.match(adapter, /return runV5\(baseUrl\)/);
  const inventory = adapter.slice(adapter.indexOf("export async function runStartupAgentInventory"));
  assert.match(inventory, /assertAgentProfilesValid\(\)/);
  assert.doesNotMatch(inventory, /runV5|fetch\(|generate\(|loadRole/);
  const registration = runtime.slice(runtime.indexOf("export function mastraRuntimeStatus"));
  assert.match(registration, /mastra.getAgent\(id\)/);
  assert.doesNotMatch(registration, /generate\(|fetch\(|loadRole/);
  assert.match(windows, /automatic agent registration inventory/);
});
