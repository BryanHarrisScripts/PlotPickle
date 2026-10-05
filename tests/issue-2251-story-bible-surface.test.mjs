import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

test("#2251 Story Bible remains connected after the #2266 Pre-Production consolidation", async () => {
  const menu = await read("app/skin-v1/dashboard-menu-registry.ts");
  const bible = menu.indexOf('id: "story-bible"');
  const discovery = menu.indexOf('id: "discovery"');
  const write = menu.indexOf('id: "write"');
  const plan = menu.indexOf('id: "plan"');

  assert.ok(discovery >= 0 && bible > discovery && write > bible && plan > write);
  assert.match(menu, /id: "story-bible", shortcut: "W", label: "WorldMap", description: "Map the Story World", group: "DEVELOP"/u);
  assert.match(menu, /"story-bible"/u);

  const dashboard = await read("app/skin-v1/dashboard-bbs-panel.tsx");
  const dashboardCss = await read("app/skin-v1-dashboard-menu-reset.css");
  assert.doesNotMatch(dashboard, /data-dashboard-pair="write-story-bible"/u);
  assert.doesNotMatch(dashboard, /if \(item\.id === "story-bible"\) return null/u);
  assert.doesNotMatch(dashboardCss, /pp-skin-v1-dashboard-paired-row/u);

  const shortcuts = [...menu.matchAll(/shortcut: "([^"]+)"/gu)].map((match) => match[1]);
  assert.equal(shortcuts.length, new Set(shortcuts).size);
});

test("#2251/#2603 World Map opens the detached Blank without manufacturing a durable Library project", async () => {
  const host = await read("app/skin-v1/dashboard-bbs-review-host.tsx");
  const browser = await read("core/storage/project-library-browser.ts");

  assert.match(host, /setStoryBibleProject\(loadActiveLibraryProject\(\)\)/u);
  assert.doesNotMatch(host, /Please load a story\./u);
  assert.match(browser, /export function loadActiveLibraryProject\(\): LibraryPPFProject/u);
  assert.match(browser, /loadActiveLibraryProject[\s\S]*createEmptyLibraryProject/u);
  assert.match(browser, /detachedProjectCache = \{ profileId: activeProfileId, project \}/u);
  assert.doesNotMatch(host, /createEmptyLibraryProject|createAfterglow/u);
});

test("#2251/#2605 keeps the canonical Story Bible projection inside the read-only World Map surface", async () => {
  const [surface, styles, host] = await Promise.all([
    read("app/skin-v1/story-bible-surface.tsx"),
    read("app/skin-v1/story-bible-surface.module.css"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
  ]);

  for (const phrase of [
    'data-story-bible-surface="canonical"',
    'data-story-bible-read-only="true"',
    'data-world-map-surface="review"',
    "Current canonical project truth",
    "Approved character truth and visual identity",
    "4 Acts · 12 Sequences · 24 Blocks · 96 Mini-Blocks",
    "Canonical evidence currently available",
  ]) assert.ok(surface.includes(phrase), `Missing World Map review evidence: ${phrase}`);

  assert.match(surface, /projectStoryBible\(project, plotPickleCurriculum\)/u);
  assert.match(surface, /buildStoryDevelopmentFields\(plotPickleCurriculum\)/u);
  assert.match(surface, /storyDevelopmentFieldView\(project, field\)/u);
  assert.match(surface, /NO POSTER YET/u);
  assert.match(surface, /NO APPROVED CHARACTER IMAGE YET/u);
  assert.match(surface, /Edit in Mind Map/u);
  assert.doesNotMatch(surface, /Ask World Agent|Generate Poster Visual|Generate Character Visual/u);
  assert.match(host, /<StoryBibleSurface project=\{storyBibleProject\} onEditField=\{openMindMapField\} \/>/u);
  assert.match(styles, /var\(--pp-skin-/u);
  assert.doesNotMatch(styles, /#[0-9a-f]{3,8}\b|rgba?\(/iu);
});

test("#2251 registers Story Bible without expanding the frozen standard capture set", async () => {
  const registry = await readJson("config/skin-v1-surface-registry.json");
  const bible = registry.surfaces.find((surface) => surface.id === "story-bible");
  const write = registry.surfaces.find((surface) => surface.id === "write");
  const edit = registry.surfaces.find((surface) => surface.id === "edit");

  assert.ok(bible);
  assert.equal(bible.parent, "dashboard");
  assert.equal(bible.capturePolicy, "census-only");
  assert.equal(bible.orchestrated, true);
  assert.equal(bible.runtimeSelector, "[data-story-bible-surface='canonical']");
  assert.equal(write.navigationPath[0].order, 7);
  assert.equal(bible.navigationPath[0].order, 8);
  assert.equal(edit.navigationPath[0].order, 9);
  assert.equal(registry.surfaces.filter((surface) => surface.capturePolicy === "standard").length, 32);

  const webmcp = await read("lib/verification/webmcp-surface-capture-registry.mjs");
  assert.match(webmcp, /censusOnly: Object\.freeze\(\["discovery", "story-bible", "production"\]\)/u);
});
