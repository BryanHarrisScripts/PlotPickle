import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Skin V1 VIDEO uses the focused MiniMax H3 text-to-video local default instead of the old routing chooser", async () => {
  const host = await source("app/skin-v1/local-ai-skin-host.tsx");

  assert.match(host, /import LocalVideoPanel from "\.\/local-video-panel"/u);
  assert.match(host, /import LocalH3SetupPanel from "\.\/local-h3-setup-panel"/u);
  assert.match(host, /view === "video" \? <LocalVideoPanel/u);
  assert.match(host, /view === "h3" \? <LocalH3SetupPanel/u);
  assert.doesNotMatch(host, /view === "video" \? <AiRoutingPanel capability="video"/u);
  assert.match(host, /fetch\("\/api\/media-routing\/comfyui\/h3\/native\/status"/u);
  assert.match(host, /fixedLocalVideoReady\(h3\)/u);
  assert.match(host, /status\.workflowFamily === "text-to-video"/u);
});

test("local VIDEO presents MiniMax H3 text-to-video as the engine and shares the exact setup blocker", async () => {
  const panel = await source("app/skin-v1/local-video-panel.tsx");

  for (const contract of [
    "PLOTPICKLE VIDEO DEFAULT",
    "MINIMAX H3 · TEXT TO VIDEO",
    "ComfyUI Service",
    "Managed runtime dependency",
    "Text-to-video engine",
    "TEXT→VIDEO / 360P / B&W",
    "ACTIVE / GREEN",
    'activeReady ? "READY" : working ? "RUNNING..." : "RUN"',
    "/api/media-routing/comfyui/start",
    "/api/media-routing/comfyui/h3/native",
    "allowConstrainedVram",
    "h3TextToVideoPrerequisitesReady",
    "deriveH3TextToVideoSetup",
    "SETUP BLOCKER:",
    "SETUP H3",
  ]) assert.ok(panel.includes(contract), `Missing local video default contract: ${contract}`);

  assert.doesNotMatch(panel, /api\.openai\.com|api\.minimax\.io|generativelanguage\.googleapis\.com/u);
});

test("guided H3 setup reports one exact blocker at a time and keeps developer controls advanced", async () => {
  const [helper, panel] = await Promise.all([
    source("app/skin-v1/h3-setup-status.ts"),
    source("app/skin-v1/local-h3-setup-panel.tsx"),
  ]);

  for (const blocker of [
    "COMFYUI SERVICE NOT RUNNING",
    "GPU BELOW LOCAL VIDEO MINIMUM",
    "TEXT-TO-VIDEO WORKFLOW NOT INSTALLED",
    "TEXT-TO-VIDEO WORKFLOW REQUIRED",
    "COMFYUI VERSION UPDATE REQUIRED",
    "MISSING COMFYUI NODE:",
    "MISSING H3 MODEL:",
    "TEXT-TO-VIDEO SETUP READY",
  ]) assert.ok(helper.includes(blocker), `Missing H3 setup blocker: ${blocker}`);

  for (const contract of [
    "PLOTPICKLE H3 SETUP",
    "MINIMAX H3 · TEXT TO VIDEO",
    "SETUP BLOCKER",
    "NEXT:",
    "CHECK AGAIN",
    "START COMFYUI",
    "ADVANCED SETUP",
    "H3NativePanel",
    "does not automatically download H3 weights",
  ]) assert.ok(panel.includes(contract), `Missing guided H3 setup contract: ${contract}`);
});

test("8 GB-class H3 VRAM uses the constrained profile that the UI displays", async () => {
  const provider = await source("build/ai/h3/comfyui-h3-native-provider.ts");

  assert.match(provider, /const gib = Math\.round\(\(bytes \/ \(1024 \*\* 3\)\) \* 10\) \/ 10/u);
  assert.match(provider, /if \(gib >= 8\) return \{ id: "constrained"/u);
  assert.match(provider, /8 GB-class VRAM uses PlotPickle's constrained local text-to-video profile/u);
  assert.match(provider, /return \{ id: "impractical", warning: "Less than 8 GB VRAM is blocked/u);
});

test("local IMAGES uses RUN then READY and yellow diagnostic pills", async () => {
  const panel = await source("app/skin-v1/local-comfyui-panel.tsx");

  assert.match(panel, /activeReady \? "READY" : working === "ready" \? "RUNNING\.\.\." : "RUN"/u);
  assert.match(panel, /const yellowButton: React\.CSSProperties/u);
  assert.match(panel, /border: "1px solid #d8c85d"/u);
  assert.match(panel, /borderRadius: 999/u);
  assert.match(panel, /style=\{yellowButton\}[^>]*>\{working === "diagnostic"/u);
  assert.match(panel, /"RUN LOCAL DIAGNOSTIC"/u);
  assert.match(panel, /style=\{yellowButton\}[^>]*>\{working === "test"/u);
  assert.match(panel, /"TEST LOCAL IMAGE"/u);
});
