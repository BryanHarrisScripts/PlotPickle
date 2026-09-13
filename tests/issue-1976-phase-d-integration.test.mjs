import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { LEARN_CURRENT_PROGRAM_MAP, LEARN_CURRENT_ARCHIVE_LESSONS } from "../learn/current-program-map.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const readJson = async (path) => JSON.parse(await read(path));
const sha256 = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

const registry = await readJson("learn/enrichment/1976-canonical.json");
const authored = await Promise.all(
  registry.lessons.map(async (entry) => ({ entry, lesson: (await readJson(entry.file)).lesson })),
);

const enrichmentHashPayload = () => authored.map(({ entry, lesson }) => ({
  id: entry.id,
  file: entry.file,
  topic: entry.topic,
  number: entry.number,
  ownerCraftModule: entry.ownerCraftModule,
  lesson,
}));

test("#1976 Phase D promotes exactly eight C1/C2 lessons and leaves C3 unapproved", () => {
  assert.equal(registry.status, "canonical");
  assert.equal(registry.lessons.length, 8);
  assert.equal(new Set(registry.lessons.map((entry) => entry.id)).size, 8);
  assert.equal(registry.authority.c3Approved, false);
  assert.deepEqual(registry.currentCanonicalInventory, {
    topicCount: 12,
    archivedLessonCount: 89,
    bundledSourceCount: 95,
    presentationLessonCount: 96,
    craftModuleCount: 24,
    enrichmentLessonCount: 8,
  });
});

test("#1976 Phase D freezes the independently authored enrichment bodies with SHA-256", () => {
  const actual = sha256(enrichmentHashPayload());
  assert.equal(registry.enrichmentContentSha256, actual, `Phase D enrichment hash mismatch; actual ${actual}`);
});

test("#1976 Phase D gives every current canonical lesson exactly one Craft Module owner", () => {
  assert.equal(LEARN_CURRENT_ARCHIVE_LESSONS.length, 89);
  assert.equal(LEARN_CURRENT_PROGRAM_MAP.courses.length, 24);
  assert.equal(LEARN_CURRENT_PROGRAM_MAP.canonicalLessonCount, 89);

  const ownership = new Map(LEARN_CURRENT_ARCHIVE_LESSONS.map((lesson) => [lesson.id, []]));
  for (const course of LEARN_CURRENT_PROGRAM_MAP.courses) {
    assert.equal(course.access, "open");
    assert.equal(course.prerequisiteMode, "advisory-only");
    for (const lessonId of course.lessonIds) {
      assert.ok(ownership.has(lessonId), `${course.id} references unknown current canonical lesson ${lessonId}.`);
      ownership.get(lessonId).push(course.id);
    }
  }

  for (const [lessonId, owners] of ownership) {
    assert.equal(owners.length, 1, `${lessonId} owners: ${owners.join(", ")}`);
  }
  for (const entry of registry.lessons) {
    assert.deepEqual(ownership.get(entry.id), [entry.ownerCraftModule]);
  }
});

test("#1976 Phase D exposes the current projection through Journey and Explore without changing progress authority", async () => {
  const [catalog, journey, explore] = await Promise.all([
    read("adapters/curriculum/current-catalog-integrated.ts"),
    read("app/api/learn/journey-courses/route.ts"),
    read("app/api/learn/explore/route.ts"),
  ]);

  assert.match(catalog, /archive\.length !== expectedArchiveLessons \|\| archive\.length !== 89/u);
  assert.match(catalog, /standalonePlotPickleCurriculum\.length !== 96/u);
  assert.match(catalog, /sourceIds\.length !== index\.sourceCount[^\n]*95/u);
  assert.match(journey, /canonicalLessonCount: 89/u);
  assert.match(journey, /PPFProject\.learning\.completedLessonIds/u);
  assert.match(explore, /entries\.length !== 96/u);
  assert.match(explore, /canonicalLessonCount: 89/u);
  assert.match(explore, /accessMode: "unrestricted"/u);
  assert.match(explore, /PPFProject\.learning\.completedLessonIds/u);
});

test("#1976 Phase D preserves the frozen #1918 base archive separately from enrichment", async () => {
  const [baseline, index] = await Promise.all([
    readJson("learn/journey-baseline.json"),
    readJson("learn/index.json"),
  ]);

  assert.equal(baseline.curriculum.archivedLessonCount, 81);
  assert.equal(baseline.curriculum.bundledSourceCount, 95);
  assert.equal(baseline.curriculum.presentationLessonCount, 88);
  assert.equal(index.lessonCount, 81);
  assert.equal(index.sourceCount, 95);
  assert.equal(registry.baseArchive.lessonCount, 81);
  assert.equal(registry.baseArchive.bundledSourceCount, 95);
  assert.equal(registry.baseArchive.presentationLessonCount, 88);
  assert.equal(registry.authority.baseArchiveHashesRemainFrozen, true);
});
