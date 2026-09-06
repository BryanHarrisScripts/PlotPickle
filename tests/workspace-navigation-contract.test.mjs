import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  EXPECTED_NAVIGATION_AREAS,
  EXPECTED_NAVIGATION_GAPS,
  EXPECTED_NAVIGATION_IDS,
  EXPECTED_NAVIGATION_LABELS,
  navigationViolations,
} from "../scripts/workspace-navigation-uat.mjs";

const shellSource = await readFile(new URL("../app/plotpickle-workspace-shell.tsx", import.meta.url), "utf8");
const shortcutSource = await readFile(new URL("../app/navigation/global-shortcuts.ts", import.meta.url), "utf8");
const shellCss = await readFile(new URL("../app/plotpickle-workspace-shell.module.css", import.meta.url), "utf8");

const canonicalAreas = [
  { id: "home", label: "Home", members: ["dashboard", "library"] },
  { id: "create", label: "Create", members: ["learn", "plan", "build"] },
  { id: "produce", label: "Produce", members: ["storyboard", "graphic-novel", "write", "edit"] },
  { id: "review", label: "Review", members: ["feedback", "refine", "reports"] },
  { id: "connect", label: "Connect / Play", members: ["community", "wyrmwood"] },
  { id: "settings", label: "Settings", members: ["settings"] },
];
const canonicalIds = canonicalAreas.flatMap((area) => area.members);
const canonicalLabels = [
  "Dashboard", "Library", "Learn", "Plan", "Build", "Storyboard", "Previs", "Write", "Edit",
  "Feedback", "Refine", "Reports", "Community", "Wyrmwood", "Settings",
];

function sourceNavigationItems(source) {
  return [...source.matchAll(/\{ id: "([^"]+)", key: "[A-Z]", label: "([^"]+)", detail: "([^"]+)", relic: "[^"]+",(?: area: "([^"]+)",)? action:/g)]
    .map((match) => ({ id: match[1], label: match[2], detail: match[3], area: match[4] || null }))
    .filter((item) => !["node", "profile"].includes(item.id));
}

test("#1719 groups every canonical destination into at most six forgiving areas without a second route registry", () => {
  assert.deepEqual(EXPECTED_NAVIGATION_AREAS, canonicalAreas);
  assert.deepEqual(EXPECTED_NAVIGATION_IDS, canonicalIds);
  assert.deepEqual(EXPECTED_NAVIGATION_LABELS, canonicalLabels);
  assert.deepEqual(EXPECTED_NAVIGATION_GAPS, []);

  const sourceItems = sourceNavigationItems(shortcutSource);
  assert.deepEqual(sourceItems.map((item) => item.id), canonicalIds);
  assert.deepEqual(sourceItems.map((item) => item.label), canonicalLabels);
  assert.equal(canonicalAreas.length, 6);
  for (const area of canonicalAreas) {
    assert.deepEqual(sourceItems.filter((item) => item.area === area.id).map((item) => item.id), area.members);
  }
  assert.doesNotMatch(shortcutSource, /id: "story"/);
  assert.match(shortcutSource, /navigationAreaForDestination[\s\S]*activeShortcutId === "story"/);
});

test("#1341 keeps Library and Dashboard titles while preserving their approved subtitles", () => {
  const sourceItems = sourceNavigationItems(shortcutSource);
  assert.deepEqual(sourceItems.find((item) => item.id === "library"), { id: "library", label: "Library", detail: "Stories", area: "home" });
  assert.deepEqual(sourceItems.find((item) => item.id === "dashboard"), { id: "dashboard", label: "Dashboard", detail: "KPI", area: "home" });
});

test("#1719 shell exposes area, destination, context and primary-next UAT hooks while preserving canonical destinations", () => {
  assert.match(shellSource, /data-plotpickle-global-nav="v4"/);
  assert.match(shellSource, /data-workspace-areas="true"/);
  assert.match(shellSource, /data-navigation-area-id=\{navigationArea\.id\}/);
  assert.match(shellSource, /data-workspace-navigation="true"/);
  assert.match(shellSource, /data-workspace-nav-id=\{item\.id\}/);
  assert.match(shellSource, /data-navigation-area=\{navigationArea\.id\}/);
  assert.match(shellSource, /data-current-navigation-area=\{activeArea\}/);
  assert.match(shellSource, /data-current-destination=/);
  assert.match(shellSource, /data-shell-project-context="true"/);
  assert.match(shellSource, /data-shell-primary-next=/);
  assert.doesNotMatch(shellSource, /data-navigation-gap-after|navigationBreakAfter|groupBreakCommunityGame|groupBreakPrevis|groupBreakReports/);
});

test("#1719 navigation CSS uses PlotPickle tokens while rendered UAT enforces at least 44px targets", () => {
  assert.match(shellCss, /\.areaList button\s*\{[^}]*min-height:\s*44px;[^}]*padding:\s*var\(--pp-space-/s);
  assert.match(shellCss, /\.destinationList button\s*\{[^}]*width:\s*64px;[^}]*min-height:\s*64px;[^}]*border-radius:\s*var\(--pp-radius-control\)/s);
  assert.match(shellCss, /\.utilityArea\s*\{[^}]*margin-left:\s*auto;/s);
  assert.match(shellCss, /\.projectStrip\s*\{[^}]*gap:\s*var\(--pp-space-/s);
  assert.match(shellCss, /\.primaryNextAction\s*\{[^}]*min-height:\s*44px;[^}]*font-size:\s*var\(--pp-text-xs\)/s);
  assert.match(shellCss, /font-family:\s*var\(--pp-font-code\)/);
  assert.doesNotMatch(shellCss, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  assert.match(shellCss, /@media \(prefers-reduced-motion: reduce\)/);
});

test("#1719 rendered navigation UAT rejects hidden reachability, seventh-area, membership, orientation and target-size regressions", () => {
  const areaById = new Map(canonicalAreas.map((area) => [area.id, area]));
  const labelById = new Map(canonicalIds.map((id, index) => [id, canonicalLabels[index]]));
  const healthy = {
    areas: canonicalAreas.map((area) => ({ id: area.id, label: area.label, height: 44, current: area.id === "home" })),
    items: canonicalIds.map((id) => {
      const area = canonicalAreas.find((candidate) => candidate.members.includes(id)).id;
      return { id, label: labelById.get(id), area, width: 64, height: 64, visible: area === "home", current: id === "dashboard" };
    }),
    visiblePanels: ["home"],
    currentArea: "home",
    currentDestination: "dashboard",
    canonicalCount: canonicalIds.length,
    projectContext: true,
    primaryNext: true,
  };
  assert.deepEqual(navigationViolations(healthy), []);
  assert.equal(areaById.size, 6);

  const missing = structuredClone(healthy);
  missing.items = missing.items.filter((item) => item.id !== "reports");
  assert.ok(navigationViolations(missing).some((value) => value.startsWith("navigation reachability")));

  const seventh = structuredClone(healthy);
  seventh.areas.push({ id: "more", label: "More", height: 44, current: false });
  assert.ok(navigationViolations(seventh).some((value) => value.startsWith("navigation areas")));

  const misplaced = structuredClone(healthy);
  misplaced.items.find((item) => item.id === "wyrmwood").area = "produce";
  assert.ok(navigationViolations(misplaced).some((value) => value.startsWith("navigation membership")));

  const wrongPanel = structuredClone(healthy);
  wrongPanel.visiblePanels = ["create"];
  assert.ok(navigationViolations(wrongPanel).some((value) => value.startsWith("active area panel")));

  const smallTarget = structuredClone(healthy);
  smallTarget.areas[0].height = 40;
  assert.ok(navigationViolations(smallTarget).some((value) => value.startsWith("navigation area target")));
});
