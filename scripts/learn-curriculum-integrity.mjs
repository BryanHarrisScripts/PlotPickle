import { createHash } from "node:crypto";

const CURRICULUM_BODY_KEYS = new Set([
  "overview",
  "objectives",
  "sections",
  "definitions",
  "example",
  "checklist",
  "mistakes",
  "exercise",
  "sources",
  "original",
]);

const sha256Json = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function canonicalLessonHashPayload(lessons) {
  return [...lessons]
    .sort((left, right) => left.number - right.number)
    .map((lesson) => ({
      id: lesson.id,
      number: lesson.original?.number,
      path: lesson.original?.path,
      title: lesson.title,
      duration: lesson.duration,
      overview: lesson.overview,
      objectives: lesson.objectives,
      sections: lesson.sections,
      definitions: lesson.definitions,
      example: lesson.example,
      checklist: lesson.checklist,
      mistakes: lesson.mistakes,
      exercise: lesson.exercise,
      apply: lesson.apply,
      tags: lesson.tags,
    }));
}

function collectForbiddenCurriculumBodyPaths(value, path = "programMap", findings = []) {
  if (!value || typeof value !== "object") return findings;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectForbiddenCurriculumBodyPaths(item, `${path}[${index}]`, findings));
    return findings;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (CURRICULUM_BODY_KEYS.has(key)) findings.push(childPath);
    collectForbiddenCurriculumBodyPaths(child, childPath, findings);
  }
  return findings;
}

function extractPromotedFoundationSourceIds(source) {
  return [...source.matchAll(/sourceId:\s*"([^"]+)"/gu)].map((match) => match[1]);
}

export function validateLearnCurriculumIntegrity({
  baseline,
  index,
  topicDocuments,
  programMap,
  presentationAdapterSource = "",
  foundationReferenceSource = "",
}) {
  const failures = [];
  const check = (condition, message) => {
    if (!condition) failures.push(message);
  };

  const documents = Array.isArray(topicDocuments) ? topicDocuments : [];
  const indexFiles = Array.isArray(index?.files) ? index.files : [];
  const archiveLessons = documents.flatMap((document) =>
    (Array.isArray(document?.lessons) ? document.lessons : []).map((lesson) => ({
      ...lesson,
      canonicalTopic: document?.topic?.id,
    })),
  );
  const sources = archiveLessons.flatMap((lesson) => Array.isArray(lesson.sources) ? lesson.sources : []);
  const canonicalLessonIds = archiveLessons.map((lesson) => lesson.id);
  const canonicalSourceIds = sources.map((source) => source.id);
  const courseList = Array.isArray(programMap?.courses) ? programMap.courses : [];
  const courseIds = courseList.map((course) => course.id);
  const courseIdSet = new Set(courseIds);
  const canonicalLessonIdSet = new Set(canonicalLessonIds);

  check(baseline?.issue === 1918, "Integrity baseline must belong to issue #1918.");
  check(documents.length === baseline?.curriculum?.topicCount, `Expected ${baseline?.curriculum?.topicCount} canonical topics, found ${documents.length}.`);
  check(indexFiles.length === baseline?.curriculum?.topicCount, `Index must enumerate ${baseline?.curriculum?.topicCount} canonical topics, found ${indexFiles.length}.`);
  check(new Set(documents.map((document) => document?.topic?.id)).size === documents.length, "Canonical topic IDs must be unique.");

  const documentsByTopic = new Map(documents.map((document) => [document?.topic?.id, document]));
  for (const entry of indexFiles) {
    const document = documentsByTopic.get(entry.topic);
    check(Boolean(document), `Explore/index references missing canonical topic ${entry.topic}.`);
    if (!document) continue;
    const lessons = Array.isArray(document.lessons) ? document.lessons : [];
    const sourceCount = lessons.reduce((total, lesson) => total + (Array.isArray(lesson.sources) ? lesson.sources.length : 0), 0);
    check(document.schemaVersion === index.schemaVersion, `Topic ${entry.topic} schema version no longer matches the canonical index.`);
    check(document.lessonCount === lessons.length, `Topic ${entry.topic} declared lesson count does not match its actual lessons.`);
    check(document.sourceCount === sourceCount, `Topic ${entry.topic} declared source count does not match its actual sources.`);
    check(entry.lessonCount === lessons.length, `Explore/index lesson coverage drifted for topic ${entry.topic}.`);
    check(entry.sourceCount === sourceCount, `Explore/index source coverage drifted for topic ${entry.topic}.`);
  }

  check(archiveLessons.length === baseline?.curriculum?.archivedLessonCount, `Expected ${baseline?.curriculum?.archivedLessonCount} archived lessons, found ${archiveLessons.length}.`);
  check(archiveLessons.length === index?.lessonCount, `Canonical index expected ${index?.lessonCount} archived lessons, found ${archiveLessons.length}.`);
  check(new Set(canonicalLessonIds).size === canonicalLessonIds.length, "Canonical archive lesson IDs must remain unique.");
  check(sources.length === baseline?.curriculum?.bundledSourceCount, `Expected ${baseline?.curriculum?.bundledSourceCount} bundled sources, found ${sources.length}.`);
  check(sources.length === index?.sourceCount, `Canonical index expected ${index?.sourceCount} bundled sources, found ${sources.length}.`);
  check(new Set(canonicalSourceIds).size === canonicalSourceIds.length, "Canonical bundled source IDs must remain unique.");

  const actualLessonHash = sha256Json(canonicalLessonHashPayload(archiveLessons));
  const actualSourceHash = sha256Json([...sources].sort((left, right) => left.id.localeCompare(right.id)));
  check(actualLessonHash === baseline?.curriculum?.lessonContentSha256, "Canonical LEARN lesson content changed from the frozen #1918 baseline hash.");
  check(actualSourceHash === baseline?.curriculum?.sourceContentSha256, "Canonical LEARN source content changed from the frozen #1918 baseline hash.");
  check(actualLessonHash === index?.lessonContentSha256, "Canonical LEARN lesson content no longer matches index.json SHA-256 evidence.");
  check(actualSourceHash === index?.sourceContentSha256, "Canonical LEARN source content no longer matches index.json SHA-256 evidence.");

  check(programMap?.courseCount === 24, `Expected program-map courseCount 24, found ${programMap?.courseCount}.`);
  check(courseList.length === 24, `Expected 24 program-map courses, found ${courseList.length}.`);
  check(courseIdSet.size === courseIds.length, "Program-map course IDs must remain unique.");

  const ownership = new Map(canonicalLessonIds.map((lessonId) => [lessonId, []]));
  for (const course of courseList) {
    const lessonIds = Array.isArray(course.lessonIds) ? course.lessonIds : [];
    check(course.access === "open", `${course.id} must remain open and cannot become a curriculum gate.`);
    check(course.prerequisiteMode === "advisory-only", `${course.id} prerequisites must remain advisory only.`);
    for (const lessonId of lessonIds) {
      check(canonicalLessonIdSet.has(lessonId), `${course.id} references unknown canonical lesson ${lessonId}.`);
      if (ownership.has(lessonId)) ownership.get(lessonId).push(course.id);
    }
    for (const prerequisite of Array.isArray(course.advisoryPrerequisites) ? course.advisoryPrerequisites : []) {
      check(courseIdSet.has(prerequisite), `${course.id} references unknown advisory prerequisite ${prerequisite}.`);
      check(prerequisite !== course.id, `${course.id} cannot list itself as an advisory prerequisite.`);
    }
  }

  for (const [lessonId, owners] of ownership) {
    check(owners.length > 0, `Canonical lesson ${lessonId} is orphaned from the 24-course Journey map.`);
    check(owners.length === 1, `Canonical lesson ${lessonId} has duplicate course ownership: ${owners.join(", ") || "none"}.`);
  }

  const forbiddenBodyPaths = collectForbiddenCurriculumBodyPaths(programMap);
  check(forbiddenBodyPaths.length === 0, `Program map must remain index/orchestration only; curriculum-body fields found at: ${forbiddenBodyPaths.join(", ")}.`);
  check(programMap?.authority?.mapRole === "index-and-orchestration-only", "Program map authority must remain index-and-orchestration-only.");
  check(programMap?.authority?.curriculumBodiesDuplicated === false, "Program map must explicitly forbid duplicated curriculum bodies.");
  check(programMap?.authority?.recommendedSequenceIsAccessControl === false, "Recommended sequence must never become access control.");
  check(programMap?.authority?.humanMayLearnOutOfOrder === true, "Human out-of-order learning authority must remain explicit.");

  const foundations = documentsByTopic.get("foundations");
  const foundationLessons = Array.isArray(foundations?.lessons) ? foundations.lessons : [];
  const foundationSources = foundationLessons.flatMap((lesson) => Array.isArray(lesson.sources) ? lesson.sources : []);
  const promotedFoundationSourceIds = extractPromotedFoundationSourceIds(foundationReferenceSource);
  const promotedFoundationSourceIdSet = new Set(promotedFoundationSourceIds);
  const foundationSourceIdSet = new Set(foundationSources.map((source) => source.id));
  const coveredPromotedFoundationSourceIdSet = new Set(
    [...promotedFoundationSourceIdSet].filter((sourceId) => foundationSourceIdSet.has(sourceId)),
  );

  check(promotedFoundationSourceIds.length === promotedFoundationSourceIdSet.size, "Foundations promoted presentation source IDs must be unique.");
  check(promotedFoundationSourceIdSet.size === foundationSourceIdSet.size, `Expected every one of the ${foundationSourceIdSet.size} Foundations sources to be promoted into presentation/reference coverage.`);
  for (const sourceId of foundationSourceIdSet) {
    check(promotedFoundationSourceIdSet.has(sourceId), `Foundations source ${sourceId} is missing promoted presentation/reference coverage.`);
  }
  for (const sourceId of promotedFoundationSourceIdSet) {
    check(foundationSourceIdSet.has(sourceId), `Promoted Foundations presentation source ${sourceId} is not part of the canonical Foundations archive.`);
  }

  const presentationLessonCount = archiveLessons.length + coveredPromotedFoundationSourceIdSet.size;
  const foundationsPresentationLessonCount = foundationLessons.length + coveredPromotedFoundationSourceIdSet.size;
  check(presentationLessonCount === baseline?.curriculum?.presentationLessonCount, `Expected ${baseline?.curriculum?.presentationLessonCount} presentation lessons, accounted for ${presentationLessonCount}.`);
  check(foundationsPresentationLessonCount === baseline?.curriculum?.foundationsPresentationLessonCount, `Expected ${baseline?.curriculum?.foundationsPresentationLessonCount} Foundations presentation lessons, accounted for ${foundationsPresentationLessonCount}.`);
  check(presentationAdapterSource.includes(`standalonePlotPickleCurriculum.length !== ${baseline?.curriculum?.presentationLessonCount}`), "Current curriculum adapter no longer enforces the frozen presentation lesson count.");
  check(presentationAdapterSource.includes(`standaloneFoundations.length !== ${baseline?.curriculum?.foundationsPresentationLessonCount}`), "Current curriculum adapter no longer enforces the frozen Foundations presentation lesson count.");

  const ownerForLesson = new Map([...ownership].map(([lessonId, owners]) => [lessonId, owners[0] ?? null]));
  const journeyCoverage = archiveLessons.map((lesson) => ({
    presentationId: lesson.id,
    mode: "journey",
    canonicalLessonId: lesson.id,
    courseId: ownerForLesson.get(lesson.id),
  }));
  const referenceCoverage = [];
  for (const lesson of foundationLessons) {
    for (const source of Array.isArray(lesson.sources) ? lesson.sources : []) {
      if (!coveredPromotedFoundationSourceIdSet.has(source.id)) continue;
      referenceCoverage.push({
        presentationId: `foundations-${source.id.replace(/^24-blocks-/u, "")}`,
        mode: "reference-coverage",
        sourceId: source.id,
        canonicalLessonId: lesson.id,
        courseId: ownerForLesson.get(lesson.id),
      });
    }
  }
  const presentationCoverage = [...journeyCoverage, ...referenceCoverage];
  check(presentationCoverage.length === baseline?.curriculum?.presentationLessonCount, "Every presentation lesson must have Journey or explicit reference coverage.");
  check(new Set(presentationCoverage.map((entry) => entry.presentationId)).size === presentationCoverage.length, "Presentation coverage IDs must be unique.");
  check(presentationCoverage.every((entry) => Boolean(entry.courseId)), "Every presentation coverage record must resolve to a Journey course through its canonical lesson.");

  check(indexFiles.every((entry) => documentsByTopic.has(entry.topic)), "Explore/index must continue to reach every canonical topic document.");
  check(archiveLessons.length === index.lessonCount && sources.length === index.sourceCount, "Explore/index must continue to enumerate the complete canonical lesson and source inventory.");

  return {
    ok: failures.length === 0,
    failures,
    summary: {
      topicCount: documents.length,
      archivedLessonCount: archiveLessons.length,
      bundledSourceCount: sources.length,
      presentationLessonCount,
      courseCount: courseList.length,
      journeyPresentationCoverageCount: journeyCoverage.length,
      referencePresentationCoverageCount: referenceCoverage.length,
      lessonContentSha256: actualLessonHash,
      sourceContentSha256: actualSourceHash,
    },
    coverage: {
      journey: journeyCoverage,
      references: referenceCoverage,
    },
  };
}

export function assertLearnCurriculumIntegrity(input) {
  const result = validateLearnCurriculumIntegrity(input);
  if (!result.ok) {
    throw new Error(`PlotPickle LEARN curriculum integrity failed:\n- ${result.failures.join("\n- ")}`);
  }
  return result;
}
