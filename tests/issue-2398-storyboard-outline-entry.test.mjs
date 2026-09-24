import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2398 starts Matrix Storyboard with Outline's Act rail and canonical map", async () => {
  const [host, surfaces, map] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("app/skin-v1/preproduction-review-surfaces.tsx"),
    read("modules/build/ui/progressive-story-map.tsx"),
  ]);
  const storyboard = host.slice(host.indexOf("if (storyboardOpen)"), host.indexOf("if (previsOpen)"));
  const rail = storyboard.indexOf("<StoryActRail");
  const storyMap = storyboard.indexOf("<SkinV1StoryboardStoryMap");
  const detail = storyboard.indexOf("<SkinV1StoryboardReviewSurface");
  assert.ok(rail >= 0 && storyMap > rail && detail > storyMap);
  assert.match(storyboard, /onOpen=\{\(act\) => updateReviewAddress\("storyboard", \{ blockNumber: \(act - 1\) \* 6 \+ 1, miniBlockNumber: 1 \}\)\}/);
  assert.match(surfaces, /<ProgressiveStoryMap[\s\S]*?navigationOnly[\s\S]*?surfaceLabel="Storyboard"[\s\S]*?onSelectAddress=\{onAddressChange\}/);
  assert.match(map, /sequences\.filter\(\(sequence\) => !act \|\| Math\.ceil\(sequence\.number \/ 3\) === act\)/);
});

test("#2398 keeps one selected address across map, Storyboard detail and standalone route", async () => {
  const [surfaces, detail, standalone] = await Promise.all([
    read("app/skin-v1/preproduction-review-surfaces.tsx"),
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("app/storyboard/page.tsx"),
  ]);
  assert.match(surfaces, /key=\{`\$\{project\.id\}-storyboard-act-\$\{act\}`\}/);
  assert.match(surfaces, /initialBlockNumber=\{normalized\.blockNumber\}[\s\S]*?initialMiniBlockNumber=\{normalized\.miniBlockNumber\}/);
  assert.match(surfaces, /embeddedNavigation[\s\S]*?onAddressChange=\{onAddressChange\}/);
  assert.match(detail, /\[initialBlockNumber, initialMiniBlockNumber\]/);
  assert.match(detail, /!embeddedNavigation \? <nav aria-label="Storyboard Acts"/);
  assert.match(detail, /preserveStoryboardAddress\(block, mini\)/);
  assert.match(standalone, /<StoryboardReadinessWorkspace/);
  assert.doesNotMatch(standalone, /embeddedNavigation/);
});
