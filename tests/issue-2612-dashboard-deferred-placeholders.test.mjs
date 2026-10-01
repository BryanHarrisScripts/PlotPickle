import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const GRAY_DASHBOARD_IDS = [
  "screening",
  "write",
  "edit",
  "refine",
  "sound-foley",
  "sound-narration",
  "sound-music",
  "pitch-deck",
  "pitch-package",
  "feedback",
  "wyrmwood",
  "story",
];

test("#2612 makes the agreed future destinations gray while keeping only active review work yellow", async () => {
  const menu = await read("app/skin-v1/dashboard-menu-registry.ts");
  const review = menu.slice(
    menu.indexOf("export const DASHBOARD_REVIEW_ITEM_IDS"),
    menu.indexOf("export const DASHBOARD_UNAVAILABLE_ITEM_IDS"),
  );
  const unavailable = menu.slice(
    menu.indexOf("export const DASHBOARD_UNAVAILABLE_ITEM_IDS"),
    menu.indexOf("export const DASHBOARD_STARTUP_CHOICES"),
  );

  assert.deepEqual(
    [...review.matchAll(/"([^"]+)"/gu)].map((match) => match[1]),
    ["previs", "timeline", "production"],
  );
  assert.deepEqual(
    [...unavailable.matchAll(/"([^"]+)"/gu)].map((match) => match[1]),
    GRAY_DASHBOARD_IDS,
  );
  assert.match(menu, /!DASHBOARD_UNAVAILABLE_ITEM_IDS\.has\(item\.id\)/u);
});

test("#2612 gray rows stay selectable but activation cannot leave Dashboard", async () => {
  const [panel, host] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
  ]);

  assert.match(panel, /aria-description=\{unavailable \? "Surface unavailable; row remains selectable\." : undefined\}/u);
  assert.match(panel, /onClick=\{\(\) => activateItem\(index\)\}/u);
  assert.doesNotMatch(panel, /disabled=\{unavailable\}/u);
  assert.match(panel, /!DASHBOARD_UNAVAILABLE_ITEM_IDS\.has\(selectedDashboardItem\.id\)/u);
  assert.match(panel, /data-dashboard-status=\{unavailable \? "inactive"/u);

  const guard = host.indexOf("DASHBOARD_UNAVAILABLE_ITEM_IDS.has(item.id)");
  assert.ok(guard >= 0);
  for (const downstream of [
    'item.id === "screening"',
    'item.id === "sound-narration"',
    'item.id === "story-bible"',
  ]) {
    assert.ok(guard < host.indexOf(downstream), `Gray guard must run before ${downstream}`);
  }
  assert.doesNotMatch(host, /const canonicalRoutes|window\.location\.assign/u);
  assert.match(
    host,
    /if \(DASHBOARD_UNAVAILABLE_ITEM_IDS\.has\(item\.id\)\) \{[\s\S]*onActivate\(index\);[\s\S]*onSurfaceNameChange\("DASHBOARD"\);[\s\S]*return;/u,
  );
});

test("#2612 defers Dashboard entry without deleting underlying future implementations", async () => {
  const [host, probe, write, edit, diagnostics, feedback, pitch, wyrmwood, story] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("lib/verification/browser-probes/continuity.mjs"),
    read("app/write/page.tsx"),
    read("app/edit/page.tsx"),
    read("app/diagnostics/page.tsx"),
    read("app/feedback/page.tsx"),
    read("app/pitch-review/page.tsx"),
    read("modules/wyrmwood/ui/wyrmwood-workspace.tsx"),
    read("app/story/page.tsx"),
  ]);

  for (const [label, source] of [
    ["write", write],
    ["edit", edit],
    ["refine", diagnostics],
    ["feedback", feedback],
    ["pitch", pitch],
    ["wyrmwood", wyrmwood],
    ["story", story],
  ]) assert.ok(source.trim().length > 0, `Underlying future implementation was removed: ${label}`);

  assert.doesNotMatch(host, /canonicalRoutes|window\.location\.assign/u);
  assert.match(host, /<SkinV1SoundReviewSurface/u);
  assert.match(host, /<SkinV1ScreeningReviewSurface/u);
  for (const deferred of ["sound-foley", "sound-narration", "sound-music", "screening"]) {
    assert.doesNotMatch(probe, new RegExp(`menuId: "${deferred}"`, "u"));
  }
  for (const active of ["plan", "storyboard", "previs", "timeline", "production"]) {
    assert.match(probe, new RegExp(`menuId: "${active}"`, "u"));
  }
});
