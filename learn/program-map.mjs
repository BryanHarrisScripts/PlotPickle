import { readFileSync } from "node:fs";
import { LEARN_PROGRAM_COURSE_SPECS, LEARN_PROGRAM_SHELL_SPEC } from "./program-map-spec.mjs";

const TOPIC_FILES = [
  "foundations.json",
  "theme.json",
  "character.json",
  "world.json",
  "structure.json",
  "dialogue.json",
  "visual-storytelling.json",
  "drafting.json",
  "revision.json",
  "responsible-ai.json",
  "collaboration.json",
  "industry.json",
];

const topicDocuments = TOPIC_FILES.map((file) => JSON.parse(readFileSync(new URL(`./${file}`, import.meta.url), "utf8")));
const lessonsByTopic = new Map(topicDocuments.map((document) => [document.topic.id, document.lessons]));
const archiveLessons = topicDocuments.flatMap((document) =>
  document.lessons.map((lesson) => ({ ...lesson, canonicalTopic: document.topic.id })),
);

function resolveLessonRefs(lessonRefs) {
  return lessonRefs.flatMap(({ topic, positions }) => {
    const lessons = lessonsByTopic.get(topic);
    if (!lessons) throw new Error(`LEARN program map references unknown canonical topic ${topic}.`);
    return positions.map((position) => {
      const lesson = lessons[position - 1];
      if (!lesson) throw new Error(`LEARN program map references missing canonical lesson position ${topic}:${position}.`);
      return lesson.id;
    });
  });
}

const courses = LEARN_PROGRAM_COURSE_SPECS.map((spec) => ({
  ...spec,
  access: "open",
  prerequisiteMode: "advisory-only",
  lessonIds: resolveLessonRefs(spec.lessonRefs),
}));

export const LEARN_PROGRAM_MAP = Object.freeze({
  ...LEARN_PROGRAM_SHELL_SPEC,
  semesters: LEARN_PROGRAM_SHELL_SPEC.semesters,
  courses,
});

export const LEARN_PROGRAM_ARCHIVE_LESSONS = Object.freeze(
  archiveLessons.map((lesson) => ({
    id: lesson.id,
    number: lesson.number,
    topic: lesson.canonicalTopic,
    title: lesson.title,
  })),
);

export default LEARN_PROGRAM_MAP;
