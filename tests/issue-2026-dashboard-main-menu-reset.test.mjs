import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("#2026/#2032/#2050/#2068/#2085/#2266/#2285/#2287/#2302 locks the Human-approved Dashboard order, labels, descriptions and groups", async () => {
  const menu = await read("app/skin-v1/dashboard-menu-registry.ts");

  const ordered = [
    ["learn", "1", "Learn", "Learn Story Craft", "EXPLORE"],
    ["community", "C", "Community", "Share and Collaborate", "EXPLORE"],
    ["screening", "9", "Screening", "Screen Stories and Gather Reactions", "EXPLORE"],
    ["library", "L", "Library", "Load Your Stories", "EXPLORE"],
    ["reports", "A", "Reports", "Review Story Health and Coverage Reports", "EXPLORE"],
    ["discovery", "G", "MindMap", "Capture and Map New Story Material", "DEVELOP"],
    ["story-bible", "V", "WorldMap", "Map the Story World", "DEVELOP"],
    ["write", "W", "Write", "Write Scenes, Dialogue and Action Blocks", "DEVELOP"],
    ["edit", "E", "Edit", "Review and Improve Screenplay Flow", "DEVELOP"],
    ["refine", "R", "Refine", "Polish Dialogue and Story Choices", "DEVELOP"],
    ["plan", "O", "Outline", "Visualize Story Structure", "VISUALIZE"],
    ["storyboard", "S", "Storyboard", "Visualize Scenes Before You Write", "VISUALIZE"],
    ["previs", "P", "Previs", "Preview Shots, Timing and Camera Motion", "VISUALIZE"],
    ["timeline", "T", "Timeline", "Synchronize Script, Shots, Timing and Audio", "VISUALIZE"],
    ["production", "D", "Rough Cut", "Review Production Intent and Handoff Readiness", "VISUALIZE"],
    ["sound-narration", "6", "Narration", "Develop Narration, Voice-Over and Spoken Story", "SOUND"],
    ["sound-music", "7", "Music", "Develop Score, Music and Ambient Cues", "SOUND"],
    ["sound-foley", "8", "Foley", "Develop Foley, Room Tone and Environmental Sound", "SOUND"],
    ["pitch-package", "4", "Package", "Develop the Pitch Package and Presentation Materials", "PITCH"],
    ["pitch-deck", "5", "Deck", "Generate and Review the Visual Pitch Deck", "PITCH"],
    ["feedback", "F", "Feedback", "Gather Reader Notes and Reactions", "PITCH"],
    ["profile", "I", "Identity", "Manage User Profile", "PLAY"],
    ["wyrmwood", "2", "Wyrmwood", "Practice Narrative Craft", "PLAY"],
    ["story", "3", "Written", "Story Game Engine", "PLAY"],
    ["settings", "M", "Settings", "Configure PlotPickle", "SYSTEM"],
    ["help", "B", "Service", "Prepare a PlotPickle Issue", "SYSTEM"],
    ["open-source", "N", "Legal", "Open Source Licensing and Attribution", "SYSTEM"],
    ["logout", "X", "Log Off", "End This Session", "SYSTEM"],
    ["shutdown", "Q", "Shut Down", "Safely Close PlotPickle and Local Services", "SYSTEM"],
  ];

  let cursor = -1;
  for (const [id, shortcut, label, description, group] of ordered) {
    const token = `{ id: "${id}", shortcut: "${shortcut}", label: "${label}", description: "${description}", group: "${group}" }`;
    const index = menu.indexOf(token);
    assert.ok(index > cursor, `${label} must appear in the canonical Dashboard order`);
    cursor = index;
  }

  const shortcuts = ordered.map(([, shortcut]) => shortcut);
  assert.equal(new Set(shortcuts).size, shortcuts.length, "Dashboard keyboard shortcuts must be unique");

  const groupCounts = new Map();
  for (const [, , , , group] of ordered) groupCounts.set(group, (groupCounts.get(group) || 0) + 1);
  assert.deepEqual([...groupCounts.entries()], [
    ["EXPLORE", 5],
    ["DEVELOP", 5],
    ["VISUALIZE", 5],
    ["SOUND", 3],
    ["PITCH", 3],
    ["PLAY", 3],
    ["SYSTEM", 5],
  ]);

  for (const [, , , description] of ordered) {
    assert.doesNotMatch(description, /&/u, "Human-facing Dashboard menu copy must use 'and' rather than ampersands");
  }
  assert.match(menu, /\.filter\(\(item\) => !\["logout", "shutdown"\]\.includes\(item\.id\)/u);
  const connected = menu.slice(menu.indexOf("export const CONNECTED_DASHBOARD_ITEM_IDS"), menu.indexOf("export const DASHBOARD_REVIEW_ITEM_IDS"));
  assert.doesNotMatch(connected, /"pitch-package"/u);
  assert.doesNotMatch(connected, /"pitch-deck"/u);
  assert.match(menu, /export const DASHBOARD_REVIEW_ITEM_IDS = new Set\(\[[\s\S]*"discovery"[\s\S]*"story-bible"[\s\S]*"plan"[\s\S]*"storyboard"[\s\S]*"previs"[\s\S]*"timeline"[\s\S]*"production"/u);
  assert.match(menu, /export const DASHBOARD_UNAVAILABLE_ITEM_IDS = new Set\(\[[\s\S]*"sound-narration"[\s\S]*"sound-music"[\s\S]*"sound-foley"[\s\S]*"pitch-package"[\s\S]*"pitch-deck"/u);
});

test("#2026/#2068/#2124 keeps the compact main-menu composition, visible score and one aligned live-status column", async () => {
  const [layout, resetCss, dashboard] = await Promise.all([
    read("app/layout.tsx"),
    read("app/skin-v1-dashboard-menu-reset.css"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
  ]);

  assert.match(layout, /import "\.\/skin-v1-dashboard-menu-reset\.css"/u);
  assert.match(resetCss, /\.pp-skin-v1-dashboard-shell-title[\s\S]*display: none !important/u);
  assert.match(resetCss, /\.pp-skin-v1-dashboard-art/u);
  assert.match(resetCss, /\[data-plotpickle-score="v1"\][\s\S]*display: block !important/u);
  assert.match(resetCss, /\.pp-skin-v1-dashboard-title/u);
  assert.match(resetCss, /\.pp-skin-v1-dashboard-status-box[\s\S]*right: var\(--pp-skin-space-2\) !important/u);
  assert.doesNotMatch(resetCss, /data-dashboard-menu-item="logout"[\s\S]*margin-top/u);

  assert.match(dashboard, /<PlotPickleScorePanel \/>/u);
  assert.match(dashboard, /const connected = CONNECTED_DASHBOARD_ITEM_IDS\.has\(item\.id\)/u);
  assert.match(dashboard, /data-skin-menu-indicator=\{connected \? "connected" : "unwired"\}/u);
  assert.match(dashboard, /data-dashboard-surface-state=\{unavailable \? "unavailable" : inReview \? "in-review" : locked \? "locked" : "unavailable"\}/u);
  assert.match(dashboard, /data-dashboard-locked=\{locked \? "true" : "false"\}/u);
  assert.match(dashboard, /data-dashboard-status=\{unavailable \? "inactive" : inReview \? "in-review" : locked \? "locked" : "inactive"\}/u);
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

test("#2068 reuses the graceful PlotPickle shutdown sequence behind the Dashboard action", async () => {
  const [host, shutdown] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("app/skin-v1/node-shutdown-panel.tsx"),
  ]);

  assert.match(host, /item\.id === "shutdown"/u);
  assert.match(host, /<NodeShutdownPanel onCancel=\{closeShutdown\} \/>/u);
  assert.match(shutdown, /nodeAction\("begin-shutdown"\)/u);
  assert.match(shutdown, /persistActiveProfileProject\(\)/u);
  assert.match(shutdown, /flushProfilePrivateWrites\(\)/u);
  assert.match(shutdown, /logoutHumanProfile\(currentProfile\.csrfToken\)/u);
  assert.match(shutdown, /clearProfilePrivateBrowser\(\)/u);
  assert.match(shutdown, /nodeAction\("complete-shutdown", \{ shutdownToken \}\)/u);
  assert.match(shutdown, /nodeAction\("block-shutdown", \{ shutdownToken, message \}\)/u);
  assert.match(shutdown, /does not shut down or restart Windows/u);
});
