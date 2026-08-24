import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  EXPECTED_NAVIGATION_GAPS,
  EXPECTED_NAVIGATION_IDS,
  EXPECTED_NAVIGATION_LABELS,
  navigationViolations,
} from "../scripts/workspace-navigation-uat.mjs";

const shellSource = await readFile(new URL("../app/plotpickle-workspace-shell.tsx", import.meta.url), "utf8");
const shellCss = await readFile(new URL("../app/plotpickle-workspace-shell.module.css", import.meta.url), "utf8");

const canonicalIds = [
  "community",
  "library",
  "learn",
  "wyrmwood",
  "plan",
  "build",
  "storyboard",
  "graphic-novel",
  "write",
  "edit",
  "feedback",
  "refine",
  "reports",
  "dashboard",
  "settings",
];

const canonicalLabels = [
  "Community",
  "Library",
  "Learn",
  "Wyrmwood",
  "Plan",
  "Build",
  "Storyboard",
  "Previs",
  "Write",
  "Edit",
  "Feedback",
  "Refine",
  "Reports",
  "Dashboard",
  "Settings",
];

const canonicalGaps = [];

function sourceNavigationItems(source) {
  return [...source.matchAll(/\{ id: "([^"]+)", relic: "[^"]+", label: "([^"]+)", detail: "([^"]+)", selectable: (?:true|false) \}/g)]
    .map((match) => ({ id: match[1], label: match[2], detail: match[3] }));
}

test("canonical navigation contract preserves the revised order and labels", () => {
  assert.deepEqual(EXPECTED_NAVIGATION_IDS, canonicalIds);
  assert.deepEqual(EXPECTED_NAVIGATION_LABELS, canonicalLabels);
  assert.deepEqual(EXPECTED_NAVIGATION_GAPS, canonicalGaps);

  const sourceItems = sourceNavigationItems(shellSource);
  assert.deepEqual(sourceItems.map((item) => item.id), canonicalIds);
  assert.deepEqual(sourceItems.map((item) => item.label), canonicalLabels);
});

test("#1341 keeps Library and Dashboard titles while using their approved subtitles", () => {
  const sourceItems = sourceNavigationItems(shellSource);
  assert.deepEqual(sourceItems.find((item) => item.id === "library"), { id: "library", label: "Library", detail: "Stories" });
  assert.deepEqual(sourceItems.find((item) => item.id === "dashboard"), { id: "dashboard", label: "Dashboard", detail: "KPI" });
});

test("workspace shell exposes stable UAT hooks without legacy visual gap groups", () => {
  assert.match(shellSource, /data-plotpickle-global-nav="v2"/);
  assert.match(shellSource, /data-workspace-navigation="true"/);
  assert.match(shellSource, /data-workspace-nav-id=\{item\.id\}/);
  assert.doesNotMatch(shellSource, /data-navigation-gap-after|navigationBreakAfter|groupBreakCommunityGame|groupBreakPrevis|groupBreakReports/);
});

test("navigation CSS keeps the workflow strip centered and compact", () => {
  assert.match(shellCss, /\.list\s*\{[^}]*width:\s*max-content;/s);
  assert.match(shellCss, /\.list\s*\{[^}]*margin:\s*0 auto;/s);
  assert.match(shellCss, /\.list\s*\{[^}]*gap:\s*clamp\(2px, 0\.25vw, 4px\);/s);
  assert.match(shellCss, /\.list li\s*\{[^}]*width:\s*64px;[^}]*flex:\s*0 0 64px;/s);
  assert.doesNotMatch(shellCss, /groupBreakCommunityGame|groupBreakPrevis|groupBreakReports/);
});

test("rendered navigation UAT rejects order, label, gap, and compactness regressions", () => {
  const healthy = {
    items: canonicalIds.map((id, index) => ({ id, label: canonicalLabels[index], width: 64 })),
    gaps: [],
  };
  assert.deepEqual(navigationViolations(healthy), []);

  const reordered = structuredClone(healthy);
  [reordered.items[1], reordered.items[2]] = [reordered.items[2], reordered.items[1]];
  assert.ok(navigationViolations(reordered).some((value) => value.startsWith("navigation order")));

  const legacyGap = structuredClone(healthy);
  legacyGap.gaps.push({ after: "wyrmwood", kind: "community-game", marginRight: 40 });
  assert.ok(navigationViolations(legacyGap).some((value) => value.startsWith("navigation gaps")));

  const tooWide = structuredClone(healthy);
  tooWide.items[0].width = 96;
  assert.ok(navigationViolations(tooWide).some((value) => value.startsWith("navigation item width")));
});
