import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("Issue #1802 keeps Dashboard as the canonical Skin V1 design reference", async () => {
  const [dashboard, reference, audit, manifest] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1-dashboard-reference.css"),
    read("lib/verification/webmcp-surface-visual-audit.mjs"),
    read("tests/visual-baselines/skin-v1/manifest.json").then(JSON.parse),
  ]);

  assert.match(dashboard, /data-skin-reference="dashboard-canonical"/u);
  assert.match(audit, /dashboard-canonical\.png/u);
  assert.equal(manifest.designReference, "dashboard");
  assert.match(audit, /captureSurfaceCandidate/u);
  assert.match(reference, /@import "\.\/skin-v1-definition\.css";/u);
});

test("Issue #1802 removes decorative equals dividers and uses one solid white rule", async () => {
  const [dashboard, reference] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1-dashboard-reference.css"),
  ]);

  assert.doesNotMatch(dashboard, /=\{8,\}/u);
  assert.doesNotMatch(dashboard, /pp-skin-v1-dashboard-divider/u);
  assert.match(dashboard, /pp-skin-v1-dashboard-rule/u);
  assert.match(reference, /\.pp-skin-v1-dashboard-rule/u);
  assert.match(reference, /background: var\(--pp-skin-line-strong\)/u);
});

test("Issue #1802 keeps the outer frame white and active row Matrix-green", async () => {
  const reference = await read("app/skin-v1-dashboard-reference.css");

  assert.match(reference, /border: var\(--pp-skin-border-strong\) solid var\(--pp-skin-line-strong\)/u);
  assert.match(reference, /\.pp-skin-v1-menu-item\.pp-skin-v1-dashboard-row\.is-selected/u);
  assert.match(reference, /border-color: var\(--pp-skin-accent-bright\)/u);
  assert.match(reference, /background: var\(--pp-skin-accent-deep\)/u);
  assert.match(reference, /color: var\(--pp-skin-ink\)/u);
});

test("Issue #1802 renders a status square on every Dashboard row and only activates selected connected rows", async () => {
  const [dashboard, reference] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1-dashboard-reference.css"),
  ]);

  assert.match(dashboard, /const statusActive = selected && connected;/u);
  assert.match(dashboard, /pp-skin-v1-dashboard-status-box\$\{statusActive \? " is-active" : ""\}/u);
  assert.match(dashboard, /data-dashboard-status=\{statusActive \? "active" : "inactive"\}/u);
  assert.match(reference, /background: var\(--pp-skin-ink-muted\)/u);
  assert.match(reference, /\.pp-skin-v1-dashboard-status-box\.is-active/u);
  assert.match(reference, /background: var\(--pp-skin-accent-bright\)/u);
});

test("Issue #1802 preserves packaged Dashboard art, fallback, and BBS header treatment", async () => {
  const [dashboard, assets, reference] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1/skin-v1-assets.ts"),
    read("app/skin-v1-dashboard-reference.css"),
  ]);

  assert.match(dashboard, /import Image from "next\/image"/u);
  assert.match(dashboard, /SKIN_V1_ASSETS\.dashboard\.hero/u);
  assert.match(dashboard, /SKIN_V1_ASSETS\.dashboard\.heroFallback/u);
  assert.match(dashboard, /priority/u);
  assert.match(assets, /plotpickle-observatory-dragon\.webp/u);
  assert.match(assets, /\/api\/skin-v1\/dashboard-art/u);
  assert.match(dashboard, /PLOTPICKLE BBS/u);
  assert.match(dashboard, /&gt;&gt;&gt;/u);
  assert.match(dashboard, /&lt;&lt;&lt;/u);
  assert.match(reference, /\.pp-skin-v1-dashboard-shell-chevron/u);
});
