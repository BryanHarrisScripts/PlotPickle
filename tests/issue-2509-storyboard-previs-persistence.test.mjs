import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2509 restores per-version local-save metadata from the exact saved Storyboard artifact", async () => {
  const source = await read("modules/library/local-resource-recovery.ts");
  assert.match(source, /STORYBOARD_LOCAL_SAVE_MARKER = "storyboard-local-save:v1"/u);
  assert.match(source, /const priorArtifact = priorStoryboardArtifact\(resource, sourceProjects\)/u);
  assert.match(source, /priorArtifact\?\.artifact\.sourceDecisionKeys\?\.includes\(STORYBOARD_LOCAL_SAVE_MARKER\)/u);
  assert.match(source, /sourceDecisionKeys: preservedStoryboardDecisionKeys\(resource, priorArtifact, priorApproval\)/u);
  assert.match(source, /restoredSavedCount/u);
});

test("#2509 keeps exact Human lock proof separate and restores canonical acceptance", async () => {
  const source = await read("modules/library/local-resource-recovery.ts");
  assert.match(source, /const priorApproval = priorAcceptedStoryboardArtifact\(resource, sourceProjects\)/u);
  assert.match(source, /type: "foundations\.visual\.accept"/u);
  assert.match(source, /recovery-approval-source:saved-library/u);
  assert.match(source, /restoredLockedCount/u);
});

test("#2509 preserves the exact recovered alternate identity for Storyboard and Previs", async () => {
  const [recovery, storyboard, previs] = await Promise.all([
    read("modules/library/local-resource-recovery.ts"),
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("app/_components/previs/previs-readiness-workspace.tsx"),
  ]);
  assert.match(recovery, /candidate\.assetUrl === resource\.assetUrl/u);
  assert.match(recovery, /candidate\.frameNumber === resource\.position/u);
  assert.match(recovery, /storyboard-anchor:block:block-\$\{blockRef\}:mini-\$\{resource\.miniBlockNumber\}/u);
  assert.match(storyboard, /storyboardArtifactSavedLocally/u);
  assert.match(previs, /acceptedVisualIds\.has\(artifact\.id\) && artifact\.reviewState === "accepted"/u);
});
