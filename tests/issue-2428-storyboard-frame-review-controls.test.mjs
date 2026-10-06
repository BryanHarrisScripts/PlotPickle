import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2428 gives every one of the 25 Storyboard positions a visible review strip", async () => {
  const source = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");
  const positionLoop = source.slice(source.indexOf("Array.from({ length: 25 }"), source.indexOf("{promptPosition !== null"));
  assert.match(positionLoop, /className=\{styles\.frameReview\}/u);
  assert.doesNotMatch(positionLoop, /selectedArtifact \? <div className=\{styles\.frameReview\}/u);
  assert.match(positionLoop, />Save<\/button>/u);
  assert.match(positionLoop, /\{accepted \? "Unlock" : "Lock"\}<\/button>/u);
  assert.match(positionLoop, />Redo</u);
  assert.match(positionLoop, />Delete</u);
  assert.match(positionLoop, /data-review-state=\{reviewState\}/u);
  assert.match(positionLoop, /selectedImage \? "Reference Storyboard Image" : "No Storyboard Image"/u);
});

test("#2428/#2772 reload prefers the accepted image, then the latest non-rejected candidate for its position", async () => {
  const source = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");
  assert.match(source, /const positionArtifacts = frameArtifacts\.filter\(\(artifact\) => artifact\.frameNumber === position && artifact\.reviewState !== "rejected"\)/u);
  assert.match(source, /const latestGeneratedArtifact = \[\.\.\.positionArtifacts\]\.sort\(\(left, right\) => right\.createdAt\.localeCompare\(left\.createdAt\)\)\[0\] \?\? null/u);
  assert.match(source, /const acceptedPositionArtifact = \[\.\.\.positionArtifacts\]/u);
  assert.match(source, /artifact\.reviewState === "accepted"[\s\S]*acceptedVisualArtifactIds\.includes\(artifact\.id\)/u);
  assert.match(source, /const requestedImageId = selectedImageByPosition\[selectionKey\] \?\? ""/u);
  assert.match(source, /const fallbackImageId = acceptedPositionArtifact\?\.id \?\? latestGeneratedArtifact\?\.id \?\? shot\?\.frames\[0\]\?\.id \?\? positionImages\[0\]\?\.id \?\? ""/u);
});

test("#2428 places Save, Lock, Redo and Delete directly under each frame image", async () => {
  const [source, css] = await Promise.all([
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("app/_components/storyboard/storyboard-readiness-workspace.module.css"),
  ]);
  const row = source.slice(source.indexOf("className={styles.positionImage}"), source.indexOf("className={styles.framePromptProvenance}"));
  assert.ok(row.indexOf("className={styles.positionImage}") < row.indexOf("className={styles.frameReview}"));
  assert.match(css, /\.frameReview \{[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/u);
  assert.match(css, /\.frameReview button\[aria-pressed="true"\]/u);
});
