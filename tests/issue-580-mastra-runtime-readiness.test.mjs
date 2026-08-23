import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

test("Mastra readiness probes the embedded runtime instead of returning a hard-coded flag", async () => {
  const runtime = await read("build/mastra-agent-runtime.ts");

  assert.match(runtime, /HEALTH_CHECK_PROFILE/);
  assert.match(runtime, /createPlotPickleMastra\(HEALTH_CHECK_PROFILE\)/);
  assert.match(runtime, /for \(const id of agents\) mastra\.getAgent\(id\)/);
  assert.match(runtime, /mode: "embedded"/);
  assert.match(runtime, /ready: false/);
  assert.match(runtime, /The embedded Mastra runtime could not initialize/);
});

test("Mastra execution and the Curriculum Guide keep a bounded local response budget", async () => {
  const [runtime, guide] = await Promise.all([
    read("build/mastra-agent-runtime.ts"),
    read("modules/creative-room/curriculum-guide.ts"),
  ]);

  assert.match(runtime, /MASTRA_AGENT_TIMEOUT_MS = 25_000/);
  assert.match(runtime, /const abortSignal = AbortSignal\.timeout\(MASTRA_AGENT_TIMEOUT_MS\)/);
  assert.match(runtime, /const executionOptions = \{[\s\S]*abortSignal,/);
  assert.match(runtime, /agent\.generate\(prompt, (?:\{[\s\S]*\.\.\.executionOptions|executionOptions)\)/);
  assert.match(runtime, /structuredOutput: \{[\s\S]*foundationProposalSchema/);
  assert.match(runtime, /jsonPromptInjection: false/);
  assert.match(runtime, /30-second response limit/);
  assert.match(guide, /\/api\/writing-assistant\/status/);
  assert.match(guide, /status\.mastra\?\.ready/);
  assert.match(guide, /status\.localRuntime\?\.ready/);
  assert.match(guide, /AbortSignal\.timeout\(3_000\)/);
  assert.match(guide, /AbortSignal\.timeout\(45_000\)/);
  assert.match(guide, /local response limit/);
  assert.doesNotMatch(guide, /status\.ollama\?\.reachable/);
});
