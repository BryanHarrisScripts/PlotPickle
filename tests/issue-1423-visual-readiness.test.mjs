import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const readiness = read("modules/build/visual-readiness.ts");
const progressive = read("modules/build/progressive-story-map.ts");
const visualIdentity = read("lib/projects/visual/character-visual-identity.ts");
const storyboard = read("app/visual-storyboard.tsx");
const afterglowProof = read("modules/library/reference/afterglow-v9-visual-readiness.ts");
const afterglowStoryboard = read("data/afterglow-storyboard.ts");
const afterglowComplete = read("data/afterglow-complete.ts");

test("#1423 defines one curriculum-to-visual readiness contract without a second canon store", () => {
  assert.match(readiness, /VisualReadinessSnapshot/);
  assert.match(readiness, /deriveVisualReadiness/);
  assert.match(readiness, /projectRevision/);
  assert.match(readiness, /curriculumFrontier/);
  assert.match(readiness, /storyboardAllowed/);
  assert.match(readiness, /missingPrerequisites/);
  assert.doesNotMatch(readiness, /writeFile|database|sqlite|localStorage/);
});

test("#1423 preserves Defined Observed Emerging Missing Locked semantics", () => {
  for (const state of ["defined", "observed", "emerging", "missing", "locked"]) {
    assert.match(progressive, new RegExp(`"${state}"`));
  }
  assert.match(readiness, /BuildStoryEvidenceState/);
});

test("#1423 does not unlock storyboard from unreviewed Foundations placement", () => {
  assert.match(readiness, /reviewedPlacement = block\.state === "observed" \|\| block\.state === "defined"/);
  assert.match(readiness, /Human-reviewed structural placement/);
  assert.match(readiness, /storyboard frontier approval/);
});

test("#1423 distinguishes observed legacy references from Human-approved visual identity", () => {
  assert.match(readiness, /observed-reference/);
  assert.match(readiness, /accepted-visual/);
  assert.match(readiness, /Human-approved canonical visual identity/);
  assert.match(visualIdentity, /approvedCharacterReferenceImages/);
  assert.match(visualIdentity, /status === "locked"/);
});

test("#1423 reuses existing storyboard identity inputs instead of creating view-local identities", () => {
  assert.match(storyboard, /storyboardIdentityInputs/);
  assert.match(storyboard, /getCharacterVisualIdentity/);
  assert.match(storyboard, /approvedCharacterReferenceImages/);
  assert.match(readiness, /LegacyVisualIdentityEvidence/);
});

test("#1423 staleness is targeted and explainable", () => {
  assert.match(readiness, /markVisualTargetsStale/);
  assert.match(readiness, /affectedTargetIds/);
  assert.match(readiness, /staleBecause/);
  assert.match(readiness, /affected\.has\(target\.id\)/);
});

test("#1423 Afterglow v9 proof maps character, location, Block and visual reference without accepting legacy art as canon", () => {
  assert.match(afterglowProof, /AFTERGLOW_V9_VISUAL_READINESS_BLOCK_NUMBER = 17/);
  assert.match(afterglowProof, /id: "ren"/);
  assert.match(afterglowProof, /kind: "character"/);
  assert.match(afterglowProof, /id: "venice-beach"/);
  assert.match(afterglowProof, /kind: "location"/);
  assert.match(afterglowProof, /kind: "reference"/);
  assert.match(afterglowProof, /approved: false/g);
  assert.match(afterglowProof, /createAfterglowStoryboardFrames/);
  assert.match(afterglowStoryboard, /afterglow-block-\$\{blockNumber\}-mini-\$\{miniBlockNumber\}/);
  assert.match(afterglowComplete, /Block 17/);
  assert.match(afterglowComplete, /venice-beach/);
  assert.match(afterglowComplete, /characterIds/);
});
