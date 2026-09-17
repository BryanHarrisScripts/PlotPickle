import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relative) => readFile(new URL(`../${relative}`, import.meta.url), "utf8");

test("#2164 keeps Library Load for saved stories and provides an actionable Afterglow handoff", async () => {
  const [workspace, discoveryCss] = await Promise.all([
    read("modules/library/ui/library-workspace.tsx"),
    read("app/skin-v1/library-writer-discovery.css"),
  ]);

  assert.match(workspace, /data-library-surface="load"[\s\S]*data-library-reference-handoff="examples"/u);
  assert.match(workspace, /Looking for Afterglow\?/u);
  assert.match(workspace, /setDestination\("examples"\)/u);
  assert.match(workspace, /<h3>\{item\.title\}<\/h3>/u);
  assert.match(discoveryCss, /AFTERGLOW: REFLECTIONS OF SENTIENCE/u);
  assert.match(discoveryCss, /PACIFIC ROAD · AI FAMILY · VISUAL REFERENCE/u);
  assert.doesNotMatch(discoveryCss, /data-library-surface="load"\]::before/u);
});

test("#2164 explains the unchanged structural score without judging creative quality", async () => {
  const panel = await read("app/skin-v1/plotpickle-score-panel.tsx");

  assert.match(panel, /balances all five structural dimensions geometrically/u);
  assert.match(panel, /Verbosity and Erosion are inverted because lower is better/u);
  assert.match(panel, /not a judgment of creative quality/u);
});

test("#2164 presents four Act rows and projects only real selected Mini-Block passages", async () => {
  const [surface, flowCss] = await Promise.all([
    read("app/skin-v1/matrix-story-map-surface.tsx"),
    read("app/skin-v1/preproduction-review-flow.css"),
  ]);

  assert.match(flowCss, /grid-template-columns: repeat\(3, minmax\(250px, 1fr\)\)/u);
  assert.match(flowCss, /grid-template-rows: repeat\(4, minmax\(0, auto\)\)/u);
  assert.match(surface, /passage\.blockNumber === address\.blockNumber/u);
  assert.match(surface, /passage\.miniBlockNumber === address\.miniBlockNumber/u);
  assert.match(surface, /WRITTEN STORY[\s\S]*STORYBOARD[\s\S]*PREVIS/u);
  assert.match(surface, /leaves it empty rather than inventing story text/u);
  assert.match(surface, /View the whole Block source/u);
  assert.match(flowCss, /aria-label\$="local workflow"[\s\S]*display: none !important/u);
});

test("#2164 teaches Storyboard relationships and preserves the existing view identities", async () => {
  const [surface, flowCss] = await Promise.all([
    read("app/skin-v1/matrix-story-map-surface.tsx"),
    read("app/skin-v1/preproduction-review-flow.css"),
  ]);

  assert.match(surface, /Block \/ Mini-Block[\s\S]*Scene \/ Beat[\s\S]*Shot \/ Frame/u);
  assert.match(surface, /variable-density, not a forced one-to-one ladder/u);
  assert.match(flowCss, /data-visual-story-view="story"\]::after[\s\S]*content: "SCENE & SHOTS"/u);
  assert.match(flowCss, /data-visual-story-view="timeline"\]::after[\s\S]*content: "TIMELINE"/u);
});

test("#2164 derives Previs coverage from existing candidate and accepted visual evidence", async () => {
  const [surfaces, runtime] = await Promise.all([
    read("app/skin-v1/preproduction-review-surfaces.tsx"),
    read("app/skin-v1-runtime.tsx"),
  ]);

  assert.match(surfaces, /project\.build\.foundations\.visualArtifacts/u);
  assert.match(surfaces, /project\.build\.world\.visualArtifacts/u);
  assert.match(surfaces, /acceptedVisualArtifactIds/u);
  assert.match(surfaces, /state: accepted \? "accepted" : candidates\.length \? "candidate" : "missing"/u);
  assert.match(surfaces, /Start with what you can already see/u);
  assert.match(runtime, /import "\.\/skin-v1\/previs-visual-coverage\.css"/u);
});
