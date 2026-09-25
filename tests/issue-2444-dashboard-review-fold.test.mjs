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
  assert.deepEqual(rows.filter((row) => row.group === "PITCH").map((row) => row.id), ["pitch-package", "pitch-deck", "feedback"]);
  assert.equal(rows.some((row) => row.group === "REVIEW"), false);
  assert.deepEqual([...new Set(rows.map((row) => row.group))], ["EXPLORE", "DEVELOP", "VISUALIZE", "SOUND", "PITCH", "PLAY", "SYSTEM"]);
});

test("#2444 preserves moved-item identity, shortcut, copy and lifecycle sets", async () => {
  const menu = await read("app/skin-v1/dashboard-menu-registry.ts");
  assert.match(menu, /\{ id: "refine", shortcut: "R", label: "Refine", description: "Polish Dialogue and Story Choices", group: "DEVELOP" \}/u);
  assert.match(menu, /\{ id: "feedback", shortcut: "F", label: "Feedback", description: "Gather Reader Notes and Reactions", group: "PITCH" \}/u);
  assert.match(menu, /\{ id: "reports", shortcut: "A", label: "Reports", description: "Review Story Health and Coverage Reports", group: "EXPLORE" \}/u);

  const disabled = menu.slice(menu.indexOf("export const DASHBOARD_UNAVAILABLE_ITEM_IDS"), menu.indexOf("export const DASHBOARD_STARTUP_CHOICES"));
  assert.match(disabled, /"pitch-package"/u);
  assert.match(disabled, /"pitch-deck"/u);
  assert.doesNotMatch(disabled, /"feedback"|"reports"|"refine"/u);

  const reviewState = menu.slice(menu.indexOf("export const DASHBOARD_REVIEW_ITEM_IDS"), menu.indexOf("export const DASHBOARD_UNAVAILABLE_ITEM_IDS"));
  assert.doesNotMatch(reviewState, /"feedback"|"reports"|"refine"/u);
});
