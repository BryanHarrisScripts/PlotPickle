import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { skinV1RouteMigrationLedger } from "../lib/verification/skin-v1-route-migration-ledger.mjs";

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

test("#2226 derives one canonical direct-route contract and a measurable compatibility burn-down ledger", async () => {
  const [routeContract, legacyBoundary, runtime, writer] = await Promise.all([
    read("app/skin-v1-route-contract.ts"),
    read("app/legacy-skin-only.tsx"),
    read("app/skin-v1-runtime.tsx"),
    read("scripts/write-skin-v1-route-migration-ledger.mjs"),
  ]);
  const ledger = skinV1RouteMigrationLedger();

  assert.equal(ledger.contractId, "skin-v1-route-migration-ledger-v1");
  assert.equal(ledger.sourceRegistry, "skin-v1-surface-registry-v1");
  assert.equal(ledger.policy, "derived-only-no-second-route-authority");
  assert.deepEqual(ledger.counts, {
    canonicalOrchestratedDirect: 7,
    routedCompatibilityDebt: 28,
    stateCompatibilityDebt: 10,
    publicExceptions: 5,
  });
  assert.deepEqual(
    ledger.canonicalOrchestratedDirect.map((entry) => entry.id),
    ["write", "storyboard", "previs", "pageflow", "edit", "feedback", "refine"],
  );
  for (const id of ["reports", "core-curriculum", "buzz-settings"]) {
    assert.ok(ledger.routedCompatibilityDebt.some((entry) => entry.id === id), id + " must remain visible in the compatibility ledger until migrated");
  }
  for (const id of ["edit", "feedback", "refine"]) {
    assert.ok(!ledger.routedCompatibilityDebt.some((entry) => entry.id === id), id + " must leave route debt once orchestrated");
  }

  assert.match(routeContract, /surface\.orchestrated && surface\.runtimeRoute/u);
  assert.match(routeContract, /ORCHESTRATED_DIRECT_PATHS/u);
  assert.match(routeContract, /isCanonicalSkinV1Path/u);
  assert.match(legacyBoundary, /isCanonicalSkinV1Path\(pathname\)/u);
  assert.doesNotMatch(legacyBoundary, /function skinV1/u);
  assert.match(runtime, /isCanonicalSkinV1Path\(url\.pathname\)/u);
  assert.doesNotMatch(runtime, /CANONICAL_SKIN_V1_ROUTES/u);
  assert.match(writer, /skin-v1-route-migration-ledger\.json/u);
});

test("#2226 orchestrates Edit Feedback and Refine without expanding the 30-surface standard capture set", async () => {
  const [registry, orchestrator, editWorkspace, feedbackPage, pitchPage, diagnostics, refineReturn, css] = await Promise.all([
    readJson("config/skin-v1-surface-registry.json"),
    read("app/skin-v1/surface-orchestrator.tsx"),
    read("app/edit-workspace.tsx"),
    read("app/feedback/page.tsx"),
    read("app/pitch-review/page.tsx"),
    read("app/diagnostics/page.tsx"),
    read("app/refine-return-nav.tsx"),
    read("app/skin-v1-surface-orchestrator.css"),
  ]);
  const byId = new Map(registry.surfaces.map((surface) => [surface.id, surface]));
  const edit = byId.get("edit");
  const refine = byId.get("refine");
  const feedback = byId.get("feedback");

  assert.equal(registry.surfaces.filter((surface) => surface.capturePolicy === "standard").length, 30);
  assert.equal(registry.surfaces.filter((surface) => surface.capturePolicy === "census-only").length, 41);

  assert.equal(edit?.capturePolicy, "census-only");
  assert.equal(edit?.orchestrated, true);
  assert.equal(edit?.runtimeSelector, "[data-edit-workspace='canonical']");
  assert.equal(edit?.formatProfile?.layout, "three-column");
  assert.equal(edit?.formatProfile?.shell, "production");

  assert.equal(refine?.capturePolicy, "census-only");
  assert.equal(refine?.orchestrated, true);
  assert.equal(refine?.runtimeSelector, "[data-refine-workspace='canonical']");
  assert.equal(refine?.formatProfile?.layout, "one-column");
  assert.equal(refine?.formatProfile?.shell, "diagnostic");

  assert.equal(feedback?.capturePolicy, "census-only");
  assert.equal(feedback?.route, "/feedback");
  assert.equal(feedback?.orchestrated, true);
  assert.equal(feedback?.runtimeSelector, "[data-feedback-workspace='canonical']");
  assert.equal(feedback?.formatProfile?.layout, "two-column");
  assert.equal(feedback?.formatProfile?.shell, "diagnostic");
  assert.equal(Object.prototype.hasOwnProperty.call(feedback ?? {}, "migrationHold"), false);
  assert.match(feedbackPage, /data-feedback-workspace="canonical"/u);
  assert.match(feedbackPage, /<FeedbackWorkspace/u);
  assert.match(pitchPage, /window\.location\.replace\("\/feedback"\)/u);
  assert.match(pitchPage, /PitchReviewWorkspace/u);

  assert.match(orchestrator, /ORCHESTRATED_SURFACES/u);
  assert.match(orchestrator, /surface\.orchestrated && surface\.runtimeSelector/u);
  assert.match(orchestrator, /registry-migration-projection/u);
  assert.match(editWorkspace, /data-edit-workspace="canonical"/u);
  assert.match(diagnostics, /data-refine-workspace="canonical"/u);
  assert.match(diagnostics, /data-skin-v1-local-return="true"/u);
  assert.match(refineReturn, /data-skin-v1-local-chrome="return-navigation"/u);
  assert.match(css, /data-skin-v1-local-chrome="return-navigation"/u);
  assert.match(css, /data-skin-v1-local-return="true"/u);
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

test("#2226 canonical Return delegates more-specific nested navigation without rendering a duplicate control", async () => {
  const [orchestrator, css] = await Promise.all([
    read("app/skin-v1/surface-orchestrator.tsx"),
    read("app/skin-v1-surface-orchestrator.css"),
  ]);

  assert.match(orchestrator, /function delegatedReturn/u);
  assert.match(orchestrator, /existingReturnControl/u);
  assert.match(orchestrator, /setDelegatedReturnLabel\(delegatedReturn\(next\)\?\.label \?\? null\)/u);
  assert.match(orchestrator, /const delegated = delegatedReturn\(active\)/u);
  assert.match(orchestrator, /delegated\.control\.click\(\)/u);
  assert.match(orchestrator, /data-skin-v1-return-contract="single-owner"/u);
  assert.match(orchestrator, /data-skin-v1-return-source=\{delegatedReturnLabel \? "content-delegated" : "registry-parent"\}/u);
  assert.match(css, /\.pp-skin-v1-bbs-banner/u);
  assert.match(css, /width: 1px !important;/u);
});

test("#2226 standard orchestrated surfaces use a thin structural perimeter while Dashboard keeps its separately governed layered reference", async () => {
  const [css, grammar] = await Promise.all([
    read("app/skin-v1-surface-orchestrator.css"),
    readJson("config/skin-v1-surface-grammar.json"),
  ]);

  assert.equal(grammar.frameProfiles["solid-standard"].outerBorderToken, "--pp-skin-border-thin");
  assert.equal(grammar.frameProfiles["layered-inset"].outerBorderToken, "--pp-skin-border-strong");
  assert.match(
    css,
    /border: var\(--pp-skin-border-thin\) solid var\(--pp-skin-line-strong\) !important;/
  );
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




test("#2226 orchestrator Dashboard return reaches the application surface owner", async () => {
  const [orchestrator, client] = await Promise.all([
    read("app/skin-v1/surface-orchestrator.tsx"),
    read("app/skin-v1/skin-v1-client.tsx"),
  ]);
  assert.match(orchestrator, /plotpickle:return-dashboard/u);
  assert.match(orchestrator, /active\.parent === "dashboard"/u);
  assert.match(client, /addEventListener\("plotpickle:return-dashboard"/u);
  assert.match(client, /setActiveSurface\("DASHBOARD"\)/u);
  assert.match(client, /setDashboardSurfaceName\("DASHBOARD"\)/u);
});






test("#2226 Visual Director resets deterministically to the canonical Dashboard route", async () => {
  const source = await read("lib/verification/skin-v1-visual-director.mjs");
  const functionStart = source.indexOf("async function goDashboard(page, server)");
  const functionEnd = source.indexOf("async function collectProfile", functionStart);
  const body = source.slice(functionStart, functionEnd);
  assert.match(body, /page\.goto\(new URL\("\/skin-v1", server\)/u);
  assert.match(body, /dashboard\.readySelector/u);
  assert.doesNotMatch(body, /pp-skin-v1-return/u);
  assert.doesNotMatch(body, /pp-skin-v1-orchestrator-return/u);
});


test("#2226 menu contract audit uses the orchestrator Return before legacy controls", async () => {
  const source = await read("lib/verification/skin-v1-menu-contract-audit.mjs");
  assert.match(source, /async function clickSurfaceReturn/u);
  assert.match(source, /pp-skin-v1-orchestrator-return:visible/u);
  assert.match(source, /await clickSurfaceReturn\(page, "Back to Settings"\)/u);
  assert.match(source, /await clickSurfaceReturn\(page, "Back to Story Mode"\)/u);
  assert.match(source, /await clickSurfaceReturn\(page, "Back to Dashboard"\)/u);
});


test("#2226 declared parent returns terminate at the real Settings and Story Mode owners", async () => {
  const [orchestrator, dashboard, storyMode] = await Promise.all([
    read("app/skin-v1/surface-orchestrator.tsx"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1/story-mode-host.tsx"),
  ]);

  assert.match(orchestrator, /plotpickle:return-surface/u);
  assert.match(orchestrator, /parentSurface: active\.parent/u);
  assert.match(orchestrator, /active\.parent === "settings" \|\| active\.parent === "story-mode"/u);

  assert.match(dashboard, /addEventListener\("plotpickle:return-surface"/u);
  assert.match(dashboard, /parentSurface !== "settings"/u);
  assert.match(dashboard, /setSettingsWorkspace\(null\)/u);
  assert.match(dashboard, /setStoryModeOpen\(false\)/u);
  assert.match(dashboard, /setNodeInfoOpen\(false\)/u);
  assert.match(dashboard, /setPlotPickleAgentsOpen\(false\)/u);
  assert.match(dashboard, /setSettingsMenuOpen\(true\)/u);

  assert.match(storyMode, /addEventListener\("plotpickle:return-surface"/u);
  assert.match(storyMode, /parentSurface === "story-mode"/u);
  assert.match(storyMode, /setView\("landing"\)/u);
});
