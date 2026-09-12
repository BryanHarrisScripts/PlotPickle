import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("#1935 Writer's Craft selected row uses the BBS dark/accent state", async () => {
  const [directoryCss, dashboard, audit] = await Promise.all([
    read("app/skin-v1-settings-directory.css"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("lib/verification/skin-v1-menu-contract-audit.mjs"),
  ]);

  assert.match(
    dashboard,
    /aria-label="Writer's Craft menu"[\s\S]{0,180}data-skin-menu="writer-craft"/u,
    "Writer's Craft must retain its stable semantic surface identity",
  );
  assert.match(
    directoryCss,
    /\[aria-label="Writer's Craft menu"\] \.pp-skin-v1-menu-item\.pp-skin-v1-dashboard-row\.is-selected\s*\{[\s\S]*?border:\s*var\(--pp-skin-border-thin\) solid var\(--pp-skin-accent-bright\) !important;[\s\S]*?background:\s*var\(--pp-skin-accent-deep\) !important;[\s\S]*?color:\s*var\(--pp-skin-ink\) !important;/u,
    "Writer's Craft selected rows must use the canonical dark background and visible accent border",
  );
  assert.match(audit, /row\.selected && row\.backgroundColor !== result\.accentDeep/u);
  assert.match(audit, /row\.selected && row\.borderColor !== result\.accentBright/u);
});

test("#1935 keeps the global selected-control tokens unchanged", async () => {
  const [baseCss, definitionCss, directoryCss] = await Promise.all([
    read("app/skin-v1.css"),
    read("app/skin-v1-definition.css"),
    read("app/skin-v1-settings-directory.css"),
  ]);

  assert.match(
    baseCss,
    /\.pp-skin-v1-menu-item\.is-selected\s*\{[\s\S]*?background:\s*var\(--pp-skin-selected-bg\);[\s\S]*?color:\s*var\(--pp-skin-selected-ink\);/u,
  );
  assert.match(definitionCss, /--pp-skin-selected-bg:\s*#f4f4f4;/u);
  assert.doesNotMatch(directoryCss, /--pp-skin-selected-bg\s*:/u);
});
