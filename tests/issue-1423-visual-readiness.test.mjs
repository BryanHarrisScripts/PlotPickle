import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const readiness = read("modules/build/visual-readiness.ts");
const progressive = read("modules/build/progressive-story-map.ts");
const visualIdentity = read("lib/projects/visual/character-visual-identity.ts");
const storyboard = read("app/visual-storyboard.tsx");

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
