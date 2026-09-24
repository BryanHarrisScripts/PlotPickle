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
  assert.match(source, /foundations\.visual\.accept" : "foundations\.visual\.discard"/u);
  assert.match(source, /saveFoundationProject\(next\)/u);
  assert.match(source, /setGenerationScope\("single"\)/u);
  assert.match(source, /<button disabled=\{qaOnlyAccess \|\| frameBusy\} type="button" onClick=\{\(\) => reviewFrame\(selectedArtifact, "discard"\)\}>Reject<\/button>/u);
});

test("#2420 routes visual decisions to Storyboard and makes Previs evidence reachable", async () => {
  const previs = await read("app/_components/previs/previs-readiness-workspace.tsx");
  assert.doesNotMatch(previs, /Open BUILD evidence|StoryboardEditorialWorkspace|Remove shot|value="omitted"/u);
  assert.match(previs, /onOpenStoryboard\(anchor\)/u);
  assert.match(previs, /id="previs-selected-evidence"/u);
  assert.match(previs, /getElementById\("previs-selected-evidence"\)\?\.scrollIntoView/u);
});
