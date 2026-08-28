import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("one shared root navigator owns the approved revised PlotPickle order", async () => {
  const [page, navigator, registry] = await Promise.all([
    read("app/page.tsx"),
    read("app/plotpickle-workspace-shell.tsx"),
    read("app/navigation/global-shortcuts.ts"),
  ]);

  assert.match(page, /PlotPickleWorkspaceShell/);
  assert.doesNotMatch(page, /WyrmwoodPluginEntry/);
  assert.match(page, /function navigateWorkspace\(workspace: Workspace\)/);
  assert.match(page, /activeWorkspace="community"/);
  assert.match(page, /activeWorkspace="learn"/);
  assert.match(page, /activeWorkspace="plan"/);
  assert.match(page, /activeWorkspace="wyrmwood"/);
  assert.match(page, /activeWorkspace="settings"/);

  assert.match(navigator, /data-plotpickle-global-nav="v3"/);
  assert.match(navigator, /data-workspace-navigation="true"/);
  assert.match(navigator, /aria-label="PlotPickle global workflow"/);
  assert.match(navigator, /plotpickle-ouroboros-v3-transparent\.png/);
  assert.match(navigator, /WORKFLOW_SHORTCUTS\.map/);

  const community = registry.indexOf('id: "community"');
  const library = registry.indexOf('id: "library"');
  const learn = registry.indexOf('id: "learn"');
  const wyrmwood = registry.indexOf('id: "wyrmwood"');
  const plan = registry.indexOf('id: "plan"');
  const build = registry.indexOf('id: "build"');
  const storyboard = registry.indexOf('id: "storyboard"');
  const previs = registry.indexOf('id: "graphic-novel"');
  const write = registry.indexOf('id: "write"');
  const edit = registry.indexOf('id: "edit"');
  const feedback = registry.indexOf('id: "feedback"');
  const refine = registry.indexOf('id: "refine"');
  const reports = registry.indexOf('id: "reports"');
  const dashboard = registry.indexOf('id: "dashboard"');
  const settings = registry.indexOf('id: "settings"');

  assert.ok(community >= 0 && community < library && library < learn && learn < wyrmwood, "Community through Wyrmwood must form the opening sequence");
  assert.ok(wyrmwood < plan && plan < build && build < storyboard && storyboard < previs, "Plan through Previs must follow Wyrmwood");
  assert.ok(previs < write && write < edit && edit < feedback && feedback < refine, "Write through Refine must follow Previs");
  assert.ok(refine < reports && reports < dashboard && dashboard < settings, "Reports, Dashboard and Settings must close the workflow");

  assert.match(registry, /relic: "\/assets\/workflow-relics\/community\.svg", action: \{ kind: "workspace", workspace: "community" \}/);
  assert.match(registry, /key: "G", label: "Wyrmwood", detail: "Game"/);
  assert.match(registry, /key: "O", label: "Library", detail: "Stories"/);
  assert.match(registry, /key: "V", label: "Previs", detail: "Visualize"/);
  assert.match(registry, /key: "K", label: "Dashboard", detail: "KPI"/);
  assert.match(registry, /key: "T", label: "Settings", detail: "Config"/);
  assert.doesNotMatch(navigator, /navigationBreakAfter|data-navigation-gap-after|groupBreakCommunityGame|groupBreakPrevis|groupBreakReports/);
});

test("the global navigator stays compact, centered and horizontally scrollable when needed", async () => {
  const css = await read("app/plotpickle-workspace-shell.module.css");

  assert.match(css, /\.navigator \{[\s\S]*flex: 0 0 82px/);
  assert.match(css, /\.scroller \{[\s\S]*width: 100%;[\s\S]*min-width: 0;[\s\S]*overflow-x: auto/);
  assert.match(css, /\.list \{[\s\S]*width: max-content;[\s\S]*min-width: max-content;[\s\S]*gap: clamp\(2px, 0\.25vw, 4px\);[\s\S]*margin: 0 auto/);
  assert.match(css, /\.list li \{[\s\S]*width: 64px;[\s\S]*min-width: 64px;[\s\S]*max-width: 64px;[\s\S]*flex: 0 0 64px/);
  assert.doesNotMatch(css, /groupBreakCommunityGame|groupBreakPrevis|groupBreakReports/);
  assert.match(css, /\.copy \{[\s\S]*min-width: 0;[\s\S]*min-height: 24px/);
  assert.match(css, /@media \(max-width: 1040px\)[\s\S]*\.list \{[\s\S]*margin: 0;[\s\S]*gap: 4px;[\s\S]*padding-left: 76px/);
  assert.match(css, /\.workspaceFrame :global\(nav\[aria-label="PlotPickle workflow"\]\)/);
  assert.match(css, /PlotPickle workflow and plugins/);
  assert.doesNotMatch(css, /last-child[\s\S]*margin-left/);
});

test("legacy standalone Settings control remains detectable while the root shell owns v3 navigation", async () => {
  const anchor = await read("app/ui-continuity-anchor.tsx");

  assert.match(anchor, /data-plotpickle-global-nav="v2"/);
  assert.match(anchor, /data-ui-continuity-shell="v1"/);
});
