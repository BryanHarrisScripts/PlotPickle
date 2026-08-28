import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { reduceStoryCouncilContributions } from "../core/story-workflow/story-council/core.mjs";
import { createStoryDecisionFromCouncilResult, createStoryDecisionResponse } from "../core/story-workflow/story-decisions/core.mjs";
import { reviewStoryChangePackage, storyWorkbenchImpactMap } from "../core/story-workflow/workbench/core.mjs";
import {
  createStoryConvergenceEvidence,
  evaluateStoryEditorialReadiness,
  normalizeStoryFindingLifecycle,
} from "../core/story-workflow/workbench/convergence.mjs";
import { requeueAffectedStoryWorkItems } from "../core/story-workflow/runtime/story-workflow-core.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const baseContribution = {
  workItemId: "story-work:afterglow-ren-motivation",
  baseRevision: "9",
  kind: "proposal",
  targetRefs: ["ppf:character:ren:motivation"],
  evidenceRefs: ["character:ren", "afterglow-v9-block-17"],
  curriculumRequirementId: "story-council:afterglow-v9:ren-motivation",
  principleRef: "curriculum:foundations:motivation",
  severity: "high",
  confidence: 0.82,
  changesCanon: true,
  affectedDownstreamRefs: ["ppf:structure:block-17"],
  agreementRefs: [],
  disagreementRefs: [],
  provenance: { transport: "local-runtime", roomClass: "local-only", recordedAt: "2026-08-27T20:00:00.000Z" },
};

function contribution(overrides) {
  return { ...baseContribution, ...overrides };
}

function afterglowCouncilResult() {
  return reduceStoryCouncilContributions([
    contribution({
      contributionId: "afterglow-tamsin",
      runId: "run-tamsin",
      agentId: "tamsin-hearthquill",
      explanation: "One transition can make Ren's protective motive more visibly causal.",
      proposal: "Strengthen the existing Block 17 setup/payoff without changing the ending.",
    }),
    contribution({
      contributionId: "afterglow-mira",
      runId: "run-mira",
      agentId: "mira-threadmere",
      explanation: "Continuity supports the same bounded repair.",
      proposal: "Strengthen the existing Block 17 setup/payoff without changing the ending.",
      agreementRefs: ["afterglow-tamsin"],
    }),
    contribution({
      contributionId: "afterglow-critics",
      runId: "run-critics",
      agentId: "critics-circle",
      explanation: "The ambiguity may be intentional and should remain a Human choice.",
      proposal: "Keep the current ambiguity unless the writer chooses the clearer setup/payoff.",
      disagreementRefs: ["afterglow-tamsin", "afterglow-mira"],
    }),
  ])[0];
}

function storyPackage(decision, response) {
  return {
    projectId: "afterglow-v9",
    decisionId: decision.decisionId,
    responseId: response.responseId,
    responseClass: response.responseClass,
    baseRevision: 9,
    targetRefs: ["ppf:foundations:foundations-essentials-essential-aspects-2-md:output-2"],
    operation: {
      targetRef: "ppf:foundations:foundations-essentials-essential-aspects-2-md:output-2",
      beforeValue: "Ren protects control because grief makes connection feel dangerous.",
      value: "Ren protects control because grief makes connection feel dangerous, until Isobel makes withdrawal cost more than honesty.",
      author: "agent-proposed",
    },
    curriculumRefs: ["foundations:ren-motivation"],
    evidenceRefs: ["character:ren", "afterglow-v9-block-17"],
    predictedImpactRefs: ["ppf:structure:block-17", "screenplay:block-17", "visual:ren-isobel-beach"],
    provenance: {
      humanProfileId: response.humanProfileId,
      runRefs: ["run-tamsin", "run-mira", "run-critics"],
      councilResultId: "council-afterglow-ren",
      rationale: response.rationale,
    },
    createdAt: "2026-08-27T20:05:00.000Z",
  };
}

test("#1421 composes Council -> authenticated Human Decision -> Workbench without granting agents canon authority", () => {
  const councilResult = afterglowCouncilResult();
  assert.equal(councilResult.requiresHuman, true);
  assert.equal(councilResult.humanGate, "conflict");

  const decision = createStoryDecisionFromCouncilResult({
    projectId: "afterglow-v9",
    councilResult,
    councilResultId: "council-afterglow-ren",
    question: "Should Block 17 make Ren's protective motive more explicit?",
    now: "2026-08-27T20:01:00.000Z",
  });
  assert.ok(decision);
  assert.equal(decision.integrity.writesCanon, false);
  assert.equal(decision.integrity.requiresWorkbenchValidation, true);

  const answered = createStoryDecisionResponse(decision, {
    responseClass: "accept-proposal",
    humanProfileId: "profile-human-afterglow",
    currentRevision: "9",
    rationale: "Make the causal choice clearer while preserving the source ending.",
    respondedAt: "2026-08-27T20:04:00.000Z",
  });
  assert.equal(answered.response.humanAuthority, "authenticated-human");
  assert.equal(answered.response.writesCanon, false);

  const review = reviewStoryChangePackage({
    package: storyPackage(answered.decision, answered.response),
    currentRevision: 9,
    projectMatches: true,
    targetOwned: true,
    frontierEditable: true,
    visualScriptImpact: true,
  });
  assert.equal(review.canApply, true);
  assert.equal(review.blockingFindingCount, 0);
  const impact = storyWorkbenchImpactMap({ package: review.package });
  assert.ok(impact.explainableRefs.includes("ppf:structure:block-17"));
  assert.ok(impact.staleProjectionRefs.includes("screenplay:block-17"));
});

test("#1421 targeted re-evaluation preserves unrelated completed work", () => {
  const workItems = [
    { workItemId: "block-17", status: "resolved", targetRefs: ["ppf:structure:block-17"], dependencyRefs: ["ppf:foundations:ren-motivation"], proposalIds: [], runId: "run-17", kind: "re-evaluation" },
    { workItemId: "block-18", status: "resolved", targetRefs: ["ppf:structure:block-18"], dependencyRefs: ["ppf:foundations:other"], proposalIds: [], runId: "run-18", kind: "requirement" },
  ];
  const next = requeueAffectedStoryWorkItems(workItems, ["ppf:foundations:ren-motivation"]);
  assert.equal(next[0].status, "queued");
  assert.equal(next[1].status, "resolved");
  assert.equal(next[1].runId, "run-18");
});

test("#1421 finding lifecycle cannot silently drop material findings", () => {
  const resolved = normalizeStoryFindingLifecycle({
    findingId: "finding-ren-17",
    severity: "high",
    disposition: "resolved",
    targetRefs: ["ppf:structure:block-17"],
    evidenceRefs: ["afterglow-v9-block-17"],
    resolutionRefs: ["story-response-afterglow-ren", "ppf-revision:10"],
    rationale: "Human-approved Workbench apply resolved the bounded finding.",
  });
  assert.equal(resolved.disposition, "resolved");
  assert.throws(() => normalizeStoryFindingLifecycle({ findingId: "vanished", severity: "high", disposition: "resolved" }), /explicit resolution evidence/);
});

test("#1421 readiness requires evidence, including two consecutive clean audit rounds", () => {
  const ready = evaluateStoryEditorialReadiness({
    telemetry: {
      openRequiredDecisions: 0,
      unresolvedHighMediumFindings: 0,
      missingCurrentFrontierRequirements: 0,
      staleWorkOrProposals: 0,
      specialistDisagreements: 0,
      affectedWorkItemsRerun: 1,
      newMaterialFindings: 0,
      currentFrontierBlockers: [],
    },
    findings: [{ findingId: "finding-ren-17", severity: "high", disposition: "resolved", resolutionRefs: ["ppf-revision:10"] }],
    auditRounds: [
      { round: 1, completed: true, newMaterialMediumHighFindings: 0 },
      { round: 2, completed: true, newMaterialMediumHighFindings: 0 },
    ],
    staleAcceptedChangeConflicts: 0,
    integrityErrors: [],
  });
  assert.equal(ready.status, "ready-for-editorial-review");
  assert.equal(ready.readyForEditorialReview, true);
  assert.equal(ready.humanMayStop, true);
  assert.equal(Object.hasOwn(ready, "qualityScore"), false);

  for (const blocked of [
    { telemetry: { openRequiredDecisions: 1 }, reason: /Story Decision/ },
    { findings: [{ findingId: "high-open", severity: "high", disposition: "open" }], reason: /high-severity/ },
    { staleAcceptedChangeConflicts: 1, reason: /stale accepted-change/ },
    { telemetry: { missingCurrentFrontierRequirements: 1 }, reason: /current-frontier/ },
    { integrityErrors: ["provenance mismatch"], reason: /integrity\/provenance/ },
    { auditRounds: [{ round: 1, completed: true, newMaterialMediumHighFindings: 0 }], reason: /Two consecutive/ },
  ]) {
    const result = evaluateStoryEditorialReadiness({
      telemetry: { openRequiredDecisions: 0, missingCurrentFrontierRequirements: 0 },
      findings: [],
      auditRounds: [
        { round: 1, completed: true, newMaterialMediumHighFindings: 0 },
        { round: 2, completed: true, newMaterialMediumHighFindings: 0 },
      ],
      staleAcceptedChangeConflicts: 0,
      integrityErrors: [],
      ...blocked,
    });
    assert.equal(result.readyForEditorialReview, false);
    assert.ok(result.blockers.some((message) => blocked.reason.test(message)));
  }
});

test("#1421 emits a bounded machine-readable Afterglow evidence package for the performance handoff", () => {
  const evidence = createStoryConvergenceEvidence({
    reference: {
      fixtureId: "afterglow-v9-through-foundations",
      fixtureVersion: 1,
      sourceVersion: "v9",
      sourceSha: "54b5967644c5a41363fa88f57b02473ea758acc2",
      startingRevision: 9,
      endingRevision: 10,
      applicationCommit: "exact-head",
    },
    capabilities: { buzz: "degraded-local-equivalent", localModel: "local-quality-route", paidCloudUsed: false },
    execution: { workItemsPlanned: 3, workItemsExecuted: 3, councilContributions: 3, decisionsCreated: 1, decisionsResolved: 1 },
    persistence: { saveCloseReopenVerified: true, stateCoherentAfterReopen: true },
    projections: { visualStateCoherent: true, textStateCoherentOrHonestlyStale: true, storyboardFrontierHonest: true },
    telemetry: { affectedWorkItemsRerun: 1 },
    findings: [{ findingId: "finding-ren-17", severity: "high", disposition: "resolved", resolutionRefs: ["ppf-revision:10"] }],
    auditRounds: [
      { round: 1, completed: true, newMaterialMediumHighFindings: 0 },
      { round: 2, completed: true, newMaterialMediumHighFindings: 0 },
    ],
  });
  assert.equal(evidence.schemaVersion, 1);
  assert.equal(evidence.reference.sourceVersion, "v9");
  assert.equal(evidence.capabilities.paidCloudUsed, false);
  assert.equal(evidence.execution.revisionsProduced, 1);
  assert.equal(evidence.persistence.stateCoherentAfterReopen, true);
  assert.equal(evidence.readiness.readyForEditorialReview, true);
  assert.equal(Object.hasOwn(evidence, "transcript"), false);
  assert.equal(Object.hasOwn(evidence, "reasoning"), false);
});

test("#1421 reuses the immutable reference, visual/text proof and normal persistence boundaries", async () => {
  const [identity, reference, visualProof, workbench, persistence] = await Promise.all([
    read("data/afterglow-reference-identity.ts"),
    read("modules/library/reference/afterglow-v9-foundations.ts"),
    read("tests/issue-1420-afterglow-vertical-proof.test.mjs"),
    read("modules/story-workflow/workbench/workflow.ts"),
    read("core/storage/project-library/revision-safe-browser.ts"),
  ]);
  assert.match(identity, /AFTERGLOW_V9_SOURCE_VERSION = "v9"/);
  assert.match(identity, /54b5967644c5a41363fa88f57b02473ea758acc2/);
  assert.match(reference, /referenceFixture/);
  assert.match(visualProof, /source screenplay below has not been rewritten|source screenplay text remains unchanged/);
  assert.match(workbench, /planTargetedStoryReevaluation/);
  assert.match(persistence, /RevisionConflictError/);
  assert.doesNotMatch(workbench, /ppf-direct-write|canon-write|github.*pull request/i);
});
