import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("one shared root navigator owns Community, LEARN, PLAN, Wyrmwood and Settings", async () => {
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

  assert.match(navigator, /data-plotpickle-global-nav="v1"/);
  assert.match(navigator, /aria-label="PlotPickle global workflow"/);
  assert.match(navigator, /plotpickle-ouroboros-v3-transparent\.png/);

  const dashboard = navigator.indexOf('id: "dashboard"');
  const community = navigator.indexOf('id: "community"');
  const learn = navigator.indexOf('id: "learn"');
  const reports = navigator.indexOf('id: "reports"');
  const wyrmwood = navigator.indexOf('id: "wyrmwood"');
  const settings = navigator.indexOf('id: "settings"');
  assert.ok(dashboard >= 0 && dashboard < community, "Community must sit immediately to the right of Dashboard");
  assert.ok(community < learn, "Community must precede Learn");
  assert.ok(reports >= 0 && reports < wyrmwood, "Wyrmwood must follow Reports");
  assert.ok(wyrmwood < settings, "Settings must follow Wyrmwood");
  assert.match(navigator, /relic: "\/assets\/workflow-relics\/community\.svg", label: "Community", detail: "Guildhall", selectable: true/);
  assert.match(navigator, /label: "Wyrmwood", detail: "Game", selectable: true/);
  assert.match(navigator, /label: "Settings", detail: "Config", selectable: true/);
  assert.doesNotMatch(navigator, /label: "WYRMWOOD"/);
  assert.doesNotMatch(navigator, /label: "SETTINGS"/);
});

test("the global navigator fits desktop viewports and scrolls intentionally on narrow windows", async () => {
  const css = await read("app/plotpickle-workspace-shell.module.css");

  assert.match(css, /\.navigator \{[\s\S]*flex: 0 0 82px/);
  assert.match(css, /\.list \{[\s\S]*width: 100%;[\s\S]*min-width: 0;[\s\S]*gap: clamp\(3px, 0\.55vw, 8px\)/);
  assert.match(css, /\.list li \{[\s\S]*max-width: 84px;[\s\S]*flex: 1 1 0/);
  assert.match(css, /\.groupBreakAfter/);
  assert.match(css, /\.copy \{[\s\S]*min-width: 0;[\s\S]*min-height: 24px/);
  assert.match(css, /@media \(max-width: 1040px\)[\s\S]*\.list \{[\s\S]*width: max-content;[\s\S]*min-width: max-content/);
  assert.match(css, /@media \(max-width: 1040px\)[\s\S]*\.list li \{[\s\S]*width: 76px;[\s\S]*flex: 0 0 76px/);
  assert.match(css, /\.workspaceFrame :global\(nav\[aria-label="PlotPickle workflow"\]\)/);
  assert.match(css, /PlotPickle workflow and plugins/);
  assert.doesNotMatch(css, /last-child[\s\S]*margin-left/);
});

test("legacy standalone Settings control yields to the shared root navigator", async () => {
  const anchor = await read("app/ui-continuity-anchor.tsx");

  assert.match(anchor, /data-plotpickle-global-nav="v1"/);
  assert.match(anchor, /data-ui-continuity-shell="v1"/);
});