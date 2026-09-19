import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("#2106 live image generation resolves the real job class through Story Mode before execution", async () => {
  const [media, policy] = await Promise.all([
    read("build/media-routing-gateway.ts"),
    read("build/story-mode-policy-gateway.ts"),
  ]);

  assert.match(media, /resolveImageStoryJobClass/);
  assert.match(media, /readStoryModePolicy/);
  assert.match(media, /readStoryModeJobRouting/);
  assert.match(media, /resolveStoryModeJobRoute/);
  assert.match(media, /storyImageRouteCandidates/);
  assert.match(media, /const execution = await resolveImageExecutionRoute\(store, input\)/);
  assert.match(media, /jobClass: execution\.jobClass/);
  assert.match(media, /preference: execution\.preference/);
  assert.match(media, /locality: execution\.locality/);
  assert.match(policy, /capability === "image"\) \{ next\(\); return; \}/);
});

test("#2106 per-job routing uses only tested executable image routes and does not mutate global selection", async () => {
  const media = await read("build/media-routing-gateway.ts");
  const resolver = media.slice(
    media.indexOf("async function storyImageRouteCandidates"),
    media.indexOf("async function saveImageSuccess"),
  );

  for (const route of ["comfyui", "ollama-comfyui", "openai", "minimax"]) {
    assert.ok(resolver.includes(`routeId: "${route}"`), `missing live candidate ${route}`);
  }
  assert.match(resolver, /store\.comfyui\.imageVerifiedAt/);
  assert.match(resolver, /assistantVerifiedAt/);
  assert.match(resolver, /profile\?\.imageVerifiedAt/);
  assert.match(resolver, /selected: choice\.image ===/);
  assert.doesNotMatch(resolver, /writeRoutingChoice|writeMediaRoutingStore|selectRoute/);
});

test("#2106 Ollama plus ComfyUI now participates in the same live Job Routing boundary", async () => {
  const [ai, media] = await Promise.all([
    read("build/ai-routing-gateway.ts"),
    read("build/media-routing-gateway.ts"),
  ]);

  assert.match(ai, /export async function createOllamaComfyImage\(input: ImageGenerationInput\)/);
  assert.match(ai, /export async function readRoutingChoice\(\)/);
  assert.doesNotMatch(ai, /pathname === IMAGE_PATH/);
  assert.match(media, /createOllamaComfyImage\(input\)/);
  assert.match(media, /route === "ollama-comfyui"/);
});

test("#2106 Hybrid Story Mode exposes the two real image workloads and persists routing preferences", async () => {
  const panel = await read("app/skin-v1/hybrid-story-mode-panel.tsx");

  assert.match(panel, /IMAGES — FAST \/ DRAFT/);
  assert.match(panel, /IMAGES — PRECISION \/ EDIT/);
  assert.match(panel, /AUTO/);
  assert.match(panel, /LOCAL FIRST/);
  assert.match(panel, /CLOUD FIRST/);
  assert.match(panel, /fetch\("\/api\/story-mode\/job-routing"/);
  assert.match(panel, /body: JSON\.stringify\(\{ jobClass, preference \}\)/);
  assert.match(panel, /data-story-mode-job-routing="image"/);
  assert.doesNotMatch(panel, /PINNED PROVIDER|Ollama Hybrid|ollama-hybrid/);
});

test("#2106 verification owns both legacy image gateways under the one Job Routing boundary", async () => {
  const ownership = JSON.parse(await read("config/verification/ownership-map.json"));
  const rule = ownership.rules.find((candidate) => candidate.id === "story-mode-image-job-routing");

  assert.equal(rule?.classification, "production");
  assert.equal(rule?.ownerLayer, "provider-runtime");
  for (const path of [
    "build/ai-routing-gateway.ts",
    "build/media-routing-gateway.ts",
    "build/media-provider-common.ts",
    "build/cloud-media-provider.ts",
    "build/ai/comfyui-media-provider.ts",
  ]) assert.ok(rule?.include.includes(path), `missing verification ownership for ${path}`);
});
