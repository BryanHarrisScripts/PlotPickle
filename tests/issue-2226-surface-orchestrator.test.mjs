import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

test("#2226 wires every standard surface into the runtime orchestrator", async () => {
  const [registry, declarations] = await Promise.all([
    readJson("config/skin-v1-surface-registry.json"),
    readJson("config/skin-v1-surface-declarations/standard-surfaces.json"),
  ]);
  const standard = registry.surfaces.filter((surface) => surface.capturePolicy === "standard");
  assert.equal(standard.length, 30);
  assert.equal(Object.keys(declarations.surfaces).length, 30);

  for (const surface of standard) {
    assert.equal(surface.orchestrated, true, surface.id + " must be orchestrated");
    assert.ok(surface.runtimeSelector, surface.id + " must declare a runtime selector");
    assert.ok(surface.runtimeReadySelector, surface.id + " must declare a ready selector");
    assert.ok(surface.formatProfile?.layout, surface.id + " must retain a layout profile");
    assert.equal(declarations.surfaces[surface.id].surfaceId, surface.id);
    assert.equal(declarations.surfaces[surface.id].runtimeSelector, surface.runtimeSelector);
    assert.equal(declarations.surfaces[surface.id].contentOwnership, "existing-feature-owner");
    assert.equal(declarations.surfaces[surface.id].exampleContentPolicy, "preserve-live-content");
  }
});

test("#2226 runtime consumes tokens, composition, anatomy and declarations rather than inventing a parallel skin", async () => {
  const [layout, orchestrator, css] = await Promise.all([
    read("app/layout.tsx"),
    read("app/skin-v1/surface-orchestrator.tsx"),
    read("app/skin-v1-surface-orchestrator.css"),
  ]);

  assert.match(layout, /SkinV1SurfaceOrchestrator/u);
  assert.match(layout, /skin-v1-surface-orchestrator\.css/u);
  assert.match(orchestrator, /skin-v1-surface-registry\.json/u);
  assert.match(orchestrator, /skin-v1-surface-composition-reference\.json/u);
  assert.match(orchestrator, /skin-v1-surface-anatomy-contract\.json/u);
  assert.match(orchestrator, /skin-v1-surface-declarations\/standard-surfaces\.json/u);
  assert.match(orchestrator, /data-skin-v1-orchestrator="runtime"/u);
  assert.match(orchestrator, /data-skin-v1-region-role="global-header"/u);
  assert.match(orchestrator, /data-skin-v1-region-role="surface-action-row"/u);
  assert.match(orchestrator, /data-skin-v1-region-role="status-footer"/u);

  assert.match(css, /--pp-skin-shell-max/u);
  assert.match(css, /--pp-skin-border-strong/u);
  assert.match(css, /--pp-skin-border-thin/u);
  assert.match(css, /--pp-skin-accent-deep/u);
  assert.match(css, /--pp-skin-accent-bright/u);
  assert.match(css, /data-skin-v1-orchestrator-active="true"/u);
});

test("#2226 orchestrator exposes declared profile identity on the live root", async () => {
  const source = await read("app/skin-v1/surface-orchestrator.tsx");
  for (const marker of [
    "skinV1SurfaceId",
    "skinV1Layout",
    "skinV1Shell",
    "skinV1Frame",
    "skinV1SelectedState",
    "skinV1Typography",
    "skinV1Composition",
    "skinV1Anatomy",
    "skinV1Declaration",
  ]) {
    assert.match(source, new RegExp(marker, "u"), "missing runtime marker " + marker);
  }
});

test("#2226 representative WebMCP state uses Afterglow without replacing live feature owners", async () => {
  const [fixture, catalogue] = await Promise.all([
    read("app/skin-v1/afterglow-representative-fixture.tsx"),
    read("lib/verification/webmcp-standard-surface-catalogue.mjs"),
  ]);

  assert.match(fixture, /AFTERGLOW_REPRESENTATIVE_FIXTURE_VALUE = "afterglow"/u);
  assert.match(fixture, /createAfterglowV9FoundationsReference/u);
  assert.match(fixture, /createLibraryWorkingCopy/u);
  assert.match(fixture, /switchActiveLibraryProject/u);
  assert.match(fixture, /data.*plotpickleRepresentativeFixture|plotpickleRepresentativeFixture/u);
  assert.match(catalogue, /REPRESENTATIVE_FIXTURE = "afterglow"/u);
  assert.match(catalogue, /representative/u);
  assert.match(catalogue, /data-plotpickle-representative-fixture="afterglow"/u);
});

test("#2226 WebMCP captures the orchestrated environment and fails closed if a surface bypasses it", async () => {
  const catalogue = await read("lib/verification/webmcp-standard-surface-catalogue.mjs");
  assert.match(catalogue, /ORCHESTRATOR_SELECTOR/u);
  assert.match(catalogue, /data-skin-v1-orchestrated="true"/u);
  assert.match(catalogue, /data-skin-v1-orchestrator-active="true"/u);
  assert.match(catalogue, /data-skin-v1-surface-id/u);
  assert.match(catalogue, /rendered without the canonical Skin V1 Surface Orchestrator contract/u);
  assert.match(catalogue, /frame\.screenshot/u);
});

test("#2226 Scene Workspace keeps its explicit anatomy override inside the 30-surface declaration set", async () => {
  const [bundle, scene] = await Promise.all([
    readJson("config/skin-v1-surface-declarations/standard-surfaces.json"),
    readJson("config/skin-v1-surface-declarations/scene-workspace.json"),
  ]);
  assert.equal(bundle.surfaces["scene-timeline"].declarationSource, "individual-override");
  assert.equal(scene.surfaceId, "scene-timeline");
  assert.equal(scene.contentLayout.workspaceColumnCount, 3);
  assert.deepEqual(scene.contentLayout.regions.map((region) => region.id), [
    "script",
    "playback",
    "inspector",
    "timeline",
  ]);
});


test("#2226 direct routed surfaces outrank nested visible subregions", async () => {
  const registry = await readJson("config/skin-v1-surface-registry.json");
  const routed = Object.fromEntries(
    registry.surfaces
      .filter((surface) => surface.capturePolicy === "standard" && surface.runtimeRoute)
      .map((surface) => [surface.id, surface.runtimeRoute]),
  );
  assert.deepEqual(routed, {
    write: "/write?block=17&mini=1",
    storyboard: "/storyboard?block=17&mini=1",
    previs: "/previs?block=17&mini=1",
    pageflow: "/pageflow?block=17&mini=1",
  });
  const source = await read("app/skin-v1/surface-orchestrator.tsx");
  assert.match(source, /directRouteMatches/u);
  assert.match(source, /surface\.runtimeRoute/u);
  assert.match(source, /window\.location\.pathname/u);
});


test("#2226 Visual Director returns through the orchestrator before legacy controls", async () => {
  const source = await read("lib/verification/skin-v1-visual-director.mjs");
  assert.match(source, /pp-skin-v1-orchestrator-return:visible/u);
  const orchestratorIndex = source.indexOf("pp-skin-v1-orchestrator-return:visible");
  const legacyIndex = source.indexOf("pp-skin-v1-return:visible", orchestratorIndex);
  assert.ok(orchestratorIndex >= 0 && legacyIndex > orchestratorIndex);
});
