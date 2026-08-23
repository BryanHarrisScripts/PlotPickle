import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("one shared root navigator owns the approved revised PlotPickle order", async () => {
  const [page, navigator] = await Promise.all([
    read("app/page.tsx"),
    read("app/plotpickle-workspace-shell.tsx"),
  ]);

  assert.match(page, /PlotPickleWorkspaceShell/);
  assert.doesNotMatch(page, /WyrmwoodPluginEntry/);
  assert.match(page, /function navigateWorkspace\(workspace: Workspace\)/);
  assert.match(page, /activeWorkspace="community"/);
  assert.match(page, /activeWorkspace="learn"/);
  assert.match(page, /activeWorkspace="plan"/);
  assert.match(page, /activeWorkspace="wyrmwood"/);
  assert.match(page, /activeWorkspace="settings"/);

  assert.match(navigator, /data-plotpickle-global-nav="v2"/);
  assert.match(navigator, /data-workspace-navigation="true"/);
  assert.match(navigator, /aria-label="PlotPickle global workflow"/);
  assert.match(navigator, /plotpickle-ouroboros-v3-transparent\.png/);

  const community = navigator.indexOf('id: "community"');
  const library = navigator.indexOf('id: "library"');
  const learn = navigator.indexOf('id: "learn"');
  const wyrmwood = navigator.indexOf('id: "wyrmwood"');
  const plan = navigator.indexOf('id: "plan"');
  const build = navigator.indexOf('id: "build"');
  const storyboard = navigator.indexOf('id: "storyboard"');
  const previs = navigator.indexOf('id: "graphic-novel"');
  const write = navigator.indexOf('id: "write"');
  const edit = navigator.indexOf('id: "edit"');
  const feedback = navigator.indexOf('id: "feedback"');
  const refine = navigator.indexOf('id: "refine"');
  const reports = navigator.indexOf('id: "reports"');
  const dashboard = navigator.indexOf('id: "dashboard"');
  const settings = navigator.indexOf('id: "settings"');

  assert.ok(community >= 0 && community < library && library < learn && learn < wyrmwood, "Community through Wyrmwood must form the opening sequence");
  assert.ok(wyrmwood < plan && plan < build && build < storyboard && storyboard < previs, "Plan through Previs must follow Wyrmwood");
  assert.ok(previs < write && write < edit && edit < feedback && feedback < refine, "Write through Refine must follow Previs");
  assert.ok(refine < reports && reports < dashboard && dashboard < settings, "Reports, Dashboard and Settings must close the workflow");

  assert.match(navigator, /relic: "\/assets\/workflow-relics\/community\.svg", label: "Community", detail: "Guildhall", selectable: true/);
  assert.match(navigator, /label: "Wyrmwood", detail: "Game", selectable: true/);
  assert.match(navigator, /label: "Library", detail: "Examples & Stories", selectable: true/);
  assert.match(navigator, /label: "Previs", detail: "Visualize", selectable: false/);
  assert.match(navigator, /label: "Dashboard", detail: "Start", selectable: true/);
  assert.match(navigator, /label: "Settings", detail: "Config", selectable: true/);
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

test("legacy standalone Settings control yields to the compact shared root navigator", async () => {
  const anchor = await read("app/ui-continuity-anchor.tsx");

  assert.match(anchor, /data-plotpickle-global-nav="v2"/);
  assert.match(anchor, /data-ui-continuity-shell="v1"/);
});
