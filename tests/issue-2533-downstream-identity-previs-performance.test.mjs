import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

test("#2533 downstream shells own the embedded Story Map so orchestrator identity cannot fall back to Outline", async () => {
  const registry = await readJson("config/skin-v1-surface-registry.json");
  const expected = new Map([
    ["production", "Rough Cut"],
    ["sound-foley", "Foley"],
    ["sound-narration", "Narration"],
    ["sound-music", "Music"],
    ["screening", "Screening"],
  ]);

  for (const [id, label] of expected) {
    const surface = registry.surfaces.find((candidate) => candidate.id === id);
    assert.ok(surface, `Missing registered surface ${id}`);
    assert.equal(surface.label, label);
    assert.deepEqual(surface.ownsInlineSurfaces, ["story-map"], `${label} must own its embedded shared Story Map`);
  }

  const timeline = registry.surfaces.find((candidate) => candidate.id === "scene-timeline");
  const previs = registry.surfaces.find((candidate) => candidate.id === "previs");
  assert.ok(timeline?.ownsInlineSurfaces?.includes("story-map"));
  assert.ok(previs?.ownsInlineSurfaces?.includes("story-map"));
});

test("#2533 surface orchestrator excludes owned inline surfaces before depth ranking", async () => {
  const orchestrator = await read("app/skin-v1/surface-orchestrator.tsx");
  assert.match(orchestrator, /ownedInlineSurfaceIds/u);
  assert.match(orchestrator, /routeCandidates\.flatMap\(\(surface\) => surface\.ownsInlineSurfaces \?\? \[\]\)/u);
  assert.match(orchestrator, /routeCandidates\.filter\(\(surface\) => !ownedInlineSurfaceIds\.has\(surface\.id\)\)/u);
});

test("#2533 downstream host still exposes exact local identity and shared Story Map labels", async () => {
  const host = await read("app/skin-v1/dashboard-bbs-review-host.tsx");

  assert.match(host, /<h1>ROUGH CUT<\/h1>/u);
  assert.match(host, /surfaceLabel="Rough Cut"/u);
  assert.match(host, /soundOpen === "narration" \? "NARRATION" : soundOpen === "music" \? "MUSIC" : "FOLEY"/u);
  assert.match(host, /storyNavigationLabel = soundOpen === "narration" \? "Narration" : soundOpen === "music" \? "Music" : "Foley"/u);
  assert.match(host, /<h1>SCREENING<\/h1>/u);
  assert.match(host, /surfaceLabel="Screening"/u);
});

test("#2533 memoizes immutable Storyboard evidence projections by project object for Previs first-open work", async () => {
  const editorial = await read("app/_components/storyboard/storyboard-editorial-model.ts");

  for (const cache of [
    "SOURCE_EVIDENCE_CACHE",
    "VISUAL_READINESS_CACHE",
    "ANCHOR_EVIDENCE_CACHE",
    "REFERENCE_CANDIDATE_CACHE",
    "DEPENDENCY_SOURCE_KEY_CACHE",
  ]) {
    assert.match(editorial, new RegExp(`const ${cache} = new WeakMap<PPFProject`, "u"));
  }

  assert.match(editorial, /function normalizedSourceEvidence\(project: PPFProject\)/u);
  assert.match(editorial, /SOURCE_EVIDENCE_CACHE\.get\(project\)/u);
  assert.match(editorial, /function cachedVisualReadiness\(project: PPFProject\)/u);
  assert.match(editorial, /VISUAL_READINESS_CACHE\.get\(project\)/u);
  assert.match(editorial, /const cached = projectCache\.get\(cacheKey\);\s*if \(cached\) return cached;/u);
  assert.match(editorial, /const evidence = normalizedSourceEvidence\(project\)/u);
  assert.match(editorial, /const target = cachedVisualReadiness\(project\)\.targets\.find/u);
});

test("#2533 Previs remains one synchronous project hydration owner with no duplicate loading timer", async () => {
  const surfaces = await read("app/skin-v1/preproduction-review-surfaces.tsx");
  const start = surfaces.indexOf("export function SkinV1PrevisCompositeSurface");
  const end = surfaces.indexOf("export function SkinV1TimelineReviewSurface", start);
  const previs = surfaces.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.match(previs, /useState<LibraryPPFProject \| null>\(\(\) => loadFoundationProject\(\)\)/u);
  assert.doesNotMatch(previs, /setTimeout|Opening Previs Story Map|Opening canonical Previs projection/u);
  assert.match(previs, /surfaceLabel="Previs"/u);
  assert.match(previs, /<PrevisReadinessWorkspace/u);
});

test("#2533 browser continuity profile covers every Human-tested downstream identity", async () => {
  const probe = await read("lib/verification/browser-probes/continuity.mjs");
  for (const tuple of [
    '{ id: "timeline", menuId: "timeline", governed: "scene-timeline" }',
    '{ id: "sound-foley", menuId: "sound-foley", governed: "sound-foley" }',
    '{ id: "sound-narration", menuId: "sound-narration", governed: "sound-narration" }',
    '{ id: "sound-music", menuId: "sound-music", governed: "sound-music" }',
    '{ id: "production", menuId: "production", governed: "production" }',
    '{ id: "screening", menuId: "screening", governed: "screening" }',
  ]) assert.ok(probe.includes(tuple), `Continuity browser profile missing ${tuple}`);
  assert.match(probe, /expectedLabel: surface\.label/u);
  assert.match(probe, /settled-orchestrator-surface-label/u);
});
