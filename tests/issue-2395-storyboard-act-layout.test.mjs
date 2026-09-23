import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2395 keeps Act and Mini-Block selection connected to the preproduction address", async () => {
  const [workspace, wrapper, css] = await Promise.all([
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("app/skin-v1/preproduction-review-surfaces.tsx"),
    read("app/_components/storyboard/storyboard-readiness-workspace.module.css"),
  ]);
  assert.match(workspace, /aria-label="Storyboard Acts"/);
  assert.match(workspace, /const firstBlock = \(act - 1\) \* 6 \+ 1/);
  assert.match(workspace, /actBlocks = blocks\.filter/);
  assert.match(workspace, /selectStoryboardAddress\(number, 1\)/);
  assert.match(workspace, /selectStoryboardAddress\(selectedNumber, miniNumber\)/);
  assert.match(workspace, /onAddressChange\?\.\(\{ blockNumber: block, miniBlockNumber: mini \}\)/);
  assert.match(wrapper, /onAddressChange=\{onAddressChange\}/);
  assert.match(css, /\.actRail \{ grid-template-columns: repeat\(4/);
  assert.match(css, /\.tabRail \{ grid-template-columns: repeat\(6/);
  assert.match(css, /\.footer \{\s*width: 100%/);
});

test("#2395 presents real Scenes, Beats and existing visuals without making 25 videos", async () => {
  const [workspace, editorial] = await Promise.all([
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("app/_components/storyboard/storyboard-editorial-workspace.tsx"),
  ]);
  assert.match(workspace, /projectPreproductionSemantics\(project, legacyProject\)/);
  assert.match(workspace, /sceneIds\.includes\(scene\.id\)/);
  assert.match(workspace, /selectedVisualAnchor\?\.beats\.length/);
  assert.match(workspace, /selectedVisualAnchor\?\.frames\.map/);
  assert.match(workspace, /miniReferences\.filter/);
  assert.match(workspace, /Array\.from\(\{ length: 25 \}/);
  assert.match(workspace, /no image or video quota/);
  assert.match(workspace, /No authored Beat is mapped/);
  assert.doesNotMatch(workspace, /createStoryboardReferenceArtifact\(/);
  assert.match(editorial, /<details className=\{styles\.sourceEvidence\}/);
});
