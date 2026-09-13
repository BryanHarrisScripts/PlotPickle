import { canonicalTopicDocuments } from "../../../../adapters/curriculum/current-catalog";
import { ISSUE_1976_CANONICAL_REGISTRY } from "../../../../adapters/curriculum/issue-1976-canonical";
import { LEARN_PROGRAM_COURSE_SPECS } from "../../../../learn/program-map-spec.mjs";
import type { CurriculumLesson } from "../../../../core/contracts/curriculum";

export const runtime = "nodejs";
export const dynamic = "force-static";

type CourseSpec = (typeof LEARN_PROGRAM_COURSE_SPECS)[number];
const lessonsByTopic = new Map(canonicalTopicDocuments.map((document) => [document.topic.id, document.lessons]));

function enrichmentLessonsForCourse(course: CourseSpec) {
  return ISSUE_1976_CANONICAL_REGISTRY.lessons
    .filter((entry) => entry.ownerCraftModule === course.id)
    .map((entry) => {
      const lesson = lessonsByTopic.get(entry.topic)?.find((candidate) => candidate.id === entry.id);
      if (!lesson) throw new Error(`Phase D cannot resolve canonical enrichment lesson ${entry.id}.`);
      return lesson;
    });
}

function resolveCourseLessons(course: CourseSpec): readonly CurriculumLesson[] {
  const baseLessons = course.lessonRefs.flatMap(({ topic, positions }) => {
    const lessons = lessonsByTopic.get(topic);
    if (!lessons) throw new Error(`Journey course ${course.id} references unavailable canonical topic ${topic}.`);
    return positions.map((position) => {
      const lesson = lessons[position - 1];
      if (!lesson) throw new Error(`Journey course ${course.id} references missing canonical lesson ${topic}:${position}.`);
      return lesson;
    });
  });
  return [...baseLessons, ...enrichmentLessonsForCourse(course)];
}

export async function GET() {
  const courses = LEARN_PROGRAM_COURSE_SPECS.map((course) => ({
    id: course.id,
    year: course.year,
    semester: course.semester,
    orderInSemester: course.orderInSemester,
    title: course.title,
    purpose: course.purpose,
    advisoryPrerequisites: course.advisoryPrerequisites,
    applicationTargets: course.applicationTargets,
    access: "open" as const,
    prerequisiteMode: "advisory-only" as const,
    status: "wired" as const,
    contentAvailable: true as const,
    lessons: resolveCourseLessons(course),
  }));

  if (courses.length !== 24) throw new Error(`Journey expected exactly 24 courses, found ${courses.length}.`);
  if (courses.some((course) => course.lessons.length === 0)) throw new Error("Journey requires every Craft Module to resolve canonical lessons.");
  if (new Set(courses.flatMap((course) => course.lessons.map((lesson) => lesson.id))).size !== 89) throw new Error("Phase D expected 89 uniquely owned canonical Journey lessons.");

  return Response.json({
    schemaVersion: "1.1",
    issue: 1918,
    phase: "phase-d-canonical-integration",
    courseCount: courses.length,
    canonicalLessonCount: 89,
    authority: {
      curriculumOwner: "adapters/curriculum/current-catalog.ts",
      enrichmentOwner: "learn/enrichment/1976-canonical.json",
      progressOwner: "PPFProject.learning.completedLessonIds",
      recommendedSequenceIsAccessControl: false,
      humanMayLearnOutOfOrder: true,
      curriculumBodiesDuplicated: false,
    },
    courses,
  });
}
