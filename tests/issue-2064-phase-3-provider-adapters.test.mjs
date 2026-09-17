import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

async function loadTypeScript(path, tag) {
  const typeScript = await source(path);
  const compiled = stripTypeScriptTypes(typeScript, { mode: "transform" });
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}#${tag}-${Date.now()}-${Math.random()}`);
}

function specification(directionLevel = "production") {
  return {
    version: 1,
    providerNeutral: true,
    projectId: "story-2064-phase-3",
    canonicalRevision: 23,
    directionLevel,
    scene: {
      sceneId: "scene-1",
      title: "Cage Row",
      purpose: "Interrupt the heist with empathy.",
      objective: "Keep moving without being seen.",
      opposition: "The trapped creature catches Jace's attention.",
      action: "Jace slows beside the cages.",
      turn: "He lowers the pistol.",
      outcome: "The plan loses momentum.",
      assetRefs: [{ kind: "location", id: "location-cage-row" }],
    },
    sequenceDurationSeconds: 8,
    shots: [{
      editorialShotId: "editorial-shot-1",
      productionShotId: "previs-shot-1",
      anchorRef: "storyboard-anchor:block:block-01:mini-1",
      order: 1,
      narrativePurpose: "Show the hesitation without revealing recognition.",
      durationSeconds: 5,
      camera: {
        shotSize: "Medium",
        angle: "Eye level",
        movement: "Slow drift",
        lensIntent: "Natural perspective",
        lightingIntent: "Soft practical cage light",
      },
      blocking: [{
        subjectId: "character-jace",
        startPosition: "walking left to right",
        facing: "three-quarter",
        eyelineTargetId: "creature-goldie",
        movement: "stops mid-stride and lowers pistol",
        endPosition: "still beside cage",
        screenDirection: "left-to-right",
        axisState: "hold axis",
      }],
      continuityLockReferences: ["continuity:jace-costume"],
      informationDirectives: [{
        id: "withhold-recognition",
        sourceRef: "canon-fact:jace-recognizes-goldie",
        sourceFingerprint: "fact-v1",
        statement: "Jace recognizes the creature.",
        mode: "WITHHOLD_NOW",
        protectionIntent: "Do not reveal recognition yet.",
        release: { state: "linked", reference: "editorial-shot-9", condition: "Jace says the creature's name" },
      }],
      audioIntents: ["Diegetic cage ambience only."],
      frameRefs: ["frame-1"],
      assetRefs: [{ kind: "character", id: "character-jace" }],
      transitionIn: "cut",
      transitionOut: "cut",
      sourceRefs: ["scene-1", "editorial-shot-1", "previs-shot-1", "frame-1"],
    }],
    sourceRefs: ["story-2064:story", "scene-1", "editorial-shot-1"],
  };
}

async function modules() {
  const [capabilities, compiler, adapters] = await Promise.all([
    loadTypeScript("lib/preproduction/provider-capability-contract.ts", "capabilities"),
    loadTypeScript("lib/preproduction/provider-instruction-compiler.ts", "compiler"),
    loadTypeScript("lib/preproduction/provider-instruction-adapters.ts", "adapters"),
  ]);
  return { capabilities, compiler, adapters };
}

test("#2064 Phase 3 registers concrete local and cloud instruction integrations without choosing either one", async () => {
  const { adapters } = await modules();
  assert.deepEqual(adapters.providerInstructionIntegrationIds(), ["comfyui-ltx-local", "openai"]);

  const local = adapters.providerInstructionIntegrationForSelectedTarget("comfyui-ltx-local");
  assert.equal(local.runtimeTarget.locality, "local");
  assert.equal(local.runtimeTarget.runtimeProviderId, "comfyui");
  assert.equal(local.runtimeTarget.pluginAdapterId, "comfyui-ltx-local");
  assert.equal(local.runtimeTarget.sourceRegistryRouteId, "video.comfyui-native");

  const cloud = adapters.providerInstructionIntegrationForSelectedTarget("openai");
  assert.equal(cloud.runtimeTarget.locality, "cloud");
  assert.equal(cloud.runtimeTarget.runtimeProviderId, "openai");
  assert.equal(cloud.runtimeTarget.pluginAdapterId, null);
  assert.equal(cloud.runtimeTarget.sourceRegistryRouteId, "video.openai");

  assert.throws(
    () => adapters.providerInstructionIntegrationForSelectedTarget("not-selected"),
    /no #2064 provider instruction integration is registered/i,
  );
});

test("#2064 Phase 3 compiles the same Director Specification differently through OpenAI master and per-shot adapters", async () => {
  const { capabilities, compiler, adapters } = await modules();
  const integration = adapters.providerInstructionIntegrationForSelectedTarget("openai");
  const requirements = [
    { property: "scene.intent", strength: "required", sourceRef: "scene-1" },
    { property: "shot.duration", strength: "required", sourceRef: "editorial-shot-1" },
    { property: "camera.movement", strength: "preferred", sourceRef: "editorial-shot-1" },
    { property: "references", strength: "preferred", sourceRef: "frame-1" },
    { property: "delivery.frame-rate", strength: "preferred", sourceRef: "delivery:fps" },
    { property: "audio", strength: "preferred", sourceRef: "audio:scene-1" },
  ];
  const assessment = capabilities.assessProviderCapabilities(integration.capabilityContract, requirements);

  const master = compiler.compileProviderInstructions({
    specification: specification(),
    assessment,
    strategy: "master",
    adapter: integration.instructionAdapter,
  });
  const perShot = compiler.compileProviderInstructions({
    specification: specification(),
    assessment,
    strategy: "per-shot",
    adapter: integration.instructionAdapter,
  });

  assert.equal(master.providerId, "openai");
  assert.equal(master.instructions.length, 1);
  assert.match(master.instructions[0].text, /Create one coherent video sequence/);
  assert.match(master.instructions[0].text, /SHOT PLAN/);
  assert.match(master.instructions[0].text, /Slow drift/);
  assert.match(master.instructions[0].text, /WITHHOLD_NOW/);
  assert.equal(master.finishingRequirements[0].property, "delivery.frame-rate");
  assert.equal(master.unsupportedPreferences[0].property, "audio");

  assert.equal(perShot.instructions.length, 1);
  assert.equal(perShot.instructions[0].scope, "shot");
  assert.match(perShot.instructions[0].text, /Create shot 1 of 1/);
  assert.notEqual(perShot.instructions[0].text, master.instructions[0].text);
});

test("#2064 Phase 3 keeps the local LTX adapter per-shot and truthful about fixed-preset limitations", async () => {
  const { capabilities, compiler, adapters } = await modules();
  const integration = adapters.providerInstructionIntegrationForSelectedTarget("comfyui-ltx-local");
  const requirements = [
    { property: "scene.intent", strength: "required", sourceRef: "scene-1" },
    { property: "shot.order", strength: "required", sourceRef: "scene-1" },
    { property: "shot.duration", strength: "preferred", sourceRef: "editorial-shot-1" },
    { property: "camera.movement", strength: "preferred", sourceRef: "editorial-shot-1" },
    { property: "references", strength: "preferred", sourceRef: "frame-1" },
    { property: "delivery.frame-rate", strength: "preferred", sourceRef: "delivery:fps" },
  ];
  const assessment = capabilities.assessProviderCapabilities(integration.capabilityContract, requirements);
  const bundle = compiler.compileProviderInstructions({
    specification: specification(),
    assessment,
    strategy: "per-shot",
    adapter: integration.instructionAdapter,
  });

  assert.deepEqual(integration.capabilityContract.compilationStrategies, ["per-shot"]);
  assert.equal(bundle.instructions.length, 1);
  assert.match(bundle.instructions[0].text, /one continuous text-to-video shot/i);
  assert.match(bundle.instructions[0].text, /one short local generation pass/i);
  assert.equal(bundle.finishingRequirements.some((item) => item.property === "shot.duration"), true);
  assert.equal(bundle.finishingRequirements.some((item) => item.property === "delivery.frame-rate"), true);
  assert.equal(bundle.unsupportedPreferences.some((item) => item.property === "references"), true);

  assert.throws(() => compiler.compileProviderInstructions({
    specification: specification(),
    assessment,
    strategy: "master",
    adapter: integration.instructionAdapter,
  }), /does not declare the master compilation strategy/i);
});

test("#2064 Phase 3 blocks a required local reference capability instead of pretending the text-only LTX preset can enforce it", async () => {
  const { capabilities, compiler, adapters } = await modules();
  const integration = adapters.providerInstructionIntegrationForSelectedTarget("comfyui-ltx-local");
  const assessment = capabilities.assessProviderCapabilities(integration.capabilityContract, [
    { property: "references", strength: "required", sourceRef: "frame-1" },
  ]);

  assert.deepEqual(assessment.blockingRequiredProperties, ["references"]);
  assert.throws(() => compiler.compileProviderInstructions({
    specification: specification(),
    assessment,
    strategy: "per-shot",
    adapter: integration.instructionAdapter,
  }), /blocked by unsupported required properties: references/i);
});

test("#2064 Phase 3 stays aligned with the existing provider registry and current runtime contracts", async () => {
  const [registryText, ltxPreset, routingGateway] = await Promise.all([
    source("config/ai-source-registry.json"),
    source("build/ai/comfyui-ltx-default.ts"),
    source("build/ai-routing-gateway.ts"),
  ]);
  const registry = JSON.parse(registryText);
  const ltxPlugin = registry.plugins.find((item) => item.adapterId === "comfyui-ltx-local");
  const localRoute = registry.routes.find((item) => item.id === "video.comfyui-native");
  const openAiRoute = registry.routes.find((item) => item.id === "video.openai");

  assert.equal(ltxPlugin.runtimeProviderId, "comfyui");
  assert.deepEqual(localRoute.providerIds, ["comfyui"]);
  assert.deepEqual(openAiRoute.providerIds, ["openai"]);
  assert.match(ltxPreset, /frames: 25, fps: 24/);
  assert.match(ltxPreset, /width: 640, height: 352/);
  assert.match(routingGateway, /return requested <= 4 \? "4" : requested <= 8 \? "8" : "12"/);
  assert.match(routingGateway, /form\.set\("prompt", prompt\)/);
});

test("#2064 Phase 3 is adapter translation only and does not create a second router, call providers, or persist prompt prose", async () => {
  const [adapterText, directorSpecText] = await Promise.all([
    source("lib/preproduction/provider-instruction-adapters.ts"),
    source("lib/preproduction/director-specification.ts"),
  ]);

  assert.match(adapterText, /routing has[\s\S]*already selected/i);
  assert.match(adapterText, /sourceRegistryRouteId/);
  assert.doesNotMatch(adapterText, /fetch\(|localStorage|sessionStorage|readRoutingChoice|selectRoute|writeRoutingChoice|providerJson|providerForm/);
  assert.doesNotMatch(adapterText, /persistPrompt|savePrompt|writePrompt|canonicalPrompt/);
  assert.doesNotMatch(directorSpecText, /OpenAI|ComfyUI|LTX|Seedance|Runway|Veo|Kling/);
});
