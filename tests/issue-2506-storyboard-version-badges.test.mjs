import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2506 renders Saved locally and Locked on the currently selected Storyboard alternate", async () => {
  const source = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");
  const loop = source.slice(source.indexOf("Array.from({ length: 25 }"), source.indexOf("{promptPosition !== null"));

  assert.match(loop, /const selectedArtifact = positionArtifacts\.find\(\(artifact\) => artifact\.id === selectedImageId\) \?\? null/u);
  assert.match(loop, /const accepted = Boolean\(selectedArtifact && project\.build\.foundations\.acceptedVisualArtifactIds\.includes\(selectedArtifact\.id\)\)/u);
  assert.match(loop, /const savedLocally = Boolean\(selectedArtifact && storyboardArtifactSavedLocally\(selectedArtifact\)\)/u);
  assert.match(loop, /savedLocally \? <span className=\{`\$\{styles\.frameStateBadge\} \$\{styles\.frameSavedBadge\}`\}>Saved locally<\/span>/u);
  assert.match(loop, /accepted \? <span className=\{`\$\{styles\.frameStateBadge\} \$\{styles\.frameLockedBadge\}`\}>Locked<\/span>/u);
});

test("#2506 keeps Saved and Locked as independent per-version states", async () => {
  const source = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");
  assert.match(source, /function storyboardArtifactSavedLocally/u);
  assert.match(source, /STORYBOARD_LOCAL_SAVE_MARKER = "storyboard-local-save:v1"/u);
  assert.match(source, /acceptedVisualArtifactIds\.includes\(selectedArtifact\.id\)/u);
  assert.doesNotMatch(source, /const savedLocally = accepted/u);
});

test("#2506 places Saved locally lower-left and Locked lower-right without colliding with N/X", async () => {
  const css = await read("app/_components/storyboard/storyboard-readiness-workspace.module.css");
  assert.match(css, /\.frameVersionCount \{[\s\S]*?top: var\(--pp-skin-space-1\);[\s\S]*?left: 50%;/u);
  assert.match(css, /\.frameStateBadge \{[\s\S]*?bottom: var\(--pp-skin-space-1\);/u);
  assert.match(css, /\.frameSavedBadge \{ left: var\(--pp-skin-space-1\); \}/u);
  assert.match(css, /\.frameLockedBadge \{[\s\S]*?right: var\(--pp-skin-space-1\);/u);
});

test("#2506 relies on durable Storyboard save/lock restoration rather than transient UI memory", async () => {
  const recovery = await read("modules/library/local-resource-recovery.ts");
  assert.match(recovery, /STORYBOARD_LOCAL_SAVE_MARKER = "storyboard-local-save:v1"/u);
  assert.match(recovery, /restoredSavedCount/u);
  assert.match(recovery, /restoredLockedCount/u);
  assert.match(recovery, /type: "foundations\.visual\.accept"/u);
});
