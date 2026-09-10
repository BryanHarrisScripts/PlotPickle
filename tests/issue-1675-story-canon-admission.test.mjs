import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1675 Phase 2 canon proposals require one completed persisted STORY session and its final accepted checkpoint", async () => {
  const bridge = await read("modules/story-the-unwritten/canon-admission.ts");
  assert.match(bridge, /loadStorySessionSnapshot/);
  assert.match(bridge, /readStorySessionHistory/);
  assert.match(bridge, /runtime\.session\.status !== "completed"/);
  assert.match(bridge, /history\.history\.latestCheckpointRef/);
  assert.match(bridge, /checkpoint\.revision !== loaded\.snapshot\.mechanicalState\.revision/);
  assert.match(bridge, /runtime\.session\.latestCheckpointRef !== checkpointRef/);
});

test("#1675 Phase 2 completed STORY outcomes enter the existing revision-aware PPF proposal boundary instead of a STORY canon store", async () => {
  const bridge = await read("modules/story-the-unwritten/canon-admission.ts");
  assert.match(bridge, /createCanonicalProposal\(input\.project/);
  assert.match(bridge, /kind: "story"/);
  assert.match(bridge, /targetIds/);
  assert.match(bridge, /profileId: requestedByProfileId/);
  assert.match(bridge, /sourceKind: "system"/);
  assert.match(bridge, /runId: `story-session:\$\{sessionId\}`/);
  assert.match(bridge, /contentFingerprint: storyOutcomeFingerprint\(evidence\.checkpoint\.stateHash\)/);
  assert.match(bridge, /STORY_CANON_ADMISSION_SKILL_URI/);
  assert.doesNotMatch(bridge, /canonicalRevision\s*:/);
});

test("#1675 Phase 2 proposing a STORY outcome remains non-canon and cannot call the writer approval mutation path", async () => {
  const bridge = await read("modules/story-the-unwritten/canon-admission.ts");
  const proposalStart = bridge.indexOf("export function proposeCompletedStorySessionOutcomeForCanon");
  const admissionStart = bridge.indexOf("export function recordWriterApprovedStoryCanonAdmission");
  assert.ok(proposalStart >= 0 && admissionStart > proposalStart);
  const proposalBody = bridge.slice(proposalStart, admissionStart);
  assert.doesNotMatch(proposalBody, /canonAdmissionRef\s*=/);
  assert.doesNotMatch(bridge, /applyWriterApprovedCanonicalProposal/);
  assert.doesNotMatch(bridge, /currentRevision\s*\+/);
});

test("#1675 Phase 2 canon admission can be recorded only after the existing PPF proposal is accepted by host authority", async () => {
  const bridge = await read("modules/story-the-unwritten/canon-admission.ts");
  assert.match(bridge, /proposal\.status !== "accepted"/);
  assert.match(bridge, /proposal\.appliedRevision === null/);
  assert.match(bridge, /readCanonicalRevisionStore/);
  assert.match(bridge, /candidate\.proposalId === proposal\.id && candidate\.revision === proposal\.appliedRevision/);
  assert.match(bridge, /proposal\.contentFingerprint !== storyOutcomeFingerprint\(evidence\.checkpoint\.stateHash\)/);
  assert.match(bridge, /runtime\.session\.canonAdmissionRef = revision\.id/);
  assert.match(bridge, /persistStorySessionSnapshot/);
});

test("#1675 Phase 2 recording the same accepted canonical revision is idempotent and conflicting admission fails closed", async () => {
  const bridge = await read("modules/story-the-unwritten/canon-admission.ts");
  assert.match(bridge, /existingAdmissionRef === revision\.id/);
  assert.match(bridge, /status: "already-recorded"/);
  assert.match(bridge, /existingAdmissionRef !== null/);
  assert.match(bridge, /already linked to a different canonical revision/);
});

test("#1675 Phase 2 reuses PlotPickle writer approval and stale-revision protection unchanged", async () => {
  const revisions = await read("lib/projects/persistence/project-revisions.ts");
  assert.match(revisions, /applyWriterApprovedCanonicalProposal/);
  assert.match(revisions, /const writer = explicitWriterApproval\(input\.approval\)/);
  assert.match(revisions, /Explicit writer approval is required for canonical mutation/);
  assert.match(revisions, /found\.baseRevision !== store\.currentRevision/);
  assert.match(revisions, /reason: "stale-revision"/);
  assert.match(revisions, /const nextRevision = store\.currentRevision \+ 1/);
});

test("#1675 Phase 2 accepted session history stays the evidence source and is not copied into PPF proposal payloads", async () => {
  const bridge = await read("modules/story-the-unwritten/canon-admission.ts");
  assert.match(bridge, /acceptedEventLogRef: evidence\.acceptedEventLogRef/);
  assert.match(bridge, /checkpointRef: evidence\.checkpointRef/);
  assert.match(bridge, /stateRevision: evidence\.checkpoint\.revision/);
  assert.match(bridge, /stateHash: evidence\.checkpoint\.stateHash/);
  assert.doesNotMatch(bridge, /acceptedEvents\s*:/);
  assert.doesNotMatch(bridge, /mechanicalState\s*:/);
});
