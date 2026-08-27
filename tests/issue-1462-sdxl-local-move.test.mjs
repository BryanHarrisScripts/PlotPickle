import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (relative) => readFile(new URL(relative, root), "utf8");

const moved = [
  ["build/comfyui-sdxl-local-gateway.ts", "build/ai/comfyui-sdxl-local-gateway.ts"],
  ["build/comfyui-sdxl-local-provider.ts", "build/ai/comfyui-sdxl-local-provider.ts"],
];

test("#1462 SDXL pair retires root paths while preserving local image and continuity boundaries", async () => {
  for (const [source, target] of moved) {
    await assert.rejects(access(new URL(source, root)), `${source} must stay retired after the SDXL move`);
    await access(new URL(target, root));
  }

  const [host, gateway, provider, hardware, configText] = await Promise.all([
    read("build/local-ai-gateway.ts"),
    read("build/ai/comfyui-sdxl-local-gateway.ts"),
    read("build/ai/comfyui-sdxl-local-provider.ts"),
    read("tests/hardware-aware-local-ai-runtime.test.mjs"),
    read("config/repository-architecture-target.json"),
  ]);

  assert.match(host, /\.\/ai\/comfyui-sdxl-local-gateway/);
  assert.doesNotMatch(host, /\.\/comfyui-sdxl-local-gateway["']/);
  assert.match(gateway, /\.\/comfyui-sdxl-local-provider/);
  assert.match(gateway, /\.\.\/comfyui-media-provider/);
  assert.match(gateway, /\.\.\/media-routing-store/);
  assert.match(gateway, /\.\.\/media-provider-common/);
  assert.match(gateway, /isLocalRequest\(request\)/);
  assert.match(gateway, /maximum = 256 \* 1024/);
  assert.match(gateway, /request\.method !== "POST"/);
  assert.match(gateway, /store\.imageRoute !== "comfyui"/);
  assert.match(gateway, /requestCount: 1/);
  assert.match(gateway, /localProfile: "SDXL 1\.0"/);

  assert.match(provider, /\.\.\/media-provider-common/);
  assert.match(provider, /DEFAULT_BASE_URL = "http:\/\/127\.0\.0\.1:8188"/);
  assert.match(provider, /IMAGE_TIMEOUT_MS = 240_000/);
  assert.match(provider, /visualContinuityEnvelope/);
  assert.match(provider, /referenceImages\(input\)/);
  assert.match(provider, /uploadReference/);
  assert.match(provider, /VAEEncode/);
  assert.match(provider, /saveGeneratedAsset/);
  assert.doesNotMatch(provider, /0\.0\.0\.0/);

  assert.match(hardware, /build\/ai\/comfyui-sdxl-local-gateway\.ts/);
  assert.match(hardware, /build\/ai\/comfyui-sdxl-local-provider\.ts/);

  const config = JSON.parse(configText);
  const batch = config.moveBatches.find((item) => item.id === "phase1-build-ai");
  assert.notEqual(batch?.status, "completed", "the AI batch must remain open while other ratified AI roots remain");
});
