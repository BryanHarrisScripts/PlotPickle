import { canonicalTopicDocuments, plotPickleCurriculum } from "../../../../adapters/curriculum/current-catalog";
import { FOUNDATION_PROMOTED_SOURCE_IDS } from "../../../../adapters/curriculum/foundation-reference-lessons";
import { ISSUE_1976_CANONICAL_REGISTRY } from "../../../../adapters/curriculum/issue-1976-canonical";
import type { CurriculumLesson } from "../../../../core/contracts/curriculum";
import { LEARN_PROGRAM_COURSE_SPECS } from "../../../../learn/program-map-spec.mjs";

export const runtime = "nodejs";
export const dynamic = "force-static";

type CourseSpec = (typeof LEARN_PROGRAM_COURSE_SPECS)[number];
const topicById = new Map(canonicalTopicDocuments.map((document) => [document.topic.id, document]));
const courseById = new Map(LEARN_PROGRAM_COURSE_SPECS.map((course) => [course.id, course]));
const promotedFoundationSourceIds = new Set(FOUNDATION_PROMOTED_SOURCE_IDS);

const archiveLessonOwner = new Map<string, CourseSpec>();
for (const course of LEARN_PROGRAM_COURSE_SPECS) {
  for (const reference of course.lessonRefs) {
    const topic = topicById.get(reference.topic);
    if (!topic) throw new Error(`Explore Craft Module ${course.id} references unavailable topic ${reference.topic}.`);
    for (const position of reference.positions) {
      const lesson = topic.lessons[position - 1];
      if (!lesson) throw new Error(`Explore Craft Module ${course.id} references missing lesson ${reference.topic}:${position}.`);
      if (archiveLessonOwner.has(lesson.id)) throw new Error(`Explore found duplicate Journey ownership for canonical lesson ${lesson.id}.`);
      archiveLessonOwner.set(lesson.id, course);
    }
  }
}
for (const entry of ISSUE_1976_CANONICAL_REGISTRY.lessons) {
  const course = courseById.get(entry.ownerCraftModule);
  if (!course) throw new Error(`Phase D enrichment ${entry.id} references missing Craft Module ${entry.ownerCraftModule}.`);
  if (archiveLessonOwner.has(entry.id)) throw new Error(`Phase D enrichment ${entry.id} duplicates Journey ownership.`);
  archiveLessonOwner.set(entry.id, course);
}

function canonicalOwnerLessonId(lesson: CurriculumLesson) {
  if (archiveLessonOwner.has(lesson.id)) return lesson.id;
  const promotedSource = lesson.sources.find((source) => promotedFoundationSourceIds.has(source.id));
  if (!promotedSource) throw new Error(`Explore presentation lesson ${lesson.id} has no canonical Journey owner.`);
  const foundationsDocument = topicById.get("foundations");
  const owner = foundationsDocument?.lessons.find((candidate) => candidate.sources.some((source) => source.id === promotedSource.id));
  if (!owner) throw new Error(`Explore promoted Foundations lesson ${lesson.id} cannot resolve source owner ${promotedSource.id}.`);
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
    if (!course) throw new Error(`Explore presentation lesson ${lesson.id} cannot resolve a Craft Module.`);
    if (!topic) throw new Error(`Explore presentation lesson ${lesson.id} cannot resolve topic ${lesson.topic}.`);

    return {
      presentationId: lesson.id,
      presentationOrder: index + 1,
      canonicalLessonId,
      coverageMode: lesson.id === canonicalLessonId ? "journey" as const : "reference-coverage" as const,
      topic: { id: topic.topic.id, title: topic.topic.title },
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

  if (entries.length !== 96) throw new Error(`Phase D expected 96 presentation lessons, found ${entries.length}.`);
  if (representedTopics.size !== 12) throw new Error(`Phase D expected 12 represented topics, found ${representedTopics.size}.`);
  if (representedCraftModules.size !== 24) throw new Error(`Phase D expected all 24 Craft Modules, found ${representedCraftModules.size}.`);
  if (sourceIds.size !== 95) throw new Error(`Phase D expected 95 unique bundled sources, found ${sourceIds.size}.`);
  if (referenceCoverageCount !== 7) throw new Error(`Phase D expected seven promoted Foundations reference lessons, found ${referenceCoverageCount}.`);

  return Response.json({
    schemaVersion: "1.1",
    issue: 1918,
    phase: "phase-d-canonical-integration",
    topicCount: representedTopics.size,
    presentationLessonCount: entries.length,
    canonicalLessonCount: 89,
    craftModuleCount: representedCraftModules.size,
    bundledSourceCount: sourceIds.size,
    referenceCoverageCount,
    authority: {
      curriculumOwner: "adapters/curriculum/current-catalog.ts",
      journeyMapOwner: "learn/program-map-spec.mjs",
      enrichmentOwner: "learn/enrichment/1976-canonical.json",
      progressOwner: "PPFProject.learning.completedLessonIds",
      journeyAndExploreShareProgress: true,
      accessMode: "unrestricted" as const,
      recommendedSequenceIsAccessControl: false,
      humanMayLearnOutOfOrder: true,
      curriculumBodiesDuplicated: false,
    },
    topics: canonicalTopicDocuments.map((document) => document.topic),
    craftModules: LEARN_PROGRAM_COURSE_SPECS.map((course) => ({
      id: course.id,
      path: course.semester,
      title: course.title,
      applicationTargets: course.applicationTargets,
    })),
    entries,
  });
}
