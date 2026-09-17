import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

async function moduleUnderTest() {
  const typeScript = await source("lib/preproduction/provider-capability-contract.ts");
  const compiled = stripTypeScriptTypes(typeScript, { mode: "transform" });
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}#provider-capability-${Date.now()}-${Math.random()}`);
}

function contract(overrides = {}) {
  return {
    version: 1,
    providerId: "test-video-adapter",
    capability: "video",
    compilationStrategies: ["master", "per-shot"],
    rules: [
      { property: "shot.order", treatment: "enforceable" },
      { property: "shot.duration", treatment: "best-effort", note: "Provider accepts timing direction but may vary duration." },
      { property: "delivery.frame-rate", treatment: "finishing", note: "Normalize frame rate in finishing/export." },
      { property: "references", treatment: "enforceable" },
    ],
    ...overrides,
  };
}

test("#2064 Phase 1 classifies Director Specification requirements without implying undeclared guarantees", async () => {
  const { assessProviderCapabilities } = await moduleUnderTest();
  const assessment = assessProviderCapabilities(contract(), [
    { property: "shot.order", strength: "required", sourceRef: "shot-1" },
    { property: "shot.duration", strength: "required", sourceRef: "shot-1" },
    { property: "delivery.frame-rate", strength: "required", sourceRef: "delivery:fps" },
    { property: "camera.lens", strength: "preferred", sourceRef: "shot-1" },
  ]);

  assert.equal(assessment.version, 1);
  assert.equal(assessment.providerId, "test-video-adapter");
  assert.equal(assessment.capability, "video");
  assert.deepEqual(assessment.compilationStrategies, ["master", "per-shot"]);
  assert.equal(assessment.classifications[0].treatment, "enforceable");
  assert.equal(assessment.classifications[1].treatment, "best-effort");
  assert.equal(assessment.classifications[2].treatment, "finishing");
  assert.equal(assessment.classifications[3].treatment, "unsupported");
  assert.equal(assessment.classifications[3].userVisibleAdaptationRequired, false, "preferred unsupported wishes should not become blocking requirements");
  assert.deepEqual(assessment.blockingRequiredProperties, []);
});

test("#2064 Phase 1 makes required unsupported properties user-visible instead of silently degrading them", async () => {
  const { assessProviderCapabilities } = await moduleUnderTest();
  const assessment = assessProviderCapabilities(contract(), [
    { property: "delivery.resolution", strength: "required", sourceRef: "delivery:resolution" },
  ]);

  assert.equal(assessment.classifications[0].treatment, "unsupported");
  assert.equal(assessment.classifications[0].userVisibleAdaptationRequired, true);
  assert.deepEqual(assessment.blockingRequiredProperties, ["delivery.resolution"]);
});

test("#2064 Phase 1 treats omitted provider declarations as unsupported and preserves finishing as a separate truth", async () => {
  const { classifyProviderProperty } = await moduleUnderTest();
  const omitted = classifyProviderProperty(contract(), "delivery.frame-count");
  const finishing = classifyProviderProperty(contract(), "delivery.frame-rate");

  assert.equal(omitted.treatment, "unsupported");
  assert.match(omitted.note, /not declared/i);
  assert.equal(finishing.treatment, "finishing");
  assert.match(finishing.note, /finishing\/export/i);
});

test("#2064 Phase 1 validates adapter declarations and rejects ambiguous duplicate capability rules", async () => {
  const { validateProviderCapabilityContract, assessProviderCapabilities } = await moduleUnderTest();

  assert.throws(() => validateProviderCapabilityContract(contract({ providerId: "  " })), /providerId/i);
  assert.throws(() => validateProviderCapabilityContract(contract({ compilationStrategies: [] })), /at least one compilation strategy/i);
  assert.throws(() => assessProviderCapabilities(contract({
    rules: [
      { property: "shot.duration", treatment: "best-effort" },
      { property: "shot.duration", treatment: "enforceable" },
    ],
  }), []), /duplicate provider capability rule/i);
});

test("#2064 Phase 1 remains a declaration/classification boundary and does not select routes or compile provider instructions", async () => {
  const text = await source("lib/preproduction/provider-capability-contract.ts");
  assert.match(text, /"enforceable" \| "best-effort" \| "finishing" \| "unsupported"/);
  assert.match(text, /"master" \| "per-shot"/);
  assert.doesNotMatch(text, /Seedance|Runway|Veo|Kling|MiniMax|OpenAI|ComfyUI/);
  assert.doesNotMatch(text, /fetch\(|localStorage|sessionStorage|media-routing|story-mode-policy|selectProvider|routeProvider/);
  assert.doesNotMatch(text, /promptProse|providerPrompt|compileProviderInstructions/);
});
