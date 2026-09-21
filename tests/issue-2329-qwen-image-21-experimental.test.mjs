import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2329 keeps SDXL production-default while registering Qwen-Image-2.1 as Experimental", async () => {
  const [catalog, store] = await Promise.all([
    read("lib/runtime/ai/local-runtime.ts"),
    read("build/media-routing-store.ts"),
  ]);

  assert.match(catalog, /Default ComfyUI image workflow for 8 GB VRAM/);
  assert.match(catalog, /Qwen-Image-2\.1 Q4 GGUF/);
  assert.match(catalog, /opt-in user-supplied Experimental profile/);
  assert.match(store, /imageProfile: "sdxl-1\.0"/);
  assert.match(store, /"sdxl-1\.0" \| "qwen-image-2\.1-experimental"/);
  assert.match(store, /qwenImage21/);
  assert.match(store, /licenseAcknowledgedAt/);
  assert.match(store, /LOCAL_SDXL_CHECKPOINT/);
});

test("#2329 Qwen provider is local-only, GGUF-gated and bounded for GTX 1080 qualification", async () => {
  const provider = await read("build/ai/comfyui-qwen-image-21-provider.ts");

  assert.match(provider, /127\.0\.0\.1:8188/);
  assert.match(provider, /UnetLoaderGGUF/);
  assert.match(provider, /MAX_REFERENCES = 10/);
  assert.match(provider, /requestCount.*!== 1/s);
  assert.match(provider, /width: 768, height: 1024/);
  assert.match(provider, /width: 1024, height: 768/);
  assert.match(provider, /768 : 1024/);
  assert.doesNotMatch(provider, /2048/);
  assert.match(provider, /\{\{PLOTPICKLE_PROMPT\}\}/);
  assert.match(provider, /\{\{PLOTPICKLE_REFERENCE_/);
  assert.match(provider, /remote URLs/);
  assert.match(provider, /renderDurationMs/);
});

test("#2329 Qwen activation requires explicit license acknowledgement and a reviewed ready workflow", async () => {
  const [gateway, sdxl] = await Promise.all([
    read("build/media-routing-gateway.ts"),
    read("build/ai/comfyui-sdxl-local-gateway.ts"),
  ]);

  assert.match(gateway, /qwen-image-2\.1-workflow/);
  assert.match(gateway, /qwen-image-2\.1-profile/);
  assert.match(gateway, /licenseAcknowledged === true/);
  assert.match(gateway, /Explicitly acknowledge the Qwen Research License/);
  assert.match(gateway, /validateQwenImage21Workflow/);
  assert.match(gateway, /workflowNodesReady/);
  assert.match(gateway, /generateQwenImage21/);
  assert.match(gateway, /imageProfile === "qwen-image-2\.1-experimental"/);
  assert.match(sdxl, /store\.comfyui\.imageProfile !== "sdxl-1\.0"/);
});

test("#2329 exposes Experimental controls without adding a managed Qwen downloader", async () => {
  const [panel, localGateway, starter] = await Promise.all([
    read("app/skin-v1/local-comfyui-panel.tsx"),
    read("build/local-ai-gateway.ts"),
    read("build/ai/comfyui-sdxl-starter-gateway.ts"),
  ]);

  assert.match(panel, /EXPERIMENTAL — QWEN-IMAGE-2\.1 \/ GGUF/);
  assert.match(panel, /PlotPickle does not download or bundle Qwen-Image-2\.1 weights/);
  assert.match(panel, /Qwen Research License/);
  assert.match(panel, /commercial use requires separate licensing/);
  assert.match(panel, /ACTIVATE EXPERIMENTAL PROFILE/);
  assert.match(panel, /SWITCH BACK TO SDXL/);
  assert.match(panel, /TEST ONE QWEN IMAGE/);
  assert.match(panel, /Qwen3-VL 8B/);
  assert.match(panel, /Pascal qualification/);
  assert.doesNotMatch(localGateway, /Qwen.*Starter|Qwen.*Installer|qwen.*download/i);
  assert.doesNotMatch(starter, /Qwen-Image-2\.1/);
});
