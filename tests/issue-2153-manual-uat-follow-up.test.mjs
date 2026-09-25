import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("#2153 removes Review from the Notices description only", async () => {
  const menu = await read("app/skin-v1/dashboard-menu-registry.ts");

  assert.match(menu, /id: "open-source", shortcut: "N", label: "Notices", description: "Open Source Licensing and Attribution"/u);
  assert.doesNotMatch(menu, /Review Open Source Licensing and Attribution/u);
});

test("#2153 reuses compact Matrix directory geometry for Story Mode", async () => {
  const [host, styles] = await Promise.all([
    read("app/skin-v1/story-mode-host.tsx"),
    read("app/skin-v1-settings-directory.css"),
  ]);

  assert.match(host, /aria-label="Story Mode directory"/u);
  assert.match(host, /data-skin-menu="story-mode"/u);
  assert.match(host, /pp-skin-v1-menu pp-skin-v1-dashboard-menu/u);
  assert.match(host, /pp-skin-v1-menu-item pp-skin-v1-dashboard-row pp-skin-v1-submenu-item/u);
  assert.match(styles, /aria-label="Story Mode directory"[^\n]*\.pp-skin-v1-menu\.pp-skin-v1-dashboard-menu/u);
  assert.match(styles, /aria-label="Story Mode directory"[^\n]*\.pp-skin-v1-menu-item\.pp-skin-v1-dashboard-row/u);
});

test("#2153 makes existing Story Mode readiness visually legible without a new authority", async () => {
  const [host, styles] = await Promise.all([
    read("app/skin-v1/story-mode-host.tsx"),
    read("app/skin-v1-settings-directory.css"),
  ]);

  assert.match(host, /if \(!loaded\) return "checking"/u);
  assert.match(host, /return ready \? "ready" : "not-ready"/u);
  assert.match(host, /data-story-mode-readiness=\{readinessState\(status\.ready, loaded\)\}/u);
  assert.match(host, /data-story-mode-status="derived"/u);
  assert.match(styles, /data-story-mode-readiness="ready"[^}]*--pp-skin-ready/su);
  assert.match(styles, /data-story-mode-readiness="not-ready"[^}]*--pp-skin-danger/su);
  assert.match(styles, /pp-skin-v1-story-mode-readiness i[^}]*--pp-skin-ink-muted/su);

  for (const endpoint of ["/api/story-mode/policy", "/api/ai-routing/status", "/api/local-ai/runtime"]) {
    assert.match(host, new RegExp(endpoint.replaceAll("/", "\\/"), "u"));
  }
  assert.doesNotMatch(host, /new readiness|readiness service|readiness API/iu);
});

test("#2153/#2438 marks the Human-approved Dashboard destinations yellow while green means locked", async () => {
  const [dashboard, styles, audit] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/issue-2061.css"),
    read("lib/verification/skin-v1-menu-contract-audit.mjs"),
  ]);

  assert.match(dashboard, /DASHBOARD_REVIEW_ITEM_IDS\.has\(item\.id\)/u);
  assert.match(dashboard, /data-dashboard-review=\{inReview \? "in-review" : undefined\}/u);
  assert.match(dashboard, /data-dashboard-locked=\{locked \? "true" : "false"\}/u);
  assert.match(dashboard, /inReview \? " is-review" : ""/u);
  assert.match(dashboard, /locked \? "locked"/u);
  assert.match(styles, /\[data-dashboard-review="in-review"\][^}]*--pp-skin-warning/su);
  assert.match(audit, /\["discovery", "story-bible", "plan", "storyboard", "previs", "timeline", "production"\]\.includes\(row\.id\)/u);
  assert.match(audit, /expectedSurfaceState = isDashboardReviewItem \? "in-review" : row\.connected \? "locked" : "unavailable"/u);
});

test("#2153 keeps Local and Cloud in the existing Dashboard rail and Hybrid and Mode on Story Mode", async () => {
  const [rail, host] = await Promise.all([
    read("app/skin-v1/dashboard-readiness-rail.tsx"),
    read("app/skin-v1/story-mode-host.tsx"),
  ]);

  assert.equal(rail.split('shortLabel: "LOCAL"').length - 1, 1);
  assert.equal(rail.split('shortLabel: "CLOUD"').length - 1, 1);
  assert.doesNotMatch(rail, /shortLabel: "HYBRID"|shortLabel: "MODE"/u);
  assert.match(host, /\{ label: "HYBRID", ready: hybridReady \}/u);
  assert.match(host, /data-story-mode-active-policy=\{mode\}/u);
});
