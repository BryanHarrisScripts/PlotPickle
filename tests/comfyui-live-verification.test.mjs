import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("focused ComfyUI verifier exercises real local services and PlotPickle routing", async () => {
  const verifier = await source("scripts/verify-comfyui-live.mjs");

  for (const contract of [
    "http://127.0.0.1:8188",
    "http://127.0.0.1:11434",
    "/system_stats",
    "/object_info/CheckpointLoaderSimple",
    "/api/tags",
    "/api/generate",
    "/api/local-connections",
    "/api/media-routing/status",
    "/api/media-routing/routes",
    "/api/media-routing/test/image",
    'setRoutes("manual", "none")',
    'setRoutes("comfyui", "none")',
    "Ollama → PlotPickle → local ComfyUI image",
    "verifyOutput",
    "restoreState",
  ]) {
    assert.ok(verifier.includes(contract), `Missing live ComfyUI verification contract: ${contract}`);
  }
});

test("focused verifier covers cloud and H3 configuration without silently spending money", async () => {
  const verifier = await source("scripts/verify-comfyui-live.mjs");

  for (const contract of [
    "--live-cloud",
    "--live-paid-h3",
    "--live-native-h3",
    "--strict-all",
    "/api/media-routing/comfyui/h3/native/status",
    "/api/media-routing/comfyui/h3/native/activation",
    "minimax-comfyui",
    "Remote ComfyUI guard",
    "Cloud image configuration",
    "Paid cloud generation is OFF",
  ]) {
    assert.ok(verifier.includes(contract), `Missing optional-route verification contract: ${contract}`);
  }

  assert.match(verifier, /if \(LIVE_CLOUD\)/);
  assert.match(verifier, /if \(LIVE_PAID_H3\)/);
  assert.match(verifier, /if \(LIVE_NATIVE_H3\)/);
  assert.doesNotMatch(verifier, /process\.env\.(OPENAI|MINIMAX|API_KEY)/i);
});

test("focused verifier matches PlotPickle's existing ComfyUI backend contracts", async () => {
  const [verifier, mediaGateway, comfyProvider, nativeGateway] = await Promise.all([
    source("scripts/verify-comfyui-live.mjs"),
    source("build/media-routing-gateway.ts"),
    source("build/comfyui-media-provider.ts"),
    source("build/comfyui-h3-native-gateway.ts"),
  ]);

  for (const endpoint of [
    "/api/media-routing/status",
    "/api/media-routing/routes",
    "/api/media-routing/comfyui/connection",
    "/api/media-routing/test/image",
  ]) {
    assert.ok(verifier.includes(endpoint), `Verifier does not use ${endpoint}`);
    const gatewayToken = endpoint.replace("/api/media-routing", "");
    assert.ok(
      mediaGateway.includes(gatewayToken) || mediaGateway.includes(endpoint),
      `Media gateway no longer exposes ${endpoint}`,
    );
  }

  for (const endpoint of [
    "/api/media-routing/comfyui/h3/native/status",
    "/api/media-routing/comfyui/h3/native/activation",
  ]) {
    assert.ok(verifier.includes(endpoint), `Verifier does not use ${endpoint}`);
  }
  assert.ok(nativeGateway.includes('/api/media-routing/comfyui/h3/native'));

  for (const node of [
    "CheckpointLoaderSimple",
    "CLIPTextEncode",
    "EmptyLatentImage",
    "KSampler",
    "VAEDecode",
    "SaveImage",
  ]) {
    assert.ok(verifier.includes(node), `Verifier does not require ${node}`);
    assert.ok(comfyProvider.includes(node), `ComfyUI provider no longer uses ${node}`);
  }
});

test("one-click Windows runner uses the safe non-paid verification mode by default", async () => {
  const runner = await source("Run-PlotPickle-ComfyUI-Check.bat");
  assert.match(runner, /node "%~dp0scripts\\verify-comfyui-live\.mjs"/);
  assert.match(runner, /Paid cloud image and H3 generation are NOT run/);
  const executionLine = runner.split(/\r?\n/).find((line) => /^node /i.test(line.trim())) || "";
  assert.doesNotMatch(executionLine, /--live-cloud|--live-paid-h3|--live-native-h3/);
});
