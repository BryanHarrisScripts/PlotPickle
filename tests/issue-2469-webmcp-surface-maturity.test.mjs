import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { summarizeDashboardMaturity } from "../lib/verification/skin-v1-menu-contract-audit.mjs";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("#2469 projects Dashboard maturity as locked, in-review and unavailable", () => {
  const summary = summarizeDashboardMaturity([
    { id: "library", surfaceState: "locked", connected: true, locked: true },
    { id: "screening", surfaceState: "in-review", connected: true, locked: false },
    { id: "pitch-deck", surfaceState: "unavailable", connected: false, locked: false },
  ]);
  assert.deepEqual(summary.locked, ["library"]);
  assert.deepEqual(summary.inReview, ["screening"]);
  assert.deepEqual(summary.unavailable, ["pitch-deck"]);
});

test("#2469 registers current Screening and Sound destinations without promoting maturity", async () => {
  const [registryText, menu] = await Promise.all([
    read("config/skin-v1-surface-registry.json"),
    read("app/skin-v1/dashboard-menu-registry.ts"),
  ]);
  const registry = JSON.parse(registryText);
  for (const id of ["screening", "sound-foley", "sound-narration", "sound-music"]) {
    const surface = registry.surfaces.find((item) => item.id === id);
    assert.ok(surface, "Missing canonical surface governance for " + id);
    assert.equal(surface.capturePolicy, "census-only");
    assert.equal(surface.governance, "census");
  }
  const review = menu.slice(menu.indexOf("export const DASHBOARD_REVIEW_ITEM_IDS"), menu.indexOf("export const DASHBOARD_UNAVAILABLE_ITEM_IDS"));
  for (const id of ["screening", "sound-foley", "sound-narration", "sound-music"]) assert.match(review, new RegExp('"' + id + '"'));
});

test("#2469 keeps sound surfaces individually identifiable in rendered governance", async () => {
  const host = await read("app/skin-v1/dashboard-bbs-review-host.tsx");
  assert.match(host, /data-dashboard-review-surface=\{itemId\}/u);
  assert.match(host, /soundOpen === "narration" \? "sound-narration"/u);
  assert.match(host, /soundOpen === "music" \? "sound-music" : "sound-foley"/u);
});

test("#2469 WebMCP reports maturity separately from repository visual-baseline approval", async () => {
  const startup = await read("scripts/run-webmcp-startup-uat.mjs");
  assert.match(startup, /Dashboard maturity: .*LOCKED, .*IN REVIEW, .*UNAVAILABLE/u);
  assert.match(startup, /Currently locked surfaces:/u);
  assert.match(startup, /Currently locked visual baselines:/u);
  assert.match(startup, /dashboardMaturity: menuContract\.dashboardMaturity/u);
});

test("#2469 verifies complete Dashboard keyboard traversal and wrap", async () => {
  const audit = await read("lib/verification/skin-v1-menu-contract-audit.mjs");
  assert.match(audit, /verifyDashboardKeyboardTraversal/u);
  assert.match(audit, /page\.keyboard\.press\("ArrowDown"\)/u);
  assert.match(audit, /page\.keyboard\.press\("ArrowUp"\)/u);
  assert.match(audit, /page\.keyboard\.press\("Home"\)/u);
  assert.match(audit, /page\.keyboard\.press\("End"\)/u);
  assert.match(audit, /dashboard-wrap-first/u);
  assert.match(audit, /dashboard-wrap-last/u);
});
