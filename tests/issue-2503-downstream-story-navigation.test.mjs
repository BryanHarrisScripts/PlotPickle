import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function section(source, from, to) {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start, `Missing section ${from}`);
  return source.slice(start, end);
}

test("#2503 Timeline and Rough Cut use the shared Act / Block / Mini-Block story navigation shell", async () => {
  const host = await read("app/skin-v1/dashboard-bbs-review-host.tsx");
  const timeline = section(host, "if (timelineOpen)", "if (productionOpen)");
  const roughCut = section(host, "if (productionOpen)", "if (openSourceOpen)");

  for (const [source, label] of [[timeline, "Timeline"], [roughCut, "Rough Cut"]]) {
    assert.match(source, /<StoryActRail activeAct=/u);
    assert.match(source, /<SkinV1StoryboardStoryMap/u);
    assert.match(source, new RegExp(`surfaceLabel="${label}"`, "u"));
    assert.match(source, /Back to Dashboard/u);
    assert.doesNotMatch(source, /<PreproductionStageRail/u);
  }
});

test("#2503 Foley Narration Music and Screening share the same story navigation grammar", async () => {
  const host = await read("app/skin-v1/dashboard-bbs-review-host.tsx");
  const sound = section(host, "if (soundOpen)", "if (screeningOpen)");
  const screening = section(host, "if (screeningOpen)", "if (discoveryOpen)");

  assert.match(sound, /storyNavigationLabel = soundOpen === "narration" \? "Narration" : soundOpen === "music" \? "Music" : "Foley"/u);
  assert.match(sound, /<StoryActRail activeAct=/u);
  assert.match(sound, /surfaceLabel=\{storyNavigationLabel\}/u);
  assert.match(sound, /<SkinV1StoryboardStoryMap/u);
  assert.match(sound, /Back to Dashboard/u);

  assert.match(screening, /<StoryActRail activeAct=/u);
  assert.match(screening, /surfaceLabel="Screening"/u);
  assert.match(screening, /<SkinV1StoryboardStoryMap/u);
  assert.match(screening, /Back to Dashboard/u);
});

test("#2503 downstream labels are first-class consumers of the same Progressive Story Map status colours", async () => {
  const [map, css, surfaces] = await Promise.all([
    read("modules/build/ui/progressive-story-map.tsx"),
    read("modules/build/ui/progressive-story-map.module.css"),
    read("app/skin-v1/preproduction-review-surfaces.tsx"),
  ]);

  for (const label of ["Timeline", "Rough Cut", "Foley", "Narration", "Music", "Screening"]) {
    assert.ok(map.includes(`"${label}"`), `Missing shared Story navigation label ${label}`);
  }
  assert.match(surfaces, /surfaceLabel\?: StoryNavigationSurfaceLabel/u);
  assert.match(surfaces, /data-skin-v1-story-navigation-map/u);
  for (const state of ["defined", "observed", "emerging", "missing", "locked"]) {
    assert.match(css, new RegExp(`\\[data-state="${state}"\\]`, "u"));
  }
});

test("#2503 downstream projections hydrate before first paint and subscribe without a second mount-time load", async () => {
  const surfaces = await read("app/skin-v1/preproduction-review-surfaces.tsx");
  const storyMap = section(surfaces, "export function SkinV1StoryboardStoryMap", "export function SkinV1PrevisCompositeSurface");
  const timeline = section(surfaces, "export function SkinV1TimelineReviewSurface", "export function SkinV1ProductionReviewSurface");
  const production = section(surfaces, "export function SkinV1ProductionReviewSurface", "export function SkinV1SoundReviewSurface");
  const sound = section(surfaces, "export function SkinV1SoundReviewSurface", "export function SkinV1ScreeningReviewSurface");
  const screening = section(surfaces, "export function SkinV1ScreeningReviewSurface", "export function SkinV1BuildReviewSurface");

  for (const source of [storyMap, timeline, production, sound, screening]) {
    assert.match(source, /useState<[^>]+ \| null>\(\(\) => loadFoundationProject\(\)\)/u);
    assert.match(source, /const sync = \(\) =>/u);
    assert.match(source, /FOUNDATION_PROJECT_SAVED_EVENT/u);
    assert.doesNotMatch(source, /\n\s*sync\(\);\n/u);
    assert.doesNotMatch(source, /window\.setTimeout\(sync, 0\)/u);
  }
});

test("#2503 inner downstream workspaces do not expose a second competing Mini-Block selector", async () => {
  const surfaces = await read("app/skin-v1/preproduction-review-surfaces.tsx");
  const timeline = section(surfaces, "export function SkinV1TimelineReviewSurface", "export function SkinV1ProductionReviewSurface");
  const production = section(surfaces, "export function SkinV1ProductionReviewSurface", "export function SkinV1SoundReviewSurface");
  const sound = section(surfaces, "export function SkinV1SoundReviewSurface", "export function SkinV1ScreeningReviewSurface");

  assert.doesNotMatch(timeline, /Timeline Mini-Block address|pp-skin-v1-preproduction-address-rail/u);
  assert.doesNotMatch(production, /Rough Cut Mini-Block address|pp-skin-v1-production-addresses/u);
  assert.doesNotMatch(sound, /Mini-Block address|pp-skin-v1-preproduction-address-rail/u);
});


test("#2503 Timeline owns its inline Story Map for deterministic WebMCP surface detection", async () => {
  const [registryText, canonical, catalogue] = await Promise.all([
    read("config/skin-v1-surface-registry.json"),
    read("lib/verification/webmcp-canonical-surface-registry.mjs"),
    read("lib/verification/webmcp-standard-surface-catalogue.mjs"),
  ]);
  const registry = JSON.parse(registryText);
  const timeline = registry.surfaces.find((surface) => surface.id === "scene-timeline");
  assert.deepEqual(timeline?.ownsInlineSurfaces, ["story-map"]);
  assert.match(canonical, /ownsInlineSurfaces: Object\.freeze/u);
  assert.match(catalogue, /const inlineOwner = visibleContracts\.find/u);
  assert.match(catalogue, /contract\.ownsInlineSurfaces/u);
  assert.doesNotMatch(catalogue, /const storyboardOwner = visibleContracts\.find/u);
});
