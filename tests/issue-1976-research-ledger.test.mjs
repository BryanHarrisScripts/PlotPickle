import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { LEARN_PROGRAM_COURSE_SPECS } from "../learn/program-map-spec.mjs";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const EXPECTED_SKILLS = [
  "chekhov-dramaturgy",
  "ozu-screenplay-style",
  "succession-series-writing",
  "sw-american-case-studies",
  "sw-character-conflict",
  "sw-chinese-opera-banqiang",
  "sw-chinese-series-practice",
  "sw-dialogue",
  "sw-format-adaptation",
  "sw-industry-business",
  "sw-japanese-screenwriting",
  "sw-korean-french-screenwriting",
  "sw-premise-theme",
  "sw-scene-craft",
  "sw-series-case-studies",
  "sw-series-engine-bible",
  "sw-series-structure",
  "sw-sitcom-comedy",
  "sw-story-structure",
  "sw-workflow",
  "sw-writers-room",
].sort();

const ALLOWED_CLASSIFICATIONS = new Set(["strong-overlap", "partial", "gap", "specialist"]);
const ALLOWED_SHAPES = new Set(["none", "extension", "deep-dive", "case-study", "exercise", "new-lesson"]);
const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);
const PROHIBITED_BODY_KEYS = new Set(["content", "quote", "quotes", "excerpt", "excerpts", "skillBody", "referenceBody", "scriptBody"]);

function assertNoImportedBodyFields(value, path = "ledger") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoImportedBodyFields(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.equal(PROHIBITED_BODY_KEYS.has(key), false, `${path}.${key} must not embed external body text.`);
    assertNoImportedBodyFields(child, `${path}.${key}`);
  }
}

test("#1976 Phase A pins the original 21-skill research snapshot and preserves the canonical LEARN baseline", async () => {
  const [ledger, baseline] = await Promise.all([
    readJson("docs/research/1976-screenwriting-gap-ledger.json"),
    readJson("learn/journey-baseline.json"),
  ]);

  assert.equal(ledger.issue, 1976);
  assert.equal(ledger.phase, "phase-a-research-ledger");
  assert.equal(ledger.researchSnapshot.repository, "jtydhr88/screenwriting-skills");
  assert.equal(ledger.researchSnapshot.commit, "92022d2123676857e73f3ae94a9b76b6cb3f65b8");
  assert.equal(ledger.researchSnapshot.skillCount, 21);
  assert.equal(ledger.authority.externalRepositoryRole, "research-index-only");
  assert.equal(ledger.authority.externalBodiesImported, false);
  assert.equal(ledger.authority.classificationIsBuildCommitment, false);

  assert.deepEqual(ledger.plotPickleBaseline, {
    topicCount: baseline.curriculum.topicCount,
    archivedLessonCount: baseline.curriculum.archivedLessonCount,
    bundledSourceCount: baseline.curriculum.bundledSourceCount,
    presentationLessonCount: baseline.curriculum.presentationLessonCount,
    lessonContentSha256: baseline.curriculum.lessonContentSha256,
    sourceContentSha256: baseline.curriculum.sourceContentSha256,
  });
  assert.equal(baseline.curriculum.archivedLessonCount, 81);
  assert.equal(baseline.curriculum.bundledSourceCount, 95);
  assert.equal(baseline.curriculum.presentationLessonCount, 88);
});

test("#1976 Phase A ledger covers each pinned external skill exactly once with bounded classifications", async () => {
  const ledger = await readJson("docs/research/1976-screenwriting-gap-ledger.json");
  const ids = ledger.entries.map((entry) => entry.skillId);
  assert.equal(ids.length, 21);
  assert.equal(new Set(ids).size, 21);
  assert.deepEqual([...ids].sort(), EXPECTED_SKILLS);

  const counts = Object.fromEntries([...ALLOWED_CLASSIFICATIONS].map((classification) => [
    classification,
    ledger.entries.filter((entry) => entry.classification === classification).length,
  ]));
  assert.deepEqual(counts, {
    "strong-overlap": 4,
    partial: 7,
    gap: 5,
    specialist: 5,
  });

  for (const entry of ledger.entries) {
    assert.ok(ALLOWED_CLASSIFICATIONS.has(entry.classification), `${entry.skillId} has an unknown classification.`);
    assert.ok(ALLOWED_SHAPES.has(entry.recommendedShape), `${entry.skillId} has an unknown recommended shape.`);
    assert.ok(ALLOWED_PRIORITIES.has(entry.priority), `${entry.skillId} has an unknown priority.`);
    for (const field of ["territory", "missingTerritory", "recommendation", "provenance"]) {
      assert.equal(typeof entry[field], "string");
      assert.ok(entry[field].trim().length > 0, `${entry.skillId}.${field} must be populated.`);
    }
    assert.equal(typeof entry.currentCoverage?.summary, "string");
    assert.ok(entry.currentCoverage.summary.trim().length > 0);
    if (entry.recommendedShape !== "none") {
      assert.ok(entry.candidateHomes.length > 0, `${entry.skillId} recommends content but has no existing Craft Module home.`);
    }
  }
});

test("#1976 Phase A maps only to current PlotPickle topics and the existing 24 Craft Modules", async () => {
  const [ledger, index] = await Promise.all([
    readJson("docs/research/1976-screenwriting-gap-ledger.json"),
    readJson("learn/index.json"),
  ]);
  const topics = new Set(index.files.map((item) => item.topic));
  const courseIds = new Set(LEARN_PROGRAM_COURSE_SPECS.map((course) => course.id));
  assert.equal(courseIds.size, 24);

  for (const entry of ledger.entries) {
    assert.ok(entry.currentCoverage.topics.length > 0, `${entry.skillId} must name current PlotPickle coverage.`);
    for (const topic of entry.currentCoverage.topics) {
      assert.ok(topics.has(topic), `${entry.skillId} points to unknown topic ${topic}.`);
    }
    for (const courseId of [...entry.currentCoverage.craftModules, ...entry.candidateHomes]) {
      assert.ok(courseIds.has(courseId), `${entry.skillId} points to unknown Craft Module ${courseId}.`);
    }
  }
});

test("#1976 Phase A summary points to ledger rows and imports no external skill/reference bodies", async () => {
  const ledger = await readJson("docs/research/1976-screenwriting-gap-ledger.json");
  const ids = new Set(ledger.entries.map((entry) => entry.skillId));
  assert.ok(ledger.highestValueGaps.length >= 5);
  for (const family of ledger.highestValueGaps) {
    assert.ok(family.family.trim());
    assert.ok(family.reason.trim());
    assert.ok(family.skillIds.length > 0);
    for (const skillId of family.skillIds) assert.ok(ids.has(skillId), `${family.family} references unknown skill ${skillId}.`);
  }
  assertNoImportedBodyFields(ledger);
});

test("#1976 Phase A remains research-only and does not redefine the 6 Paths / 24 Craft Modules", async () => {
  const [brief, ledgerSource] = await Promise.all([
    readFile("docs/developer-briefs/1976-phase-a-research-ledger.md", "utf8"),
    readFile("docs/research/1976-screenwriting-gap-ledger.json", "utf8"),
  ]);
  assert.match(brief, /preserve 6 Paths \/ 24 Craft Modules/u);
  assert.match(brief, /Do not:\s*[\s\S]*author new curriculum lesson bodies/u);
  assert.match(brief, /Do not:\s*[\s\S]*add new Paths or Craft Modules/u);
  assert.match(brief, /Do not proceed|Do not begin Phase B|Do not begin #1918 Phase 8/iu);
  assert.doesNotMatch(ledgerSource, /"course-(?:2[5-9]|[3-9]\d)"/u);
});
