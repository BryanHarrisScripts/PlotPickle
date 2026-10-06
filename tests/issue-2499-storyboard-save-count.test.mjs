import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("#2499 Storyboard exposes explicit durable Save separate from Lock", async () => {
  const source = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");

  assert.match(source, /STORYBOARD_LOCAL_SAVE_MARKER = "storyboard-local-save:v1"/u);
  assert.match(source, /function storyboardArtifactSavedLocally/u);
  assert.match(source, /artifact\.assetUrl\.startsWith\("\/api\/local-ai\/assets\/"\)/u);
  assert.match(source, /sourceDecisionKeys[\s\S]*STORYBOARD_LOCAL_SAVE_MARKER/u);

  const saveStart = source.indexOf("function saveFrameVersion");
  const reviewStart = source.indexOf("function reviewFrame", saveStart);
  const saveBlock = source.slice(saveStart, reviewStart);
  assert.ok(saveStart >= 0 && reviewStart > saveStart);
  assert.match(saveBlock, /const savedArtifact: FoundationsVisualArtifact = \{[\s\S]*\.\.\.artifact/u);
  assert.match(saveBlock, /type: "foundations\.visual\.store"/u);
  assert.match(saveBlock, /artifact: savedArtifact/u);
  assert.match(saveBlock, /saveFoundationProject\(next\)/u);
  assert.match(saveBlock, /onProjectChange\(next\)/u);
  assert.doesNotMatch(saveBlock, /foundations\.visual\.accept|foundations\.visual\.unaccept/u);

  const loop = source.slice(source.indexOf("Array.from({ length: 25 }"), source.indexOf("{promptPosition !== null"));
  assert.match(loop, />Save<\/button>/u);
  assert.match(loop, /Saved locally/u);
  assert.match(loop, /\{accepted \? "Unlock" : "Lock"\}<\/button>/u);
  assert.match(loop, /savedLocally/u);
  assert.match(loop, /onClick=\{\(\) => selectedArtifact && saveFrameVersion\(selectedArtifact\)\}/u);
});

test("#2499 Lock remains single-select and independent from explicit local Save", async () => {
  const source = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");
  const reviewStart = source.indexOf('function reviewFrame');
  const reviewEnd = source.indexOf('const normalizedSourceEvidence', reviewStart);
  const reviewBlock = source.slice(reviewStart, reviewEnd);

  assert.match(reviewBlock, /candidate\.id !== artifact\.id && candidate\.frameNumber === artifact\.frameNumber/u);
  assert.match(reviewBlock, /foundations\.visual\.unaccept/u);
  assert.match(reviewBlock, /foundations\.visual\.accept/u);
  assert.doesNotMatch(reviewBlock, /STORYBOARD_LOCAL_SAVE_MARKER/u);
});

test("#2772 reload prefers the durably accepted Storyboard image over a newer unlocked candidate", async () => {
  const source = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");
  const loop = source.slice(source.indexOf("Array.from({ length: 25 }"), source.indexOf("{promptPosition !== null"));

  assert.match(loop, /const acceptedPositionArtifact = \[\.\.\.positionArtifacts\]/u);
  assert.match(loop, /artifact\.reviewState === "accepted"/u);
  assert.match(loop, /acceptedVisualArtifactIds\.includes\(artifact\.id\)/u);
  assert.match(loop, /const fallbackImageId = acceptedPositionArtifact\?\.id \?\? latestGeneratedArtifact\?\.id/u);
  assert.match(loop, /const requestedImageId = selectedImageByPosition\[selectionKey\] \?\? ""/u);
});

test("#2499 all 25 Storyboard positions show current image number over total", async () => {
  const [source, css] = await Promise.all([
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("app/_components/storyboard/storyboard-readiness-workspace.module.css"),
  ]);

  const loop = source.slice(source.indexOf("Array.from({ length: 25 }"), source.indexOf("{promptPosition !== null"));
  assert.match(loop, /const frameVersionLabel = positionImages\.length > 0 && selectedImageIndex >= 0/u);
  assert.match(loop, /\$\{selectedImageIndex \+ 1\}\/\$\{positionImages\.length\}/u);
  assert.match(loop, /: "0\/0"/u);
  assert.match(loop, /className=\{styles\.frameVersionCount\}/u);
  assert.match(loop, /Storyboard Image versions for Shot/u);
  assert.match(css, /\.frameVersionCount \{/u);
  assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/u);
});

test("#2499 chevron browser and prompt provenance remain intact", async () => {
  const source = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");
  const loop = source.slice(source.indexOf("Array.from({ length: 25 }"), source.indexOf("{promptPosition !== null"));

  assert.match(loop, /Previous Storyboard Image for Shot/u);
  assert.match(loop, /Next Storyboard Image for Shot/u);
  assert.match(loop, /disabled=\{selectedImageIndex <= 0\}/u);
  assert.match(loop, /selectedImageIndex >= positionImages\.length - 1/u);
  assert.match(loop, /<strong>Storyboard Image Prompt<\/strong>/u);
  assert.match(loop, /selectedImage\.prompt \|\| "Original Storyboard Image prompt unavailable for this image\."/u);
});
