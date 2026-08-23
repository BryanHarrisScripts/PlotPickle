import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1255 reuses the reviewed local-tool detector to distinguish installed-stopped from not-installed", async () => {
  const [gateway, installer] = await Promise.all([
    read("build/comfyui-onboarding-gateway.ts"),
    read("scripts/install-local-ai-tool.ps1"),
  ]);

  assert.match(gateway, /inspectInstalledComfyUi/);
  assert.match(gateway, /install-local-ai-tool\.ps1/);
  assert.match(gateway, /"-Tool", "ComfyUI"/);
  assert.match(gateway, /"-CheckOnly"/);
  assert.match(gateway, /state: installed \? "installed-stopped" : "not-installed"/);
  assert.match(gateway, /request\.method === "GET"/);
  assert.match(gateway, /officialDownloadUrl: COMFY_DOWNLOAD_URL/);
  assert.match(installer, /Comfy\.ComfyUI-Desktop/);
  assert.match(installer, /https:\/\/comfy\.org\/download/);
  assert.match(installer, /installed-api-not-ready/);
});

test("#1255 Settings keeps ComfyUI setup in place and reports the real local state progression", async () => {
  const panel = await read("app/media-routing-panel.tsx");

  for (const phrase of [
    "Install ComfyUI Desktop",
    "Start ComfyUI",
    "Finish ComfyUI setup",
    "Installed · stopped",
    "Running · setup needed",
    "Running · test needed",
    "Tested · ready",
    "Test Image",
  ]) assert.ok(panel.includes(phrase), `Missing ComfyUI state/action: ${phrase}`);

  assert.match(panel, /jsonRequest<ComfyInstallResponse>\(COMFY_START_API\)/);
  assert.match(panel, /comfyInstallation\?\.installed === false/);
  assert.match(panel, /window\.open\(destination, "_blank", "noopener,noreferrer"\)/);
  assert.match(panel, /<img src=\{imageResult\.assetUrl\}/);
  assert.match(panel, /test asset stored locally/);
  assert.match(panel, /imageResult\.assetLocation/);
});

test("#1255 local image readiness requires real ComfyUI nodes checkpoint a returned image test and local asset evidence", async () => {
  const [provider, panel, routing] = await Promise.all([
    read("build/comfyui-media-provider.ts"),
    read("app/media-routing-panel.tsx"),
    read("build/ai-routing-gateway.ts"),
  ]);

  for (const node of ["CheckpointLoaderSimple", "CLIPTextEncode", "EmptyLatentImage", "KSampler", "VAEDecode", "SaveImage"]) {
    assert.ok(provider.includes(`"${node}"`), `Required ComfyUI node missing from readiness contract: ${node}`);
  }
  assert.match(provider, /const assetLocation = path\.join\(persistentHome\(\), "assets", fileName\)/);
  assert.match(provider, /return \{ assetUrl, assetLocation,/);
  assert.match(panel, /const comfyConfigured = status\.comfyui\.reachable && status\.comfyui\.imageNodesReady && Boolean\(status\.comfyui\.checkpoint\)/);
  assert.match(panel, /const comfyReady = comfyConfigured && Boolean\(status\.comfyui\.imageVerifiedAt\)/);
  assert.match(routing, /const comfyImageReady = Boolean\(comfyImageConfigured && comfy\.imageNodesReady && media\.comfyui\.imageVerifiedAt\)/);
  assert.match(routing, /const ollamaImageReady = Boolean\(ollama\?\.assistantVerifiedAt && comfyImageReady\)/);
});

test("#1255 start remains explicit and never silently installs optional H3 or cloud model packs", async () => {
  const [gateway, starter, panel] = await Promise.all([
    read("build/comfyui-onboarding-gateway.ts"),
    read("scripts/start-comfyui-background.ps1"),
    read("app/media-routing-panel.tsx"),
  ]);

  assert.match(gateway, /body\.approved !== true/);
  assert.match(gateway, /start-comfyui-background\.ps1/);
  assert.match(gateway, /-AllowDesktopLaunch/);
  assert.match(panel, /will not download MiniMax H3, video packs, or other large optional models/);
  assert.match(starter, /will not install checkpoints, workflows, or large video\/H3 model packs automatically/);
  assert.doesNotMatch(gateway, /winget\s+install|git\s+clone/i);
});
