import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const C2_IDS = [
  "series-episode-season-architecture",
  "series-engine-and-bible",
  "writers-room-story-breaking",
  "half-hour-comedy-craft",
].sort();

const REQUIRED_LESSON_FIELDS = [
  "id", "topic", "ownerCraftModule", "kind", "title", "duration", "overview",
  "objectives", "sections", "definitions", "example", "checklist", "mistakes",
  "exercise", "apply", "applicationTargets", "tags", "companionItems",
  "researchSources", "provenance",
];

async function canonicalLessonIds() {
  const index = await readJson("learn/index.json");
  const ids = [];
  for (const item of index.files) {
    const topic = await readJson(`learn/${item.file}`);
    ids.push(...topic.lessons.map((lesson) => lesson.id));
  }
  return ids;
}

test("#1976 Phase C2 authors exactly the four locked television medium extensions", async () => {
  const [manifest, design] = await Promise.all([
    readJson("learn/enrichment/1976-c2/manifest.json"),
    readJson("docs/research/1976-curriculum-design-map.json"),
  ]);
  assert.equal(manifest.issue, 1976);
  assert.equal(manifest.phase, "phase-c2-independent-authoring");
  assert.equal(manifest.status, "staged-not-canonical");
  assert.deepEqual(manifest.lessons.map((entry) => entry.id).sort(), C2_IDS);
  assert.deepEqual(
    design.lessonCandidates.filter((lesson) => lesson.phaseCWave === "C2").map((lesson) => lesson.lessonId).sort(),
    C2_IDS,
  );
  const files = await readdir("learn/enrichment/1976-c2");
  assert.equal(files.filter((file) => file.endsWith(".json") && file !== "manifest.json").length, 4);
});

test("#1976 Phase C2 bodies preserve the Phase B identity and ownership map", async () => {
  const [manifest, design] = await Promise.all([
    readJson("learn/enrichment/1976-c2/manifest.json"),
    readJson("docs/research/1976-curriculum-design-map.json"),
  ]);
  const designById = new Map(design.lessonCandidates.map((lesson) => [lesson.lessonId, lesson]));
  for (const entry of manifest.lessons) {
    const staged = await readJson(entry.file);
    const lesson = staged.lesson;
    const locked = designById.get(entry.id);
    assert.ok(locked);
    assert.equal(staged.staging.phase, "phase-c2-independent-authoring");
    assert.equal(staged.staging.canonicalOnIntegration, false);
    assert.equal(lesson.id, locked.lessonId);
    assert.equal(lesson.title, locked.title);
    assert.equal(lesson.topic, locked.canonicalTopic);
    assert.equal(lesson.kind, locked.kind);
    assert.equal(lesson.ownerCraftModule, locked.ownerCraftModule);
    assert.deepEqual(lesson.relatedCraftModules, locked.relatedCraftModules);
    assert.deepEqual(lesson.applicationTargets, locked.applicationTargets);
    assert.deepEqual(lesson.companionItems.map((item) => item.id), locked.companionItems.map((item) => item.id));
  }
});

test("#1976 Phase C2 teaching bodies are complete and explicitly medium-specific", async () => {
  const manifest = await readJson("learn/enrichment/1976-c2/manifest.json");
  for (const entry of manifest.lessons) {
    const { lesson } = await readJson(entry.file);
    for (const field of REQUIRED_LESSON_FIELDS) assert.ok(field in lesson, `${lesson.id}.${field} is required.`);
    assert.equal(lesson.kind, "medium-extension");
    assert.ok(lesson.overview.trim().length >= 100);
    assert.ok(lesson.objectives.length >= 3);
    assert.ok(lesson.sections.length >= 4);
    assert.ok(lesson.definitions.length >= 3);
    assert.ok(lesson.checklist.length >= 5);
    assert.ok(lesson.mistakes.length >= 4);
    assert.ok(lesson.exercise.trim().length >= 80);
    assert.ok(lesson.tags.length >= 5);
    assert.ok(lesson.researchSources.length >= 1);
    assert.equal(lesson.provenance.authorship, "Independently authored for PlotPickle.");
    assert.equal(lesson.provenance.mediumSpecific, true);
    assert.equal(lesson.provenance.mutableRulesFrozenIntoCanon, false);
    assert.equal(lesson.provenance.legalAdvice, false);
  }
});

test("#1976 Phase C2 preserves learner authority and does not turn medium conventions into gates", async () => {
  const manifest = await readJson("learn/enrichment/1976-c2/manifest.json");
  assert.equal(manifest.authority.mediumExtensionsAreUniversalRules, false);
  assert.equal(manifest.authority.gradingOrMasteryGateAdded, false);
  for (const entry of manifest.lessons) {
    const { lesson } = await readJson(entry.file);
    const body = JSON.stringify(lesson);
    assert.doesNotMatch(body, /\b(pass|fail|grade|mastery score|mandatory revision|required revision)\b/iu);
    for (const source of lesson.researchSources) {
      assert.equal("content" in source, false);
      assert.equal("quote" in source, false);
      assert.equal("excerpt" in source, false);
    }
  }
});

test("#1976 Phase C2 remains staged and leaves the canonical LEARN baseline unchanged", async () => {
  const [baseline, canonicalIds, manifest, c1] = await Promise.all([
    readJson("learn/journey-baseline.json"),
    canonicalLessonIds(),
    readJson("learn/enrichment/1976-c2/manifest.json"),
    readJson("learn/enrichment/1976-c1/manifest.json"),
  ]);
  assert.equal(baseline.curriculum.topicCount, 12);
  assert.equal(baseline.curriculum.archivedLessonCount, 81);
  assert.equal(baseline.curriculum.bundledSourceCount, 95);
  assert.equal(baseline.curriculum.presentationLessonCount, 88);
  assert.equal(c1.lessons.length, 4);
  for (const entry of manifest.lessons) assert.equal(canonicalIds.includes(entry.id), false, `${entry.id} must remain staged until Phase D.`);
  assert.equal(manifest.authority.currentCountsHashesUnchanged, true);
  assert.match(manifest.deferred.C3, /unapproved/iu);
});
