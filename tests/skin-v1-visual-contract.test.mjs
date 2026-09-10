import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("Skin V1 is the base presentation contract and future skins can swap palette tokens", async () => {
  const definition = await read("app/skin-v1-definition.css");

  assert.match(definition, /html\[data-plotpickle-skin\^="skin-"\]/u);
  assert.match(definition, /PALETTE — the only block later skins should override/u);

  for (const token of [
    "--pp-skin-canvas",
    "--pp-skin-surface-0",
    "--pp-skin-ink",
    "--pp-skin-line",
    "--pp-skin-accent-deep",
    "--pp-skin-accent",
    "--pp-skin-accent-bright",
    "--pp-skin-warning-surface",
    "--pp-skin-warning-line",
    "--pp-skin-warning",
    "--pp-skin-warning-ink",
    "--pp-skin-focus",
    "--pp-skin-selected-bg",
    "--pp-skin-selected-ink",
  ]) assert.match(definition, new RegExp(token, "u"));

  for (const token of [
    "--pp-skin-font-ui",
    "--pp-skin-font-brand",
    "--pp-skin-space-1: 4px",
    "--pp-skin-space-9: 36px",
    "--pp-skin-radius: 0px",
    "--pp-skin-touch-target: 44px",
    "--pp-skin-shell-max: 1180px",
    "--pp-skin-menu-max: 1060px",
    "--pp-skin-art-ratio: 3 / 1",
    "--pp-skin-shadow-panel: 4px 4px 0",
    "--pp-skin-shadow-control: 2px 2px 0",
    "--pp-skin-motion-fast: 80ms",
  ]) assert.ok(definition.includes(token), `Missing Skin V1 base contract token: ${token}`);

  assert.match(definition, /8\/16-BIT SHADING/u);
  assert.match(definition, /--pp-matrix-deep: var\(--pp-skin-accent-deep\)/u);
  assert.match(definition, /--pp-matrix-mid: var\(--pp-skin-accent\)/u);
  assert.match(definition, /--pp-matrix-light: var\(--pp-skin-accent-bright\)/u);
});

test("Dashboard consumes Skin V1 tokens and Skin V1 owns its artwork package", async () => {
  const [reference, dashboard, assets] = await Promise.all([
    read("app/skin-v1-dashboard-reference.css"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1/skin-v1-assets.ts"),
  ]);

  assert.match(reference, /@import "\.\/skin-v1-definition\.css";/u);
  assert.match(reference, /var\(--pp-skin-shell-max\)/u);
  assert.match(reference, /var\(--pp-skin-menu-max\)/u);
  assert.match(reference, /var\(--pp-skin-accent-bright\)/u);
  assert.match(reference, /var\(--pp-skin-fill-panel\)/u);
  assert.doesNotMatch(reference, /#55ffff|#67e9f4|#f4bd49/iu);

  assert.match(dashboard, /import Image from "next\/image"/u);
  assert.match(dashboard, /import \{ SKIN_V1_ASSETS \} from "\.\/skin-v1-assets"/u);
  assert.match(dashboard, /useState\(SKIN_V1_ASSETS\.dashboard\.hero\)/u);
  assert.match(dashboard, /priority/u);
  assert.match(dashboard, /width=\{1200\}/u);
  assert.match(dashboard, /height=\{400\}/u);
  assert.match(dashboard, /SKIN_V1_ASSETS\.dashboard\.heroFallback/u);

  assert.match(assets, /hero: "\/brand\/dashboard\/plotpickle-observatory-dragon\.svg"/u);
  assert.match(assets, /heroFallback: "\/api\/skin-v1\/dashboard-art"/u);
  assert.match(reference, /image-rendering: pixelated/u);
  assert.match(reference, /object-fit: cover/u);
});

test("Skin V1 owned surfaces consume semantic skin tokens instead of owning palettes", async () => {
  const files = [
    "app/community-monochrome-skin.css",
    "app/skin-v1/local-ai-skin-host.tsx",
    "app/skin-v1/local-comfyui-panel.tsx",
    "app/skin-v1/local-video-panel.tsx",
    "app/skin-v1/local-ltx-setup-panel.tsx",
    "app/skin-v1/local-h3-setup-panel.tsx",
    "app/skin-v1/node-skin-panel.tsx",
  ];

  for (const file of files) {
    const source = await read(file);
    assert.match(source, /var\(--pp-skin-/u, `${file} must consume the shared Skin contract`);
    assert.doesNotMatch(source, /#55ffff|#67e9f4|#f4bd49/iu, `${file} must not revive the retired Dashboard palette`);
  }
});
