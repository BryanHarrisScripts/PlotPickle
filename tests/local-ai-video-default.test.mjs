import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Skin V1 VIDEO uses the focused MiniMax H3 local default instead of the old routing chooser", async () => {
  const host = await source("app/skin-v1/local-ai-skin-host.tsx");

  assert.match(host, /import LocalVideoPanel from "\.\/local-video-panel"/u);
  assert.match(host, /view === "video" \? <LocalVideoPanel/u);
  assert.doesNotMatch(host, /view === "video" \? <AiRoutingPanel capability="video"/u);
  assert.match(host, /fetch\("\/api\/media-routing\/comfyui\/h3\/native\/status"/u);
  assert.match(host, /fixedLocalVideoReady\(h3\)/u);
});

test("local VIDEO presents MiniMax H3 as the engine and ComfyUI only as its managed runtime dependency", async () => {
  const panel = await source("app/skin-v1/local-video-panel.tsx");

  for (const contract of [
    "PLOTPICKLE VIDEO DEFAULT",
    "MINIMAX H3",
    "ComfyUI Service",
    "Managed runtime dependency",
    "Local video engine",
    "360P-CLASS / B&W",
    "ACTIVE / GREEN",
    'activeReady ? "READY" : working ? "RUNNING..." : "RUN"',
    "/api/media-routing/comfyui/start",
    "/api/media-routing/comfyui/h3/native",
    "allowConstrainedVram",
  ]) assert.ok(panel.includes(contract), `Missing local video default contract: ${contract}`);

  assert.doesNotMatch(panel, /api\.openai\.com|api\.minimax\.io|generativelanguage\.googleapis\.com/u);
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
