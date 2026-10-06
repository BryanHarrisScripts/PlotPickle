import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2420 reviews only the generated candidate at its Storyboard position", async () => {
  const source = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");
  assert.match(source, /artifact\.workflow === "storyboard-frame-webp-v2"/u);
  assert.match(source, /artifact\.frameNumber === position && artifact\.reviewState !== "rejected"/u);
  assert.match(source, /candidate\.frameNumber === artifact\.frameNumber/u);
  assert.match(source, /foundations\.visual\.unaccept/u);
  assert.match(source, /decision === "accept"[\s\S]*"foundations\.visual\.accept"[\s\S]*decision === "unaccept"[\s\S]*"foundations\.visual\.unaccept"[\s\S]*"foundations\.visual\.delete"/u);
  assert.match(source, /saveFoundationProject\(next\)/u);
  assert.match(source, /setGenerationScope\("single"\)/u);
  assert.match(source, /className=\{styles\.frameReview\}[\s\S]*?>Save<[\s\S]*?>Lock<[\s\S]*?>Redo<[\s\S]*?>Delete</u);
  assert.match(source, /disabled=\{!selectedArtifact \|\| qaOnlyAccess \|\| frameBusy\}/u);
  assert.match(source, /setPendingDeleteArtifactId\(selectedArtifact\.id\)/u);
  assert.match(source, /reviewFrame\(selectedArtifact, "delete"\)/u);
});

test("#2420 keeps Previs evidence in place without legacy navigation links", async () => {
  const previs = await read("app/_components/previs/previs-readiness-workspace.tsx");
  assert.doesNotMatch(previs, /Open BUILD evidence|StoryboardEditorialWorkspace|Remove shot|value="omitted"/u);
  assert.doesNotMatch(previs, />Inspect evidence<|>Open Storyboard</u);
  assert.match(previs, /id="previs-selected-evidence"/u);
  assert.doesNotMatch(previs, /getElementById\("previs-selected-evidence"\)\?\.scrollIntoView/u);
});
