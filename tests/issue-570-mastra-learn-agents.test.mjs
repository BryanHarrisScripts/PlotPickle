import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

test("Mastra is the live Learn agent runtime", async () => {
  const [runtime, gateway, shell, pkg] = await Promise.all([
    read("build/mastra-agent-runtime.ts"),
    read("build/writing-assistant-gateway.ts"),
    read("app/learn-three-column-shell.tsx"),
    read("package.json"),
  ]);
  assert.match(runtime, /from "@mastra\/core\/agent"/);
  assert.match(runtime, /new Mastra\(\{ agents/);
  assert.match(runtime, /agent\.generate\(prompt\)/);
  assert.match(gateway, /askPlotPickleAgent/);
  assert.match(gateway, /mastraRuntimeStatus/);
  assert.match(shell, /Mastra · \$\{status\.mastra\.agents\.length\} agents ready/);
  assert.equal(JSON.parse(pkg).dependencies["@mastra/core"], "1.57.0");
});

test("Learn exposes a Workflow Change Agent with a human review boundary", async () => {
  const [runtime, shell, feedback] = await Promise.all([
    read("build/mastra-agent-runtime.ts"),
    read("app/learn-three-column-shell.tsx"),
    read("app/suggest-report-workspace.tsx"),
  ]);
  assert.match(runtime, /"workflow-change"/);
  assert.match(runtime, /never claim it was submitted/i);
  assert.match(shell, /Workflow Change Agent/);
  assert.match(shell, /Prepare reviewable change request/);
  assert.match(shell, /plotpickle\.workflow-change-draft\.v1/);
  assert.match(feedback, /source !== "workflow-change-agent"/);
  assert.match(feedback, /Review it, remove private story material/);
});
