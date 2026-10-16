import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const registrySource = await read("app/skin-v1/dashboard-menu-registry.ts");
const registry = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(registrySource)).toString("base64")}`);
const explorationIds = ["screening", "reports", "write", "edit", "refine", "sound-foley", "sound-narration", "sound-music", "pitch-deck", "pitch-package", "feedback", "wyrmwood", "story"];

test("#2950 all thirteen requested destinations are available for orange exploration", () => {
  assert.deepEqual([...registry.DASHBOARD_EXPLORATION_ITEM_IDS], explorationIds);
  for (const id of explorationIds) {
    assert.ok(registry.CONNECTED_DASHBOARD_ITEM_IDS.has(id), `${id} must use an existing connected owner`);
    assert.ok(registry.DASHBOARD_REVIEW_ITEM_IDS.has(id), `${id} must remain in review`);
    assert.equal(registry.DASHBOARD_UNAVAILABLE_ITEM_IDS.has(id), false, `${id} must be enterable`);
    assert.equal(registry.matrixPrimaryNavigationMode(id), "in-shell");
    assert.ok(registry.DASHBOARD_STARTUP_CHOICES.some(item => item.id === id) || id.startsWith("sound-"), `${id} must be accessible from Dashboard or nested Sounds`);
  }
});

test("#2950 available exploration does not grant locked or terminal authority", () => {
  for (const id of ["previs", "timeline", "production"]) {
    assert.ok(registry.DASHBOARD_REVIEW_ITEM_IDS.has(id));
    assert.equal(registry.DASHBOARD_EXPLORATION_ITEM_IDS.has(id), false);
  }
  for (const id of ["library", "learn", "profile", "settings"]) assert.equal(registry.DASHBOARD_REVIEW_ITEM_IDS.has(id), false);
  assert.equal(registry.matrixPrimaryNavigationMode("unknown-future-destination"), "unavailable");
  assert.equal(registry.matrixPrimaryNavigationMode("logout"), "terminal");
  assert.equal(registry.matrixPrimaryNavigationMode("shutdown"), "terminal");
  assert.equal(new Set(registry.DASHBOARD_MENU.map(item => item.shortcut)).size, registry.DASHBOARD_MENU.length);
});

test("#2950 orange presentation uses the existing semantic orange token without changing yellow review", async () => {
  const [panel, css] = await Promise.all([read("app/skin-v1/dashboard-bbs-panel.tsx"), read("app/issue-2061.css")]);
  assert.match(panel, /data-dashboard-exploration=\{exploration \? "true" : undefined\}/u);
  assert.match(css, /\[data-dashboard-exploration="true"\] \.pp-skin-v1-dashboard-status-box[\s\S]*border-color: var\(--pp-orange\)[\s\S]*background: var\(--pp-orange\)/u);
  assert.match(css, /\[data-dashboard-review="in-review"\] \.pp-skin-v1-dashboard-status-box[\s\S]*var\(--pp-skin-warning\)/u);
});

test("#2950 Matrix entry reuses canonical workspaces without document navigation or fake acceptance", async () => {
  const [host, exploration] = await Promise.all([read("app/skin-v1/dashboard-bbs-review-host.tsx"), read("app/_components/dashboard/dashboard-exploration-surface.tsx")]);
  assert.match(host, /setExplorationOpen\(item\.id\)/u);
  assert.match(host, /<DashboardExplorationSurface/u);
  assert.doesNotMatch(host, /window\.location\.assign|canonicalRoutes/u);
  for (const component of ["ReportsPage", "EditWorkspace", "DiagnosticCraftPage", "FeedbackPage", "PitchReviewPage", "WyrmwoodWorkspace", "StoryZeroWorkspace"]) assert.ok(exploration.includes(component), `Canonical owner missing: ${component}`);
  assert.match(host, /<BlockNativeWriteWorkspace onBackDashboard=/u);
  assert.doesNotMatch(exploration, /BlockNativeWriteWorkspace/u);
  assert.doesNotMatch(exploration, /localStorage\.setItem|createBlankProject|approve|accept.*Artifact|set.*Provider/u);
  assert.match(host, /setExplorationOpen\(null\)/u);
});
