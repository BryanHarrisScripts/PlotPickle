import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("Issue #1804 keeps Dashboard artwork inside the Skin V1 package boundary", async () => {
  const [dashboard, assets] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1/skin-v1-assets.ts"),
  ]);

  assert.match(dashboard, /import \{ SKIN_V1_ASSETS \} from "\.\/skin-v1-assets"/u);
  assert.doesNotMatch(dashboard, /const DASHBOARD_ART\s*=/u);
  assert.doesNotMatch(dashboard, /const DASHBOARD_ART_FALLBACK\s*=/u);
  assert.match(assets, /dashboard: Object\.freeze/u);
  assert.match(assets, /hero:/u);
  assert.match(assets, /heroFallback:/u);
});

test("Issue #1804 renders the Dashboard hero using the Community media pattern", async () => {
  const [dashboard, reference] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1-dashboard-reference.css"),
  ]);

  assert.match(dashboard, /import Image from "next\/image"/u);
  assert.match(dashboard, /<Image/u);
  assert.match(dashboard, /priority/u);
  assert.match(dashboard, /width=\{1200\}/u);
  assert.match(dashboard, /height=\{400\}/u);
  assert.match(reference, /aspect-ratio: var\(--pp-skin-art-ratio\)/u);
  assert.match(reference, /object-fit: cover/u);
  assert.match(reference, /image-rendering: pixelated/u);
});
