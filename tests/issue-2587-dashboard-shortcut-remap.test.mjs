import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2587 locks the Human-approved creative shortcut map and preserves numeric assignments", async () => {
  const menu = await read("app/skin-v1/dashboard-menu-registry.ts");
  const rows = [...menu.matchAll(/\{ id: "([^"]+)", shortcut: "([^"]+)", label: "([^"]+)", description: "([^"]+)", group: "([^"]+)" \}/gu)]
    .map((match) => ({ id: match[1], shortcut: match[2], label: match[3], group: match[5] }));

  const byGroup = (group) => rows.filter((row) => row.group === group).map(({ label, shortcut }) => [label, shortcut]);

  assert.deepEqual(byGroup("DEVELOP"), [
    ["MindMap", "M"], ["WorldMap", "W"], ["Write", "D"], ["Edit", "E"], ["Refine", "R"],
  ]);
  assert.deepEqual(byGroup("VISUALIZE"), [
    ["Outline", "O"], ["Storyboard", "S"], ["Previs", "P"], ["Timeline", "T"], ["Rough Cut", "C"],
  ]);
  assert.deepEqual(byGroup("ASSETS"), [["Assets", "A"]]);
  assert.deepEqual(byGroup("PITCH"), [
    ["Deck", "K"], ["Package", "G"], ["Feedback", "B"],
  ]);
  assert.deepEqual(byGroup("PLAY"), [
    ["Identity", "I"], ["Wyrmwood", "Y"], ["The Unwritten", "U"],
  ]);

  const creative = rows.filter((row) => ["DEVELOP", "VISUALIZE", "ASSETS", "PITCH", "PLAY"].includes(row.group));
  assert.equal(creative.length, 17);
  assert.equal(new Set(creative.map((row) => row.shortcut)).size, 17);

  assert.deepEqual(byGroup("EXPLORE"), [
    ["Learn", "1"], ["Library", "2"], ["Community", "3"], ["Screening", "4"], ["Reports", "5"], ["Discover", "J"],
  ]);
  assert.deepEqual(byGroup("SYSTEM"), [
    ["Settings", "6"], ["Service", "7"], ["Legal", "8"], ["Log Off", "9"], ["Shut Down", "0"],
  ]);
});

test("#2587 displayed shortcuts and keypress activation share one canonical registry value", async () => {
  const panel = await read("app/skin-v1/dashboard-bbs-panel.tsx");

  assert.ok(panel.includes('const command = `[${item.shortcut}] ${item.label}`'));
  assert.match(panel, /data-dashboard-shortcut=\{item\.shortcut\}/u);
  assert.match(panel, /data-skin-menu-shortcut=\{item\.shortcut\}/u);
  assert.match(panel, /const shortcut = event\.key\.toUpperCase\(\)/u);
  assert.match(panel, /items\.findIndex\(\(item\) => item\.shortcut\.toUpperCase\(\) === shortcut\)/u);
  assert.match(panel, /activateItem\(shortcutIndex\)/u);
});

test("#2587/#2612 preserves connected destinations and in-shell authority", async () => {
  const [menu, host, explore] = await Promise.all([
    read("app/skin-v1/dashboard-menu-registry.ts"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("app/_components/dashboard/dashboard-exploration-surface.tsx"),
  ]);
  const connected = menu.slice(menu.indexOf("export const CONNECTED_DASHBOARD_ITEM_IDS"), menu.indexOf("export const DASHBOARD_EXPLORATION_ITEM_IDS"));
  const exploration = menu.slice(menu.indexOf("export const DASHBOARD_EXPLORATION_ITEM_IDS"), menu.indexOf("export const DASHBOARD_REVIEW_ITEM_IDS"));
  const unavailable = menu.slice(menu.indexOf("export const DASHBOARD_UNAVAILABLE_ITEM_IDS"), menu.indexOf("export const DASHBOARD_STARTUP_CHOICES"));
  for (const id of ["write", "edit", "refine", "feedback", "pitch-deck", "pitch-package", "wyrmwood", "story"]) assert.ok(connected.includes(`"${id}"`), `${id} must remain connected`);
  for (const id of ["edit", "refine", "feedback", "pitch-deck", "pitch-package", "wyrmwood", "story"]) {
    assert.ok(exploration.includes(`"${id}"`), `${id} must remain in-shell`);
    assert.ok(explore.includes(`case "${id}":`) || explore.includes(`workspace === "${id}"`), `${id} must resolve to its owned workspace`);
  }
  assert.match(unavailable, /new Set<string>\(\)/u);
  assert.match(host, /if \(DASHBOARD_UNAVAILABLE_ITEM_IDS\.has\(item\.id\)\)/u);
  assert.match(host, /if \(isDashboardExplorationWorkspace\(item\.id\)\)/u);
  assert.match(host, /setExplorationOpen\(item\.id\)/u);
  assert.ok(host.indexOf("DASHBOARD_UNAVAILABLE_ITEM_IDS.has(item.id)") < host.indexOf("if (isDashboardExplorationWorkspace(item.id))"));
  assert.match(host, /if \(item\.id === "write"\)[\s\S]*?setWriteOpen\(true\)/u);
});

test("#2587 gives Deck and Package real canonical pitch subviews without changing the pitch workspace", async () => {
  const [menu, page] = await Promise.all([
    read("app/skin-v1/dashboard-menu-registry.ts"),
    read("app/pitch-review/page.tsx"),
  ]);
  const connected = menu.slice(menu.indexOf("export const CONNECTED_DASHBOARD_ITEM_IDS"), menu.indexOf("export const DASHBOARD_REVIEW_ITEM_IDS"));
  const exploration = menu.slice(menu.indexOf("export const DASHBOARD_EXPLORATION_ITEM_IDS"), menu.indexOf("export const DASHBOARD_REVIEW_ITEM_IDS"));

  assert.match(connected, /"pitch-deck"/u);
  assert.match(connected, /"pitch-package"/u);
  assert.match(exploration, /"pitch-deck"/u);
  assert.match(exploration, /"pitch-package"/u);
  assert.match(page, /requestedView === "logline" \|\| requestedView === "package" \|\| requestedView === "exports"/u);
  assert.match(page, /entryView === "package" \? "Pitch Package" : "Exports"/u);
  assert.match(page, /nav\[aria-label="Pitch and review workflows"\] button/u);
  assert.match(page, /target\?\.click\(\)/u);
});
