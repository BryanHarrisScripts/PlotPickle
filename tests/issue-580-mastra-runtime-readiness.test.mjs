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

test("Curriculum Guide preflights Mastra and Ollama and bounds local generation time", async () => {
  const guide = await read("modules/creative-room/curriculum-guide.ts");

  assert.match(guide, /\/api\/writing-assistant\/status/);
  assert.match(guide, /status\.mastra\?\.ready/);
  assert.match(guide, /status\.ollama\?\.reachable/);
  assert.match(guide, /status\.ollama\.models\?\.length/);
  assert.match(guide, /AbortSignal\.timeout\(5_000\)/);
  assert.match(guide, /AbortSignal\.timeout\(120_000\)/);
  assert.match(guide, /reached Mastra and Ollama/);
});
