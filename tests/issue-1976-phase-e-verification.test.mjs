import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";
import { LEARN_CURRENT_ARCHIVE_LESSONS, LEARN_CURRENT_PROGRAM_MAP } from "../learn/current-program-map.mjs";

const execFileAsync = promisify(execFile);
const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const readJson = async (path) => JSON.parse(await read(path));
const sha256 = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

const EXPECTED_IDS = [
  "scene-craft-pressure-and-turn",
  "screenplay-format-and-delivery",
  "adaptation-source-to-screen",
  "professional-pitching-and-representation",
  "series-episode-season-architecture",
  "series-engine-and-bible",
  "writers-room-story-breaking",
  "half-hour-comedy-craft",
];

const BODY_BEARING_SOURCE_KEYS = new Set([
  "body",
  "content",
  "excerpt",
  "quote",
  "script",
  "screenplayPages",
  "skillBody",
  "referenceBody",
]);

const [ledger, design, registry, baseline] = await Promise.all([
  readJson("docs/research/1976-screenwriting-gap-ledger.json"),
  readJson("docs/research/1976-curriculum-design-map.json"),
  readJson("learn/enrichment/1976-canonical.json"),
  readJson("learn/journey-baseline.json"),
]);

const authored = await Promise.all(
  registry.lessons.map(async (entry) => ({
    entry,
    raw: await read(entry.file),
    lesson: (await readJson(entry.file)).lesson,
  })),
);

const enrichmentHashPayload = () => authored.map(({ entry, lesson }) => ({
  id: entry.id,
  file: entry.file,
  topic: entry.topic,
  number: entry.number,
  ownerCraftModule: entry.ownerCraftModule,
  lesson,
}));

function sourceRecordHasBodyPayload(source) {
  if (!source || typeof source !== "object") return false;
  return Object.keys(source).some((key) => BODY_BEARING_SOURCE_KEYS.has(key));
}

test("#1976 Phase E locks the exact eight approved lesson identities from design through canon", () => {
  const designedIds = design.lessonCandidates.map((candidate) => candidate.lessonId);
  const canonicalIds = registry.lessons.map((entry) => entry.id);

  assert.deepEqual([...designedIds].sort(), [...EXPECTED_IDS].sort());
  assert.deepEqual([...canonicalIds].sort(), [...EXPECTED_IDS].sort());
  assert.equal(new Set(canonicalIds).size, EXPECTED_IDS.length);
  assert.equal(registry.authority.c3Approved, false);

  const c3 = design.authoringWaves.find((wave) => wave.id === "C3");
  assert.ok(c3);
  assert.deepEqual(c3.lessonIds, []);
});

test("#1976 Phase E preserves Phase B topic, kind and single Craft Module ownership", () => {
  const designById = new Map(design.lessonCandidates.map((candidate) => [candidate.lessonId, candidate]));
  const ownerMap = new Map(LEARN_CURRENT_ARCHIVE_LESSONS.map((lesson) => [lesson.id, []]));

  for (const course of LEARN_CURRENT_PROGRAM_MAP.courses) {
    for (const lessonId of course.lessonIds) {
      if (ownerMap.has(lessonId)) ownerMap.get(lessonId).push(course.id);
    }
  }

  for (const { entry, lesson } of authored) {
    const candidate = designById.get(entry.id);
    assert.ok(candidate, `${entry.id} is missing from the Phase B design.`);
    assert.equal(entry.topic, candidate.canonicalTopic);
    assert.equal(entry.ownerCraftModule, candidate.ownerCraftModule);
    assert.equal(lesson.topic, candidate.canonicalTopic);
    assert.equal(lesson.kind, candidate.kind);
    assert.equal(lesson.ownerCraftModule, candidate.ownerCraftModule);
    assert.deepEqual(ownerMap.get(entry.id), [candidate.ownerCraftModule]);
  }
});

test("#1976 Phase E requires explicit provenance and forbids body-bearing external source records", () => {
  for (const { entry, raw, lesson } of authored) {
    assert.equal(lesson.provenance?.authorship, "Independently authored for PlotPickle.", `${entry.id} authorship provenance drifted.`);
    assert.ok(lesson.provenance?.externalResearchRole, `${entry.id} must state the external research role.`);
    assert.ok(lesson.provenance?.exampleRights, `${entry.id} must state example-rights provenance.`);
    assert.ok(Array.isArray(lesson.researchSources) && lesson.researchSources.length > 0, `${entry.id} must retain research/source notes.`);

    for (const source of lesson.researchSources) {
      assert.equal(sourceRecordHasBodyPayload(source), false, `${entry.id} source ${source.id ?? "unknown"} contains a body-bearing payload field.`);
      assert.ok(source.id && source.kind && source.title, `${entry.id} source records must remain metadata-bearing provenance records.`);
    }

    assert.doesNotMatch(raw, /jtydhr88\/screenwriting-skills/u, `${entry.id} must not embed the external research repository.`);
    assert.doesNotMatch(raw, /SKILL\.md|reference\.md/u, `${entry.id} must not embed external skill/reference payload filenames.`);
  }
});

test("#1976 Phase E keeps the pinned external repository research-only across the provenance chain", () => {
  assert.equal(ledger.researchSnapshot.repository, "jtydhr88/screenwriting-skills");
  assert.equal(ledger.researchSnapshot.commit, "92022d2123676857e73f3ae94a9b76b6cb3f65b8");
  assert.equal(ledger.authority.externalRepositoryRole, "research-index-only");
  assert.equal(ledger.authority.externalBodiesImported, false);

  assert.equal(design.sourceResearch.repository, ledger.researchSnapshot.repository);
  assert.equal(design.sourceResearch.commit, ledger.researchSnapshot.commit);
  assert.equal(design.sourceResearch.role, "research-index-only");
  assert.equal(design.authority.externalResearchMayDefineLessonBody, false);
  assert.equal(registry.authority.externalResearchBodiesBundled, false);
  assert.equal(registry.authority.enrichmentBodiesDuplicated, false);
});

test("#1976 Phase E verifies frozen base hashes and the current enrichment corpus hash", async () => {
  assert.equal(ledger.plotPickleBaseline.lessonContentSha256, baseline.curriculum.lessonContentSha256);
  assert.equal(ledger.plotPickleBaseline.sourceContentSha256, baseline.curriculum.sourceContentSha256);
  assert.equal(registry.baseArchive.lessonContentSha256, baseline.curriculum.lessonContentSha256);
  assert.equal(registry.baseArchive.sourceContentSha256, baseline.curriculum.sourceContentSha256);
  assert.equal(registry.enrichmentContentSha256, sha256(enrichmentHashPayload()));

  const { stdout, stderr } = await execFileAsync(process.execPath, ["scripts/validate-learn-curriculum-integrity.mjs"], {
    cwd: process.cwd(),
    windowsHide: true,
  });
  assert.equal(stderr, "");
  assert.match(stdout, /81\/81 archived lessons/u);
  assert.match(stdout, /95\/95 bundled sources/u);
  assert.match(stdout, /88\/88 presentation lessons/u);
});

test("#1976 Phase E is verification-only and leaves current navigation/access authority intact", () => {
  assert.equal(LEARN_CURRENT_PROGRAM_MAP.courses.length, 24);
  assert.equal(LEARN_CURRENT_PROGRAM_MAP.canonicalLessonCount, 89);
  assert.ok(LEARN_CURRENT_PROGRAM_MAP.courses.every((course) => course.access === "open"));
  assert.ok(LEARN_CURRENT_PROGRAM_MAP.courses.every((course) => course.prerequisiteMode === "advisory-only"));
  assert.equal(registry.currentCanonicalInventory.presentationLessonCount, 96);
  assert.equal(registry.currentCanonicalInventory.bundledSourceCount, 95);
  assert.equal(registry.authority.progressOwner, "PPFProject.learning.completedLessonIds");
  assert.equal(registry.authority.humanMayLearnOutOfOrder, true);
  assert.equal(registry.authority.recommendedSequenceIsAccessControl, false);
});
