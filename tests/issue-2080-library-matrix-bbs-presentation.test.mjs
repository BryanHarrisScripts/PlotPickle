import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2080 Library consumes the canonical Matrix / Skin V1 presentation tokens", async () => {
  const [workspace, css] = await Promise.all([
    read("modules/library/ui/library-workspace.tsx"),
    read("modules/library/ui/library-workspace.module.css"),
  ]);

  for (const token of [
    "--pp-skin-font-ui",
    "--pp-skin-radius",
    "--pp-skin-line-strong",
    "--pp-skin-accent-deep",
    "--pp-skin-accent-bright",
    "--pp-skin-fill-panel",
    "--pp-skin-shadow-panel",
  ]) {
    assert.ok(css.includes(`var(${token})`), `Library should consume ${token}`);
  }

  assert.match(css, /\.activeCard\s*\{[\s\S]*?border:\s*var\(--pp-skin-border-strong\) solid var\(--pp-skin-accent-bright\)/);
  assert.match(workspace, /pp-skin-v1-menu pp-skin-v1-dashboard-menu/);
  assert.match(workspace, /pp-skin-v1-menu-item pp-skin-v1-dashboard-row pp-skin-v1-submenu-item/);
  assert.match(workspace, /data-skin-menu-indicators="hidden"/);
  assert.doesNotMatch(workspace, /pp-skin-v1-dashboard-status-box is-active/);
});

test("#2080 removes the modern editorial/gallery visual drift", async () => {
  const css = await read("modules/library/ui/library-workspace.module.css");

  assert.doesNotMatch(css, /Georgia|Times New Roman/i);
  assert.doesNotMatch(css, /radial-gradient/i);
  assert.doesNotMatch(css, /backdrop-filter/i);
  assert.doesNotMatch(css, /border-radius:\s*(?:7|8|9|10|11|12|16|18|20|99)px/i);
  assert.doesNotMatch(css, /#efc96b|#f8e2a3|#efcf76|#edc86d|238,\s*200,\s*103/i);
  assert.doesNotMatch(css, /font-size:\s*clamp\(44px|font-size:\s*88px/i);
});

test("#2080 preserves the #2072 Library destinations and behavior surface", async () => {
  const workspace = await read("modules/library/ui/library-workspace.tsx");

  const expected = [
    ["N", "NEW"],
    ["I", "IMPORT"],
    ["L", "LOAD"],
    ["E", "EXAMPLES"],
    ["P", "PRESETS"],
    ["A", "AVERY"],
    ["R", "ARCHIVE"],
  ];
  let cursor = -1;
  for (const [shortcut, label] of expected) {
    const next = workspace.indexOf(`shortcut: "${shortcut}", label: "${label}"`, cursor + 1);
    assert.ok(next > cursor, `Expected [${shortcut}] ${label} in canonical Library navigation order`);
    cursor = next;
  }

  assert.match(workspace, /createLibraryUserProject/);
  assert.match(workspace, /importLibraryProject/);
  assert.match(workspace, /switchActiveLibraryProject/);
  assert.match(workspace, /createLibraryWorkingCopy/);
  assert.match(workspace, /archiveLibraryProject/);
  assert.match(workspace, /AverySessionHistory/);
});
