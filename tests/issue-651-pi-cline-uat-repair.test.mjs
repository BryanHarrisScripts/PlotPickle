import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const readJson = async (file) => JSON.parse(await read(file));

test("developer repair policy is Pi-first, Cline-selectable, local-only and keeps Mastra as legacy", async () => {
  const stack = await readJson("config/developer-agent-stack.json");
  assert.equal(stack.repair.defaultWorker, "pi");
  assert.deepEqual(stack.repair.selectableWorkers, ["pi", "cline"]);
  assert.equal(stack.repair.legacyWorker, "mastra-qwen");
  assert.equal(stack.repair.localOnly, true);
  assert.equal(stack.repair.cloudFallback, false);
  assert.equal(stack.repair.requiresApprovedLocalCodingModel, true);
  assert.equal(stack.repair.isolatedWorktree, true);
  assert.equal(stack.repair.draftPrOnly, true);
});

test("repair runner supports Pi and Cline without falling through to a cloud or story model", async () => {
  const source = await read("scripts/run-uat-repair-agent.mjs");
  assert.match(source, /SUPPORTED_REPAIR_WORKERS = new Set\(\["pi", "cline", "mastra-qwen"\]\)/);
  assert.match(source, /PLOTPICKLE_REPAIR_WORKER \|\| "pi"/);
  assert.match(source, /APPROVED_LOCAL_CODING_MODEL_FRAGMENTS/);
  assert.match(source, /LM Studio/);
  assert.match(source, /llama\.cpp/);
  assert.match(source, /Ollama/);
  assert.match(source, /will not fall through to a paid\/cloud provider/i);
  assert.match(source, /PlotPickle will not silently downgrade UAT repair work to the Fast or Quality story models/);
  assert.doesNotMatch(source, /api\.openai\.com|api\.anthropic\.com|openrouter\.ai/);
});

test("Pi repair uses an isolated local custom-provider directory and offline headless execution", async () => {
  const source = await read("scripts/run-uat-repair-agent.mjs");
  assert.match(source, /"plotpickle-local"/);
  assert.match(source, /PI_CODING_AGENT_DIR/);
  assert.match(source, /PI_OFFLINE:\s*"1"/);
  assert.match(source, /PI_TELEMETRY:\s*"0"/);
  assert.match(source, /"--provider", "plotpickle-local"/);
  assert.match(source, /"--no-session"/);
  assert.match(source, /api:\s*"openai-completions"/);
});

test("Cline repair uses isolated local state and an explicit local OpenAI-compatible endpoint", async () => {
  const source = await read("scripts/run-uat-repair-agent.mjs");
  assert.match(source, /cline-repair/);
  assert.match(source, /"auth"[\s\S]*"--provider", "openai-native"[\s\S]*"--baseurl", runtime\.baseUrl/);
  assert.match(source, /"--data-dir", dataDir/);
  assert.match(source, /"--yolo"/);
  assert.match(source, /"--cwd", worktreeRoot/);
  assert.match(source, /"-k", "plotpickle-local"/);
});

test("closed-loop UAT preflights once and does not repeat one missing-model error for every finding", async () => {
  const source = await read("scripts/run-uat-closed-loop.mjs");
  const preflightIndex = source.indexOf('"--preflight", "--require-ready"');
  const loopIndex = source.indexOf("for (const finding of deduped)");
  assert.ok(preflightIndex >= 0);
  assert.ok(loopIndex > preflightIndex);
  assert.match(source, /no cloud\/story-model fallback was attempted/i);
});

test("startup reports actual repair preflight state instead of hard-coding Qwen READY", async () => {
  const source = await read("build/uat-discovery-plugin.ts");
  assert.match(source, /run-uat-repair-agent\.mjs/);
  assert.match(source, /--preflight/);
  assert.match(source, /Developer repair worker/);
  assert.match(source, /NOT READY/);
  assert.match(source, /Pi default \/ Cline selectable \/ no cloud fallback/);
  assert.doesNotMatch(source, /UAT Repair Agent\s+.*READY\s+Qwen3\.8-27B/);
});

test("focused Startup UAT owns the Pi Cline repair integration", async () => {
  const registry = await readJson("config/uat-autopilot-registry.json");
  const startup = registry.areas.find((area) => area.id === "startup");
  assert.ok(startup);
  assert.ok(startup.tests.includes("tests/issue-651-pi-cline-uat-repair.test.mjs"));
});
