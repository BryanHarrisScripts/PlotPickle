import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2505 Storyboard exposes Save / Lock / Redo / Delete on the selected alternate", async () => {
  const source = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");

  assert.match(source, />Save<\/button>/u);
  assert.match(source, />Lock<\/button>/u);
  assert.match(source, />Redo<\/button>/u);
  assert.match(source, />Delete<\/button>/u);
  assert.doesNotMatch(source, />Reject<\/button>/u);
  assert.doesNotMatch(source, /Save this Version/u);
  assert.doesNotMatch(source, /Lock this Version/u);
  assert.match(source, /setPendingDeleteArtifactId\(selectedArtifact\.id\)/u);
});

test("#2505 requires inline Yes / No confirmation before permanent Storyboard delete", async () => {
  const source = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");

  assert.match(source, /Delete this version forever\? This cannot be undone\./u);
  assert.match(source, /pendingDeleteArtifactId === selectedArtifact\.id/u);
  assert.match(source, /reviewFrame\(selectedArtifact, "delete"\)/u);
  assert.match(source, />Yes<\/button>/u);
  assert.match(source, />No<\/button>/u);
});

test("#2505 uses a durable delete tombstone and never restores that exact local alternate", async () => {
  const [commands, apply, recovery] = await Promise.all([
    read("core/contracts/story-command.ts"),
    read("core/project/apply-command.ts"),
    read("modules/library/local-resource-recovery.ts"),
  ]);

  assert.match(commands, /readonly type: "foundations\.visual\.delete"/u);
  assert.match(apply, /case "foundations\.visual\.delete"/u);
  assert.match(apply, /"storyboard-deleted:v1"/u);
  assert.match(recovery, /function priorDeletedStoryboardArtifact/u);
  assert.match(recovery, /candidate\.reviewState === "rejected"/u);
  assert.match(recovery, /decisionKeys\.includes\("storyboard-deleted:v1"\)/u);
  assert.match(recovery, /if \(priorDeletedArtifact\) \{[\s\S]*?skippedCount \+= 1;[\s\S]*?continue;/u);
});

test("#2505 deleted alternate leaves the N/X source list because rejected artifacts are excluded", async () => {
  const source = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");
  assert.match(source, /positionArtifacts = frameArtifacts\.filter\(\(artifact\) => artifact\.frameNumber === position && artifact\.reviewState !== "rejected"\)/u);
  assert.match(source, /selectedImageIndex \+ 1/u);
  assert.match(source, /positionImages\.length/u);
});
