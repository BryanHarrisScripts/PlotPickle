import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("one shared root navigator owns the approved PlotPickle navigation groups", async () => {
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

  const dashboard = navigator.indexOf('id: "dashboard"');
  const community = navigator.indexOf('id: "community"');
  const wyrmwood = navigator.indexOf('id: "wyrmwood"');
  const learn = navigator.indexOf('id: "learn"');
  const plan = navigator.indexOf('id: "plan"');
  const build = navigator.indexOf('id: "build"');
  const storyboard = navigator.indexOf('id: "storyboard"');
  const previs = navigator.indexOf('id: "graphic-novel"');
  const write = navigator.indexOf('id: "write"');
  const edit = navigator.indexOf('id: "edit"');
  const feedback = navigator.indexOf('id: "feedback"');
  const refine = navigator.indexOf('id: "refine"');
  const reports = navigator.indexOf('id: "reports"');
  const settings = navigator.indexOf('id: "settings"');

  assert.ok(dashboard >= 0 && dashboard < community && community < wyrmwood, "Dashboard, Community and Wyrmwood must form the opening group");
  assert.ok(wyrmwood < learn && learn < plan && plan < build && build < storyboard && storyboard < previs, "Learn through Previs must form the second group");
  assert.ok(previs < write && write < edit && edit < feedback && feedback < refine, "Write through Refine must form the third group");
  assert.ok(refine < reports && reports < settings, "Reports and Settings must form the final group");

  assert.match(navigator, /relic: "\/assets\/workflow-relics\/community\.svg", label: "Community", detail: "Guildhall", selectable: true/);
  assert.match(navigator, /label: "Wyrmwood", detail: "Game", selectable: true/);
  assert.match(navigator, /label: "Previs", detail: "Visualize", selectable: false/);
  assert.match(navigator, /label: "Settings", detail: "Config", selectable: true/);
  assert.match(navigator, /id === "wyrmwood"\) return "community-game"/);
  assert.match(navigator, /id === "graphic-novel"\) return "previs"/);
  assert.match(navigator, /id === "refine"\) return "reports"/);
});

test("the global navigator preserves deliberate group spacing and narrow-window scrolling", async () => {
  const css = await read("app/plotpickle-workspace-shell.module.css");

  assert.match(css, /\.navigator \{[\s\S]*flex: 0 0 82px/);
  assert.match(css, /\.list \{[\s\S]*width: 100%;[\s\S]*min-width: 0;[\s\S]*gap: clamp\(3px, 0\.55vw, 8px\)/);
  assert.match(css, /\.list li \{[\s\S]*max-width: 84px;[\s\S]*flex: 1 1 0/);
  assert.match(css, /\.groupBreakCommunityGame[\s\S]*margin-right: clamp\(28px, 4vw, 72px\)/);
  assert.match(css, /\.groupBreakPrevis[\s\S]*margin-right: clamp\(22px, 3vw, 56px\)/);
  assert.match(css, /\.groupBreakReports[\s\S]*margin-right: clamp\(72px, 10vw, 180px\)/);
  assert.match(css, /\.copy \{[\s\S]*min-width: 0;[\s\S]*min-height: 24px/);
  assert.match(css, /@media \(max-width: 1040px\)[\s\S]*\.list \{[\s\S]*width: max-content;[\s\S]*min-width: max-content/);
  assert.match(css, /@media \(max-width: 1040px\)[\s\S]*\.list li \{[\s\S]*width: 76px;[\s\S]*flex: 0 0 76px/);
  assert.match(css, /\.workspaceFrame :global\(nav\[aria-label="PlotPickle workflow"\]\)/);
  assert.match(css, /PlotPickle workflow and plugins/);
  assert.doesNotMatch(css, /last-child[\s\S]*margin-left/);
});

test("legacy standalone Settings control yields to the grouped shared root navigator", async () => {
  const anchor = await read("app/ui-continuity-anchor.tsx");

  assert.match(anchor, /data-plotpickle-global-nav="v2"/);
  assert.match(anchor, /data-ui-continuity-shell="v1"/);
});
