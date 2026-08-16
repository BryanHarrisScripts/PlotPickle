import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("one shared root navigator owns LEARN, PLAN, WYRMWOOD and SETTINGS", async () => {
  const [page, navigator] = await Promise.all([
    read("app/page.tsx"),
    read("app/plotpickle-workspace-shell.tsx"),
  ]);

  assert.match(page, /PlotPickleWorkspaceShell/);
  assert.doesNotMatch(page, /WyrmwoodPluginEntry/);
  assert.match(page, /function navigateWorkspace\(workspace: Workspace\)/);
  assert.match(page, /activeWorkspace="learn"/);
  assert.match(page, /activeWorkspace="plan"/);
  assert.match(page, /activeWorkspace="wyrmwood"/);
  assert.match(page, /activeWorkspace="settings"/);

  assert.match(navigator, /data-plotpickle-global-nav="v1"/);
  assert.match(navigator, /aria-label="PlotPickle global workflow"/);
  assert.match(navigator, /plotpickle-ouroboros-v3-transparent\.png/);

  const reports = navigator.indexOf('id: "reports"');
  const wyrmwood = navigator.indexOf('id: "wyrmwood"');
  const settings = navigator.indexOf('id: "settings"');
  assert.ok(reports >= 0 && reports < wyrmwood, "Wyrmwood must follow Reports");
  assert.ok(wyrmwood < settings, "Settings must follow Wyrmwood");
  assert.match(navigator, /label: "WYRMWOOD", detail: "Game", selectable: true/);
  assert.match(navigator, /label: "SETTINGS", detail: "Config", selectable: true/);
});

test("the global navigator keeps every relic in one fixed slot geometry", async () => {
  const css = await read("app/plotpickle-workspace-shell.module.css");

  assert.match(css, /\.list \{[\s\S]*gap: 4px/);
  assert.match(css, /\.list li \{[\s\S]*width: 70px;[\s\S]*flex: 0 0 70px/);
  assert.match(css, /\.workspaceFrame :global\(nav\[aria-label="PlotPickle workflow"\]\)/);
  assert.match(css, /PlotPickle workflow and plugins/);
  assert.doesNotMatch(css, /last-child[\s\S]*margin-left/);
});

test("legacy standalone Settings control yields to the shared root navigator", async () => {
  const anchor = await read("app/ui-continuity-anchor.tsx");

  assert.match(anchor, /data-plotpickle-global-nav="v1"/);
  assert.match(anchor, /data-ui-continuity-shell="v1"/);
});
