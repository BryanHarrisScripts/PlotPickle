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

test("closed-loop UAT ensures a hardware-suitable local coding or agent model before repair preflight", async () => {
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
  assert.match(ensure, /probeRuntimeModelCapabilities/);
  assert.match(ensure, /detectRepairHardware/);
  assert.match(ensure, /PLOTPICKLE_REPAIR_AUTOLOAD === "0"/);
  assert.match(ensure, /PLOTPICKLE_REPAIR_AUTO_DOWNLOAD !== "0"/);
  assert.match(ensure, /DEFAULT_OLLAMA_PI_MODEL = "qwen2\.5-coder:7b"/);
  assert.match(ensure, /\/api\/pull/);
  assert.match(ensure, /pullOllama\(model\)/);
  assert.match(ensure, /Pi repair readiness failed because no suitable local coding\/agent model is available/);
  assert.match(ensure, /process\.exitCode = 2/);
  assert.doesNotMatch(ensure, /api\.openai\.com|openrouter\.ai|api\.anthropic\.com/);
});

test("automatic repair-model readiness keeps the lightweight Pi default while allowing capability-verified newer models", async () => {
  const policy = await read("scripts/developer-repair-model-policy.mjs");
  for (const expected of ["qwen2.5-coder-7b", "qwen2.5-coder-14b", "qwen3.8-27b", "qwen3-coder-30b", "qwen2.5-coder-32b", "devstral-small", "codestral", "deepseek-coder", "gpt-oss-20b"]) {
    assert.match(policy, new RegExp(expected.replaceAll(".", "\\.")));
  }
  assert.match(policy, /capabilityApprovedCodingModel/);
  assert.match(policy, /repairCapabilityCacheApproves/);
  const ensure = await read("scripts/ensure-local-repair-model.mjs");
  assert.match(ensure, /qwen2\.5-coder:7b/);
  assert.match(ensure, /approvedCodingModel\(model\)/);
  assert.match(ensure, /DOWNLOADING/);
  assert.match(ensure, /READY/);
  assert.match(ensure, /writeRepairCapabilityCache/);
  assert.doesNotMatch(ensure, /did not download one automatically/i);
});

test("Sage startup grounding can recover against the current essentials-theme curriculum without masking other failures", async () => {
  const [entrypoint, adapter, theme] = await Promise.all([
    read("build/startup-agent-diagnostics.ts"),
    read("build/startup-agent-diagnostics-runtime-v4.ts"),
    read("learn/theme.json"),
  ]);
  assert.match(entrypoint, /startup-agent-diagnostics-runtime-v4/);
  assert.match(adapter, /runStartupAgentDiagnostics as runV3/);
  assert.match(adapter, /currentThemeContext/);
  assert.match(adapter, /item\.id === "essentials-theme"/);
  assert.match(adapter, /semanticGroundingPass/);
  assert.match(adapter, /onlyGroundingFailed/);
  assert.match(adapter, /failedChecks\.length === 1/);
  assert.match(adapter, /verifyCurrentSageGrounding/);
  assert.match(adapter, /modelRole: "quality"/);
  assert.match(adapter, /verified against current essentials-theme curriculum/);
  assert.match(theme, /"id": "essentials-theme"/);
  assert.match(theme, /live human question or contested proposition tested by the story's choices and consequences/);
});

test("focused Startup UAT owns automatic repair-model readiness", async () => {
  const registry = JSON.parse(await read("config/uat-autopilot-registry.json"));
  const startup = registry.areas.find((area) => area.id === "startup");
  assert.ok(startup);
  assert.ok(startup.tests.includes("tests/issue-652-auto-repair-model-readiness.test.mjs"));
});
