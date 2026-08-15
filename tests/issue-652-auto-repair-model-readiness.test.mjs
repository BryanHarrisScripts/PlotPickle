import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("startup already performs the repair-worker readiness check automatically", async () => {
  const discovery = await read("build/uat-discovery-plugin.ts");
  assert.match(discovery, /developerRepairPreflight\(\)/);
  assert.match(discovery, /run-uat-repair-agent\.mjs/);
  assert.match(discovery, /"--preflight", "--json"/);
  assert.match(discovery, /Developer repair worker/);
});

test("closed-loop UAT auto-loads only an already-downloaded LM Studio coding model when repair is actually needed", async () => {
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
  assert.match(ensure, /\["load", selected, "--ttl", "3600", "-y"\]/);
  assert.match(ensure, /\["server", "start", "--bind", "127\.0\.0\.1"\]/);
  assert.match(ensure, /PLOTPICKLE_REPAIR_AUTOLOAD === "0"/);
  assert.doesNotMatch(ensure, /\blms\s+get\b|\["get"/);
  assert.doesNotMatch(ensure, /api\.openai\.com|openrouter\.ai|api\.anthropic\.com/);
});

test("automatic repair-model loading preserves the approved local coding-model allowlist", async () => {
  const ensure = await read("scripts/ensure-local-repair-model.mjs");
  for (const expected of ["qwen3.8-27b", "qwen3-coder-30b", "qwen2.5-coder-32b", "devstral-small", "codestral", "deepseek-coder", "gpt-oss-20b"]) {
    assert.match(ensure, new RegExp(expected.replaceAll(".", "\\.")));
  }
  assert.match(ensure, /nothing was downloaded automatically/i);
});

test("focused Startup UAT owns automatic repair-model readiness", async () => {
  const registry = JSON.parse(await read("config/uat-autopilot-registry.json"));
  const startup = registry.areas.find((area) => area.id === "startup");
  assert.ok(startup);
  assert.ok(startup.tests.includes("tests/issue-652-auto-repair-model-readiness.test.mjs"));
});
