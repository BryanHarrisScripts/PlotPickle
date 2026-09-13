import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { phase3Decision } from "../lib/verification/oss-radar/phase3-decision.mjs";
import { renderDailyReport, selectDailyFindings } from "../lib/verification/oss-radar/report-renderer.mjs";

const contract = JSON.parse(await readFile("config/oss-radar/discovery-contract.json", "utf8"));

function candidate(id, lane, score, text, overrides = {}) {
  return {
    repositoryStableId: String(id),
    fullName: `fixture/project-${id}`,
    url: `https://github.com/fixture/project-${id}`,
    description: text,
    searchableText: text.toLowerCase(),
    matchedLaneIds: [lane],
    matchedQueries: [lane],
    score,
    pushedAt: "2026-09-10T00:00:00Z",
    updatedAt: "2026-09-10T00:00:00Z",
    license: { spdxId: "MIT", status: "known-open-source" },
    adoptionEligibleForHumanReview: true,
    scoreEvidence: {
      activity: { ageDays: 3, signal: 1 },
      maturity: { signal: 0.8, stars: 500, forks: 40 },
      relevance: { matchedTerms: text.toLowerCase().split(/\s+/u).slice(0, 4) },
      dimensions: {
        saveWorkValue: { points: 7 },
        missingPieceValue: { points: 5 },
        writerValue: { points: 6 },
        studentLearningValue: { points: 5 },
        evolutionValue: { points: 7 },
      },
      reasonCodes: [`lane:${lane}`, "activity:recent", "license:known-open-source"],
    },
    ...overrides,
  };
}

const samples = {
  save: candidate(1, "platform-engineering", 82, "windows desktop installer local transcription microphone"),
  improve: candidate(2, "visual-story", 75, "storyboard previs cinematography video"),
  add: candidate(3, "story-game-engine", 75, "interactive narrative story engine replay"),
  learn: candidate(4, "writer-craft", 72, "character dialogue structure revision adaptation television comedy"),
  watch: candidate(5, "ai-architecture", 67, "agent runtime context memory evaluation"),
};

test("#1977 Phase 3 deterministically covers all five Human-facing dispositions", () => {
  assert.deepEqual(
    [samples.save, samples.improve, samples.add, samples.learn, samples.watch].map(phase3Decision),
    [0, 1, 2, 3, 4],
  );
});

test("#1977 Phase 3 license ceiling prevents strongest component recommendation", () => {
  const reviewRequired = candidate(6, "platform-engineering", 90, "windows desktop installer", {
    license: { spdxId: "CUSTOM", status: "review-required" },
    adoptionEligibleForHumanReview: false,
  });
  const unknown = candidate(7, "platform-engineering", 90, "windows desktop installer", {
    license: { spdxId: "UNKNOWN", status: "unknown" },
    adoptionEligibleForHumanReview: false,
  });
  assert.equal(phase3Decision(reviewRequired), 1);
  assert.equal(phase3Decision(unknown), 4);
});

test("#1977 Phase 3 selection resolves classifier indexes through Phase 0 vocabulary", () => {
  const selection = selectDailyFindings({
    candidates: [samples.save, samples.improve, samples.add, samples.learn, samples.watch],
    contract,
    history: new Map(),
    reportDate: "2026-09-13",
  });
  assert.equal(selection.selected.length, 5);
  assert.deepEqual(selection.selected.map((item) => item.primaryDisposition), contract.report.humanDispositions);
});

test("#1977 Phase 3 report exposes bounded PlotPickle fit without claiming implementation facts", () => {
  const selection = selectDailyFindings({
    candidates: [samples.save, samples.improve, samples.add, samples.learn, samples.watch],
    contract,
    history: new Map(),
    reportDate: "2026-09-13",
  });
  const rendered = renderDailyReport({ reportDate: "2026-09-13", selection, contract, history: new Map() });
  assert.match(rendered.body, /Phase 3 classifications are deterministic Radar guidance/u);
  assert.match(rendered.body, /STORY \/ Game Engine/u);
  assert.match(rendered.body, /Related Issue fit:.*#1675/u);
  assert.match(rendered.body, /Craft Module fit:.*12/u);
  assert.match(rendered.body, /Craft Module fit:.*03/u);
  assert.match(rendered.body, /Related Issue fit:.*#1976/u);
  assert.match(rendered.body, /Related Issue fit:.*#1692/u);
  assert.match(rendered.body, /repository metadata alone does not prove implementation fit/u);
});

test("#1977 Phase 3 preserves WATCH-only unknown-license evidence at the lower threshold", () => {
  const unknown = candidate(8, "ai-architecture", 60, "agent runtime context memory", {
    license: { spdxId: "UNKNOWN", status: "unknown" },
    adoptionEligibleForHumanReview: false,
  });
  const selection = selectDailyFindings({ candidates: [unknown], contract, history: new Map(), reportDate: "2026-09-13" });
  assert.equal(selection.selected.length, 1);
  assert.equal(selection.selected[0].primaryDisposition, contract.report.humanDispositions[4]);
});
