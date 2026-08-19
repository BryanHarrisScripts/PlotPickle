import character from "../../learn/character.json";
import collaboration from "../../learn/collaboration.json";
import dialogue from "../../learn/dialogue.json";
import drafting from "../../learn/drafting.json";
import foundations from "../../learn/foundations.json";
import industry from "../../learn/industry.json";
import index from "../../learn/index.json";
import responsibleAi from "../../learn/responsible-ai.json";
import revision from "../../learn/revision.json";
import structure from "../../learn/structure.json";
import theme from "../../learn/theme.json";
import visualStorytelling from "../../learn/visual-storytelling.json";
import world from "../../learn/world.json";
import type { CurriculumLesson } from "../../core/contracts/curriculum";
import { compareVisualWriterCurriculumOrder } from "../../core/contracts/visual-writer-progression";
import { FOUNDATION_SOURCE_COVERAGE } from "./foundation-content-coverage";
import { buildDeepFoundationCurriculum } from "./foundation-deep-learning";
import { FOUNDATION_PROMOTED_SOURCE_IDS } from "./foundation-reference-lessons";

type TopicDocument = {
  readonly schemaVersion: string;
  readonly topic: { readonly id: string; readonly title: string };
  readonly lessonCount: number;
  readonly sourceCount: number;
  readonly lessons: readonly CurriculumLesson[];
};

const topicDocuments = [
  foundations,
  industry,
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
] as readonly TopicDocument[];

for (const document of topicDocuments) {
  if (document.schemaVersion !== index.schemaVersion) {
    throw new Error(`LEARN topic ${document.topic.id} uses an unexpected schema version.`);
  }
  if (document.lessonCount !== document.lessons.length) {
    throw new Error(`LEARN topic ${document.topic.id} declares ${document.lessonCount} lessons but contains ${document.lessons.length}.`);
  }
  const sourceCount = document.lessons.reduce((total, lesson) => total + lesson.sources.length, 0);
  if (document.sourceCount !== sourceCount) {
    throw new Error(`LEARN topic ${document.topic.id} declares ${document.sourceCount} sources but contains ${sourceCount}.`);
  }
}

// Keep the audited v2 JSON archive intact. Presentation order is derived from the
// canonical Visual Writer group contract while preserving lesson number inside each group.
const plotPickleCurriculum = topicDocuments
  .flatMap((document) => document.lessons)
  .sort(compareVisualWriterCurriculumOrder);

const sourceIds = plotPickleCurriculum.flatMap((lesson) => lesson.sources.map((source) => source.id));
if (plotPickleCurriculum.length !== index.lessonCount || plotPickleCurriculum.length !== 81) {
  throw new Error(`Expected ${index.lessonCount} PlotPickle lessons, found ${plotPickleCurriculum.length}.`);
}
if (sourceIds.length !== index.sourceCount || sourceIds.length !== 95 || new Set(sourceIds).size !== sourceIds.length) {
  throw new Error(`Expected ${index.sourceCount} unique embedded lesson sources, found ${sourceIds.length}.`);
}

// Foundations promotes its seven references into standalone presentation lessons,
// but it still participates in the same canonical group order without rewriting the archive.
const standalonePlotPickleCurriculum: readonly CurriculumLesson[] = topicDocuments
  .flatMap((document) => (
    document.topic.id === "foundations"
      ? buildDeepFoundationCurriculum(document.lessons)
      : document.lessons
  ))
  .sort(compareVisualWriterCurriculumOrder);

const standaloneFoundations = standalonePlotPickleCurriculum.filter((lesson) => lesson.topic === "foundations");
const foundationSourceIds = standaloneFoundations.flatMap((lesson) => lesson.sources.map((source) => source.id));
const standaloneSourceIds = standalonePlotPickleCurriculum.flatMap((lesson) => lesson.sources.map((source) => source.id));
if (standalonePlotPickleCurriculum.length !== 88 || standaloneFoundations.length !== 11) {
  throw new Error(`Expected 88 presentation lessons with 11 Foundations lessons, found ${standalonePlotPickleCurriculum.length} and ${standaloneFoundations.length}.`);
}
if (
  foundationSourceIds.length !== FOUNDATION_PROMOTED_SOURCE_IDS.length
  || new Set(foundationSourceIds).size !== foundationSourceIds.length
  || FOUNDATION_PROMOTED_SOURCE_IDS.some((sourceId) => !foundationSourceIds.includes(sourceId))
) {
  throw new Error(`Expected all ${FOUNDATION_PROMOTED_SOURCE_IDS.length} canonical Foundations sources to remain attached to their presentation lessons.`);
}
for (const sourceId of FOUNDATION_PROMOTED_SOURCE_IDS) {
  const archiveLesson = standaloneFoundations.find((lesson) => (
    lesson.sources.some((source) => source.id === sourceId)
  ));
  const coverage = FOUNDATION_SOURCE_COVERAGE[sourceId];
  if (!archiveLesson || !coverage || archiveLesson.title !== coverage.archiveLesson) {
    throw new Error(`Foundations source ${sourceId} is missing its audited archive and teaching-destination coverage.`);
  }
}
if (standaloneFoundations.some((lesson, index) => lesson.number !== index + 1)) {
  throw new Error("Foundations presentation lessons must be numbered sequentially from 1 to 11.");
}
if (standaloneSourceIds.length !== 95 || new Set(standaloneSourceIds).size !== standaloneSourceIds.length) {
  throw new Error(`Expected all 95 unique embedded presentation references, found ${standaloneSourceIds.length}.`);
}

export { standalonePlotPickleCurriculum as plotPickleCurriculum };
