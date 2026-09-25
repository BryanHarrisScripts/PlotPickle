import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2438 locks green Dashboard surfaces, keeps review surfaces yellow, and keeps unavailable destinations gray", async () => {
  const [menu, dashboard, host, styles, audit] = await Promise.all([
    read("app/skin-v1/dashboard-menu-registry.ts"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("app/issue-2061.css"),
    read("lib/verification/skin-v1-menu-contract-audit.mjs"),
  ]);

  const connected = menu.slice(
    menu.indexOf("export const CONNECTED_DASHBOARD_ITEM_IDS"),
    menu.indexOf("export const DASHBOARD_REVIEW_ITEM_IDS"),
  );
  for (const id of ["learn", "community", "library"]) assert.match(connected, new RegExp(`"${id}"`, "u"));
  assert.doesNotMatch(connected, /"pitch-package"|"pitch-deck"/u);

  const review = menu.slice(
    menu.indexOf("export const DASHBOARD_REVIEW_ITEM_IDS"),
    menu.indexOf("export const DASHBOARD_UNAVAILABLE_ITEM_IDS"),
  );
  assert.deepEqual(
    [...review.matchAll(/"([^"]+)"/gu)].map((match) => match[1]),
    ["screening", "sound-narration", "sound-music", "sound-foley", "previs", "timeline", "production"],
  );

  const disabled = menu.slice(
    menu.indexOf("export const DASHBOARD_UNAVAILABLE_ITEM_IDS"),
    menu.indexOf("export const DASHBOARD_STARTUP_CHOICES"),
  );
  assert.deepEqual(
    [...disabled.matchAll(/"([^"]+)"/gu)].map((match) => match[1]),
    ["pitch-package", "pitch-deck"],
  );

  assert.match(dashboard, /const locked = connected && !inReview && !unavailable/u);
  assert.match(dashboard, /data-dashboard-surface-state=\{unavailable \? "unavailable" : inReview \? "in-review" : locked \? "locked" : "unavailable"\}/u);
  assert.match(dashboard, /data-dashboard-locked=\{locked \? "true" : "false"\}/u);
  assert.match(dashboard, /aria-description=\{unavailable \? "Surface unavailable; row remains selectable\." : undefined\}/u);
  assert.doesNotMatch(dashboard, /if \(!item \|\| DASHBOARD_UNAVAILABLE_ITEM_IDS\.has\(item\.id\)\) return/u);
  assert.match(host, /if \(DASHBOARD_UNAVAILABLE_ITEM_IDS\.has\(item\.id\)\) \{[\s\S]*onActivate\(index\);[\s\S]*onSurfaceNameChange\("DASHBOARD"\);[\s\S]*return;/u);
  assert.doesNotMatch(host, /window\.location\.assign\("\/pitch-review\?scope=pitch&return=dashboard"\)/u);

  assert.match(styles, /\[data-dashboard-review="in-review"\] \.pp-skin-v1-dashboard-status-box[\s\S]*--pp-skin-warning/u);
  assert.doesNotMatch(styles, /data-dashboard-menu-item="library"[\s\S]*--pp-skin-warning/u);

  assert.match(audit, /expectedSurfaceState = isDashboardReviewItem \? "in-review" : row\.connected \? "locked" : "unavailable"/u);
  assert.match(audit, /expectedLocked = row\.connected && !isDashboardReviewItem/u);
});

test("#2438/#2452 keeps the Develop Story row as one-word WorldMap without changing its shortcut or position", async () => {
  const menu = await read("app/skin-v1/dashboard-menu-registry.ts");

  assert.match(menu, /\{ id: "discovery", shortcut: "G", label: "MindMap"/u);
  assert.match(menu, /\{ id: "story-bible", shortcut: "V", label: "WorldMap", description: "Map the Story World", group: "DEVELOP" \}/u);
  assert.doesNotMatch(menu, /label: "Story", description: "Story, Logline, Theme and Visual Reference"/u);
  assert.ok(menu.indexOf('id: "discovery"') < menu.indexOf('id: "story-bible"'));
  assert.ok(menu.indexOf('id: "story-bible"') < menu.indexOf('id: "write"'));
});