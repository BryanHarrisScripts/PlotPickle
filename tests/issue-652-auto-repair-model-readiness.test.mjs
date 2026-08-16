import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("startup performs repair-worker readiness and local autoload automatically", async () => {
  const discovery = await read("build/uat-discovery-plugin.ts");
  assert.match(discovery, /developerRepairPreflight\(\)/);
  assert.match(discovery, /run-uat-repair-agent\.mjs/);
  assert.match(discovery, /"--preflight", "--json"/);
  assert.match(discovery, /ensureDeveloperRepairModel/);
  assert.match(discovery, /ensure-local-repair-model\.mjs/);
  assert.match(discovery, /Developer repair worker/);
});

test("closed-loop UAT loads only an already-installed local coding model before repair preflight", async () => {
  const [closedLoop, ensure] = await Promise.all([
    read("scripts/run-uat-closed-loop.mjs"),
    read("scripts/ensure-local-repair-model.mjs"),
  ]);
  const repairBlock = closedLoop.indexOf("if (repair && deduped.length)");
  const ensureCall = closedLoop.indexOf("scripts/ensure-local-repair-model.mjs");
  const preflightCall = closedLoop.indexOf('"--preflight", "--require-ready"');
  assert.ok(repairBlock >= 0);
  assert.ok(ensureCall > repairBlock);
  assert.ok(preflightCall > ensureCall);

  assert.match(ensure, /lmsAvailable/);
  assert.match(ensure, /\["ls", "--llm", "--json"\]/);
  assert.match(ensure, /\["load", model, "--ttl", "3600", "-y"\]/);
  assert.match(ensure, /\["server", "start", "--bind", "127\.0\.0\.1"\]/);
  assert.match(ensure, /ollamaInstalledModels/);
  assert.match(ensure, /warmOllama/);
  assert.match(ensure, /PLOTPICKLE_REPAIR_AUTOLOAD === "0"/);
  assert.doesNotMatch(ensure, /\blms\s+get\b|\["get"|ollama\s+pull|\["pull"/i);
  assert.doesNotMatch(ensure, /api\.openai\.com|openrouter\.ai|api\.anthropic\.com/);
});

test("automatic repair-model loading preserves the approved local coding-model allowlist including a lightweight Pi option", async () => {
  const policy = await read("scripts/developer-repair-model-policy.mjs");
  for (const expected of ["qwen2.5-coder-7b", "qwen2.5-coder-14b", "qwen3.8-27b", "qwen3-coder-30b", "qwen2.5-coder-32b", "devstral-small", "codestral", "deepseek-coder", "gpt-oss-20b"]) {
    assert.match(policy, new RegExp(expected.replaceAll(".", "\\.")));
  }
  const ensure = await read("scripts/ensure-local-repair-model.mjs");
  assert.match(ensure, /did not download one automatically/i);
  assert.match(ensure, /Qwen2\.5-Coder 7B/);
});

test("focused Startup UAT owns automatic repair-model readiness", async () => {
  const registry = JSON.parse(await read("config/uat-autopilot-registry.json"));
  const startup = registry.areas.find((area) => area.id === "startup");
  assert.ok(startup);
  assert.ok(startup.tests.includes("tests/issue-652-auto-repair-model-readiness.test.mjs"));
});
