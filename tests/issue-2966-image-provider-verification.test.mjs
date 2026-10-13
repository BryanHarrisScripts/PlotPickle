import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveImageTestRoute, assertCloudImageTestProof } from "../core/contracts/compute/image-test-provider-truth.mjs";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const validProof = (provider) => ({
  receipt: { ok: true, route: provider, provider, assetUrl: "/api/local-ai/assets/test.webp" },
  status: { profiles: { [provider]: { imageReady: true, imageVerifiedAt: "2026-10-13T00:00:00.000Z" } } },
});

test("#2966 explicitly requested MiniMax/OpenAI always wins over locally selected SDXL and Qwen", () => {
  for (const route of ["minimax", "openai"]) assert.equal(resolveImageTestRoute(route, "comfyui"), route);
  assert.equal(resolveImageTestRoute("comfyui", "minimax"), "comfyui");
  assert.equal(resolveImageTestRoute(undefined, "comfyui"), "comfyui");
  for (const invalid of ["ollama-comfyui", "minimax-direct", "", null, {}, 123]) {
    assert.throws(() => resolveImageTestRoute(invalid, "comfyui"), /supported image-test route/);
  }
});

test("#2966 test-proof admission rejects local SDXL masquerading as MiniMax or OpenAI", () => {
  for (const expected of ["openai", "minimax"]) {
    const { receipt, status } = validProof(expected);
    assert.equal(assertCloudImageTestProof(expected, receipt, status).provider, expected);
    for (const altered of [
      { ...receipt, route: "comfyui" },
      { ...receipt, provider: "comfyui" },
      { ...receipt, ok: false },
      { ...receipt, assetUrl: "https://example.test/untrusted.png" },
      { ...receipt, assetUrl: "" },
      { ...receipt, assetUrl: undefined },
    ]) assert.throws(() => assertCloudImageTestProof(expected, altered, status), /verification rejected/);
    for (const brokenStatus of [
      { profiles: { [expected]: { imageReady: false, imageVerifiedAt: "" } } },
      { profiles: { [expected]: { imageReady: false, imageVerifiedAt: "2026-10-13" } } },
      { profiles: { comfyui: { imageReady: true, imageVerifiedAt: "2026-10-13" } } },
      { profiles: {} },
    ]) assert.throws(() => assertCloudImageTestProof(expected, receipt, brokenStatus), /not independently persisted/);
  }
  assert.throws(() => assertCloudImageTestProof("comfyui", {}, {}), /Invalid cloud image provider/);
});

test("#2966 canonical intake owns the request exactly once and only credits the executed route", async () => {
  const [host, local, router, ui] = await Promise.all([
    read("build/local-ai-gateway.ts"),
    read("build/ai/comfyui-sdxl-local-gateway.ts"),
    read("build/media-routing-gateway.ts"),
    read("app/skin-v1/cloud-provider-setup-panel.tsx"),
  ]);
  assert.doesNotMatch(host, /registerSdxlLocalImageGateway/);
  assert.doesNotMatch(local, /server\.middlewares\.use|request\.url|readBody\(request\)/);
  assert.match(local, /LOCAL_SDXL_CHECKPOINT/);
  assert.match(local, /generateSdxlImage/);
  assert.match(router, /resolveImageTestRoute\(body\.route, store\.imageRoute\)/);
  assert.match(router, /route === "comfyui" && store\.comfyui\.imageProfile === "sdxl-1\.0"/);
  assert.match(router, /await generateSdxlLocalTest\(store, input\)/);
  assert.match(router, /await saveImageSuccess\(store, route\)/);
  assert.match(router, /sendJson\(response, 200, \{ ok: true, \.\.\.result, route, provider: route \}\)/);
  assert.match(ui, /assertCloudImageTestProof\(provider, tested, verified\)/);
  assert.match(ui, /billingAcknowledged: true/);
  assert.match(ui, /requirePaidTest\(\)/);
});
