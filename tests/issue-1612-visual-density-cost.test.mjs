import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { browserRoutes, visualSurfacePaths } from "../scripts/performance/measure-browser-responsiveness.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("#1411 Slice E measures only implemented dense visual story surfaces", () => {
  assert.deepEqual(visualSurfacePaths, [
    { label: "library-reference-cards", path: "/library" },
    { label: "build-24x96", path: "/?workspace=build" },
    { label: "storyboard-24x96", path: "/storyboard" },
    { label: "story-workbench-preview", path: "/story-workbench" },
  ]);
  assert.ok(browserRoutes.some((route) => route.label === "storyboard" && route.path === "/storyboard"));
});

test("#1411 Slice E records payload, image and DOM density without inventing a threshold", async () => {
  const source = await read("scripts/performance/measure-browser-responsiveness.mjs");
  for (const contract of [
    "Network.requestWillBeSent",
    "Network.loadingFinished",
    "encodedDataLength",
    "imageRequestCount",
    "mediaRequestCount",
    "resourceSummary",
    "domNodeCount",
    "imageElementCount",
    "lazyImageElementCount",
    "headless-browser-cdp-visual-density-profile",
    "evidence-only-no-ratified-threshold",
  ]) assert.ok(source.includes(contract), `visual density evidence is missing: ${contract}`);
  assert.doesNotMatch(source, /visualStory[^\n]*(?:budget|threshold)\s*[<>=]/i);
});

test("#1411 Slice E ties BUILD and Storyboard measurement to their canonical 24/96 DOM contracts", async () => {
  const [measurement, build, storyboard] = await Promise.all([
    read("scripts/performance/measure-browser-responsiveness.mjs"),
    read("modules/build/ui/progressive-story-map.tsx"),
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
  ]);

  assert.match(build, /data-progressive-story-map="24x96"/);
  assert.match(build, /button[^>]*data-canonical-story-id=\{block\.id\}/);
  assert.match(build, /aria-label=\{`Mini-Block \$\{mini\.number\}/);
  assert.match(measurement, /profile\.blockCount === 24 && profile\.miniBlockCount === 96/);

  assert.match(storyboard, /aria-label="Storyboard Block tabs"/);
  assert.match(storyboard, /<dd>96<\/dd>/);
  assert.match(storyboard, /data-story-decision-target=\{storyboardAnchorTargetRef/);
  assert.match(measurement, /profile\.storyboardBlockTabCount === 24/);
  assert.match(measurement, /profile\.visibleMiniBlockAnchorCount === 4/);
  assert.match(measurement, /profile\.declaredVisualAnchorCount === 96/);
});

test("#1411 Slice E keeps Workbench projection evidence and Storyboard lazy imagery observable", async () => {
  const [workbench, storyboard, measurement] = await Promise.all([
    read("app/story-workbench/page.tsx"),
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("scripts/performance/measure-browser-responsiveness.mjs"),
  ]);
  assert.match(workbench, /data-projection-impact=\{impact\.state\}/);
  assert.match(storyboard, /loading="lazy"/);
  assert.match(measurement, /projectionImpactCount/);
  assert.match(measurement, /lazyImageElementCount/);
  assert.match(measurement, /Storyboard exposes 96 canonical visual addresses but renders only the selected Block's four Mini-Block anchor cards/);
});
