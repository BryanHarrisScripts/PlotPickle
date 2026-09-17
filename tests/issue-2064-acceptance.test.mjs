import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const paths = {
  director: "lib/preproduction/director-specification.ts",
  readiness: "lib/preproduction/director-spec-readiness.ts",
  productionIntent: "lib/preproduction/production-intent-handoff.ts",
  capability: "lib/preproduction/provider-capability-contract.ts",
  compiler: "lib/preproduction/provider-instruction-compiler.ts",
  adapters: "lib/preproduction/provider-instruction-adapters.ts",
  inspection: "lib/preproduction/provider-instruction-inspection.ts",
  execution: "lib/preproduction/provider-instruction-execution.ts",
  visualStory: "app/_components/storyboard/visual-story-workspace.tsx",
};

async function sources() {
  return Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await read(path)])));
}

test("#2064 acceptance 1 — structured approved state compiles into a provider-neutral Director Specification", async () => {
  const { director, readiness } = await sources();
  assert.match(director, /export type DirectorSpecification/);
  assert.match(director, /readonly providerNeutral: true/);
  assert.match(director, /export function compileDirectorSpecification/);
  assert.match(director, /PreproductionSceneDirectorSpecReadiness/);
  assert.match(readiness, /readyForDirectorSpec/);
});

test("#2064 acceptance 2 — generated provider prose stays disposable and outside canonical creative state", async () => {
  const { director, compiler, inspection, execution } = await sources();
  assert.match(compiler, /readonly disposable: true/);
  assert.match(compiler, /disposable: true/);
  assert.match(inspection, /canonical: false/);
  assert.match(inspection, /editable: false/);
  assert.match(execution, /canonical: false/);
  assert.match(director, /not creative canon/i);
  assert.doesNotMatch(`${director}\n${compiler}\n${inspection}\n${execution}`, /saveFoundationProject|localStorage|sessionStorage|writeStore\s*\(|createEmpty.*Store/);
});

test("#2064 acceptance 3 — master and per-shot compilation strategies are first-class", async () => {
  const { capability, compiler } = await sources();
  assert.match(capability, /"master" \| "per-shot"/);
  assert.match(compiler, /compileMaster/);
  assert.match(compiler, /compileShot/);
  assert.match(compiler, /strategy === "master"/);
});

test("#2064 acceptance 4 — one neutral specification can compile differently through provider adapters", async () => {
  const { compiler, adapters } = await sources();
  assert.match(compiler, /ProviderInstructionAdapter/);
  assert.match(adapters, /OPENAI_VIDEO_INSTRUCTION_ADAPTER/);
  assert.match(adapters, /LTX_LOCAL_VIDEO_INSTRUCTION_ADAPTER/);
  assert.match(adapters, /compileOpenAiMaster/);
  assert.match(adapters, /compileLtxShot/);
  assert.match(adapters, /providerInstructionIntegrationForSelectedTarget/);
});

test("#2064 acceptance 5 — Automatic, Directed and Production alter compilation depth without separate story state", async () => {
  const { director, compiler } = await sources();
  assert.match(director, /"automatic" \| "directed" \| "production"/);
  assert.match(compiler, /directionLevel === "automatic"/);
  assert.match(compiler, /directionLevel === "directed"/);
  assert.match(compiler, /audioIntents/);
  assert.match(compiler, /transitionIn/);
  assert.doesNotMatch(compiler, /automaticStory|directedStory|productionStory/);
});

test("#2064 acceptance 6 — Advanced inspection exposes the generated provider-specific instructions", async () => {
  const { inspection, visualStory } = await sources();
  assert.match(inspection, /inspectProviderInstructionBundle/);
  assert.match(visualStory, /View generated director instructions/);
  assert.match(visualStory, /data-provider-instruction-inspection="read-only"/);
  assert.match(visualStory, /Disposable provider output/);
});

test("#2064 acceptance 7 — requested properties are classified truthfully and finishing stays separate", async () => {
  const { capability, compiler, adapters } = await sources();
  assert.match(capability, /"enforceable" \| "best-effort" \| "finishing" \| "unsupported"/);
  assert.match(capability, /blockingRequiredProperties/);
  assert.match(compiler, /finishingRequirements/);
  assert.match(compiler, /unsupportedPreferences/);
  assert.match(compiler, /treatment === "enforceable" \|\| item\.treatment === "best-effort"/);
  assert.match(adapters, /delivery\.frame-rate/);
  assert.match(adapters, /treatment: "finishing"/);
});

test("#2064 acceptance 8 — existing Storyboard, Previs, semantic and routing authorities are reused rather than duplicated", async () => {
  const { director, readiness, productionIntent, adapters, execution } = await sources();
  assert.match(productionIntent, /core\/contracts\/storyboard\/editorial-shot/);
  assert.match(productionIntent, /core\/contracts\/previs/);
  assert.match(productionIntent, /\.\/semantic-projection/);
  assert.match(director, /\.\/director-spec-readiness/);
  assert.match(readiness, /\.\/production-intent-handoff/);
  assert.match(adapters, /sourceRegistryRouteId/);
  assert.match(execution, /already-selected provider integration/i);
  assert.doesNotMatch(`${director}\n${readiness}\n${adapters}\n${execution}`, /EXTENSION_KEY|new .*Store|readRoutingChoice|selectRoute/);
});

test("#2064 acceptance 9 — local generation remains supported through the existing local provider boundary", async () => {
  const { adapters, execution } = await sources();
  assert.match(adapters, /providerId: "comfyui-ltx-local"/);
  assert.match(adapters, /locality: "local"/);
  assert.match(adapters, /sourceRegistryRouteId: "video\.comfyui-native"/);
  assert.match(adapters, /pluginAdapterId: "comfyui-ltx-local"/);
  assert.match(execution, /runtimeTarget/);
});

test("#2064 acceptance 10 — the canonical Director Specification contains no provider-specific contract logic", async () => {
  const { director } = await sources();
  assert.doesNotMatch(director, /Seedance|Runway|Veo|Kling|MiniMax|OpenAI|ComfyUI|LTX/i);
  assert.match(director, /providerNeutral: true/);
});

test("#2064 closure — the executed prompt is exactly the same disposable text exposed by inspection", async () => {
  const { execution } = await sources();
  assert.match(execution, /inspectProviderInstructionBundle/);
  assert.match(execution, /prompt: instruction\.text/);
  assert.doesNotMatch(execution, /\bfetch\s*\(|providerRequest\s*\(|readRoutingChoice|selectRoute|writeMediaRoutingStore/);
});
