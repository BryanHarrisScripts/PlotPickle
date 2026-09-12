import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const C1_IDS = [
  "scene-craft-pressure-and-turn",
  "screenplay-format-and-delivery",
  "adaptation-source-to-screen",
  "professional-pitching-and-representation",
].sort();

const C2_IDS = [
  "series-episode-season-architecture",
  "series-engine-and-bible",
  "writers-room-story-breaking",
  "half-hour-comedy-craft",
].sort();

const REQUIRED_LESSON_FIELDS = [
  "id",
  "topic",
  "ownerCraftModule",
  "kind",
  "title",
  "duration",
  "overview",
  "objectives",
  "sections",
  "definitions",
  "example",
  "checklist",
  "mistakes",
  "exercise",
  "apply",
  "applicationTargets",
  "tags",
  "companionItems",
  "researchSources",
  "provenance",
];

const PROHIBITED_SOURCE_BODY_KEYS = new Set([
  "content",
  "quote",
  "quotes",
  "excerpt",
  "excerpts",
  "skillBody",
  "referenceBody",
  "scriptBody",
]);

function assertNoImportedSourceBody(value, path = "lesson") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoImportedSourceBody(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.equal(PROHIBITED_SOURCE_BODY_KEYS.has(key), false, `${path}.${key} must not embed external source body text.`);
    assertNoImportedSourceBody(child, `${path}.${key}`);
  }
}

async function canonicalLessonIds() {
  const index = await readJson("learn/index.json");
  const ids = [];
  for (const item of index.files) {
    const topic = await readJson(`learn/${item.file}`);
    ids.push(...topic.lessons.map((lesson) => lesson.id));
  }
  return ids;
}

test("#1976 Phase C1 authors exactly the four Phase B general-craft lessons and keeps them staged", async () => {
  const [manifest, design] = await Promise.all([
    readJson("learn/enrichment/1976-c1/manifest.json"),
    readJson("docs/research/1976-curriculum-design-map.json"),
  ]);

  assert.equal(manifest.issue, 1976);
  assert.equal(manifest.phase, "phase-c1-independent-authoring");
  assert.equal(manifest.status, "staged-not-canonical");
  assert.equal(manifest.authority.canonicalIntegrationDeferredToPhaseD, true);

  const manifestIds = manifest.lessons.map((entry) => entry.id).sort();
  assert.deepEqual(manifestIds, C1_IDS);

  const designC1 = design.lessonCandidates.filter((lesson) => lesson.phaseCWave === "C1");
  assert.deepEqual(designC1.map((lesson) => lesson.lessonId).sort(), C1_IDS);
  assert.deepEqual(manifest.deferred.C2.slice().sort(), C2_IDS);

  const files = await readdir("learn/enrichment/1976-c1");
  const authoredLessonFiles = files.filter((file) => file.endsWith(".json") && file !== "manifest.json");
  assert.equal(authoredLessonFiles.length, 4);
  for (const c2Id of C2_IDS) assert.equal(files.includes(`${c2Id}.json`), false, `${c2Id} must remain deferred to C2.`);
});

test("#1976 Phase C1 bodies match the locked Phase B identity, topic, kind, ownership and companion design", async () => {
  const [manifest, design] = await Promise.all([
    readJson("learn/enrichment/1976-c1/manifest.json"),
    readJson("docs/research/1976-curriculum-design-map.json"),
  ]);
  const designById = new Map(design.lessonCandidates.map((lesson) => [lesson.lessonId, lesson]));

  for (const entry of manifest.lessons) {
    const staged = await readJson(entry.file);
    const lesson = staged.lesson;
    const locked = designById.get(entry.id);
    assert.ok(locked, `${entry.id} must exist in Phase B.`);
    assert.equal(staged.staging.issue, 1976);
    assert.equal(staged.staging.phase, "phase-c1-independent-authoring");
    assert.equal(staged.staging.canonicalOnIntegration, false);
    assert.equal(lesson.id, locked.lessonId);
    assert.equal(lesson.title, locked.title);
    assert.equal(lesson.topic, locked.canonicalTopic);
    assert.equal(lesson.kind, locked.kind);
    assert.equal(lesson.ownerCraftModule, locked.ownerCraftModule);
    assert.deepEqual(lesson.relatedCraftModules, locked.relatedCraftModules);
    assert.deepEqual(lesson.applicationTargets, locked.applicationTargets);
    assert.deepEqual(
      lesson.companionItems.map((item) => item.id),
      locked.companionItems.map((item) => item.id),
    );
  }
});

test("#1976 Phase C1 lessons contain complete PlotPickle teaching bodies without grading or mandatory revision", async () => {
  const manifest = await readJson("learn/enrichment/1976-c1/manifest.json");

  for (const entry of manifest.lessons) {
    const { lesson } = await readJson(entry.file);
    for (const field of REQUIRED_LESSON_FIELDS) assert.ok(field in lesson, `${lesson.id}.${field} is required.`);
    assert.ok(lesson.overview.trim().length >= 100, `${lesson.id} overview is too thin.`);
    assert.ok(lesson.objectives.length >= 3, `${lesson.id} needs at least three objectives.`);
    assert.ok(lesson.sections.length >= 4, `${lesson.id} needs substantive sections.`);
    assert.ok(lesson.definitions.length >= 3, `${lesson.id} needs definitions.`);
    assert.ok(lesson.checklist.length >= 5, `${lesson.id} needs a usable checklist.`);
    assert.ok(lesson.mistakes.length >= 4, `${lesson.id} needs common mistakes.`);
    assert.ok(lesson.exercise.trim().length >= 80, `${lesson.id} exercise is too thin.`);
    assert.ok(lesson.tags.length >= 5, `${lesson.id} needs browse/search tags.`);
    assert.ok(lesson.researchSources.length >= 1, `${lesson.id} needs provenance metadata.`);
    assert.equal(lesson.provenance.authorship, "Independently authored for PlotPickle.");

    const body = JSON.stringify(lesson);
    assert.doesNotMatch(body, /\b(pass|fail|grade|mastery score|mandatory revision|required revision)\b/iu, `${lesson.id} must not introduce grading/gating semantics.`);
    assertNoImportedSourceBody(lesson.researchSources, `${lesson.id}.researchSources`);
  }
});

test("#1976 Phase C1 keeps external research and mutable industry/legal rules outside curriculum authority", async () => {
  const manifest = await readJson("learn/enrichment/1976-c1/manifest.json");
  for (const entry of manifest.lessons) {
    const { lesson } = await readJson(entry.file);
    assert.match(lesson.provenance.externalResearchRole, /no .*copied|verification only|used only|source bodies copied|prose copied/iu);
    assert.equal(lesson.provenance.legalAdvice, false);
    for (const source of lesson.researchSources) {
      assert.equal("content" in source, false);
      if (source.url) assert.match(source.url, /^https:\/\//u);
    }
  }

  const format = (await readJson("learn/enrichment/1976-c1/screenplay-format-and-delivery.json")).lesson;
  assert.equal(format.provenance.mutableRulesFrozenIntoCanon, false);
  const professional = (await readJson("learn/enrichment/1976-c1/professional-pitching-and-representation.json")).lesson;
  assert.equal(professional.provenance.mutableRulesFrozenIntoCanon, false);
  const adaptation = (await readJson("learn/enrichment/1976-c1/adaptation-source-to-screen.json")).lesson;
  assert.equal(adaptation.provenance.professionalReviewRecommendedForMaterialRightsDecisions, true);
});

test("#1976 Phase C1 does not promote staged lessons or change the canonical curriculum baseline", async () => {
  const [baseline, canonicalIds, manifest] = await Promise.all([
    readJson("learn/journey-baseline.json"),
    canonicalLessonIds(),
    readJson("learn/enrichment/1976-c1/manifest.json"),
  ]);

  assert.equal(baseline.curriculum.topicCount, 12);
  assert.equal(baseline.curriculum.archivedLessonCount, 81);
  assert.equal(baseline.curriculum.bundledSourceCount, 95);
  assert.equal(baseline.curriculum.presentationLessonCount, 88);
  for (const entry of manifest.lessons) {
    assert.equal(canonicalIds.includes(entry.id), false, `${entry.id} must remain staged until Phase D.`);
  }
  assert.equal(manifest.authority.currentCountsHashesUnchanged, true);
  assert.equal(manifest.authority.gradingOrMasteryGateAdded, false);
});
