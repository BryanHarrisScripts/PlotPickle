import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const load = async () => JSON.parse(await readFile("config/oss-radar/discovery-contract.json", "utf8"));

test("#1977 Phase 0 discovery lanes", async () => {
  const c = await load();
  assert.equal(c.issue, 1977);
  assert.equal(c.phase, "phase-0-discovery-contract");
  assert.equal(c.status, "contract-only");
  assert.deepEqual(c.lanes.map((x) => x.id), [
    "writer-craft",
    "visual-story",
    "story-game-engine",
    "learn-education",
    "ai-architecture",
    "platform-engineering",
  ]);
  for (const lane of c.lanes) {
    assert.equal(lane.enabled, true);
    assert.ok(lane.queries.length >= 3);
  }
});

test("#1977 Phase 0 daily report contract", async () => {
  const c = await load();
  assert.equal(c.report.targetFindings, 5);
  assert.equal(c.report.neverPadWeakFindings, true);
  assert.equal(c.report.dailyReportIdempotent, true);
  assert.equal(c.report.requiredQuestion, "What can PlotPickle learn from this?");
  assert.deepEqual(c.report.humanDispositions, ["SAVE", "IMPROVE", "ADD", "LEARN", "WATCH"]);
  assert.equal(c.report.humanDispositions.includes("PASS"), false);
  assert.equal(c.report.internalOnlyDisposition, "PASS");
});

test("#1977 Phase 0 scoring contract", async () => {
  const c = await load();
  const total = Object.values(c.scoring.weights).reduce((sum, n) => sum + n, 0);
  assert.equal(total, 100);
  assert.equal(total, c.scoring.baseMaximum);
  assert.equal(c.scoring.integrationCostPenalty.minimum, 0);
  assert.equal(c.scoring.integrationCostPenalty.maximum, 10);
  assert.ok(c.scoring.surfaceThreshold > c.scoring.watchEvidenceThreshold);
  assert.equal(c.scoring.explainableEvidenceRequired, true);
  assert.equal(c.scoring.modelOnlyRankingAllowed, false);
});

test("#1977 Phase 0 filter and license contract", async () => {
  const c = await load();
  assert.equal(c.filters.hardReject.archived, true);
  assert.equal(c.filters.hardReject.nonDivergentFork, true);
  assert.equal(c.filters.hardReject.clearlyIncompatibleLicense, true);
  assert.equal(c.filters.license.unknownLicenseMayRecommendAdoption, false);
  assert.equal(c.filters.license.compatibleLicenseStillRequiresHumanApproval, true);
  assert.equal(c.filters.activity.stalenessPenaltyAfterDays, 365);
  assert.equal(c.filters.activity.rejectAfterDays, 730);
  assert.equal(c.filters.deduplication.suppressPreviouslyReviewedWithoutMeaningfulChange, true);
});

test("#1977 Phase 0 authority boundaries", async () => {
  const c = await load();
  assert.equal(c.humanAuthority.adoptionDecision, "human-only");
  assert.equal(c.humanAuthority.automaticImplementationIssue, false);
  assert.equal(c.humanAuthority.automaticDependencyInstall, false);
  assert.equal(c.humanAuthority.automaticCodeImport, false);
  assert.equal(c.humanAuthority.automaticCurriculumImport, false);
  assert.equal(c.humanAuthority.automaticProductMutation, false);
  assert.equal(c.copyrightAndTeaching.copyThirdPartyLessonBodies, false);
  assert.equal(c.copyrightAndTeaching.copyScreenplayCorpora, false);
  assert.equal(c.copyrightAndTeaching.independentlyAuthorPlotPickleTeaching, true);
});

test("#1977 Phase 0 history and phase boundary", async () => {
  const c = await load();
  for (const field of ["whatCanPlotPickleLearn", "license", "activitySignal", "scoreEvidence"]) {
    assert.ok(c.findingSchema.required.includes(field));
  }
  assert.ok(c.history.requiredKeys.includes("repositoryStableId"));
  assert.ok(c.history.requiredKeys.includes("lastMeaningfulMarker"));
  assert.equal(c.phaseBoundaries.githubApiDiscoveryClient, false);
  assert.equal(c.phaseBoundaries.scheduledWorkflow, false);
  assert.equal(c.phaseBoundaries.monthlyIssueAutomation, false);
  assert.equal(c.phaseBoundaries.modelAssistedAnalysis, false);
});
