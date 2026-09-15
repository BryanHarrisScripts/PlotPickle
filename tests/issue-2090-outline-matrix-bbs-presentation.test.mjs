import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#2090 Outline consumes the canonical Matrix / Skin V1 presentation contract", async () => {
  const css = await source("app/structure/structure.module.css");

  for (const token of [
    "--pp-skin-canvas",
    "--pp-skin-font-ui",
    "--pp-skin-line-strong",
    "--pp-skin-accent-deep",
    "--pp-skin-accent-bright",
    "--pp-skin-fill-panel",
    "--pp-skin-fill-accent-header",
    "--pp-skin-shadow-panel",
    "--pp-skin-radius",
  ]) {
    assert.ok(css.includes(token), `Outline is missing canonical Skin token ${token}`);
  }

  assert.match(css, /\.page\s*\{[^}]*background:\s*var\(--pp-skin-canvas\)/s);
  assert.match(css, /\.activeSequence[\s\S]*background:\s*var\(--pp-skin-accent-deep\)/);
  assert.match(css, /\.field textarea[\s\S]*background:\s*var\(--pp-skin-surface-0\)/);
});

test("#2090 removes the regressed light modern Outline presentation", async () => {
  const css = await source("app/structure/structure.module.css");

  for (const oldValue of [
    "#edf9f7",
    "#f8fcfb",
    "#236771",
    "#173f46",
    "#bfdedb",
    "rgba(255, 255, 255",
    "0 18px 45px",
    "border-radius: 999px",
    "clamp(38px, 6vw, 68px)",
  ]) {
    assert.ok(!css.includes(oldValue), `Outline still contains old presentation value: ${oldValue}`);
  }

  assert.doesNotMatch(css, /border-radius:\s*(?:12|14|16|17|18|20|24)px/);
  assert.doesNotMatch(css, /background:\s*linear-gradient\(/);
});

test("#2090 preserves existing Outline structure behavior and Dashboard host", async () => {
  const [page, host] = await Promise.all([
    source("app/structure/page.tsx"),
    source("app/skin-v1/dashboard-bbs-review-host.tsx"),
  ]);

  for (const operation of [
    "addDynamicScene",
    "duplicateDynamicScene",
    "moveDynamicScene",
    "moveSceneBetweenBlocks",
    "addShortSceneToMini",
    "removeShortSceneFromMini",
    "synchronizeScreenplaySceneReferences",
    "buildStoryClock",
    "window.localStorage.setItem",
  ]) {
    assert.ok(page.includes(operation), `Outline behavior contract is missing ${operation}`);
  }

  assert.match(page, /miniBlocks/);
  assert.match(page, /shortScenes/);
  assert.match(host, /<StructureEnginePage\s*\/>/);
  assert.match(host, /onSurfaceNameChange\("OUTLINE"\)/);
});
