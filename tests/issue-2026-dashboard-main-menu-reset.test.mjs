import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("#2026/#2032/#2050/#2068/#2085 locks the Human-approved Dashboard order, labels, descriptions and groups", async () => {
  const menu = await read("app/skin-v1/dashboard-menu-registry.ts");

  const ordered = [
    ['community', 'C', 'Community', 'Share and Collaborate', 'DEVELOPMENT'],
    ['learn', '1', "Writer's Craft", 'Learn Story Craft', 'DEVELOPMENT'],
    ['library', 'L', 'Library', 'Load Your Stories', 'DEVELOPMENT'],
    ['plan', 'O', 'Outline', 'Visualize Story Structure', 'PRE-PRODUCTION'],
    ['storyboard', 'S', 'Storyboard', 'Visualize Scenes Before You Write', 'PRE-PRODUCTION'],
    ['previs', 'P', 'Previs', 'Preview Shots, Timing and Camera Motion', 'PRE-PRODUCTION'],
    ['write', 'W', 'Write', 'Write Scenes, Dialogue and Action Blocks', 'PRODUCTION'],
    ['edit', 'E', 'Edit', 'Review and Improve Screenplay Flow', 'PRODUCTION'],
    ['feedback', 'F', 'Feedback', 'Gather Reader Notes and Reactions', 'PRODUCTION'],
    ['refine', 'R', 'Refine', 'Polish Dialogue and Story Choices', 'PRODUCTION'],
    ['reports', 'A', 'Analytics', 'Review Story Health and Coverage Reports', 'PRODUCTION'],
    ['wyrmwood', '2', 'Wyrmwood Game', 'Practice Narrative Craft', 'WORKSHOPS'],
    ['story', '3', 'The Unwritten', 'Story Game Engine', 'WORKSHOPS'],
    ['profile', 'I', 'Identity', 'Manage User Profile', 'CALL SHEET'],
    ['settings', 'M', 'Manage', 'Configure PlotPickle', 'CALL SHEET'],
    ['help', 'B', 'Bug Report', 'Prepare a PlotPickle Issue', 'CALL SHEET'],
    ['open-source', 'N', 'Notices', 'Open Source Licensing and Attribution', 'CALL SHEET'],
    ['logout', 'X', 'Log Off', 'End This Session', 'WRAP'],
    ['shutdown', 'Q', 'Shut Down Node', 'Safely Close PlotPickle and Local Services', 'WRAP'],
  ];

  let cursor = -1;
  for (const [id, shortcut, label, description, group] of ordered) {
    const token = `{ id: "${id}", shortcut: "${shortcut}", label: "${label}", description: "${description}"${group ? `, group: "${group}"` : ""} }`;
    const index = menu.indexOf(token);
    assert.ok(index > cursor, `${label} must appear in the canonical Dashboard order`);
    cursor = index;
  }

  const shortcuts = ordered.map(([, shortcut]) => shortcut);
  assert.equal(new Set(shortcuts).size, shortcuts.length, "Dashboard keyboard shortcuts must be unique");

  const groupCounts = new Map();
  for (const [, , , , group] of ordered) {
    if (!group) continue;
    groupCounts.set(group, (groupCounts.get(group) || 0) + 1);
  }
  assert.deepEqual([...groupCounts.keys()], ["DEVELOPMENT", "PRE-PRODUCTION", "PRODUCTION", "WORKSHOPS", "CALL SHEET", "WRAP"]);
  for (const [group, count] of groupCounts) {
    assert.ok(count <= 5, `${group} must stay at five Dashboard rows or fewer`);
  }

  assert.doesNotMatch(menu, /group: "(?:STRUCTURING|DRAFTING|INTERACTIVE LEARNING|MANAGEMENT|SESSION)"/u);
  for (const [, , , description] of ordered) {
    assert.doesNotMatch(description, /&/u, "Human-facing Dashboard menu copy must use 'and' rather than ampersands");
  }
  assert.match(menu, /\.filter\(\(item\) => !\["logout", "shutdown"\]\.includes\(item\.id\)/u);
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
