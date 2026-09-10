import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const registry = JSON.parse(await readFile(new URL("config/ai-source-registry.json", root), "utf8"));
const loader = await readFile(new URL("lib/runtime/ai/source-registry.ts", root), "utf8");
const adapters = await readFile(new URL("build/ai/local-plugin-adapters.ts", root), "utf8");
const gateway = await readFile(new URL("build/ai/local-plugin-gateway.ts", root), "utf8");
const composition = await readFile(new URL("build/local-ai-gateway.ts", root), "utf8");

function plugin(id) {
  return registry.plugins.find((candidate) => candidate.id === id);
}

test("local AI registry exposes reviewed model/workflow plugins separately from runtimes", () => {
  const sdxl = plugin("image.sdxl-1.0");
  const ltx = plugin("video.ltx-video-2b-0.9.8-distilled");
  const h3 = plugin("video.minimax-h3");
  assert.ok(sdxl);
  assert.ok(ltx);
  assert.ok(h3);
  assert.equal(sdxl.runtimeProviderId, "comfyui");
  assert.equal(ltx.runtimeProviderId, "comfyui");
  assert.equal(h3.runtimeProviderId, "comfyui");
  assert.equal(ltx.adapterId, "comfyui-ltx-local");
  assert.equal(h3.adapterId, "comfyui-h3-native");
  assert.deepEqual(ltx.modes, ["text-to-video"]);
  assert.deepEqual(h3.modes, ["text-to-video"]);
});

test("Pascal 8 GB ranks LTX instead of H3 while H3 stays available for stronger hardware", () => {
  const ltx = plugin("video.ltx-video-2b-0.9.8-distilled");
  const h3 = plugin("video.minimax-h3");
  assert.equal(ltx.hardwarePriority["nvidia-pascal-8gb-32gb"], 10);
  assert.equal(h3.hardwarePriority["nvidia-pascal-8gb-32gb"], undefined);
  assert.equal(h3.hardwarePriority["nvidia-24gb-plus"], 10);
  assert.equal(h3.advanced, true);
});

test("typed registry selects plugins by capability and hardware profile", () => {
  assert.match(loader, /export function recommendLocalPlugin/);
  assert.match(loader, /plugin\.hardwarePriority\[hardwareProfileId\]/);
  assert.match(loader, /left\.priority - right\.priority/);
  assert.match(loader, /registered local runtime provider/);
});

test("reviewed adapter registry normalizes LTX and H3 readiness", () => {
  assert.match(adapters, /registerLocalAiPluginAdapter/);
  assert.match(adapters, /id: "comfyui-ltx-local"/);
  assert.match(adapters, /probeLtxVideo/);
  assert.match(adapters, /id: "comfyui-h3-native"/);
  assert.match(adapters, /probeNativeH3/);
  assert.match(adapters, /runtimeReady: status\.reachable/);
});

test("local plugin gateway exposes automatic hardware recommendations without UI model branching", () => {
  assert.match(gateway, /const API_ROOT = "\/api\/local-ai\/plugins"/);
  assert.match(gateway, /detectLocalHardware/);
  assert.match(gateway, /recommendLocalPlugin/);
  assert.match(gateway, /probeLocalAiPluginAdapter/);
  assert.match(composition, /registerLocalPluginGateway\(server\)/);
});
