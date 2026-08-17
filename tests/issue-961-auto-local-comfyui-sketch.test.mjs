import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("normal Windows maintenance starts installed ComfyUI as PlotPickle's local image engine", async () => {
  const [companion, installer, starter] = await Promise.all([
    source("scripts/windows-companion-software.ps1"),
    source("scripts/install-local-ai-tool.ps1"),
    source("scripts/start-comfyui-background.ps1"),
  ]);

  assert.match(companion, /-Tool", "ComfyUI", "-Maintain"/);
  assert.match(installer, /Start-ComfyUIForPlotPickle/);
  assert.match(installer, /-ReadyTimeoutSeconds 90 -AllowDesktopLaunch/);
  assert.match(installer, /local image engine/);
  assert.match(starter, /\/system_stats/);
  assert.match(starter, /desktop-started-ready/);
});

test("fresh image routing stays local-first while cloud providers remain explicit choices", async () => {
  const store = await source("build/media-routing-store.ts");
  const gateway = await source("build/media-routing-gateway.ts");

  assert.match(store, /imageRoute:\s*"comfyui"/);
  assert.match(store, /videoRoute:\s*"none"/);
  assert.match(gateway, /\["comfyui", "openai", "minimax", "manual"\]/);
  assert.doesNotMatch(gateway, /catch[^}]*generateCloudImage/s);
  assert.doesNotMatch(gateway, /fallback[^\n]*(openai|minimax)/i);
});

test("the baseline ComfyUI image path accepts a pencil-sketch prompt through the standard local workflow", async () => {
  const [provider, gateway] = await Promise.all([
    source("build/comfyui-media-provider.ts"),
    source("build/media-routing-gateway.ts"),
  ]);

  for (const node of [
    "CheckpointLoaderSimple",
    "CLIPTextEncode",
    "EmptyLatentImage",
    "KSampler",
    "VAEDecode",
    "SaveImage",
  ]) {
    assert.ok(provider.includes(node), `Missing standard ComfyUI image node: ${node}`);
  }

  assert.match(provider, /const prompt = typeof input\.prompt === "string"/);
  assert.match(provider, /CLIPTextEncode.*text: prompt/s);
  assert.match(gateway, /typeof body\.prompt === "string" \? body\.prompt/);
  assert.match(gateway, /generateComfyImage\(store\.comfyui\.baseUrl, checkpoint, input\)/);
});

test("automatic local ComfyUI startup never implies a paid cloud fallback or silent H3/video model install", async () => {
  const [installer, starter] = await Promise.all([
    source("scripts/install-local-ai-tool.ps1"),
    source("scripts/start-comfyui-background.ps1"),
  ]);
  const combined = `${installer}\n${starter}`;

  assert.match(combined, /does not request a silent install or enable cloud fallback/);
  assert.match(combined, /will not install checkpoints, workflows, or large video\/H3 model packs automatically/);
  assert.doesNotMatch(combined, /Invoke-WebRequest\s+.*(?:huggingface|civitai)/i);
  assert.doesNotMatch(combined, /(?:openai|minimax).*fallback/i);
});

test("the focused Windows verifier remains the authoritative live local-image acceptance", async () => {
  const verifier = await source("scripts/verify-comfyui-live.mjs");
  assert.ok(verifier.includes("Ollama → PlotPickle → local ComfyUI image"));
  assert.ok(verifier.includes("ComfyUI engine + image workflow prerequisites"));
});
