import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2444/#2454 keeps Refine in Develop, moves Reports to Explore, and leaves Feedback in Pitch", async () => {
  const menu = await read("app/skin-v1/dashboard-menu-registry.ts");
  const rows = [...menu.matchAll(/\{ id: "([^"]+)", shortcut: "([^"]+)", label: "([^"]+)", description: "([^"]+)", group: "([^"]+)" \}/gu)]
    .map((match) => ({ id: match[1], shortcut: match[2], label: match[3], description: match[4], group: match[5] }));

  assert.deepEqual(rows.filter((row) => row.group === "DEVELOP").map((row) => row.id), ["discovery", "story-bible", "write", "edit", "refine"]);
  assert.deepEqual(rows.filter((row) => row.group === "EXPLORE").map((row) => row.id), ["learn", "library", "community", "screening", "reports"]);
  assert.deepEqual(rows.filter((row) => row.group === "ASSETS").map((row) => row.id), ["assets", "discover"]);
  assert.deepEqual(rows.filter((row) => row.group === "PITCH").map((row) => row.id), ["pitch-deck", "pitch-package", "feedback"]);
  assert.equal(rows.some((row) => row.group === "REVIEW"), false);
  assert.deepEqual([...new Set(rows.map((row) => row.group))], ["EXPLORE", "DEVELOP", "VISUALIZE", "ASSETS", "PITCH", "PLAY", "SYSTEM"]);
});

test("#2444 preserves moved-item identity, shortcuts and current in-shell review", async () => {
  const menu = await read("app/skin-v1/dashboard-menu-registry.ts");
  for (const [id, shortcut, group] of [["refine", "R", "DEVELOP"], ["feedback", "B", "PITCH"], ["reports", "5", "EXPLORE"]]) {
    assert.match(menu, new RegExp(`\\{ id: "${id}", shortcut: "${shortcut}", label: "[^"]+", description: "[^"]+", group: "${group}" \\}`, "u"));
  }
  const connected = menu.slice(menu.indexOf("export const CONNECTED_DASHBOARD_ITEM_IDS"), menu.indexOf("export const DASHBOARD_EXPLORATION_ITEM_IDS"));
  const exploration = menu.slice(menu.indexOf("export const DASHBOARD_EXPLORATION_ITEM_IDS"), menu.indexOf("export const DASHBOARD_REVIEW_ITEM_IDS"));
  const unavailable = menu.slice(menu.indexOf("export const DASHBOARD_UNAVAILABLE_ITEM_IDS"), menu.indexOf("export const DASHBOARD_STARTUP_CHOICES"));
  for (const id of ["refine", "feedback", "reports"]) {
    assert.ok(connected.includes(`"${id}"`), `${id} must remain connected`);
    assert.ok(exploration.includes(`"${id}"`), `${id} must remain in-shell`);
  }
  assert.match(unavailable, /new Set<string>\(\)/u);
  const review = menu.slice(menu.indexOf("export const DASHBOARD_REVIEW_ITEM_IDS"), menu.indexOf("export const DASHBOARD_UNAVAILABLE_ITEM_IDS"));
  assert.match(review, /\.\.\.DASHBOARD_EXPLORATION_ITEM_IDS/u);
  assert.match(review, /"previs"/u);
});
