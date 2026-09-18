import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  WEBMCP_DASHBOARD_DESTINATION_COVERAGE,
  WEBMCP_STANDARD_SURFACE_REGISTRY,
  WEBMCP_STANDARD_SURFACE_TARGETS,
} from "../lib/verification/webmcp-surface-capture-registry.mjs";
import {
  canonicalContinuityIds,
  canonicalWebMcpSurfaceIds,
  projectUiContinuityScreens,
} from "../lib/verification/skin-v1-surface-registry.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

test("#2189 restores Write to canonical UI Continuity ownership", async () => {
  const [skin, continuity] = await Promise.all([
    readJson("config/skin-v1-surface-registry.json"),
    readJson("config/ui-continuity-agent-registry.json"),
  ]);
  const write = skin.surfaces.find((surface) => surface.id === "write");

  assert.ok(write);
  assert.deepEqual(write.continuityIds, ["write"]);
  assert.equal(write.capturePolicy, "standard");
  assert.equal(write.webmcpId, "write");
  assert.ok(canonicalContinuityIds().includes("write"));
  assert.deepEqual(projectUiContinuityScreens(continuity).map((screen) => screen.id), [...canonicalContinuityIds()]);
});

test("#2189 keeps legacy Reports /production visible to audits but out of the canonical UAT capture chain", async () => {
  const [continuity, sitemap] = await Promise.all([
    readJson("config/ui-continuity-agent-registry.json"),
    read("app/navigation/sitemap-route-context.ts"),
  ]);
  const reports = continuity.screens.find((screen) => screen.id === "reports");

  assert.equal(reports?.path, "/production");
  assert.equal(reports?.migrationClass, "legacy");
  assert.match(sitemap, /export type SitemapMigrationClass = "canonical" \| "contextual" \| "legacy" \| "public-exception"/u);
  assert.match(sitemap, /"\/production": \{[\s\S]*?migrationClass: "legacy"/u);
  assert.match(sitemap, /Legacy project authority; excluded from the canonical Writer-to-Screen UAT path/u);
  assert.equal(WEBMCP_STANDARD_SURFACE_TARGETS.includes("reports"), false);
  assert.ok(WEBMCP_DASHBOARD_DESTINATION_COVERAGE.currentlyUnwired.includes("reports"));
});

test("#2189 promotes the rebuilt Human UAT surfaces into the one canonical WebMCP registry", () => {
  for (const id of ["write", "storyboard", "previs", "pageflow"]) {
    assert.ok(WEBMCP_STANDARD_SURFACE_TARGETS.includes(id), `${id} should be a standard UAT capture`);
    assert.equal(WEBMCP_STANDARD_SURFACE_REGISTRY[id].id, id);
    assert.match(WEBMCP_STANDARD_SURFACE_REGISTRY[id].approval, /#2189/u);
    assert.ok(WEBMCP_STANDARD_SURFACE_REGISTRY[id].route, `${id} should use its real Human UAT route`);
  }

  assert.equal(WEBMCP_STANDARD_SURFACE_REGISTRY.write.route, "/?workspace=write&block=17&mini=1");
  assert.equal(WEBMCP_STANDARD_SURFACE_REGISTRY.storyboard.route, "/storyboard?block=17&mini=1");
  assert.equal(WEBMCP_STANDARD_SURFACE_REGISTRY.previs.route, "/previs?block=17&mini=1");
  assert.equal(WEBMCP_STANDARD_SURFACE_REGISTRY.pageflow.route, "/pageflow?block=17&mini=1");
  assert.deepEqual([...canonicalWebMcpSurfaceIds()], WEBMCP_STANDARD_SURFACE_TARGETS);
});

test("#2189 WebMCP catalogue and Visual Director both understand route-backed captures", async () => {
  const [catalogue, director] = await Promise.all([
    read("lib/verification/webmcp-standard-surface-catalogue.mjs"),
    read("lib/verification/skin-v1-visual-director.mjs"),
  ]);

  assert.match(catalogue, /if \(contract\.route\)/u);
  assert.match(catalogue, /page\.goto\(new URL\(contract\.route, server\)/u);
  assert.match(catalogue, /await installCatalogueWebMcp\(page, toolRoot\)/u);
  assert.match(catalogue, /routeMatchesLocation/u);
  assert.match(catalogue, /expected\.pathname !== location\.pathname/u);
  assert.match(director, /if \(contract\.route\)/u);
  assert.match(director, /page\.goto\(new URL\(contract\.route, server\)/u);
  assert.match(director, /analyzeVisualContinuity\(dashboard, await navigateAndCollect\(page, surface, server\)\)/u);
});

test("#2189 pins the visible Story Map handoffs used by Human UAT", async () => {
  const storyMap = await read("app/skin-v1/matrix-story-map-surface.tsx");

  for (const action of ["write", "pageflow", "storyboard", "previs"]) {
    assert.match(storyMap, new RegExp(`data-writer-story-action=["']${action}["']`, "u"));
  }
  assert.match(storyMap, /workspace=write&block=\$\{address\.blockNumber\}&mini=\$\{address\.miniBlockNumber\}/u);
  assert.match(storyMap, /\/pageflow\?block=\$\{address\.blockNumber\}&mini=\$\{address\.miniBlockNumber\}/u);
  assert.match(storyMap, /onOpenStage\?\.\("storyboard", address\)/u);
  assert.match(storyMap, /onOpenPrevis\?\.\(address\)/u);
});

test("#2189 keeps all added visual references as Human-review candidates", async () => {
  const manifest = await readJson("tests/visual-baselines/skin-v1/manifest.json");
  for (const id of ["write", "storyboard", "previs", "pageflow"]) {
    assert.equal(manifest.surfaces[id]?.status, "candidate");
    assert.equal(manifest.surfaces[id]?.selector, WEBMCP_STANDARD_SURFACE_REGISTRY[id].rootSelector);
  }
  assert.equal(manifest.surfaces.dashboard.status, "locked");
});


test("#2189 canonical Storyboard routes no longer read the legacy browser project store", async () => {
  const [route, skin] = await Promise.all([
    read("app/storyboard/page.tsx"),
    read("app/skin-v1/preproduction-review-surfaces.tsx"),
  ]);

  for (const source of [route, skin]) {
    assert.doesNotMatch(source, /plotpickle\.project\.v1|localStorage|getItem\(|normalizePlotPickleProject|legacySceneProjectionSource/u);
  }
  assert.match(route, /legacyProject=\{null\}/u);
  assert.match(skin, /legacyProject=\{null\}/u);
});

test("#2189 routed capture roots match the actual standalone Storyboard and Previs surfaces", async () => {
  const [storyboard, previs] = await Promise.all([
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("app/_components/previs/previs-readiness-workspace.tsx"),
  ]);

  assert.match(storyboard, /<main className=\{styles\.workspace\} aria-labelledby="storyboard-readiness-title">/u);
  assert.match(previs, /<main className=\{styles\.workspace\} aria-labelledby="previs-title">/u);
  assert.match(previs, /id="previs-block-panel"/u);
  assert.equal(WEBMCP_STANDARD_SURFACE_REGISTRY.storyboard.rootSelector, "main[aria-labelledby='storyboard-readiness-title']");
  assert.equal(WEBMCP_STANDARD_SURFACE_REGISTRY.previs.rootSelector, "main[aria-labelledby='previs-title']");
  assert.equal(WEBMCP_STANDARD_SURFACE_REGISTRY.previs.readySelector, "#previs-block-panel");
});


test("#2189 lets only the current Block-native Write deep link bypass the default Skin V1 startup redirect", async () => {
  const [proxy, startupRegression] = await Promise.all([
    read("proxy.ts"),
    read("tests/issue-1754-startup-no-legacy-flash.test.mjs"),
  ]);

  assert.match(proxy, /if \(searchParams\.get\("workspace"\) === "write"\) return NextResponse\.next\(\)/u);
  assert.match(proxy, /destination\.pathname = "\/skin-v1"/u);
  assert.match(proxy, /if \(searchParams\.get\("skin"\) === "legacy"\) return NextResponse\.next\(\)/u);
  assert.match(startupRegression, /default startup reaches Skin V1 before Legacy Skin can render/u);
  assert.doesNotMatch(proxy, /if \(searchParams\.has\("workspace"\)\) return NextResponse\.next/u);
});


test("#2189 maps the root startup proxy into existing Experience Contract ownership", async () => {
  const ownership = await readJson("config/verification/ownership-map.json");
  const startup = ownership.rules.find((rule) => rule.id === "root-story-startup");

  assert.equal(startup?.ownerLayer, "experience-contract");
  assert.ok(startup?.include.includes("app/page.tsx"));
  assert.ok(startup?.include.includes("proxy.ts"));
});
