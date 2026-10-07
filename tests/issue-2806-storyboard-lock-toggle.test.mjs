import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("#2806 Storyboard Lock is a reversible accept/unaccept toggle", async () => {
  const source = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");
  const reviewStart = source.indexOf("function reviewFrame");
  const reviewEnd = source.indexOf("const normalizedSourceEvidence", reviewStart);
  const review = source.slice(reviewStart, reviewEnd);
  const loop = source.slice(source.indexOf("Array.from({ length: 25 }"), source.indexOf("{promptPosition !== null"));

  assert.match(review, /decision: "accept" \| "unaccept" \| "delete"/u);
  assert.match(review, /decision === "unaccept"[\s\S]*"foundations\.visual\.unaccept"/u);
  assert.match(review, /decision === "accept"[\s\S]*"foundations\.visual\.accept"/u);
  assert.match(loop, /aria-pressed=\{accepted\}/u);
  assert.match(loop, /reviewFrame\(selectedArtifact, accepted \? "unaccept" : "accept"\)/u);
  assert.match(loop, /\{accepted \? "Unlock" : "Lock"\}<\/button>/u);
  assert.doesNotMatch(loop, /disabled=\{!selectedArtifact \|\| accepted \|\| qaOnlyAccess/u);
});

test("#2806 locking a different candidate still unaccepts the previous Shot lock without deleting it", async () => {
  const source = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");
  const reviewStart = source.indexOf("function reviewFrame");
  const reviewEnd = source.indexOf("const normalizedSourceEvidence", reviewStart);
  const review = source.slice(reviewStart, reviewEnd);

  assert.match(review, /candidate\.id !== artifact\.id && candidate\.frameNumber === artifact\.frameNumber/u);
  assert.match(review, /acceptedVisualArtifactIds\.includes\(candidate\.id\)/u);
  assert.match(review, /foundations\.visual\.unaccept/u);
  assert.match(review, /foundations\.visual\.accept/u);
  assert.match(review, /foundations\.visual\.delete/u);
});

test("#2806 Unlock preserves the candidate and permits an intentional zero-lock reload state", async () => {
  const source = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");
  const loop = source.slice(source.indexOf("Array.from({ length: 25 }"), source.indexOf("{promptPosition !== null"));

  assert.match(loop, /const acceptedPositionArtifact = \[\.\.\.positionArtifacts\]/u);
  assert.match(loop, /const fallbackImageId = acceptedPositionArtifact\?\.id \?\? latestGeneratedArtifact\?\.id/u);
  assert.match(loop, /const accepted = Boolean\(selectedArtifact && project\.build\.foundations\.acceptedVisualArtifactIds\.includes\(selectedArtifact\.id\)\)/u);
  assert.match(loop, /accepted \? <span[^>]*>Locked<\/span> : null/u);
  assert.doesNotMatch(loop, /acceptedPositionArtifact[\s\S]{0,300}foundations\.visual\.accept/u);
});

test("#2806 Save remains independent so Unlock → Save → Lock is possible", async () => {
  const source = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");
  const saveStart = source.indexOf("function saveFrameVersion");
  const reviewStart = source.indexOf("function reviewFrame", saveStart);
  const save = source.slice(saveStart, reviewStart);
  const loop = source.slice(source.indexOf("Array.from({ length: 25 }"), source.indexOf("{promptPosition !== null"));

  assert.match(save, /STORYBOARD_LOCAL_SAVE_MARKER/u);
  assert.match(save, /type: "foundations\.visual\.store"/u);
  assert.doesNotMatch(save, /foundations\.visual\.accept|foundations\.visual\.unaccept/u);
  assert.doesNotMatch(loop, /disabled=\{!selectedArtifact \|\| savedLocally/u);
  assert.match(loop, /disabled=\{!selectedArtifact \|\| qaOnlyAccess \|\| frameBusy\}/u);
  assert.match(loop, /accepted[\s\S]*"Locked · Save confirmation pending"/u);
  assert.match(loop, /savedLocally \? "Saved locally"/u);
});
