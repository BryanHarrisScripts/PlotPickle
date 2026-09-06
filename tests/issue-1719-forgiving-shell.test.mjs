import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const preservedShortcuts = new Map([
  ["dashboard", "K"], ["library", "O"], ["learn", "L"], ["plan", "P"], ["build", "B"],
  ["storyboard", "S"], ["graphic-novel", "V"], ["write", "W"], ["edit", "E"],
  ["feedback", "F"], ["refine", "R"], ["reports", "D"], ["community", "C"],
  ["wyrmwood", "G"], ["settings", "T"],
]);

test("#1719 preserves canonical shortcut keys, actions and deep-link destinations while grouping presentation", async () => {
  const shortcuts = await read("app/navigation/global-shortcuts.ts");
  for (const [id, key] of preservedShortcuts) {
    assert.match(shortcuts, new RegExp(`id: "${id}", key: "${key}"`), `Shortcut ${id} changed key`);
  }
  for (const route of ["/storyboard", "/previs", "/pageflow", "/edit", "/pitch-review", "/diagnostics", "/production"]) {
    assert.ok(shortcuts.includes(`href: "${route}"`), `Canonical route changed: ${route}`);
  }
  assert.match(shortcuts, /WORKFLOW_SHORTCUTS = GLOBAL_SHORTCUTS\.filter/);
  assert.match(shortcuts, /shortcutsForArea\(area: NavigationAreaId\)[\s\S]*WORKFLOW_SHORTCUTS\.filter/);
  assert.doesNotMatch(shortcuts, /\{ id: "story", key:/);
});

test("#1719 exposes exactly six normal areas and discloses only the active area destinations", async () => {
  const [shortcuts, shell] = await Promise.all([
    read("app/navigation/global-shortcuts.ts"),
    read("app/plotpickle-workspace-shell.tsx"),
  ]);
  for (const label of ["Home", "Create", "Produce", "Review", "Connect / Play", "Settings"]) {
    assert.ok(shortcuts.includes(`label: "${label}"`), `Missing area ${label}`);
  }
  assert.match(shell, /NAVIGATION_AREAS\.map/);
  assert.match(shell, /hidden=\{[^}]*\.id !== activeArea\}/);
  assert.match(shell, /data-navigation-canonical-count=\{WORKFLOW_SHORTCUTS\.length\}/);
  assert.match(shell, /data-current-navigation-area=\{activeArea\}/);
  assert.match(shell, /data-current-destination=/);
  assert.match(shell, /data-shell-project-context="true"/);
});

test("#1719 makes STORY contextual from BUILD and returns STORY toward production without promoting it to permanent nav", async () => {
  const [shell, storyPage, boundary, shortcuts] = await Promise.all([
    read("app/plotpickle-workspace-shell.tsx"),
    read("app/story/page.tsx"),
    read("app/navigation/release-experience-boundary.tsx"),
    read("app/navigation/global-shortcuts.ts"),
  ]);
  assert.match(shell, /activeWorkspace === "build"/);
  assert.match(shell, /data-shell-primary-next="story"/);
  assert.match(shell, /router\.push\("\/story"\)/);
  assert.match(shell, /Continue to Storyboard/);
  assert.match(storyPage, /<PlotPickleWorkspaceShell activeWorkspace="story" activeShortcutId="story"/);
  assert.doesNotMatch(boundary, /"\/story":/);
  assert.match(shortcuts, /activeShortcutId === "story" \|\| workspace === "story"\) return "create"/);
  assert.doesNotMatch(shortcuts, /\{ id: "story", key:/);
});

test("#1719 keeps project and save truth persistent without changing project storage authority", async () => {
  const shell = await read("app/plotpickle-workspace-shell.tsx");
  assert.match(shell, /loadFoundationProject/);
  assert.match(shell, /getProfilePrivateSaveState/);
  assert.match(shell, /PROJECT_LIBRARY_CHANGED_EVENT/);
  assert.match(shell, /PROFILE_PRIVATE_SAVE_STATE_EVENT/);
  assert.match(shell, /Project<\/small><strong>\{projectTitle\}<\/strong>/);
  assert.match(shell, /Context<\/small><strong>\{scope\}<\/strong>/);
  assert.match(shell, /Status<\/small><strong>\{saveLabel\}<\/strong>/);
  assert.doesNotMatch(shell, /saveFoundationProject|localStorage\.setItem/);
});

test("#1719 retires flat-order continuity assumptions and renders the new contract in Visual Readiness", async () => {
  const [audit, agent, experience] = await Promise.all([
    read("lib/verification/ui-continuity-audit.mjs"),
    read("scripts/ui-continuity-agent.mjs"),
    read("lib/verification/ui-experience-audit.mjs"),
  ]);
  assert.match(audit, /MAX_TOP_LEVEL_NAVIGATION_AREAS = 6/);
  assert.match(audit, /navigation-reachability/);
  assert.match(audit, /navigationMembershipDeterministic/);
  assert.match(audit, /active-area/);
  assert.doesNotMatch(audit, /navigation-order|CANONICAL_NAVIGATION_GAPS|CANONICAL_NAVIGATION_LABELS/);
  assert.match(agent, /reachableDestinationCount/);
  assert.match(agent, /visibleNavigationPanels/);
  assert.match(experience, /UI_MAX_TOP_LEVEL_AREAS = 6/);
  assert.match(experience, /Forgiving shell reaches/);
  assert.match(experience, /primaryNextActions/);
});
