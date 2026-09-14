import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("#2026/#2032 locks the Human-approved Dashboard order, labels, descriptions and groups", async () => {
  const skin = await read("app/skin-v1/skin-v1-client.tsx");
  const menu = skin.slice(skin.indexOf("const DASHBOARD_MENU"), skin.indexOf("function nextIntentId"));

  const ordered = [
    ['community', 'C', 'Community', 'Share and Collaborate', null],
    ['learn', '1', "Writer's Craft", 'Learn Story Craft', null],
    ['library', 'L', 'Story Library', 'Load Your Stories', null],
    ['plan', 'P', 'Outline', 'Visualize Story Structure', 'STRUCTURING'],
    ['storyboard', 'S', 'Storyboard', 'Visualize Scenes Before You Write', 'STRUCTURING'],
    ['previs', 'V', 'Previs', 'Preview Shots, Timing and Camera Motion', 'STRUCTURING'],
    ['write', 'W', 'Write', 'Write Scenes, Dialogue and Action Blocks', 'DRAFTING'],
    ['edit', 'E', 'Edit', 'Review and Improve Screenplay Flow', 'DRAFTING'],
    ['feedback', 'F', 'Feedback', 'Gather Reader Notes and Reactions', 'DRAFTING'],
    ['refine', 'R', 'Polish', 'Enhance Dialogue and Story Choices', 'DRAFTING'],
    ['reports', 'A', 'Analytics', 'Review Story Health and Coverage Reports', 'DRAFTING'],
    ['wyrmwood', '2', 'Wyrmwood Game', 'Practice Narrative Craft', 'INTERACTIVE LEARNING'],
    ['story', '3', 'The Unwritten', 'Story Game Engine', 'INTERACTIVE LEARNING'],
    ['profile', 'U', 'Profile', 'Manage User Identity', 'MANAGEMENT'],
    ['settings', 'O', 'Settings', 'Configure PlotPickle', 'MANAGEMENT'],
    ['help', 'H', 'Issue Log', 'Prepare a PlotPickle Issue', 'MANAGEMENT'],
    ['open-source', 'N', 'Licensing', 'Review Open Source Licensing and Attribution', 'MANAGEMENT'],
    ['logout', 'X', 'Log Off', 'End This Session', null],
  ];

  let cursor = -1;
  for (const [id, shortcut, label, description, group] of ordered) {
    const token = `{ id: "${id}", shortcut: "${shortcut}", label: "${label}", description: "${description}"${group ? `, group: "${group}"` : ""} }`;
    const index = menu.indexOf(token);
    assert.ok(index > cursor, `${label} must appear in the #2026/#2032 canonical Dashboard order`);
    cursor = index;
  }

  assert.doesNotMatch(menu, /&/u, "Human-facing Dashboard menu copy must use 'and' rather than ampersands");
});

test("#2026 keeps the compact main-menu composition and one aligned live-status column", async () => {
  const [layout, resetCss, dashboard] = await Promise.all([
    read("app/layout.tsx"),
    read("app/skin-v1-dashboard-menu-reset.css"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
  ]);

  assert.match(layout, /import "\.\/skin-v1-dashboard-menu-reset\.css"/u);
  assert.match(resetCss, /\.pp-skin-v1-dashboard-shell-title[\s\S]*display: none !important/u);
  assert.match(resetCss, /\.pp-skin-v1-dashboard-art/u);
  assert.match(resetCss, /\[data-plotpickle-score="v1"\]/u);
  assert.match(resetCss, /\.pp-skin-v1-dashboard-title/u);
  assert.match(resetCss, /\.pp-skin-v1-dashboard-status-box[\s\S]*right: var\(--pp-skin-space-2\) !important/u);
  assert.match(resetCss, /\[data-dashboard-menu-item="logout"\][\s\S]*margin-top: var\(--pp-skin-space-6\) !important/u);

  assert.match(dashboard, /const connected = CONNECTED_DASHBOARD_ITEMS\.has\(item\.id\)/u);
  assert.match(dashboard, /data-skin-menu-indicator=\{connected \? "connected" : "unwired"\}/u);
  assert.match(dashboard, /data-dashboard-status=\{connected \? "active" : "inactive"\}/u);
});

test("#2026 preserves keyboard-first navigation while changing only Human-facing menu IA", async () => {
  const [skin, dashboard] = await Promise.all([
    read("app/skin-v1/skin-v1-client.tsx"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
  ]);

  assert.match(skin, /event\.key === "ArrowDown"/u);
  assert.match(skin, /event\.key === "ArrowUp"/u);
  assert.match(skin, /event\.key === "Home"/u);
  assert.match(skin, /event\.key === "End"/u);
  assert.match(dashboard, /event\.key\.length === 1/u);
  assert.match(dashboard, /activateItem\(shortcutIndex\)/u);
  assert.match(dashboard, /onClick=\{\(\) => activateItem\(index\)\}/u);
});
