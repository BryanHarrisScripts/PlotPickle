import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  WEBMCP_DASHBOARD_DESTINATION_COVERAGE,
  WEBMCP_STANDARD_SURFACE_REGISTRY,
  WEBMCP_STANDARD_SURFACE_TARGETS,
} from "../lib/verification/webmcp-surface-capture-registry.mjs";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

test("#2285 exposes the Human-approved five-stage pre-production flow vertically", async () => {
  const [menu, host] = await Promise.all([
    read("app/skin-v1/dashboard-menu-registry.ts"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
  ]);

  const stageIds = ["plan", "storyboard", "previs", "timeline", "production"];
  let cursor = -1;
  for (const id of stageIds) {
    const next = menu.indexOf('id: "' + id + '"');
    assert.ok(next > cursor, "Five-stage Dashboard order drifted at " + id);
    cursor = next;
  }

  assert.match(menu, /"timeline"[\s\S]*"production"[\s\S]*"story-bible"/u);
  assert.match(host, /item\.id === "timeline"[\s\S]*openTimeline\(reviewAddress\)/u);
  assert.match(host, /item\.id === "production"[\s\S]*openProduction\(reviewAddress\)/u);
  assert.match(host, /<SkinV1TimelineReviewSurface/u);
  assert.match(host, /<SkinV1ProductionReviewSurface/u);
});

test("#2285 exposes the same five stages horizontally and preserves one shared address", async () => {
  const host = await read("app/skin-v1/dashboard-bbs-review-host.tsx");

  assert.match(host, /type PreproductionStage = "outline" \| "storyboard" \| "previs" \| "timeline" \| "production"/u);
  assert.match(host, /data-preproduction-stage-rail="five-stage"/u);
  for (const stage of ["outline", "storyboard", "previs", "timeline", "production"]) {
    assert.match(host, new RegExp('PreproductionStageRail active="' + stage + '"', "u"));
  }
  assert.match(host, /openPreproductionStage\([\s\S]*address: PreproductionReviewAddress = reviewAddress/u);
  assert.match(host, /setReviewAddress\(address\)/u);
});

test("#2285 Timeline reuses the existing synchronized scene authority at one real story address", async () => {
  const [surfaces, visual, timeline] = await Promise.all([
    read("app/skin-v1/preproduction-review-surfaces.tsx"),
    read("app/_components/storyboard/visual-story-workspace.tsx"),
    read("app/_components/storyboard/scene-timeline-workspace.tsx"),
  ]);

  assert.match(surfaces, /SkinV1TimelineReviewSurface/u);
  assert.match(surfaces, /<VisualStoryWorkspace[\s\S]*initialView="timeline"/u);
  assert.match(surfaces, /legacyProject=\{null\}/u);
  assert.match(visual, /data-scene-workspace="dialogue-action-shot-audio"/u);
  assert.match(visual, />Timeline<\/button>/u);
  assert.match(timeline, /Timeline · Dialogue \/ Action \/ Shot \/ Audio/u);
  assert.doesNotMatch(visual + timeline, />Scene Workspace<\/|>Scene Timeline<\//u);
});

test("#2285 Production projects real Previs evidence and stays provider-neutral", async () => {
  const [surfaces, continuity] = await Promise.all([
    read("app/skin-v1/preproduction-review-surfaces.tsx"),
    readJson("config/ui-continuity-agent-registry.json"),
  ]);

  assert.match(surfaces, /SkinV1ProductionReviewSurface/u);
  assert.match(surfaces, /derivePrevisProjection\(project\)/u);
  assert.match(surfaces, /storyboardCoverage/u);
  assert.match(surfaces, /staleShotIds/u);
  assert.match(surfaces, /reviewState === "approved"/u);
  assert.match(surfaces, /data-production-stage="provider-neutral-handoff"/u);
  assert.match(surfaces, /does not manufacture one to make Production look complete/u);
  assert.doesNotMatch(surfaces, /plotpickle\.project\.v1|localStorage|getItem\(/u);

  const legacy = continuity.screens.find((screen) => screen.id === "production-legacy");
  assert.equal(legacy?.path, "/production");
  assert.equal(legacy?.migrationClass, "legacy");
});

test("#2285 renames the governed standard scene workspace to Timeline without expanding the 30-surface standard set", async () => {
  const [registry, manifest] = await Promise.all([
    readJson("config/skin-v1-surface-registry.json"),
    readJson("tests/visual-baselines/skin-v1/manifest.json"),
  ]);
  const timeline = registry.surfaces.find((surface) => surface.id === "scene-timeline");
  const production = registry.surfaces.find((surface) => surface.id === "production");

  assert.equal(timeline?.label, "Timeline");
  assert.equal(timeline?.capturePolicy, "standard");
  assert.equal(manifest.surfaces["scene-timeline"]?.label, "Timeline");
  assert.equal(WEBMCP_STANDARD_SURFACE_REGISTRY["scene-timeline"].label, "Timeline");
  assert.deepEqual(
    WEBMCP_STANDARD_SURFACE_REGISTRY["scene-timeline"].navigation.map((step) => step.selector),
    ["[data-dashboard-menu-item='timeline']"],
  );
  assert.equal(production?.capturePolicy, "census-only");
  assert.equal(production?.runtimeSelector, "[data-skin-v1-preproduction-review='production']");
  assert.equal(WEBMCP_STANDARD_SURFACE_TARGETS.length, 30);
  assert.equal(WEBMCP_STANDARD_SURFACE_TARGETS.includes("production"), false);
  assert.deepEqual(WEBMCP_DASHBOARD_DESTINATION_COVERAGE.captured.timeline, ["scene-timeline"]);
  assert.ok(WEBMCP_DASHBOARD_DESTINATION_COVERAGE.censusOnly.includes("production"));
});
