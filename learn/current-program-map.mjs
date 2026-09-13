import { readFileSync } from "node:fs";
import { LEARN_PROGRAM_MAP, LEARN_PROGRAM_ARCHIVE_LESSONS } from "./program-map.mjs";

const registry = JSON.parse(readFileSync(new URL("./enrichment/1976-canonical.json", import.meta.url), "utf8"));
const enrichmentLessons = registry.lessons.map((entry) => {
  const staged = JSON.parse(readFileSync(new URL(`../${entry.file}`, import.meta.url), "utf8")).lesson;
  if (!staged || staged.id !== entry.id) throw new Error(`#1976 canonical registry cannot resolve ${entry.id}.`);
  return { id: entry.id, number: entry.number, topic: entry.topic, title: staged.title, ownerCraftModule: entry.ownerCraftModule };
});

const courses = LEARN_PROGRAM_MAP.courses.map((course) => ({
  ...course,
  lessonIds: [
    ...course.lessonIds,
    ...enrichmentLessons.filter((lesson) => lesson.ownerCraftModule === course.id).map((lesson) => lesson.id),
  ],
}));

export const LEARN_CURRENT_PROGRAM_MAP = Object.freeze({
  ...LEARN_PROGRAM_MAP,
  phase: "phase-d-canonical-integration",
  courses: Object.freeze(courses),
  canonicalLessonCount: LEARN_PROGRAM_ARCHIVE_LESSONS.length + enrichmentLessons.length,
  enrichmentRegistry: "learn/enrichment/1976-canonical.json",
});

export const LEARN_CURRENT_ARCHIVE_LESSONS = Object.freeze([
  ...LEARN_PROGRAM_ARCHIVE_LESSONS,
  ...enrichmentLessons.map(({ ownerCraftModule: _owner, ...lesson }) => lesson),
]);

export default LEARN_CURRENT_PROGRAM_MAP;
