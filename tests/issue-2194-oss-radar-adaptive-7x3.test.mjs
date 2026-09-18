import assert from "node:assert/strict";
import test from "node:test";

import { configuredQueries, loadDiscoveryContract } from "../lib/verification/oss-radar/discover-github.mjs";
import { selectDailyFindings } from "../lib/verification/oss-radar/report-renderer-core.mjs";
import { renderXReadyDigest } from "../lib/verification/oss-radar/public-digest.mjs";

const categoryForLane = {
  "writer-craft": "WRITER CRAFT",
  "visual-story": "VISUAL STORY",
  "story-game-engine": "STORY / GAME ENGINE",
  "learn-education": "LEARN / EDUCATION",
  "ai-architecture": "AI ARCHITECTURE",
  "platform-engineering": "ARCHITECTURE",
  "architectural-comparators": "ARCHITECTURAL COMPARATOR",
};

function candidate({ areaId, laneId, conceptId, index, score = 80 }) {
  return {
    repositoryStableId: `${areaId}-${index}`,
    fullName: `fixture/${areaId}-${index}`,
    url: `https://github.com/fixture/${areaId}-${index}`,
    description: `Fixture for ${areaId} ${conceptId}`,
    searchableText: `${areaId} ${conceptId}`,
    matchedLaneIds: [laneId],
    matchedQueries: [`${areaId} query ${index}`],
    matchedQueryRefs: [{
      id: `${laneId}/family-${index}/01`,
      laneId,
      familyId: `family-${index}`,
      query: `${areaId} query ${index}`,
    }],
    score,
    discoveryScore: score - 2,
    scoreStage: "enriched",
    surfaceEligible: true,
    watchEvidenceEligible: true,
    adoptionEligibleForHumanReview: true,
    pushedAt: "2026-09-18T12:00:00Z",
    updatedAt: "2026-09-18T12:00:00Z",
    stars: index,
    forks: 0,
    license: { status: "known-open-source", spdxId: "MIT", adoptionEligibleForHumanReview: true },
    scoreEvidence: {
      dimensions: {
        saveWorkValue: { points: 7 },
        missingPieceValue: { points: 5 },
        writerValue: { points: 4 },
        studentLearningValue: { points: 4 },
        evolutionValue: { points: 8 },
      },
      maturity: { signal: 0.6 },
      activity: { ageDays: 0 },
      relevance: {
        matchedTerms: [],
        evidenceConcepts: [conceptId],
        evidenceLaneIds: [laneId],
        plotPickleTargets: [areaId],
      },
      reasonCodes: [`lane:${laneId}`, `evidence:${conceptId}`],
    },
  };
}

function fixtureCandidates() {
  const definitions = [
    ["experience-skins", "learn-education", "generative-ui"],
    ["experience-contract", "platform-engineering", "ui-contract"],
    ["production-orchestration", "story-game-engine", "workflow-orchestration"],
    ["agent-skill-mesh", "ai-architecture", "agent-runtime"],
    ["story-canon-evidence", "writer-craft", "story-state"],
    ["provider-runtime", "architectural-comparators", "provider-routing"],
    ["validation-operations", "platform-engineering", "security-audit"],
  ];
  return definitions.flatMap(([areaId, laneId, conceptId]) =>
    [0, 1, 2, 3].map((index) => candidate({
      areaId,
      laneId,
      conceptId,
      index,
      score: 90 - index,
    }))
  );
}

test("#2194 loads the adaptive seven-area, 7x3 Radar contract", async () => {
  const contract = await loadDiscoveryContract();
  assert.equal(contract.selectionMode, "architecture-7x3");
  assert.equal(contract.architectureAreas.length, 7);
  assert.equal(contract.report.findingsPerArea, 3);
  assert.equal(contract.report.targetFindings, 21);
  assert.equal(contract.discoveryBudget.finalReviewCount, 21);
  assert.equal(contract.discoveryBudget.enrichmentShortlistSize, 42);
  assert.equal(contract.discoveryBudget.laneBalancedEnrichment, true);
  assert.equal(configuredQueries(contract).length, 42);
  assert.equal(contract.scoring.weights.aiArchitectureValue > contract.scoring.weights.writerValue, true);
  assert.equal(contract.priorityProfile.architectureAdaptability > contract.priorityProfile.storytellingCreativeCapability, true);
  assert.deepEqual(
    contract.architectureAreas.map((area) => area.backendAlias),
    [
      "Experience Skins",
      "Experience Contract",
      "Production Orchestration",
      "Agent & Skill Mesh",
      "Story / Canon / Evidence",
      "Provider Runtime",
      "Validation & Operations",
    ],
  );
});

test("#2194 selects three complementary unique findings per architecture area", async () => {
  const contract = await loadDiscoveryContract();
  const selection = selectDailyFindings({
    candidates: fixtureCandidates(),
    contract,
    history: new Map(),
    reportDate: "2026-09-18",
  });

  assert.equal(selection.areaSelections.length, 7);
  assert.deepEqual(selection.areaSelections.map((section) => section.findings.length), [3, 3, 3, 3, 3, 3, 3]);
  assert.equal(selection.reviewQueue.length, 21);
  assert.equal(new Set(selection.reviewQueue.map((item) => item.repositoryStableId)).size, 21);
  for (const section of selection.areaSelections) {
    assert.equal(new Set(section.findings.flatMap((item) => item.matchedQueryRefs.map((ref) => ref.familyId))).size, 3);
  }

  const digest = renderXReadyDigest({ reportDate: "2026-09-18", candidates: selection.reviewQueue });
  for (const area of contract.architectureAreas) assert.equal(digest.includes(area.backendAlias), true);
});

test("#2194 suppresses unchanged prior reviews and fills each area from fresh candidates", async () => {
  const contract = await loadDiscoveryContract();
  const candidates = fixtureCandidates();
  const history = new Map();

  for (const area of contract.architectureAreas) {
    const priorCandidate = candidates.find((item) => item.repositoryStableId === `${area.id}-0`);
    const laneId = priorCandidate.matchedLaneIds[0];
    history.set(String(priorCandidate.repositoryStableId), {
      repositoryStableId: String(priorCandidate.repositoryStableId),
      fullName: priorCandidate.fullName,
      firstSeenDate: "2026-09-18",
      lastReviewedDate: "2026-09-18",
      lastMeaningfulMarker: priorCandidate.pushedAt,
      previousDisposition: "IMPROVE",
      previousQualification: "qualified",
      internalCategories: [categoryForLane[laneId]],
      previousScoreEvidence: {
        finalScore: priorCandidate.score,
        reasonCodes: priorCandidate.scoreEvidence.reasonCodes,
        matchedLaneIds: priorCandidate.matchedLaneIds,
      },
      plotPickleDecision: "unreviewed",
    });
  }

  const selection = selectDailyFindings({
    candidates,
    contract,
    history,
    reportDate: "2026-09-19",
  });

  assert.equal(selection.reviewQueue.length, 21);
  assert.equal(selection.suppressed.length >= 7, true);
  for (const area of contract.architectureAreas) {
    assert.equal(selection.reviewQueue.some((item) => item.repositoryStableId === `${area.id}-0`), false);
  }
  assert.deepEqual(selection.areaSelections.map((section) => section.findings.length), [3, 3, 3, 3, 3, 3, 3]);
});
