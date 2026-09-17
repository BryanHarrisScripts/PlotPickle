import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  WEBMCP_STANDARD_SURFACE_REGISTRY,
  WEBMCP_STANDARD_SURFACE_TARGETS,
} from "../lib/verification/webmcp-surface-capture-registry.mjs";

const read = (relative) => readFile(new URL(`../${relative}`, import.meta.url), "utf8");

test("#2124 Phase 4 routes Matrix Outline and Storyboard to the existing pre-production surfaces without changing Dashboard readiness presentation", async () => {
  const [menu, host, storyMapSurface] = await Promise.all([
    read("app/skin-v1/dashboard-menu-registry.ts"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("app/skin-v1/matrix-story-map-surface.tsx"),
  ]);

  assert.match(menu, /CONNECTED_DASHBOARD_ITEM_IDS[\s\S]*"plan"/u);
  const connectedBlock = menu.match(/CONNECTED_DASHBOARD_ITEM_IDS = new Set\(\[([\s\S]*?)\]\)/u)?.[1] ?? "";
  assert.doesNotMatch(connectedBlock, /"storyboard"/u);
  assert.match(host, /item\.id === "plan"[\s\S]*onSurfaceNameChange\("STORY MAP"\)[\s\S]*setOutlineOpen\(true\)/u);
  assert.match(host, /item\.id === "storyboard"[\s\S]*onSurfaceNameChange\("STORYBOARD"\)[\s\S]*setStoryboardOpen\(true\)/u);
  assert.match(host, /<MatrixStoryMapSurface \/>/u);
  assert.match(host, /<StoryboardPage \/>/u);
  assert.match(storyMapSurface, /<ProgressiveStoryMap project=\{project\} \/>/u);
});

test("#2124 Phase 4 registers Story Map, Visual Story and Scene Timeline in the existing WebMCP standard catalogue", () => {
  for (const surface of ["story-map", "visual-story", "scene-timeline"]) {
    assert.ok(WEBMCP_STANDARD_SURFACE_TARGETS.includes(surface), `${surface} should be a standard WebMCP surface`);
    assert.equal(WEBMCP_STANDARD_SURFACE_REGISTRY[surface].approval, "#2124/#2125");
  }

  assert.equal(WEBMCP_STANDARD_SURFACE_REGISTRY["story-map"].navigation[0].selector, "[data-dashboard-menu-item='plan']");
  assert.equal(WEBMCP_STANDARD_SURFACE_REGISTRY["visual-story"].navigation[0].selector, "[data-dashboard-menu-item='storyboard']");
  assert.deepEqual(
    WEBMCP_STANDARD_SURFACE_REGISTRY["scene-timeline"].navigation.map((step) => step.selector),
    ["[data-dashboard-menu-item='storyboard']", "[data-visual-story-view='timeline']"],
  );
});

test("#2124 Phase 4 keeps empty Visual Story and Scene Timeline inspectable without manufacturing production data", async () => {
  const visualStory = await read("app/_components/storyboard/visual-story-workspace.tsx");

  assert.match(visualStory, /data-visual-story="scene-beat-shot-frame"/u);
  assert.match(visualStory, /data-visual-story-view="story"/u);
  assert.match(visualStory, /data-visual-story-view="timeline"/u);
  assert.match(visualStory, /data-scene-timeline="frames-shots-action-timing"/u);
  assert.match(visualStory, /Scene Timeline does not manufacture timing material to fill the surface/u);
  assert.match(visualStory, /only real Shot and Previs timing can then occupy the timeline/u);
});

test("#2124 keeps the Dashboard mathematical score contract visible when no story is active", async () => {
  const scorePanel = await read("app/skin-v1/plotpickle-score-panel.tsx");

  assert.match(scorePanel, /function EmptyScorePanel\(\)/u);
  assert.match(scorePanel, /data-plotpickle-score-project="none"/u);
  assert.match(scorePanel, /<output className=\{styles\.score\} aria-label="PlotPickle Score NR">NR<\/output>/u);
  assert.match(scorePanel, /NO ACTIVE STORY/u);
  assert.match(scorePanel, /0\/96 MINI-BLOCKS POPULATED/u);
  assert.match(scorePanel, /if \(!project \|\| !result\) return <EmptyScorePanel \/>/u);
  assert.doesNotMatch(scorePanel, /if \(!project \|\| !result\) return null/u);
});

test("#2124 Phase 4 adds only candidate pre-production captures while Dashboard remains the sole locked Matrix baseline", async () => {
  const manifest = JSON.parse(await read("tests/visual-baselines/skin-v1/manifest.json"));
  const locked = Object.entries(manifest.surfaces)
    .filter(([, entry]) => entry.status === "locked")
    .map(([id]) => id);

  assert.deepEqual(locked, ["dashboard"]);
  for (const surface of ["story-map", "visual-story", "scene-timeline"]) {
    assert.equal(manifest.surfaces[surface].status, "candidate");
    assert.equal(manifest.surfaces[surface].selector, WEBMCP_STANDARD_SURFACE_REGISTRY[surface].rootSelector);
    assert.equal(manifest.surfaces[surface].candidate, WEBMCP_STANDARD_SURFACE_REGISTRY[surface].candidate);
    assert.equal(manifest.surfaces[surface].baseline, WEBMCP_STANDARD_SURFACE_REGISTRY[surface].baseline);
  }
});

test("#2124 Phase 4 reuses the existing WebMCP standard-surface verifier rather than creating a parallel harness", async () => {
  const catalogue = await read("lib/verification/webmcp-standard-surface-catalogue.mjs");
  const runner = await read("scripts/run-webmcp-startup-uat.mjs");

  assert.match(catalogue, /for \(const surface of WEBMCP_STANDARD_SURFACE_TARGETS\)/u);
  assert.match(catalogue, /WEBMCP_STANDARD_SURFACE_REGISTRY\[surface\]/u);
  assert.match(catalogue, /await capture\(page, manifest, surface, failures\)/u);
  assert.match(runner, /runWebMcpStandardSurfaceCatalogue/u);
});
