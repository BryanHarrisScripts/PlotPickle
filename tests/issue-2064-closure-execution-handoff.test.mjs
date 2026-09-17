import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

async function executionModule() {
  const inspectionTypeScript = await source("lib/preproduction/provider-instruction-inspection.ts");
  const inspectionCompiled = stripTypeScriptTypes(inspectionTypeScript, { mode: "transform" });
  const inspectionUrl = `data:text/javascript;base64,${Buffer.from(inspectionCompiled).toString("base64")}`;

  const executionTypeScript = await source("lib/preproduction/provider-instruction-execution.ts");
  let executionCompiled = stripTypeScriptTypes(executionTypeScript, { mode: "transform" });
  executionCompiled = executionCompiled.replace(
    /from\s+["']\.\/provider-instruction-inspection["']/, 
    `from "${inspectionUrl}"`,
  );
  return import(`data:text/javascript;base64,${Buffer.from(executionCompiled).toString("base64")}#execution-${Date.now()}-${Math.random()}`);
}

function integration(providerId = "openai", strategies = ["master", "per-shot"]) {
  return {
    version: 1,
    providerId,
    runtimeTarget: {
      capability: "video",
      locality: providerId === "openai" ? "cloud" : "local",
      sourceRegistryRouteId: providerId === "openai" ? "video.openai" : "video.comfyui-native",
      runtimeProviderId: providerId === "openai" ? "openai" : "comfyui",
      pluginAdapterId: providerId === "openai" ? null : "comfyui-ltx-local",
    },
    capabilityContract: {
      version: 1,
      providerId,
      capability: "video",
      compilationStrategies: strategies,
      rules: [],
    },
    instructionAdapter: { version: 1, providerId },
  };
}

function bundle(strategy = "per-shot", providerId = "openai") {
  return {
    version: 1,
    disposable: true,
    providerId,
    capability: "video",
    strategy,
    projectId: "story-2064",
    canonicalRevision: 42,
    directionLevel: "production",
    instructions: strategy === "master"
      ? [{ id: "instruction-master", scope: "master", text: "EXACT MASTER INSTRUCTION", sourceRefs: ["scene-1"] }]
      : [
          {
            id: "instruction-shot-1",
            scope: "shot",
            editorialShotId: "editorial-shot-1",
            productionShotId: "production-shot-1",
            text: "EXACT SHOT ONE INSTRUCTION",
            sourceRefs: ["scene-1", "production-shot-1"],
          },
          {
            id: "instruction-shot-2",
            scope: "shot",
            editorialShotId: "editorial-shot-2",
            productionShotId: "production-shot-2",
            text: "EXACT SHOT TWO INSTRUCTION",
            sourceRefs: ["scene-1", "production-shot-2"],
          },
        ],
    finishingRequirements: [{
      property: "delivery.frame-rate",
      strength: "required",
      sourceRef: "delivery:fps",
      treatment: "finishing",
      note: "Normalize in finishing only.",
      userVisibleAdaptationRequired: false,
    }],
    unsupportedPreferences: [],
    warnings: ["Shot timing is best-effort."],
    sourceRefs: ["scene-1"],
  };
}

test("#2064 closure hands the exact inspected master instruction to execution", async () => {
  const { buildProviderInstructionExecutionHandoff } = await executionModule();
  const handoff = buildProviderInstructionExecutionHandoff({
    integration: integration("openai"),
    bundle: bundle("master"),
  });

  assert.equal(handoff.disposable, true);
  assert.equal(handoff.canonical, false);
  assert.equal(handoff.providerId, "openai");
  assert.equal(handoff.runtimeTarget.sourceRegistryRouteId, "video.openai");
  assert.equal(handoff.requests.length, 1);
  assert.equal(handoff.requests[0].prompt, "EXACT MASTER INSTRUCTION");
  assert.equal(handoff.requests[0].prompt.includes("Normalize in finishing only."), false);
  assert.deepEqual(handoff.finishingRequirements.map((item) => item.property), ["delivery.frame-rate"]);
});

test("#2064 closure filters per-shot execution to the same selected Shot shown by inspection", async () => {
  const { buildProviderInstructionExecutionHandoff } = await executionModule();
  const handoff = buildProviderInstructionExecutionHandoff({
    integration: integration("comfyui-ltx-local", ["per-shot"]),
    bundle: bundle("per-shot", "comfyui-ltx-local"),
    productionShotId: "production-shot-2",
  });

  assert.equal(handoff.runtimeTarget.locality, "local");
  assert.equal(handoff.runtimeTarget.pluginAdapterId, "comfyui-ltx-local");
  assert.equal(handoff.requests.length, 1);
  assert.equal(handoff.requests[0].productionShotId, "production-shot-2");
  assert.equal(handoff.requests[0].prompt, "EXACT SHOT TWO INSTRUCTION");
});

test("#2064 closure fails closed on provider mismatch and missing selected Shot instructions", async () => {
  const { buildProviderInstructionExecutionHandoff } = await executionModule();
  assert.throws(() => buildProviderInstructionExecutionHandoff({
    integration: integration("openai"),
    bundle: bundle("master", "comfyui-ltx-local"),
  }), /does not match the already-selected provider integration/);

  assert.throws(() => buildProviderInstructionExecutionHandoff({
    integration: integration("openai"),
    bundle: bundle("per-shot"),
    editorialShotId: "not-a-real-shot",
  }), /No generated provider instruction matches/);
});

test("#2064 execution handoff does not select routes, call providers or persist prompt prose", async () => {
  const execution = await source("lib/preproduction/provider-instruction-execution.ts");
  assert.match(execution, /inspectProviderInstructionBundle/);
  assert.match(execution, /prompt: instruction\.text/);
  assert.match(execution, /already selected/i);
  assert.doesNotMatch(execution, /\bfetch\s*\(|readRoutingChoice|selectRoute|writeMediaRoutingStore|localStorage|sessionStorage|saveFoundationProject|providerRequest\s*\(/);
});
