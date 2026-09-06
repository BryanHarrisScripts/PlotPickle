import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#672/#1719 one shared shortcut registry owns every canonical destination and six forgiving areas", async () => {
  const [page, navigator, registry] = await Promise.all([
    read("app/page.tsx"),
    read("app/plotpickle-workspace-shell.tsx"),
    read("app/navigation/global-shortcuts.ts"),
  ]);

  assert.match(page, /PlotPickleWorkspaceShell/);
  assert.doesNotMatch(page, /WyrmwoodPluginEntry/);
  assert.match(page, /function navigateWorkspace\(workspace: Workspace\)/);
  for (const workspace of ["community", "learn", "plan", "wyrmwood", "settings"]) {
    assert.match(page, new RegExp(`activeWorkspace="${workspace}"`));
  }

  assert.match(navigator, /data-plotpickle-global-nav="v4"/);
  assert.match(navigator, /data-workspace-areas="true"/);
  assert.match(navigator, /data-workspace-navigation="true"/);
  assert.match(navigator, /aria-label="PlotPickle global workflow"/);
  assert.match(navigator, /plotpickle-ouroboros-v3-transparent\.png/);
  assert.match(navigator, /NAVIGATION_AREAS\.map/);
  assert.match(navigator, /data-navigation-area-panel=/);
  assert.match(navigator, /shortcutsForArea\([^)]*\.id\)\.map/);

  for (const area of ["home", "create", "produce", "review", "connect", "settings"]) {
    assert.match(registry, new RegExp(`id: "${area}"`));
  }
  assert.match(registry, /id: "dashboard"[\s\S]*area: "home"[\s\S]*workspace: "dashboard"/);
  assert.match(registry, /id: "library"[\s\S]*area: "home"[\s\S]*workspace: "library"/);
  assert.match(registry, /id: "learn"[\s\S]*area: "create"[\s\S]*workspace: "learn"/);
  assert.match(registry, /id: "plan"[\s\S]*area: "create"[\s\S]*workspace: "plan"/);
  assert.match(registry, /id: "build"[\s\S]*area: "create"[\s\S]*workspace: "build"/);
  assert.match(registry, /id: "storyboard"[\s\S]*area: "produce"[\s\S]*href: "\/storyboard"/);
  assert.match(registry, /id: "graphic-novel"[\s\S]*area: "produce"[\s\S]*href: "\/previs"/);
  assert.match(registry, /id: "feedback"[\s\S]*area: "review"[\s\S]*href: "\/pitch-review"/);
  assert.match(registry, /id: "community"[\s\S]*area: "connect"[\s\S]*workspace: "community"/);
  assert.match(registry, /id: "wyrmwood"[\s\S]*area: "connect"[\s\S]*workspace: "wyrmwood"/);
  assert.match(registry, /id: "settings"[\s\S]*area: "settings"[\s\S]*workspace: "settings"/);
  assert.doesNotMatch(registry, /\{ id: "story", key:/);
  assert.doesNotMatch(registry, /\{ id: "collab", key:/);

  assert.match(registry, /key: "G", label: "Wyrmwood", detail: "Game"/);
  assert.match(registry, /key: "O", label: "Library", detail: "Stories"/);
  assert.match(registry, /key: "V", label: "Previs", detail: "Visualize"/);
  assert.match(registry, /key: "K", label: "Dashboard", detail: "KPI"/);
  assert.match(registry, /key: "T", label: "Settings", detail: "Config"/);
  assert.doesNotMatch(navigator, /navigationBreakAfter|data-navigation-gap-after|groupBreakCommunityGame|groupBreakPrevis|groupBreakReports/);
});

test("#1719 global navigator is compact by disclosure, horizontally forgiving when needed, and tokenized", async () => {
  const css = await read("app/plotpickle-workspace-shell.module.css");

  assert.match(css, /\.navigator \{[\s\S]*flex: 0 0 126px/);
  assert.match(css, /\.areaList \{[\s\S]*overflow-x: auto/);
  assert.match(css, /\.areaList button \{[\s\S]*min-height: 44px[\s\S]*padding: var\(--pp-space-/);
  assert.match(css, /\.destinationScroller \{[\s\S]*overflow-x: auto/);
  assert.match(css, /\.destinationList \{[\s\S]*width: max-content;[\s\S]*min-width: max-content/);
  assert.match(css, /\.destinationList li \{[\s\S]*width: 64px;[\s\S]*min-width: 64px;[\s\S]*flex: 0 0 64px/);
  assert.match(css, /\.destinationList button \{[\s\S]*width: 64px;[\s\S]*min-height: 64px[\s\S]*border-radius: var\(--pp-radius-control\)/);
  assert.match(css, /\.utilityArea \{[\s\S]*margin-left: auto/);
  assert.match(css, /\.projectStrip \{[\s\S]*border-radius: var\(--pp-radius-panel\)/);
  assert.match(css, /font-family: var\(--pp-font-code\)/);
  assert.match(css, /\.workspaceFrame :global\(nav\[aria-label="PlotPickle workflow"\]\)/);
  assert.match(css, /PlotPickle workflow and plugins/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  assert.doesNotMatch(css, /groupBreakCommunityGame|groupBreakPrevis|groupBreakReports/);
});

test("legacy standalone Settings control remains detectable while the root shell owns v4 navigation", async () => {
  const anchor = await read("app/ui-continuity-anchor.tsx");

  assert.match(anchor, /data-plotpickle-global-nav="v2"/);
  assert.match(anchor, /data-ui-continuity-shell="v1"/);
});
