import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Settings can recover ComfyUI instead of disabling the provider", async () => {
  const panel = await source("app/media-routing-panel.tsx");

  assert.match(panel, /COMFY_START_API = `\$\{API\}\/comfyui\/start`/);
  assert.match(panel, /window\.confirm\(/);
  assert.match(panel, /Install \/ start local ComfyUI/);
  assert.match(panel, /option\.id !== "comfyui" && !configured/);
  assert.match(panel, /selectImageRoute\(option\.id\)/);
  assert.match(panel, /approved: true/);
});

test("ComfyUI activation is delayed until the local engine, image nodes, and checkpoint are ready", async () => {
  const panel = await source("app/media-routing-panel.tsx");
  const reachable = panel.indexOf("if (!merged.comfyui.reachable)");
  const nodes = panel.indexOf("if (!merged.comfyui.imageNodesReady)");
  const checkpoint = panel.indexOf("if (!merged.comfyui.checkpoint)");
  const activate = panel.indexOf('imageRoute: "comfyui"', checkpoint);

  assert.ok(reachable > -1 && nodes > reachable && checkpoint > nodes && activate > checkpoint,
    "ComfyUI must not become the active route before readiness checks pass");
  assert.match(panel, /previousRoute = status\.imageRoute/);
  assert.match(panel, /remains the active image provider/);
  assert.match(panel, /Your current image provider remains active/);
});

test("the local onboarding gateway requires explicit consent and invokes the reviewed Windows starter without a shell", async () => {
  const gateway = await source("build/comfyui-onboarding-gateway.ts");

  for (const contract of [
    "/api/media-routing/comfyui/start",
    "body.approved !== true",
    "start-comfyui-background.ps1",
    "-AllowDesktopLaunch",
    "http://127.0.0.1:8188",
    "READY_STATES",
    "desktop-opened-api-not-ready",
  ]) {
    assert.ok(gateway.includes(contract), `Missing ComfyUI onboarding contract: ${contract}`);
  }

  assert.match(gateway, /execFileAsync\("powershell\.exe"/);
  assert.doesNotMatch(gateway, /shell\s*:\s*true/);
  assert.doesNotMatch(gateway, /Invoke-WebRequest\s+.*(?:huggingface|civitai)/i);
  assert.doesNotMatch(gateway, /winget\s+install/i);
  assert.doesNotMatch(gateway, /git\s+clone/i);
});

test("ComfyUI onboarding is registered before the catch-all media-routing gateway", async () => {
  const gateway = await source("build/local-ai-gateway.ts");
  const onboarding = gateway.indexOf("registerComfyUiOnboardingGateway(server)");
  const media = gateway.indexOf("registerMediaRoutingGateway(server)");

  assert.match(gateway, /registerComfyUiOnboardingGateway/);
  assert.ok(onboarding > -1 && media > onboarding,
    "The onboarding route must be registered before the media-routing catch-all");
});

test("no H3 or large optional model pack is silently installed as part of ComfyUI recovery", async () => {
  const [panel, gateway, starter] = await Promise.all([
    source("app/media-routing-panel.tsx"),
    source("build/comfyui-onboarding-gateway.ts"),
    source("scripts/start-comfyui-background.ps1"),
  ]);
  const combined = `${panel}\n${gateway}\n${starter}`;

  assert.match(combined, /will not download MiniMax H3, video packs, or other large optional models/);
  assert.match(combined, /will not install checkpoints, workflows, or large video\/H3 model packs automatically/);
  assert.doesNotMatch(gateway, /minimax_h3_.*safetensors/i);
});
