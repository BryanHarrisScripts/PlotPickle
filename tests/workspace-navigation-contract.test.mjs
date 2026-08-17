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
  "dashboard",
  "community",
  "wyrmwood",
  "learn",
  "plan",
  "build",
  "storyboard",
  "graphic-novel",
  "write",
  "edit",
  "feedback",
  "refine",
  "reports",
  "settings",
];

const canonicalLabels = [
  "Dashboard",
  "Community",
  "Wyrmwood",
  "Learn",
  "Plan",
  "Build",
  "Storyboard",
  "Previs",
  "Write",
  "Edit",
  "Feedback",
  "Refine",
  "Reports",
  "Settings",
];

const canonicalGaps = [
  { after: "wyrmwood", kind: "community-game" },
  { after: "graphic-novel", kind: "previs" },
  { after: "refine", kind: "reports" },
];

function sourceNavigationItems(source) {
  return [...source.matchAll(/\{ id: "([^"]+)", relic: "[^"]+", label: "([^"]+)", detail: "[^"]+", selectable: (?:true|false) \}/g)]
    .map((match) => ({ id: match[1], label: match[2] }));
}

test("canonical navigation contract preserves the approved order and labels", () => {
  assert.deepEqual(EXPECTED_NAVIGATION_IDS, canonicalIds);
  assert.deepEqual(EXPECTED_NAVIGATION_LABELS, canonicalLabels);
  assert.deepEqual(EXPECTED_NAVIGATION_GAPS, canonicalGaps);

  const sourceItems = sourceNavigationItems(shellSource);
  assert.deepEqual(sourceItems.map((item) => item.id), canonicalIds);
  assert.deepEqual(sourceItems.map((item) => item.label), canonicalLabels);
});

test("workspace shell exposes stable UAT hooks for all navigation groups", () => {
  assert.match(shellSource, /data-plotpickle-global-nav="v2"/);
  assert.match(shellSource, /data-workspace-navigation="true"/);
  assert.match(shellSource, /data-workspace-nav-id=\{item\.id\}/);
  assert.match(shellSource, /data-navigation-gap-after=\{breakAfter \|\| undefined\}/);

  assert.match(shellSource, /id === "wyrmwood"\) return "community-game"/);
  assert.match(shellSource, /id === "graphic-novel"\) return "previs"/);
  assert.match(shellSource, /id === "refine"\) return "reports"/);
});

test("navigation CSS keeps two workflow gaps and a larger Reports separation", () => {
  assert.match(shellCss, /\.list li\.groupBreakCommunityGame\s*\{\s*margin-right: clamp\(28px, 4vw, 72px\);/);
  assert.match(shellCss, /\.list li\.groupBreakPrevis\s*\{\s*margin-right: clamp\(22px, 3vw, 56px\);/);
  assert.match(shellCss, /\.list li\.groupBreakReports\s*\{\s*margin-right: clamp\(72px, 10vw, 180px\);/);
});

test("rendered navigation UAT rejects order, label, gap, and spacing regressions", () => {
  const healthy = {
    items: canonicalIds.map((id, index) => ({ id, label: canonicalLabels[index] })),
    gaps: canonicalGaps.map((gap, index) => ({ ...gap, marginRight: [40, 32, 100][index] })),
  };
  assert.deepEqual(navigationViolations(healthy), []);

  const reordered = structuredClone(healthy);
  [reordered.items[1], reordered.items[2]] = [reordered.items[2], reordered.items[1]];
  assert.ok(navigationViolations(reordered).some((value) => value.startsWith("navigation order")));

  const noGap = structuredClone(healthy);
  noGap.gaps[2].marginRight = 0;
  assert.ok(navigationViolations(noGap).some((value) => value.includes("has no visible spacing")));
});
