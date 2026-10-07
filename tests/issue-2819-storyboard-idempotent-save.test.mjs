import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2819 Save remains available after an artifact is already saved", async () => {
  const source = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");
  const loop = source.slice(source.indexOf("Array.from({ length: 25 }"), source.indexOf("{promptPosition !== null"));

  assert.match(loop, /disabled=\{!selectedArtifact \|\| qaOnlyAccess \|\| frameBusy\}/u);
  assert.doesNotMatch(loop, /disabled=\{!selectedArtifact \|\| savedLocally/u);
});

test("#2819 repeated Save is an idempotent success before any store write", async () => {
  const source = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");
  const start = source.indexOf("function saveFrameVersion");
  const end = source.indexOf("function reviewFrame", start);
  const save = source.slice(start, end);

  const alreadySaved = save.indexOf("if (storyboardArtifactSavedLocally(currentArtifact))");
  const write = save.indexOf("applyStoryCommand(current");
  assert.ok(alreadySaved >= 0, "idempotent already-saved branch must exist");
  assert.ok(write > alreadySaved, "already-saved branch must run before any store command");

  const branchEnd = save.indexOf("const now = new Date().toISOString()", alreadySaved);
  const idempotentBranch = save.slice(alreadySaved, branchEnd);
  assert.match(idempotentBranch, /currentArtifact\.id/u);
  assert.match(idempotentBranch, /onProjectChange\(current\)/u);
  assert.match(idempotentBranch, /already saved locally with this story/u);
  assert.match(idempotentBranch, /return;/u);
  assert.doesNotMatch(idempotentBranch, /applyStoryCommand|saveFoundationProject/u);
});

test("#2819 a new Save still writes the marker against the latest persisted artifact", async () => {
  const source = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");
  const start = source.indexOf("function saveFrameVersion");
  const end = source.indexOf("function reviewFrame", start);
  const save = source.slice(start, end);

  assert.match(save, /const current = loadFoundationProject\(\)/u);
  assert.match(save, /candidate\) => candidate\.id === artifact\.id/u);
  assert.match(save, /sourceDecisionKeys: \[\.\.\.new Set\(\[\.\.\.\(currentArtifact\.sourceDecisionKeys \?\? \[\]\), STORYBOARD_LOCAL_SAVE_MARKER\]\)\]/u);
  assert.match(save, /applyStoryCommand\(current/u);
  assert.match(save, /saveFoundationProject\(next\)/u);
  assert.doesNotMatch(save, /foundations\.visual\.accept|foundations\.visual\.unaccept/u);
});

test("#2819 saved status remains independent from Lock and Unlock", async () => {
  const source = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");
  const loop = source.slice(source.indexOf("Array.from({ length: 25 }"), source.indexOf("{promptPosition !== null"));

  assert.match(loop, /accepted\s*\?\s*savedLocally \? "Locked · Saved locally" : "Locked · Save confirmation pending"/u);
  assert.match(loop, /: savedLocally \? "Saved locally"/u);
  assert.match(loop, /reviewFrame\(selectedArtifact, accepted \? "unaccept" : "accept"\)/u);
});

test("#2819 local-resource recovery preserves an existing Storyboard save marker", async () => {
  const recovery = await read("modules/library/local-resource-recovery.ts");

  assert.match(recovery, /priorKeys\.includes\(STORYBOARD_LOCAL_SAVE_MARKER\) \? \[STORYBOARD_LOCAL_SAVE_MARKER\] : \[\]/u);
  assert.match(recovery, /restoredSavedCount/u);
});
