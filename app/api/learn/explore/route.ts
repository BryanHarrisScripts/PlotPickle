import { plotPickleCurriculum } from "../../../../adapters/curriculum/current-catalog";
import { FOUNDATION_PROMOTED_SOURCE_IDS } from "../../../../adapters/curriculum/foundation-reference-lessons";
import type { CurriculumLesson } from "../../../../core/contracts/curriculum";
import character from "../../../../learn/character.json";
import collaboration from "../../../../learn/collaboration.json";
import dialogue from "../../../../learn/dialogue.json";
import drafting from "../../../../learn/drafting.json";
import foundations from "../../../../learn/foundations.json";
import industry from "../../../../learn/industry.json";
import { LEARN_PROGRAM_COURSE_SPECS } from "../../../../learn/program-map-spec.mjs";
import responsibleAi from "../../../../learn/responsible-ai.json";
import revision from "../../../../learn/revision.json";
import structure from "../../../../learn/structure.json";
import theme from "../../../../learn/theme.json";
import visualStorytelling from "../../../../learn/visual-storytelling.json";
import world from "../../../../learn/world.json";

export const runtime = "nodejs";
export const dynamic = "force-static";

type TopicDocument = Readonly<{
  topic: Readonly<{ id: string; title: string }>;
  lessons: readonly CurriculumLesson[];
}>;

type CourseSpec = (typeof LEARN_PROGRAM_COURSE_SPECS)[number];

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

const topicById = new Map(topicDocuments.map((document) => [document.topic.id, document]));
const promotedFoundationSourceIds = new Set(FOUNDATION_PROMOTED_SOURCE_IDS);

const archiveLessonOwner = new Map<string, CourseSpec>();
for (const course of LEARN_PROGRAM_COURSE_SPECS) {
  for (const reference of course.lessonRefs) {
    const topic = topicById.get(reference.topic);
    if (!topic) throw new Error(`Phase 6 Craft Module ${course.id} references unavailable topic ${reference.topic}.`);
    for (const position of reference.positions) {
      const lesson = topic.lessons[position - 1];
      if (!lesson) throw new Error(`Phase 6 Craft Module ${course.id} references missing lesson ${reference.topic}:${position}.`);
      if (archiveLessonOwner.has(lesson.id)) throw new Error(`Phase 6 found duplicate Journey ownership for canonical lesson ${lesson.id}.`);
      archiveLessonOwner.set(lesson.id, course);
    }
  }
}

function canonicalOwnerLessonId(lesson: CurriculumLesson) {
  if (archiveLessonOwner.has(lesson.id)) return lesson.id;
  const promotedSource = lesson.sources.find((source) => promotedFoundationSourceIds.has(source.id));
  if (!promotedSource) throw new Error(`Phase 6 presentation lesson ${lesson.id} has no canonical Journey owner.`);
  const foundationsDocument = topicById.get("foundations");
  const owner = foundationsDocument?.lessons.find((candidate) => candidate.sources.some((source) => source.id === promotedSource.id));
  if (!owner) throw new Error(`Phase 6 promoted Foundations lesson ${lesson.id} cannot resolve source owner ${promotedSource.id}.`);
  return owner.id;
}

function unique(values: readonly string[]) {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

export async function GET() {
  const entries = plotPickleCurriculum.map((lesson, index) => {
    const canonicalLessonId = canonicalOwnerLessonId(lesson);
    const course = archiveLessonOwner.get(canonicalLessonId);
    const topic = topicById.get(lesson.topic);
    if (!course) throw new Error(`Phase 6 presentation lesson ${lesson.id} cannot resolve a Craft Module.`);
    if (!topic) throw new Error(`Phase 6 presentation lesson ${lesson.id} cannot resolve topic ${lesson.topic}.`);

    return {
      presentationId: lesson.id,
      presentationOrder: index + 1,
      canonicalLessonId,
      coverageMode: lesson.id === canonicalLessonId ? "journey" as const : "reference-coverage" as const,
      topic: {
        id: topic.topic.id,
        title: topic.topic.title,
      },
      craftModule: {
        id: course.id,
        year: course.year,
        path: course.semester,
        orderInPath: course.orderInSemester,
        title: course.title,
        applicationTargets: course.applicationTargets,
      },
      concepts: unique([
        ...lesson.tags,
        ...lesson.definitions.map((definition) => definition.term),
        ...lesson.sections.map((section) => section.heading),
      ]),
      applicationAreas: unique([lesson.apply, ...course.applicationTargets]),
      lesson,
    };
  });

  const sourceIds = new Set(entries.flatMap((entry) => entry.lesson.sources.map((source) => source.id)));
  const representedTopics = new Set(entries.map((entry) => entry.topic.id));
  const representedCraftModules = new Set(entries.map((entry) => entry.craftModule.id));
  const referenceCoverageCount = entries.filter((entry) => entry.coverageMode === "reference-coverage").length;

  if (entries.length !== 88) throw new Error(`Phase 6 expected 88 presentation lessons, found ${entries.length}.`);
  if (representedTopics.size !== 12) throw new Error(`Phase 6 expected 12 represented topics, found ${representedTopics.size}.`);
  if (representedCraftModules.size !== 24) throw new Error(`Phase 6 expected all 24 Craft Modules to be represented, found ${representedCraftModules.size}.`);
  if (sourceIds.size !== 95) throw new Error(`Phase 6 expected 95 unique bundled sources, found ${sourceIds.size}.`);
  if (referenceCoverageCount !== 7) throw new Error(`Phase 6 expected seven promoted Foundations reference lessons, found ${referenceCoverageCount}.`);

  return Response.json({
    schemaVersion: "1.0",
    issue: 1918,
    phase: "phase-6-explore-all-curriculum",
    topicCount: representedTopics.size,
    presentationLessonCount: entries.length,
    craftModuleCount: representedCraftModules.size,
    bundledSourceCount: sourceIds.size,
    referenceCoverageCount,
    authority: {
      curriculumOwner: "adapters/curriculum/current-catalog.ts",
      journeyMapOwner: "learn/program-map-spec.mjs",
      progressOwner: "PPFProject.learning.completedLessonIds",
      journeyAndExploreShareProgress: true,
      accessMode: "unrestricted" as const,
      recommendedSequenceIsAccessControl: false,
      humanMayLearnOutOfOrder: true,
      curriculumBodiesDuplicated: false,
    },
    topics: topicDocuments.map((document) => document.topic),
    craftModules: LEARN_PROGRAM_COURSE_SPECS.map((course) => ({
      id: course.id,
      path: course.semester,
      title: course.title,
      applicationTargets: course.applicationTargets,
    })),
    entries,
  });
}
