import character from "../../../../learn/character.json";
import collaboration from "../../../../learn/collaboration.json";
import dialogue from "../../../../learn/dialogue.json";
import drafting from "../../../../learn/drafting.json";
import foundations from "../../../../learn/foundations.json";
import industry from "../../../../learn/industry.json";
import responsibleAi from "../../../../learn/responsible-ai.json";
import revision from "../../../../learn/revision.json";
import structure from "../../../../learn/structure.json";
import theme from "../../../../learn/theme.json";
import visualStorytelling from "../../../../learn/visual-storytelling.json";
import world from "../../../../learn/world.json";
import { LEARN_PROGRAM_COURSE_SPECS } from "../../../../learn/program-map-spec.mjs";
import type { CurriculumLesson } from "../../../../core/contracts/curriculum";

export const runtime = "nodejs";
export const dynamic = "force-static";

type TopicDocument = Readonly<{
  topic: Readonly<{ id: string }>;
  lessons: readonly CurriculumLesson[];
}>;

const topicDocuments = [
  foundations,
  theme,
  character,
  world,
  structure,
  dialogue,
  visualStorytelling,
  drafting,
  revision,
  responsibleAi,
  collaboration,
  industry,
] as readonly TopicDocument[];

const lessonsByTopic = new Map(topicDocuments.map((document) => [document.topic.id, document.lessons]));

function resolveCourseLessons(course: (typeof LEARN_PROGRAM_COURSE_SPECS)[number]) {
  return course.lessonRefs.flatMap(({ topic, positions }) => {
    const lessons = lessonsByTopic.get(topic);
    if (!lessons) throw new Error(`Phase 5 course ${course.id} references unavailable canonical topic ${topic}.`);
    return positions.map((position) => {
      const lesson = lessons[position - 1];
      if (!lesson) throw new Error(`Phase 5 course ${course.id} references missing canonical lesson ${topic}:${position}.`);
      return lesson;
    });
  });
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

  if (courses.length !== 24) throw new Error(`Phase 5 expected exactly 24 courses, found ${courses.length}.`);
  if (courses.some((course) => course.lessons.length === 0)) throw new Error("Phase 5 requires every Craft Module to resolve canonical lessons.");

  return Response.json({
    schemaVersion: "1.0",
    issue: 1918,
    phase: "phase-5-all-paths",
    courseCount: courses.length,
    authority: {
      curriculumOwner: "existing LEARN archive",
      progressOwner: "PPFProject.learning.completedLessonIds",
      recommendedSequenceIsAccessControl: false,
      humanMayLearnOutOfOrder: true,
      curriculumBodiesDuplicated: false,
    },
    courses,
  });
}
