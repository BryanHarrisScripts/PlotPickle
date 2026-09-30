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
  assert.deepEqual(byGroup("SOUND"), [
    ["Foley", "F"], ["Narration", "N"], ["Music", "A"],
  ]);
  assert.deepEqual(byGroup("PITCH"), [
    ["Deck", "K"], ["Package", "G"], ["Feedback", "B"],
  ]);
  assert.deepEqual(byGroup("PLAY"), [
    ["Identity", "I"], ["Wyrmwood", "Y"], ["The Unwritten", "U"],
  ]);

  const creative = rows.filter((row) => ["DEVELOP", "VISUALIZE", "SOUND", "PITCH", "PLAY"].includes(row.group));
  assert.equal(creative.length, 19);
  assert.equal(new Set(creative.map((row) => row.shortcut)).size, 19);

  assert.deepEqual(byGroup("EXPLORE"), [
    ["Learn", "1"], ["Library", "2"], ["Community", "3"], ["Screening", "4"], ["Reports", "5"],
  ]);
  assert.deepEqual(byGroup("SYSTEM"), [
    ["Settings", "6"], ["Service", "7"], ["Legal", "8"], ["Log Off", "9"], ["Shut Down", "0"],
  ]);
});

test("#2587 displayed shortcuts and keypress activation share one canonical registry value", async () => {
  const panel = await read("app/skin-v1/dashboard-bbs-panel.tsx");

  assert.match(panel, /const command = `\[\${item\.shortcut}\] \${item\.label}`/u);
  assert.match(panel, /data-dashboard-shortcut=\{item\.shortcut\}/u);
  assert.match(panel, /data-skin-menu-shortcut=\{item\.shortcut\}/u);
  assert.match(panel, /const shortcut = event\.key\.toUpperCase\(\)/u);
  assert.match(panel, /items\.findIndex\(\(item\) => item\.shortcut\.toUpperCase\(\) === shortcut\)/u);
  assert.match(panel, /activateItem\(shortcutIndex\)/u);
});

test("#2587 routes available creative destinations to their canonical authorities", async () => {
  const [menu, host] = await Promise.all([
    read("app/skin-v1/dashboard-menu-registry.ts"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
  ]);

  for (const id of ["write", "edit", "refine", "feedback", "pitch-deck", "pitch-package", "wyrmwood", "story"]) {
    const connected = menu.slice(menu.indexOf("export const CONNECTED_DASHBOARD_ITEM_IDS"), menu.indexOf("export const DASHBOARD_REVIEW_ITEM_IDS"));
    assert.match(connected, new RegExp(`"${id}"`, "u"), `${id} should be connected`);
  }

  const routes = new Map([
    ["write", "/write"],
    ["edit", "/edit"],
    ["refine", "/diagnostics"],
    ["feedback", "/feedback"],
    ["pitch-deck", "/pitch-review?scope=pitch&view=exports&return=dashboard"],
    ["pitch-package", "/pitch-review?scope=pitch&view=package&return=dashboard"],
    ["wyrmwood", "/?workspace=wyrmwood"],
    ["story", "/story"],
  ]);
  for (const [id, route] of routes) {
    assert.ok(host.includes(`${JSON.stringify(id)}: ${JSON.stringify(route)}`) || host.includes(`${id}: ${JSON.stringify(route)}`), `Missing canonical route for ${id}`);
  }
  assert.match(host, /window\.location\.assign\(canonicalRoute\)/u);
});

test("#2587 gives Deck and Package real canonical pitch subviews", async () => {
  const [menu, page, workspace] = await Promise.all([
    read("app/skin-v1/dashboard-menu-registry.ts"),
    read("app/pitch-review/page.tsx"),
    read("app/pitch-review-workspace.tsx"),
  ]);
  const connected = menu.slice(menu.indexOf("export const CONNECTED_DASHBOARD_ITEM_IDS"), menu.indexOf("export const DASHBOARD_REVIEW_ITEM_IDS"));
  const unavailable = menu.slice(menu.indexOf("export const DASHBOARD_UNAVAILABLE_ITEM_IDS"), menu.indexOf("export const DASHBOARD_STARTUP_CHOICES"));

  assert.match(connected, /"pitch-deck"/u);
  assert.match(connected, /"pitch-package"/u);
  assert.doesNotMatch(unavailable, /"pitch-deck"|"pitch-package"/u);
  assert.match(page, /requestedView === "logline" \|\| requestedView === "package" \|\| requestedView === "exports"/u);
  assert.match(page, /initialView=\{entryView\}/u);
  assert.match(workspace, /initialView\?: PitchReviewView/u);
  assert.match(workspace, /setView\(initialView\)/u);
});
