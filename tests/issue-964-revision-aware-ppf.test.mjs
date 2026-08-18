import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("canonical PPF state has one portable revision store and immutable proposal base revisions", async () => {
  const source = await read("lib/project-revisions.ts");
  assert.match(source, /PROJECT_REVISION_EXTENSION_KEY = "canonicalRevision"/);
  assert.match(source, /currentRevision: number/);
  assert.match(source, /baseRevision: number/);
  assert.match(source, /baseRevision: current\.currentRevision/);
  assert.match(source, /currentProjectRevision/);
  assert.match(source, /history: CanonicalRevisionRecord\[\]/);
  assert.match(source, /previousRevision: store\.currentRevision/);
  assert.match(source, /currentRevision: nextRevision/);
});

test("two proposals created against the same revision cannot both silently become canon", async () => {
  const source = await read("lib/project-revisions.ts");
  assert.match(source, /found\.baseRevision !== store\.currentRevision/);
  assert.match(source, /status: "stale" as const/);
  assert.match(source, /reason: "stale-revision"/);
  assert.match(source, /project: withRevisionStore\(input\.project, staleStore\)/);
  assert.match(source, /const nextRevision = store\.currentRevision \+ 1/);
  assert.match(source, /status: "accepted" as const/);
  assert.match(source, /appliedRevision: nextRevision/);
});

test("stale proposals remain reviewable and require explicit reject, rebase or a new accepted proposal", async () => {
  const source = await read("lib/project-revisions.ts");
  assert.match(source, /CanonicalProposalStatus = "pending" \| "accepted" \| "rejected" \| "stale" \| "rebased" \| "superseded"/);
  assert.match(source, /rejectCanonicalProposal/);
  assert.match(source, /rebaseCanonicalProposal/);
  assert.match(source, /rebasedFromRevision/);
  assert.match(source, /baseRevision: store\.currentRevision/);
  assert.match(source, /markStaleCanonicalProposals/);
});

test("every canonical mutation requires an explicit writer approval boundary", async () => {
  const source = await read("lib/project-revisions.ts");
  assert.match(source, /type WriterApproval = \{/);
  assert.match(source, /kind: "writer"/);
  assert.match(source, /Explicit writer approval is required for canonical mutation/);
  assert.match(source, /applyWriterApprovedCanonicalProposal/);
  assert.ok(source.indexOf("const writer = explicitWriterApproval(input.approval)") < source.indexOf("const nextRevision = store.currentRevision + 1"));
  assert.doesNotMatch(source, /sourceKind === "buzz-peer"[\s\S]{0,200}(?:apply|accepted|currentRevision\s*\+)/);
  assert.doesNotMatch(source, /sourceKind === "project-memory"[\s\S]{0,200}(?:apply|accepted|currentRevision\s*\+)/);
});

test("proposal provenance links agent, Skill, run, model route and Context Engine sources without storing secrets or hidden reasoning", async () => {
  const source = await read("lib/project-revisions.ts");
  for (const field of ["profileId", "skillUri", "runId", "provider", "model", "routeId", "promptFingerprint", "sourceIds", "sourceRevisions", "generatedAt"]) {
    assert.match(source, new RegExp(`${field}:`), `missing provenance field ${field}`);
  }
  assert.match(source, /contextProvenanceFromReceipt/);
  assert.match(source, /receipt\.sources\.map/);
  assert.match(source, /api\[_-\]\?key|private\[_-\]\?key|credential|nsec1/i);
  assert.doesNotMatch(source, /chainOfThought|chain_of_thought|hiddenReasoning|hidden_reasoning|scratchpad/i);
});

test("asset proposals use the same revision/provenance gate as story and screenplay proposals", async () => {
  const source = await read("lib/project-revisions.ts");
  assert.match(source, /CanonicalProposalKind = "story" \| "field" \| "screenplay" \| "asset" \| "other"/);
  assert.match(source, /CanonicalGenerationProvenance/);
  assert.match(source, /contentFingerprint/);
  assert.match(source, /targetIds: string\[\]/);
  assert.match(source, /kind: input\.kind/);
});

test("the portable PPF and Afterglow revision workspace can coexist with canonical revision history", async () => {
  const [projectFolder, screenplayRevisions, afterglowTest] = await Promise.all([
    read("lib/project-folder.ts"),
    read("lib/screenplay-revisions.ts"),
    read("tests/afterglow-revision-ppf.test.mjs"),
  ]);
  assert.match(projectFolder, /projectExtensions: project\.extensions \?\? \{\}/);
  assert.match(projectFolder, /extensions: manifestExtensions\.projectExtensions/);
  assert.match(screenplayRevisions, /SCREENPLAY_REVISIONS_EXTENSION_KEY = "screenplayRevisions"/);
  for (const decision of ["keep-baseline", "replace-with-revision", "merge-selected", "write-new", "discard-revision"]) {
    assert.match(screenplayRevisions, new RegExp(decision));
    assert.match(afterglowTest, new RegExp(decision));
  }
});

test("existing Git Story Proposals retain their independent base-commit concurrency guard", async () => {
  const gateway = await read("build/github-review-gateway.ts");
  assert.match(gateway, /expectedBaseRevision !== baseCommit\.commitSha/);
  assert.match(gateway, /current\.commitSha !== expectedBaseCommit \|\| pullBaseCommit !== expectedBaseCommit/);
  assert.match(gateway, /approved branch changed after Story Proposal review began/i);
});
