import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CONNECTION_ENGINES, CONNECTION_PROVIDERS, resolveConnectionJoin,
  connectionProof, acceptedJoinRecord,
} from "../core/contracts/compute/connection-join-contract.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const ready = (route, extra = {}) => ({
  image: { options: { comfyui: { configured: true, ready: true, imageProfile: "sdxl-1.0", verifiedAt: "synthetic", ...extra } } },
  video: { options: { [route]: { configured: true, ready: true, verifiedAt: "synthetic", ...extra } } },
  text: { options: { [route]: { configured: true, ready: true, verifiedAt: "synthetic", ...extra } } },
});

test("#2918 all human-named local models appear as resources, not workflow engines", () => {
  assert.deepEqual(CONNECTION_ENGINES.map((e) => e.label), ["ComfyUI Local", "ComfyUI Cloud"]);
  assert.deepEqual(CONNECTION_PROVIDERS.image.filter((p) => p.locality === "local").map((p) => p.id), [
    "sdxl-base", "qwen-image-2.1", "ollama-prompt",
  ]);
  assert.ok(CONNECTION_PROVIDERS.video.some((p) => p.id === "ltx-video" && p.locality === "local"));
  assert.ok(CONNECTION_PROVIDERS.video.some((p) => p.id === "minimax-h3-local" && p.locality === "local"));
  assert.ok(CONNECTION_PROVIDERS.video.some((p) => p.id === "minimax-h3-api" && p.locality === "cloud"));
  for (const id of ["ollama", "openai", "gemini", "minimax"]) assert.ok(CONNECTION_PROVIDERS.text.some((p) => p.id === id));
  assert.ok(CONNECTION_PROVIDERS.image.some((p) => p.id === "openai"));
  assert.ok(CONNECTION_PROVIDERS.video.some((p) => p.id === "openai"));
  assert.ok(CONNECTION_PROVIDERS.image.find((p) => p.id === "qwen-image-2.1").detail.includes("Experimental"));
});

test("#2918 capabilities join to reviewed exact routes rather than provider brands", () => {
  for (const [capability, engine, provider, route] of [
    ["text", "direct", "ollama", "ollama"],
    ["text", "direct", "gemini", "gemini"],
    ["image", "comfy-local", "sdxl-base", "comfyui"],
    ["image", "comfy-local", "qwen-image-2.1", "comfyui"],
    ["image", "comfy-local", "ollama-prompt", "ollama-comfyui"],
    ["image", "direct", "openai", "openai"],
    ["video", "comfy-local", "ltx-video", "ltx-video"],
    ["video", "comfy-local", "minimax-h3-local", "comfyui-native"],
    ["video", "comfy-local", "minimax-h3-api", "minimax-comfyui"],
    ["video", "direct", "minimax", "minimax"],
  ]) {
    const resolved = resolveConnectionJoin(capability, engine, provider);
    assert.equal(resolved.capable, true, JSON.stringify([capability, engine, provider]));
    assert.equal(resolved.route, route);
    assert.deepEqual(acceptedJoinRecord(capability, engine, provider, "synthetic").route, route);
  }
});

test("#2918 rejects nonexistent or unreviewed adapter pairs without invented routes", () => {
  for (const [capability, engine, provider] of [
    ["video", "comfy-local", "openai"],
    ["video", "direct", "openai"],
    ["image", "comfy-local", "openai"],
    ["text", "comfy-local", "ollama"],
    ["image", "direct", "qwen-image-2.1"],
    ["video", "comfy-cloud", "ltx-video"],
    ["image", "comfy-cloud", "sdxl-base"],
    ["video", "comfy-cloud", "minimax"],
    ["image", "direct", "nonsense"],
  ]) {
    const rejected = resolveConnectionJoin(capability, engine, provider);
    assert.equal(rejected.capable, false);
    assert.match(rejected.reason, /This route is not capable/);
    assert.throws(() => acceptedJoinRecord(capability, engine, provider, "now"), /not capable/);
  }
});

test("#2918 a compatible Join is not verified merely because it is saved or another model passed", () => {
  const sdxl = acceptedJoinRecord("image", "comfy-local", "sdxl-base", "synthetic");
  const qwen = acceptedJoinRecord("image", "comfy-local", "qwen-image-2.1", "synthetic");
  const status = ready("comfyui");
  assert.deepEqual(connectionProof(status, sdxl), { ready: true, state: "VERIFIED", verifiedAt: "synthetic" });
  assert.equal(connectionProof(status, qwen).state, "SETUP NEEDED", "SDXL proof never verifies Experimental Qwen");
  const qwenStatus = ready("comfyui", { imageProfile: "qwen-image-2.1-experimental" });
  assert.equal(connectionProof(qwenStatus, sdxl).state, "SETUP NEEDED");
  assert.equal(connectionProof(qwenStatus, qwen).state, "VERIFIED");
  const untested = ready("ltx-video");
  untested.video.options["ltx-video"].ready = false;
  assert.equal(connectionProof(untested, acceptedJoinRecord("video", "comfy-local", "ltx-video", "now")).state, "TEST NEEDED");
  untested.video.options["ltx-video"].configured = false;
  assert.equal(connectionProof(untested, acceptedJoinRecord("video", "comfy-local", "ltx-video", "now")).state, "SETUP NEEDED");
  const disabled = ready("ltx-video", { supported: false });
  assert.equal(connectionProof(disabled, acceptedJoinRecord("video", "comfy-local", "ltx-video", "now")).state, "NOT CAPABLE");
});

test("#2918 Connections frontend and gateway use single catalog and a distinct Join endpoint", async () => {
  const [ui, gateway, css, brief] = await Promise.all([
    read("app/skin-v1/hybrid-story-mode-panel.tsx"),
    read("build/ai-routing-gateway.ts"),
    read("app/skin-v1/hybrid-story-mode-panel.module.css"),
    read("docs/developer-briefs/2918-connections-join-truth.md"),
  ]);
  assert.match(ui, />LOCAL AND CLOUD PROVIDERS</);
  assert.match(ui, />WORKFLOW ROUTING</);
  assert.match(ui, /CONNECTION_ENGINES\.map/);
  assert.match(ui, /CONNECTION_PROVIDERS\[capability\.id\]/);
  assert.match(ui, /data-join-capability/);
  assert.match(ui, /\/api\/ai-routing\/join/);
  assert.match(gateway, /async function joinConnection/);
  assert.match(gateway, /acceptedJoinRecord/);
  assert.match(gateway, /connectionProof/);
  assert.match(gateway, /writeComputeSelection/);
  assert.match(gateway, /connection-joins\.json/);
  assert.match(css, /\[data-joined="true"\]/);
  assert.match(brief, /SDXL Base 1\.0/);
  assert.match(brief, /Qwen-Image-2\.1/);
  assert.match(brief, /LTX-Video/);
});
