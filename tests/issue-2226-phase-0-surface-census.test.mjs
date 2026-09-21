import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { WEBMCP_STANDARD_SURFACE_TARGETS } from "../lib/verification/webmcp-canonical-surface-registry.mjs";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

test("#2226 Phase 0 freezes the current canonical census without replacing visual authority", async () => {
  const [registry, manifest] = await Promise.all([
    readJson("config/skin-v1-surface-registry.json"),
    readJson("tests/visual-baselines/skin-v1/manifest.json"),
  ]);

  assert.equal(registry.surfaces.length, 78);
  assert.equal(registry.surfaces.filter((surface) => surface.capturePolicy === "standard").length, 30);
  assert.equal(registry.surfaces.filter((surface) => surface.capturePolicy === "census-only").length, 43);
  assert.equal(registry.surfaces.filter((surface) => surface.capturePolicy === "public-exception").length, 5);
  assert.equal(WEBMCP_STANDARD_SURFACE_TARGETS.length, 30);
  assert.equal(Object.keys(manifest.surfaces).length, 30);

  const locked = Object.entries(manifest.surfaces)
    .filter(([, entry]) => entry.status === "locked")
    .map(([id]) => id);
  assert.deepEqual(locked, ["dashboard"]);
});

test("#2226 Phase 0 records current navigation order from existing product evidence", async () => {
  const [dashboardMenu, dashboardPanel, library] = await Promise.all([
    read("app/skin-v1/dashboard-menu-registry.ts"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("modules/library/ui/library-workspace.tsx"),
  ]);

  const rootOrder = [
    "community", "learn", "library", "plan", "storyboard", "previs", "timeline", "production", "write", "edit", "feedback",
    "refine", "reports", "wyrmwood", "story", "profile", "settings", "help", "open-source", "logout", "shutdown",
  ];
  let cursor = -1;
  for (const id of rootOrder) {
    const next = dashboardMenu.indexOf('id: "' + id + '"');
    assert.ok(next > cursor, "Dashboard navigation order drifted at " + id);
    cursor = next;
  }

  const settingsOrder = ["general", "story-mode", "node-info", "agents"];
  cursor = -1;
  for (const id of settingsOrder) {
    const next = dashboardPanel.indexOf('id: "' + id + '"', cursor + 1);
    assert.ok(next > cursor, "Manage navigation order drifted at " + id);
    cursor = next;
  }

  const libraryOrder = ["new", "import", "load", "examples", "presets", "avery", "archive"];
  cursor = -1;
  for (const id of libraryOrder) {
    const next = library.indexOf('id: "' + id + '"', cursor + 1);
    assert.ok(next > cursor, "Library navigation order drifted at " + id);
    cursor = next;
  }
});

test("#2226/#2285 keeps the timeline authority nested while exposing Timeline directly from Dashboard", async () => {
  const [registry, captureRegistry, visualWorkspace] = await Promise.all([
    readJson("config/skin-v1-surface-registry.json"),
    read("lib/verification/webmcp-surface-capture-registry.mjs"),
    read("app/_components/storyboard/visual-story-workspace.tsx"),
  ]);
  const scene = registry.surfaces.find((surface) => surface.id === "scene-timeline");

  assert.equal(scene?.parent, "storyboard");
  assert.equal(scene?.surfaceClass, "nested");
  assert.equal(scene?.label, "Timeline");
  assert.match(captureRegistry, /"scene-timeline"[\s\S]*data-dashboard-menu-item=\'timeline\'/u);
  assert.match(visualWorkspace, /SceneTimelineWorkspace/u);
});

test("#2226 Phase 0 preserves Human review and does not invent a shell-level four-column archetype", async () => {
  const [brief, census, grammar] = await Promise.all([
    read("docs/developer-briefs/2226-skin-v1-surface-blueprint.md"),
    read("docs/architecture/skin-v1-surface-blueprint-phase-0-census.md"),
    readJson("config/skin-v1-surface-grammar.json"),
  ]);

  for (const phrase of [
    "Library family — shared defect",
    "Selected-state grammar",
    "Navigation-ordered surface identity and PNG naming",
    "Scene Timeline / Scene Workspace",
    "No baseline replacement in this phase",
  ]) assert.ok(brief.includes(phrase), "Developer brief lost Human review phrase: " + phrase);

  assert.ok(census.toLowerCase().includes("no four-column surface archetype is proposed"));
  assert.ok(census.includes("Dashboard is the only locked baseline"));
  assert.equal(Object.prototype.hasOwnProperty.call(grammar, "layoutArchetypes"), false, "Phase 0 must not prematurely add layout schema");
});
