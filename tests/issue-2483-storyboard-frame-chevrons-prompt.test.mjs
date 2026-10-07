import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2483 replaces the Storyboard Frame pull-down with bounded image chevrons", async () => {
  const source = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");
  const loop = source.slice(source.indexOf("Array.from({ length: 25 }"), source.indexOf("{promptPosition !== null"));

  assert.doesNotMatch(loop, /<select/u);
  assert.doesNotMatch(loop, /positionSelector/u);
  assert.match(loop, /const positionArtifacts = frameArtifacts\.filter\(\(artifact\) => artifact\.frameNumber === position && artifact\.reviewState !== "rejected"\)/u);
  assert.match(loop, /const positionImages = \[\.\.\.generatedPositionImages, \.\.\.linkedPositionImages\]/u);
  assert.match(loop, /Previous Storyboard Image for Shot/u);
  assert.match(loop, /Next Storyboard Image for Shot/u);
  assert.match(loop, /disabled=\{selectedImageIndex <= 0\}/u);
  assert.match(loop, /disabled=\{selectedImageIndex < 0 \|\| selectedImageIndex >= positionImages\.length - 1\}/u);
  assert.match(loop, /setSelectedImageByPosition/u);
});

test("#2483 keeps chevron browsing presentation-only and preserves frame review authority", async () => {
  const source = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");
  const imageStart = source.indexOf("className={styles.positionImage}");
  const reviewStart = source.indexOf("className={styles.frameReview}", imageStart);
  const imageControls = source.slice(imageStart, reviewStart);

  assert.doesNotMatch(imageControls, /reviewFrame|applyStoryCommand|saveFoundationProject/u);

  const loop = source.slice(source.indexOf("Array.from({ length: 25 }"), source.indexOf("{promptPosition !== null"));
  assert.match(loop, />\{frameSaving \? "Saving…" : "Save"\}<\/button>/u);
  assert.match(loop, /\{accepted \? "Unlock" : "Lock"\}<\/button>/u);
  assert.match(loop, /frameVersionLabel/u);
  assert.match(loop, />Redo</u);
  assert.match(loop, />Delete</u);
  assert.match(loop, /project\.build\.foundations\.acceptedVisualArtifactIds\.includes\(selectedArtifact\.id\)/u);
});

test("#2483 displays exact persisted prompts and classifies recovered placeholders as unavailable", async () => {
  const source = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");

  assert.match(source, /const RECOVERED_STORYBOARD_PROMPT_UNAVAILABLE = "Recovered local Storyboard resource\. Original prompt metadata was unavailable in the loaded project\."/u);
  assert.match(source, /function exactStoryboardPrompt\(prompt: string \| undefined\)/u);
  assert.match(source, /value\.startsWith\("Recovered local Storyboard resource\."\)/u);
  assert.match(source, /prompt: exactStoryboardPrompt\(artifact\.prompt\)/u);
  assert.match(source, /<strong>Storyboard Image Prompt<\/strong>/u);
  assert.match(source, /selectedImage\.prompt \|\| "Original Storyboard Image prompt unavailable for this image\."/u);
});

test("#2483 styles chevrons on the image and removes the old selector styling", async () => {
  const css = await read("app/_components/storyboard/storyboard-readiness-workspace.module.css");

  assert.match(css, /\.positionImage \{[\s\S]*?position: relative;/u);
  assert.match(css, /\.frameChevron \{/u);
  assert.match(css, /\.frameChevronPrevious \{ left:/u);
  assert.match(css, /\.frameChevronNext \{ right:/u);
  assert.match(css, /\.framePromptProvenance \{/u);
  assert.match(css, /\.frameVersionCount \{/u);
  assert.doesNotMatch(css, /\.positionSelector/u);
});
