import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normalizeStoryChangePackage,
  reviewStoryChangePackage,
  storyDecisionReconciliationPlan,
  storyWorkbenchConvergenceTelemetry,
  storyWorkbenchImpactMap,
} from "../core/story-workflow/workbench/core.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function packageInput(overrides = {}) {
  return {
    projectId: "afterglow-v9",
    decisionId: "story-decision-afterglow",
    responseId: "story-response-afterglow",
    responseClass: "accept-proposal",
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
    predictedImpactRefs: ["ppf:foundations:ren-motivation", "ppf:structure:block-17", "visual:ren-isobel-beach"],
    provenance: {
      humanProfileId: "profile-human-afterglow",
      runRefs: ["run-tamsin"],
      councilResultId: "council-afterglow-ren",
      rationale: "Make the causal choice visible without changing the ending.",
    },
    createdAt: "2026-08-26T20:00:00.000Z",
    ...overrides,
  };
}

function passReview(input = packageInput(), overrides = {}) {
  return reviewStoryChangePackage({
    package: input,
    currentRevision: 9,
    projectMatches: true,
    targetOwned: true,
    frontierEditable: true,
    ...overrides,
  });
}

test("#1419 normalizes one bounded Afterglow Story Change Package without a duplicate project snapshot", () => {
  const storyPackage = normalizeStoryChangePackage(packageInput());
  assert.equal(storyPackage.schemaVersion, 1);
  assert.equal(storyPackage.projectId, "afterglow-v9");
  assert.equal(storyPackage.baseRevision, 9);
  assert.equal(storyPackage.operation.kind, "set");
  assert.equal(storyPackage.operation.targetRef, "ppf:foundations:foundations-essentials-essential-aspects-2-md:output-2");
  assert.equal(storyPackage.requiresCanonApply, true);
  assert.equal(Object.hasOwn(storyPackage, "project"), false);
  assert.equal(Object.hasOwn(storyPackage, "projectSnapshot"), false);
  assert.match(storyPackage.packageId, /^story-change-/);
});

test("#1419 keeps canon, curriculum, continuity, structure and visual/script review axes separate", () => {
  const review = passReview(packageInput(), { visualScriptImpact: true });
  assert.deepEqual(review.axes.map((axis) => axis.id), [
    "canon-authority",
    "curriculum-spec",
    "continuity-consistency",
    "structural-impact",
    "visual-script-impact",
  ]);
  assert.equal(review.axes[0].status, "PASS");
  assert.equal(review.axes[1].status, "PASS");
  assert.equal(review.axes[2].status, "NOT APPLICABLE");
  assert.equal(review.axes[4].status, "FINDINGS");
  assert.equal(review.axes[4].blocking, false, "stale visual projections are visible without pretending they invalidate an otherwise safe field edit");
  assert.equal(review.canApply, true);
});

test("#1419 stale, wrong-project, derived, imported-evidence and Locked targets fail closed", () => {
  for (const scenario of [
    { currentRevision: 10 },
    { projectMatches: false },
    { derivedTarget: true },
    { importedEvidenceTarget: true },
    { lockedPrerequisite: true, frontierEditable: false },
  ]) {
    const review = reviewStoryChangePackage({
      package: packageInput(),
      currentRevision: 9,
      projectMatches: true,
      targetOwned: true,
      frontierEditable: true,
      ...scenario,
    });
    assert.equal(review.canApply, false, JSON.stringify(scenario));
    assert.ok(review.blockingFindingCount >= 1, JSON.stringify(scenario));
  }
});

test("#1419 reject/keep-current completes as an explicit no-change package instead of manufacturing a canon revision", () => {
  for (const responseClass of ["reject-proposal", "keep-current"]) {
    const storyPackage = normalizeStoryChangePackage(packageInput({ responseClass, operation: null }));
    const review = passReview(storyPackage);
    assert.equal(storyPackage.operation, null);
    assert.equal(storyPackage.requiresCanonApply, false);
    assert.equal(review.canComplete, true);
    assert.equal(review.canApply, false);
  }
});

test("#1419 impact is explainable and bounded to the direct target plus recorded dependency evidence", () => {
  const impact = storyWorkbenchImpactMap({ package: packageInput() });
  assert.deepEqual(impact.directChangedRefs, ["ppf:foundations:foundations-essentials-essential-aspects-2-md:output-2"]);
  assert.ok(impact.explainableRefs.includes("ppf:structure:block-17"));
  assert.ok(impact.staleProjectionRefs.includes("visual:ren-isobel-beach"));
  assert.equal(impact.unaffectedByDefault, true);
  assert.equal(impact.explainableRefs.includes("ppf:unrelated:whole-story"), false);
});

test("#1419 post-apply Decision reconciliation stales only open affected Decisions and preserves the source response", () => {
  const records = [
    { decisionId: "source", projectId: "afterglow-v9", status: "answered", targetRefs: ["ppf:foundations:ren"], predictedImpactRefs: [] },
    { decisionId: "affected", projectId: "afterglow-v9", status: "new", targetRefs: ["ppf:structure:block-17"], predictedImpactRefs: [] },
    { decisionId: "unrelated", projectId: "afterglow-v9", status: "new", targetRefs: ["ppf:world:weather"], predictedImpactRefs: [] },
    { decisionId: "other-project", projectId: "other", status: "new", targetRefs: ["ppf:structure:block-17"], predictedImpactRefs: [] },
  ];
  const plan = storyDecisionReconciliationPlan(records, {
    projectId: "afterglow-v9",
    currentRevision: 10,
    sourceDecisionIds: ["source"],
    affectedRefs: ["ppf:structure:block-17"],
  });
  assert.deepEqual(plan.staleDecisionIds, ["affected"]);
  assert.deepEqual(plan.withdrawDecisionIds, []);
  assert.equal(plan.staleDecisionIds.includes("source"), false);
  assert.equal(plan.staleDecisionIds.includes("unrelated"), false);
});

test("#1419 convergence telemetry reports evidence counts without inventing a story quality score", () => {
  const telemetry = storyWorkbenchConvergenceTelemetry({
    openRequiredDecisions: 2,
    unresolvedHighMediumFindings: 1,
    missingCurrentFrontierRequirements: 3,
    staleWorkOrProposals: 2,
    specialistDisagreements: 1,
    affectedWorkItemsRerun: 2,
    newMaterialFindings: 0,
    currentFrontierBlockers: ["Foundations PLAN incomplete"],
  });
  assert.equal(telemetry.openRequiredDecisions, 2);
  assert.equal(telemetry.affectedWorkItemsRerun, 2);
  assert.equal(telemetry.newMaterialFindings, 0);
  assert.equal(Object.hasOwn(telemetry, "qualityScore"), false);
  assert.equal(Object.hasOwn(telemetry, "storyScore"), false);
});

test("#1419 current product adapter uses the Learn-first PPF command/revision boundary, not the legacy full-project or GitHub path", async () => {
  const [workflow, revisionSave, decisionsPage, workbenchPage] = await Promise.all([
    read("modules/story-workflow/workbench/workflow.ts"),
    read("core/storage/revision-safe-project-browser.ts"),
    read("app/story-decisions/page.tsx"),
    read("app/story-workbench/page.tsx"),
  ]);
  for (const contract of [
    "applyStoryCommand",
    "buildFoundationPlanLessons",
    "buildWorldPlanLessons",
    "deriveGuidedCreationProgression",
    "buildFoundationsStoryWorkflowRequirements",
    "planStoryWorkItems",
    "planTargetedStoryReevaluation",
  ]) assert.match(workflow, new RegExp(contract));
  assert.doesNotMatch(workflow, /lib\/projects\/persistence\/project-revisions|createCanonicalProposal|applyWriterApprovedCanonicalProposal/);
  assert.doesNotMatch(workflow, /github|pull request|branch/i);
  assert.match(revisionSave, /RevisionConflictError/);
  assert.match(revisionSave, /current\.revision !== expectedRevision/);
  assert.match(revisionSave, /project\.revision !== expectedRevision \+ 1/);
  assert.match(decisionsPage, /story-workbench\?decisionId=/);
  assert.match(workbenchPage, /saveFoundationProjectAtRevision/);
  assert.match(workbenchPage, /storyDecisionReconciliationPlan/);
  assert.match(workbenchPage, /markDecisionStale/);
  assert.doesNotMatch(workbenchPage, /localStorage|indexedDB|(?:from|import)[^\n]*github/i, "Workbench must not create a second canon/change store or developer integration dependency");
});

test("#1419 Workbench UI presents before/after, separate axes, exact revision apply and targeted re-evaluation evidence", async () => {
  const page = await read("app/story-workbench/page.tsx");
  for (const text of [
    "Current story",
    "Proposed story",
    "Validation",
    "Reviewed revision",
    "Current revision",
    "Apply change",
    "No full-story restart by default.",
    "affected work items re-evaluated",
    "No second PPF or hidden Workbench canon store.",
  ]) assert.ok(page.includes(text), `Story Workbench UI is missing ${text}`);
  assert.match(page, /loadFoundationProject\(\)/);
  assert.match(page, /prepareStoryWorkbenchReview/);
  assert.match(page, /applyStoryWorkbenchReview/);
  assert.match(page, /planTargetedStoryReevaluation/);
  assert.ok(page.indexOf("const saved = saveFoundationProjectAtRevision") < page.indexOf("const reconciliation = storyDecisionReconciliationPlan"), "Decision reconciliation must happen only after the canonical save succeeds");
});
