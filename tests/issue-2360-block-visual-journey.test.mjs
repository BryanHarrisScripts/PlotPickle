import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

test("#2360 keeps one Block visual workspace across Outline, Storyboard, Previs, Timeline, and Production", async () => {
  const [host, storyMap] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("app/skin-v1/matrix-story-map-surface.tsx"),
  ]);

  assert.match(host, /import BlockVisualJourneyWorkspace/u);
  assert.equal((host.match(/<BlockVisualJourneyWorkspace/g) ?? []).length, 5);
  for (const stage of ["outline", "storyboard", "previs", "timeline", "production"]) {
    assert.match(host, new RegExp('stage="' + stage + '"', "u"));
    assert.match(host, new RegExp('updateReviewAddress\\("' + stage + '"', "u"));
  }
  assert.match(host, /MatrixStoryMapSurface[\s\S]*onAddressChange=\{\(address\) => updateReviewAddress\("outline", address\)\}/u);
  assert.match(storyMap, /readonly onAddressChange\?: \(address: PreproductionReviewAddress\) => void/u);
  assert.match(storyMap, /onAddressChange\?\.\(next\)/u);
});

test("#2360 derives the first real image from a real screenplay passage and stores the submitted prompt with source identity", async () => {
  const visual = await read("app/skin-v1/block-visual-journey-workspace.tsx");

  assert.match(visual, /storyboardAnchorEvidence\(project, targetId\(address\.blockNumber\), address\.miniBlockNumber\)/u);
  assert.match(visual, /Source passage: \$\{text\}/u);
  assert.match(visual, /fetch\("\/api\/local-ai\/generate\/image"/u);
  assert.match(visual, /prompt: submittedPrompt/u);
  assert.doesNotMatch(visual, /prompt:\s*result\.revisedPrompt/u);
  assert.match(visual, /passageKey\(requestPassageId\)/u);
  assert.match(visual, /sequenceKey\(requestAddress, requestPassageId\)/u);
  assert.match(visual, /`source-revision:\$\{project\.revision\}`/u);
  assert.match(visual, /provider: result\.provider \|\| selectedRoute/u);
  assert.match(visual, /model: result\.model \|\| selectedOption\?\.model \|\| ""/u);
  assert.match(visual, /type: "foundations\.visual\.store"/u);
  assert.match(visual, /saveFoundationProject\(next\)/u);
});

test("#2360 requires Human acceptance before sequence generation and preserves partial completed media", async () => {
  const visual = await read("app/skin-v1/block-visual-journey-workspace.tsx");

  assert.match(visual, /function useFirstImage\(\)/u);
  assert.match(visual, /type: "foundations\.visual\.accept"/u);
  assert.match(visual, /!firstImageAccepted/u);
  assert.match(visual, /const neededFrames = \[2, 3\]\.filter/u);
  assert.match(visual, /for \(const frameNumber of neededFrames\)/u);
  assert.match(visual, /parentArtifactId/u);
  assert.match(visual, /completed before the stop/u);
  assert.match(visual, /Retry creates only the missing frame/u);
  assert.equal((visual.match(/type: "foundations\.visual\.accept"/g) ?? []).length, 1);
});

test("#2360 plays the same generated assets as an in-place still-image animatic without inventing timing authority", async () => {
  const visual = await read("app/skin-v1/block-visual-journey-workspace.tsx");

  assert.match(visual, /const PREVIEW_HOLD_MS = 2500/u);
  assert.match(visual, /if \(artifacts\.length < 3\)/u);
  assert.match(visual, /window\.setTimeout/u);
  assert.match(visual, /Playing still-image animatic in place/u);
  assert.match(visual, /Proposed holds are preview data, not approved timing/u);
  assert.doesNotMatch(visual, /build-animatic-studio|lazy-frames-gateway|window\.open|location\.assign/u);
});

test("#2360 persists passage and five-stage context privately and rejects late media against a changed selection", async () => {
  const [visual, context, profile, ownership] = await Promise.all([
    read("app/skin-v1/block-visual-journey-workspace.tsx"),
    read("core/storage/story-map-context.ts"),
    read("core/storage/profile-private-browser.ts"),
    readJson("config/verification/ownership-map.json"),
  ]);

  for (const stage of ["outline", "storyboard", "previs", "timeline", "production"]) {
    assert.ok(context.includes('"' + stage + '"'), "Missing persisted stage " + stage);
  }
  assert.match(context, /passageId\?: string/u);
  assert.match(profile, /previous\.passageId === context\.passageId/u);
  assert.match(visual, /passageId: selectedPassage\.id/u);
  assert.match(visual, /activeSelectionRef\.current/u);
  assert.match(visual, /activeSelection\.projectId !== requestProjectId/u);
  assert.match(visual, /activeSelection\.passageId !== requestPassageId/u);
  assert.match(visual, /did not attach the late result to the new selection/u);

  const persistence = ownership.rules.find((rule) => rule.id === "profile-private-project-persistence");
  assert.ok(persistence?.include.includes("core/storage/story-map-context.ts"));
});
