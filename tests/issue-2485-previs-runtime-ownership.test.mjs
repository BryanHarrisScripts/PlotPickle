import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

test("#2485 moves inline surface ownership into the canonical registry", async () => {
  const [registry, orchestrator] = await Promise.all([
    readJson("config/skin-v1-surface-registry.json"),
    read("app/skin-v1/surface-orchestrator.tsx"),
  ]);
  const storyboard = registry.surfaces.find((surface) => surface.id === "storyboard");
  const previs = registry.surfaces.find((surface) => surface.id === "previs");

  assert.deepEqual(storyboard?.ownsInlineSurfaces, ["story-map", "visual-story"]);
  assert.deepEqual(previs?.ownsInlineSurfaces, ["story-map"]);
  assert.equal(previs?.label, "Previs");
  assert.match(orchestrator, /ownsInlineSurfaces\?: string\[\]/u);
  assert.match(orchestrator, /routeCandidates\.flatMap\(\(surface\) => surface\.ownsInlineSurfaces \?\? \[\]\)/u);
  assert.match(orchestrator, /routeCandidates\.filter\(\(surface\) => !ownedInlineSurfaceIds\.has\(surface\.id\)\)/u);
  assert.doesNotMatch(orchestrator, /storyboardOwnsInlineChildren/u);
});

test("#2485 validates inline ownership ids and canonical Previs naming", async () => {
  const [loader, declarations, continuity] = await Promise.all([
    read("lib/verification/skin-v1-surface-registry.mjs"),
    readJson("config/skin-v1-surface-declarations/standard-surfaces.json"),
    readJson("config/ui-continuity-agent-registry.json"),
  ]);

  assert.match(loader, /must declare unique ownsInlineSurfaces ids/u);
  assert.match(loader, /cannot own itself as an inline surface/u);
  assert.match(loader, /owns unknown inline surface/u);
  assert.equal(declarations.surfaces.previs.label, "Previs");
  assert.equal(continuity.screens.find((screen) => screen.id === "previs")?.label, "Previs");
});

test("#2485 live continuity proves the settled Option 1 stage identity", async () => {
  const probe = await read("lib/verification/browser-probes/continuity.mjs");

  assert.match(probe, /normal-dashboard-stage-open-after-orchestrator-settle/u);
  assert.match(probe, /data-skin-v1-active-surface/u);
  assert.match(probe, /settled-orchestrator-surface-identity/u);
  assert.match(probe, /settled-orchestrator-surface-label/u);
  assert.match(probe, /\{ id: "previs", menuId: "previs", governed: "previs" \}/u);
  assert.match(probe, /\[data-progressive-story-map='24x96'\]:visible/u);
  assert.match(probe, /previs-shared-story-map-remains-visible/u);
});
