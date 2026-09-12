import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { LEARN_PROGRAM_COURSE_SPECS } from "../learn/program-map-spec.mjs";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const EXPECTED_LESSON_IDS = [
  "adaptation-source-to-screen",
  "half-hour-comedy-craft",
  "professional-pitching-and-representation",
  "scene-craft-pressure-and-turn",
  "screenplay-format-and-delivery",
  "series-engine-and-bible",
  "series-episode-season-architecture",
  "writers-room-story-breaking",
].sort();

const ALLOWED_LESSON_KINDS = new Set(["essential", "deep-dive", "medium-extension"]);
const ALLOWED_COMPANION_TYPES = new Set(["case-study", "exercise"]);
const BODY_KEYS = new Set(["sections", "objectives", "definitions", "example", "checklist", "mistakes", "exercise", "overview", "content"]);

async function existingCanonicalLessonIds() {
  const index = await readJson("learn/index.json");
  const documents = await Promise.all(index.files.map((item) => readJson(`learn/${item.file}`)));
  return new Set(documents.flatMap((document) => document.lessons.map((lesson) => lesson.id)));
}

function assertNoLessonBodies(value, path = "design") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoLessonBodies(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.equal(BODY_KEYS.has(key), false, `${path}.${key} must not contain Phase C lesson-body material.`);
    assertNoLessonBodies(child, `${path}.${key}`);
  }
}

test("#1976 Phase B reserves exactly eight non-colliding lesson IDs without mutating the LEARN baseline", async () => {
  const [design, baseline, currentIds] = await Promise.all([
    readJson("docs/research/1976-curriculum-design-map.json"),
    readJson("learn/journey-baseline.json"),
    existingCanonicalLessonIds(),
  ]);

  assert.equal(design.issue, 1976);
  assert.equal(design.phase, "phase-b-curriculum-design");
  assert.equal(design.currentBaseline.mutatedByPhaseB, false);
  assert.deepEqual(
    {
      topicCount: design.currentBaseline.topicCount,
      archivedLessonCount: design.currentBaseline.archivedLessonCount,
      bundledSourceCount: design.currentBaseline.bundledSourceCount,
      presentationLessonCount: design.currentBaseline.presentationLessonCount,
    },
    baseline.curriculum,
  );

  const ids = design.lessonCandidates.map((candidate) => candidate.lessonId);
  assert.equal(ids.length, 8);
  assert.equal(new Set(ids).size, 8);
  assert.deepEqual([...ids].sort(), EXPECTED_LESSON_IDS);
  for (const id of ids) assert.equal(currentIds.has(id), false, `${id} already exists in canonical LEARN.`);

  assert.equal(design.planningProjection.approvedNewCanonicalLessons, 8);
  assert.equal(design.planningProjection.projectedArchivedLessonCountAfterAllApprovedLessons, 89);
  assert.equal(design.planningProjection.projectedPresentationLessonCountAfterAllApprovedLessons, 96);
  assert.equal(design.planningProjection.projectionIsCurrentCanon, false);
});

test("#1976 Phase B gives every lesson one topic owner and one existing Craft Module owner", async () => {
  const [design, index, ledger] = await Promise.all([
    readJson("docs/research/1976-curriculum-design-map.json"),
    readJson("learn/index.json"),
    readJson("docs/research/1976-screenwriting-gap-ledger.json"),
  ]);

  const topics = new Set(index.files.map((item) => item.topic));
  const courseIds = new Set(LEARN_PROGRAM_COURSE_SPECS.map((course) => course.id));
  const researchSkillIds = new Set(ledger.entries.map((entry) => entry.skillId));
  assert.equal(courseIds.size, 24);

  for (const candidate of design.lessonCandidates) {
    assert.ok(ALLOWED_LESSON_KINDS.has(candidate.kind), `${candidate.lessonId} has an unknown lesson kind.`);
    assert.ok(topics.has(candidate.canonicalTopic), `${candidate.lessonId} points to unknown topic ${candidate.canonicalTopic}.`);
    assert.equal(typeof candidate.ownerCraftModule, "string");
    assert.ok(courseIds.has(candidate.ownerCraftModule), `${candidate.lessonId} has unknown owner ${candidate.ownerCraftModule}.`);
    assert.equal(new Set(candidate.relatedCraftModules).size, candidate.relatedCraftModules.length);
    for (const courseId of candidate.relatedCraftModules) assert.ok(courseIds.has(courseId), `${candidate.lessonId} relates to unknown ${courseId}.`);
    assert.ok(candidate.sourceSkillIds.length > 0);
    for (const skillId of candidate.sourceSkillIds) assert.ok(researchSkillIds.has(skillId), `${candidate.lessonId} cites unknown Phase A research skill ${skillId}.`);
    assert.ok(candidate.applicationTargets.length > 0);
    assert.ok(candidate.rationale.trim());
    assert.ok(candidate.learningBoundary.trim());
    assert.ok(candidate.provenanceRequirement.trim());
  }
});

test("#1976 Phase B keeps case studies and exercises attached to lessons rather than creating a second curriculum tree", async () => {
  const design = await readJson("docs/research/1976-curriculum-design-map.json");
  const companionIds = [];
  for (const candidate of design.lessonCandidates) {
    assert.ok(candidate.companionItems.length > 0, `${candidate.lessonId} should have at least one applied companion.`);
    for (const item of candidate.companionItems) {
      assert.ok(ALLOWED_COMPANION_TYPES.has(item.type), `${item.id} has unsupported type ${item.type}.`);
      assert.ok(item.id.trim());
      assert.ok(item.title.trim());
      assert.ok(item.purpose.trim());
      companionIds.push(item.id);
    }
  }
  assert.equal(new Set(companionIds).size, companionIds.length);
  assert.equal(design.authority.oneCanonicalTopicPerLesson, true);
  assert.equal(design.authority.oneOwnerCraftModulePerLesson, true);
  assert.equal(design.authority.relatedCraftModulesAreCrossLinksOnly, true);
});

test("#1976 Phase B authoring waves are bounded and C3 remains explicitly deferred", async () => {
  const design = await readJson("docs/research/1976-curriculum-design-map.json");
  const byWave = new Map(design.authoringWaves.map((wave) => [wave.id, wave]));
  assert.deepEqual(byWave.get("C1").lessonIds.sort(), [
    "adaptation-source-to-screen",
    "professional-pitching-and-representation",
    "scene-craft-pressure-and-turn",
    "screenplay-format-and-delivery",
  ]);
  assert.deepEqual(byWave.get("C2").lessonIds.sort(), [
    "half-hour-comedy-craft",
    "series-engine-and-bible",
    "series-episode-season-architecture",
    "writers-room-story-breaking",
  ]);
  assert.deepEqual(byWave.get("C3").lessonIds, []);

  const waveIds = [...byWave.get("C1").lessonIds, ...byWave.get("C2").lessonIds].sort();
  assert.deepEqual(waveIds, EXPECTED_LESSON_IDS);
  for (const candidate of design.lessonCandidates) assert.equal(candidate.phaseCWave === "C1" || candidate.phaseCWave === "C2", true);

  assert.equal(design.deferredEnrichment.length, 3);
  for (const item of design.deferredEnrichment) assert.equal(item.decision, "defer-to-C3");
});

test("#1976 Phase B remains design-only, research-bounded and guided-not-gated", async () => {
  const [design, designSource, brief] = await Promise.all([
    readJson("docs/research/1976-curriculum-design-map.json"),
    readFile("docs/research/1976-curriculum-design-map.json", "utf8"),
    readFile("docs/developer-briefs/1976-phase-b-curriculum-design.md", "utf8"),
  ]);

  assert.equal(design.sourceResearch.role, "research-index-only");
  assert.equal(design.sourceResearch.commit, "92022d2123676857e73f3ae94a9b76b6cb3f65b8");
  assert.equal(design.authority.humanMayLearnOutOfOrder, true);
  assert.equal(design.authority.newMaterialMayGateAccess, false);
  assert.equal(design.authority.externalResearchMayDefineLessonBody, false);
  assert.equal(design.authority.phaseBMayWriteCurriculumBodies, false);
  assertNoLessonBodies(design);
  assert.doesNotMatch(designSource, /"course-(?:2[5-9]|[3-9]\d)"/u);
  assert.match(brief, /Do not begin Phase C in the same PR/u);
  assert.match(brief, /guided, never gated/iu);
});
