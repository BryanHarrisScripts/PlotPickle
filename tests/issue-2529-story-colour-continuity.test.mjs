import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2529 centralizes the exact five-state story palette for every shared story-navigation map", async () => {
  const css = await read("app/skin-v1/preproduction-matrix-contract.css");

  assert.match(css, /\[data-skin-v1-story-navigation-map\] \[data-progressive-story-map="24x96"\]/u);
  assert.match(css, /\[data-skin-v1-previs-map-review="true"\] \[data-progressive-story-map="24x96"\]/u);
  assert.match(css, /--story-defined: #35d779/u);
  assert.match(css, /--story-observed: #3bb8ff/u);
  assert.match(css, /--story-emerging: #f6a93b/u);
  assert.match(css, /--story-missing: #ff4d6d/u);
  assert.match(css, /--story-locked: #a875ff/u);
});

test("#2529 preserves the canonical status-label mapping used by Outline and every downstream surface", async () => {
  const map = await read("modules/build/ui/progressive-story-map.tsx");

  assert.match(map, /defined: "DEFINED"/u);
  assert.match(map, /observed: "OBSERVED"/u);
  assert.match(map, /emerging: "EMERGING"/u);
  assert.match(map, /missing: "AVAILABLE"/u);
  assert.match(map, /locked: "BLOCKED"/u);

  for (const label of ["Outline", "Storyboard", "Previs", "Timeline", "Rough Cut", "Foley", "Narration", "Music", "Screening"]) {
    assert.ok(map.includes(`"${label}"`), `Missing shared Story Map surface label: ${label}`);
  }
});

test("#2529 all canonical Act rails use the same four-column geometry and active treatment", async () => {
  const css = await read("app/skin-v1/preproduction-review-flow.css");

  assert.match(css, /\[data-story-act-rail="four-acts"\] \{/u);
  assert.match(css, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/u);
  assert.match(css, /\[data-story-act-rail="four-acts"\] button\[aria-current="page"\]/u);
  assert.match(css, /background:var\(--pp-skin-fill-row-hover\)/u);
  assert.doesNotMatch(
    css,
    /:is\(\[data-dashboard-review-surface="outline"\], \[data-dashboard-review-surface="storyboard"\], \[data-dashboard-review-surface="previs"\]\) \[data-story-act-rail="four-acts"\]/u,
  );
});

test("#2529 every downstream surface still consumes the same shared Story Map address shell", async () => {
  const [host, surfaces] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("app/skin-v1/preproduction-review-surfaces.tsx"),
  ]);

  for (const label of ["Timeline", "Rough Cut", "Screening"]) {
    assert.match(host, new RegExp(`surfaceLabel="${label}"`, "u"));
  }
  assert.match(host, /surfaceLabel=\{storyNavigationLabel\}/u);
  assert.match(host, /storyNavigationLabel = soundOpen === "narration" \? "Narration" : soundOpen === "music" \? "Music" : "Foley"/u);
  assert.match(surfaces, /data-skin-v1-story-navigation-map=\{surfaceLabel\.toLowerCase\(\)\.replaceAll\(" ", "-"\)\}/u);
  assert.match(surfaces, /data-skin-v1-previs-map-review="true"/u);
});
