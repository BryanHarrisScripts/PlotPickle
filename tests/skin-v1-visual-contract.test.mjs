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
  assert.match(definition, /--pp-skin-media-filter:\s*none;/u);
  assert.doesNotMatch(definition, /--pp-skin-media-filter:[^;]*grayscale\(/u);
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
  assert.match(dashboard, /height=\{377\}/u);
  assert.match(dashboard, /SKIN_V1_ASSETS\.dashboard\.heroFallback/u);

  assert.match(assets, /hero: "\/brand\/dashboard\/plotpickle-observatory-dragon\.webp"/u);
  assert.match(assets, /heroFallback: "\/api\/skin-v1\/dashboard-art"/u);
  assert.match(reference, /image-rendering: pixelated/u);
  assert.match(reference, /object-fit: cover/u);
  assert.match(reference, /filter: var\(--pp-skin-media-filter\) !important/u);
});

test("Community consumes the shared Skin V1 palette instead of neutralizing it", async () => {
  const [adapter, social] = await Promise.all([
    read("app/community-monochrome-skin.css"),
    read("modules/community/community-buzz-social.module.css"),
  ]);

  assert.match(adapter, /--community-teal:\s*var\(--pp-skin-accent-bright\)/u);
  assert.match(adapter, /--community-orange:\s*var\(--pp-skin-accent\)/u);
  assert.match(adapter, /--community-accent-deep:\s*var\(--pp-skin-accent-deep\)/u);
  assert.match(adapter, /filter:\s*none\s*!important/u);
  assert.doesNotMatch(adapter, /filter:\s*grayscale\(1\)\s*saturate\(0\)/u);

  for (const token of [
    "--pp-skin-surface-0",
    "--pp-skin-surface-1",
    "--pp-skin-line",
    "--pp-skin-ink",
    "--pp-skin-ink-muted",
    "--pp-skin-accent-deep",
    "--pp-skin-accent",
    "--pp-skin-accent-bright",
    "--pp-skin-radius",
    "--pp-skin-media-filter",
  ]) assert.match(`${adapter}\n${social}`, new RegExp(token, "u"));

  assert.doesNotMatch(social, /#35c9b8|#d6a95f|#d68a45|#e5bd72|#93e36f|rgba\(53,\s*201,\s*184|rgba\(214,\s*169,\s*95/iu);
  assert.doesNotMatch(social, /border-radius:\s*(?:7|8|999)px/iu);
  assert.match(social, /image-rendering:\s*pixelated/u);
});

test("Skin V1 compatibility CSS owns structure, not a fallback black-and-white palette", async () => {
  for (const file of ["app/skin-v1.css", "app/skin-v1-bbs-surfaces.css"]) {
    const source = await read(file);
    assert.match(source, /var\(--pp-skin-/u, `${file} must consume the shared Skin contract`);
    assert.doesNotMatch(source, /#[0-9a-f]{3,8}\b/iu, `${file} must not hard-code a local colour palette`);
    assert.doesNotMatch(source, /rgba?\(/iu, `${file} must not hard-code RGB colour values`);
  }

  const compatibility = await read("app/skin-v1.css");
  assert.match(compatibility, /\.pp-skin-v1-community[\s\S]*filter:\s*none/u);
  assert.doesNotMatch(compatibility, /filter:\s*grayscale\(1\)/u);
  assert.doesNotMatch(compatibility, /--pp-dashboard-cyan|--pp-dashboard-amber/u);
});

test("Profile and Settings inherit Skin V1 presentation instead of owning local colours", async () => {
  const [profile, bbsCss, dashboard] = await Promise.all([
    read("app/skin-v1/profile-skin-panel.tsx"),
    read("app/skin-v1-bbs-surfaces.css"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
  ]);

  assert.match(profile, /className="pp-skin-v1-profile-surface"/u);
  assert.match(profile, /className="pp-skin-v1-profile-banner"/u);
  assert.match(bbsCss, /\.pp-skin-v1-profile-surface/u);
  assert.match(bbsCss, /background: var\(--pp-skin-canvas\)/u);
  assert.match(bbsCss, /background: var\(--pp-skin-fill-accent-header\)/u);
  assert.match(bbsCss, /color: var\(--pp-skin-accent-bright\)/u);

  assert.match(dashboard, /data-settings-menu="secondary-only"/u);
  assert.match(dashboard, /className="pp-skin-v1-menu-item pp-skin-v1-submenu-item"/u);
  assert.match(dashboard, /className="pp-skin-v1-bbs-help" id="settings-menu-status"/u);
  const settingsStart = dashboard.indexOf("if (settingsMenuOpen)");
  const dashboardStart = dashboard.indexOf('aria-label="PlotPickle Dashboard"', settingsStart);
  const settingsSource = dashboard.slice(settingsStart, dashboardStart);
  assert.ok(settingsStart >= 0 && dashboardStart > settingsStart);
  assert.doesNotMatch(settingsSource, /#[0-9a-f]{3,8}\b|rgba?\(/iu);
});

test("Skin V1 owned surfaces consume semantic skin tokens instead of owning palettes", async () => {
  const files = [
    "app/community-monochrome-skin.css",
    "modules/community/community-buzz-social.module.css",
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
