import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

test("#2489 restores the five-state palette inside Previs", async () => {
  const css = await read("app/skin-v1/preproduction-matrix-contract.css");
  assert.match(css, /\[data-skin-v1-preproduction-review="previs"\] \[data-progressive-story-map="24x96"\]/u);
  assert.match(css, /main\[aria-labelledby="previs-title"\] \[data-progressive-story-map="24x96"\]/u);
  for (const colour of ["#35d779", "#3bb8ff", "#f6a93b", "#ff4d6d", "#a875ff"]) {
    assert.ok(css.includes(colour), "missing evidence colour " + colour);
  }
});

test("#2489 aligns canonical production identity to Rough Cut", async () => {
  const registry = await readJson("config/skin-v1-surface-registry.json");
  const production = registry.surfaces.find((surface) => surface.id === "production");
  assert.equal(production?.label, "Rough Cut");
  assert.equal(production?.navigationPath?.[0]?.label, "Rough Cut");
  assert.equal(production?.runtimeSelector, "[data-skin-v1-preproduction-review='production']");
});

test("#2489 live continuity covers all downstream Dashboard stages after orchestrator settle", async () => {
  const probe = await read("lib/verification/browser-probes/continuity.mjs");
  for (const expected of [
    '{ id: "outline", menuId: "plan", governed: "story-map" }',
    '{ id: "storyboard", menuId: "storyboard", governed: "storyboard" }',
    '{ id: "previs", menuId: "previs", governed: "previs" }',
    '{ id: "timeline", menuId: "timeline", governed: "scene-timeline" }',
    '{ id: "sound-foley", menuId: "sound-foley", governed: "sound-foley" }',
    '{ id: "sound-narration", menuId: "sound-narration", governed: "sound-narration" }',
    '{ id: "sound-music", menuId: "sound-music", governed: "sound-music" }',
    '{ id: "production", menuId: "production", governed: "production" }',
    '{ id: "screening", menuId: "screening", governed: "screening" }',
  ]) assert.ok(probe.includes(expected), "missing live stage: " + expected);

  assert.match(probe, /canonicalSurface\(stage\.governed\)/u);
  assert.match(probe, /surface\.runtimeReadySelector/u);
  assert.match(probe, /expectedLabel: surface\.label/u);
  assert.match(probe, /previs-five-state-colour-grammar/u);
  assert.match(probe, /getComputedStyle\(node\)\.color/u);
});
