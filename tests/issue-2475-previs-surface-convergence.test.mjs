import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2475 keeps Previs identity explicit from host through the shared Story Map", async () => {
  const [host, surfaces, map] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("app/skin-v1/preproduction-review-surfaces.tsx"),
    read("modules/build/ui/progressive-story-map.tsx"),
  ]);

  assert.match(host, /if \(previsOpen\)[\s\S]*<h1>PREVIS<\/h1>/u);
  assert.match(host, /if \(previsOpen\) onSurfaceNameChange\("PREVIS"\)/u);
  assert.match(surfaces, /data-skin-v1-previs-map-review="true"[\s\S]*surfaceLabel="Previs"/u);
  assert.match(map, /surfaceLabel === "Previs" \? "Previs"/u);
});

test("#2475 applies the same centered four-Act rail contract to Outline, Storyboard and Previs", async () => {
  const css = await read("app/skin-v1/preproduction-review-flow.css");

  assert.match(css, /:is\(\[data-dashboard-review-surface="outline"\], \[data-dashboard-review-surface="storyboard"\], \[data-dashboard-review-surface="previs"\]\) \[data-story-act-rail="four-acts"\][\s\S]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)[\s\S]*margin:var\(--pp-skin-space-4\) auto/u);
  assert.match(css, /\[data-story-act-rail="four-acts"\] button\[aria-current="page"\]/u);
});

test("#2475 removes the duplicate Previs Visual Coverage Mini-Block navigator", async () => {
  const surfaces = await read("app/skin-v1/preproduction-review-surfaces.tsx");

  assert.doesNotMatch(surfaces, /pp-skin-v1-previs-coverage/u);
  assert.doesNotMatch(surfaces, /previs-visual-coverage-title/u);
  assert.doesNotMatch(surfaces, /visualCoverageForBlock/u);
  assert.match(surfaces, /data-skin-v1-preproduction-review="previs"[\s\S]*pp-skin-v1-preproduction-context[\s\S]*<PrevisReadinessWorkspace/u);
});

test("#2475 keeps one shared evidence-state grammar and the real Previs workspace", async () => {
  const [map, workspace] = await Promise.all([
    read("modules/build/ui/progressive-story-map.tsx"),
    read("app/_components/previs/previs-readiness-workspace.tsx"),
  ]);

  assert.match(map, /defined: "DEFINED"/u);
  assert.match(map, /observed: "OBSERVED"/u);
  assert.match(map, /emerging: "EMERGING"/u);
  assert.match(map, /missing: "AVAILABLE"/u);
  assert.match(map, /locked: "BLOCKED"/u);
  assert.match(workspace, /Play Flip Book/u);
  assert.match(workspace, /Play Graphic Novel/u);
  assert.match(workspace, /acceptedVisualIds\.has\(artifact\.id\) && artifact\.reviewState === "accepted"/u);
});
