import assert from "node:assert/strict";
import test from "node:test";
import { renderDailyReport } from "../lib/verification/oss-radar/report-renderer.mjs";

function candidate(id, fullName, createdAt) {
  return {
    repositoryStableId: id,
    fullName,
    url: `https://github.com/${fullName}`,
    description: `${fullName} fixture`,
    createdAt,
    matchedLaneIds: ["platform-engineering"],
    score: 70,
    discoveryScore: 70,
    scoreStage: "discovery",
    license: { spdxId: "MIT", status: "known-open-source" },
    reviewQualification: "qualified",
    qualificationThreshold: 65,
    primaryDisposition: "WATCH",
    scoreEvidence: { activity: { ageDays: 1 }, relevance: { matchedTerms: [] }, reasonCodes: [] },
  };
}

test("#1977 OSS Radar displays the selected Top 5 newest-created first", () => {
  const oldest = candidate("1", "example/oldest", "2024-01-01T00:00:00Z");
  const newest = candidate("2", "example/newest", "2026-09-15T00:00:00Z");
  const middle = candidate("3", "example/middle", "2025-06-01T00:00:00Z");
  const queue = [oldest, newest, middle];
  const rendered = renderDailyReport({
    reportDate: new Date("2026-09-15T12:00:00Z"),
    selection: { selected: queue, belowThreshold: [], reviewQueue: queue, target: 3, reviewTarget: 3 },
    contract: { report: { targetFindings: 3 } },
    history: new Map(),
  });

  const newestIndex = rendered.body.indexOf("example/newest");
  const middleIndex = rendered.body.indexOf("example/middle");
  const oldestIndex = rendered.body.indexOf("example/oldest");
  assert.ok(newestIndex >= 0 && middleIndex > newestIndex && oldestIndex > middleIndex);
});
