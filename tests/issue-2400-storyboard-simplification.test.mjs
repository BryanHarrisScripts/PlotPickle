import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2400 enters Storyboard from the Act map without the duplicate stage or visual workspace", async () => {
  const host = await read("app/skin-v1/dashboard-bbs-review-host.tsx");
  const storyboard = host.slice(host.indexOf("if (storyboardOpen)"), host.indexOf("if (previsOpen)"));
  assert.ok(storyboard.indexOf("<StoryActRail") < storyboard.indexOf("<SkinV1StoryboardStoryMap"));
  assert.ok(storyboard.indexOf("<SkinV1StoryboardStoryMap") < storyboard.indexOf("<SkinV1StoryboardReviewSurface"));
  assert.doesNotMatch(storyboard, /<PreproductionStageRail|<BlockVisualJourneyWorkspace/);
  assert.match(storyboard, /onOpenPrevis=\{openPrevis\}/);
  assert.match(host.slice(host.indexOf("if (previsOpen)")), /<BlockVisualJourneyWorkspace/);
});

test("#2400 moves Keep Change Compare into Previs at the selected canonical address", async () => {
  const [storyboard, previs, wrapper, editorial, standalone] = await Promise.all([
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("app/_components/previs/previs-readiness-workspace.tsx"),
    read("app/skin-v1/preproduction-review-surfaces.tsx"),
    read("app/_components/storyboard/storyboard-editorial-workspace.tsx"),
    read("app/storyboard/page.tsx"),
  ]);
  assert.doesNotMatch(storyboard, /<StoryboardEditorialWorkspace/);
  assert.doesNotMatch(storyboard, /onOpenPrevis\(selectedNumber, miniNumber\)/);
  assert.match(storyboard, /<VisualStoryWorkspace[\s\S]*?embedded/);
  assert.match(wrapper, /onOpenPrevis=\{\(blockNumber, miniBlockNumber\) => onOpenPrevis\(\{ blockNumber, miniBlockNumber \}\)\}/);
  assert.match(standalone, /\/previs\?block=\$\{blockNumber\}&mini=\$\{miniBlockNumber\}/);
  assert.match(previs, /deriveVisualReadiness\(\{ project \}\)/);
  assert.match(previs, /storyboardReferenceCandidates\(project, editorialTarget\.id\)\.find\(\(candidate\) => candidate\.miniBlockNumber === selectedMiniBlockNumber\)/);
  assert.match(previs, /<StoryboardEditorialWorkspace[\s\S]*?requestedCandidateId=\{editorialCandidateId\}/);
  assert.match(previs, /onAddressChange\?\.\(\{ blockNumber: anchor\.blockNumber, miniBlockNumber: anchor\.miniBlockNumber \}\)/);
  assert.match(editorial, /saveFoundationProject\(next\)/);
  assert.match(editorial, />Change \/ Try<|>Compare</);
});
