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
import { buildFoundationCurriculum } from "./foundation-reference-lessons";

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

// Keep the audited v2 JSON archive intact. The presentation curriculum below
// promotes the seven Foundations references into standalone lessons without
// changing or discarding the original source records used for provenance.
const plotPickleCurriculum = topicDocuments
  .flatMap((document) => document.lessons)
  .sort((left, right) => left.number - right.number);

const sourceIds = plotPickleCurriculum.flatMap((lesson) => lesson.sources.map((source) => source.id));
if (plotPickleCurriculum.length !== index.lessonCount || plotPickleCurriculum.length !== 81) {
  throw new Error(`Expected ${index.lessonCount} PlotPickle lessons, found ${plotPickleCurriculum.length}.`);
}
if (sourceIds.length !== index.sourceCount || sourceIds.length !== 95 || new Set(sourceIds).size !== sourceIds.length) {
  throw new Error(`Expected ${index.sourceCount} unique embedded lesson sources, found ${sourceIds.length}.`);
}

const standalonePlotPickleCurriculum: readonly CurriculumLesson[] = topicDocuments
  .flatMap((document) => (
    document.topic.id === "foundations"
      ? buildFoundationCurriculum(document.lessons)
      : document.lessons
  ))
  .sort((left, right) => left.number - right.number);

const standaloneFoundations = standalonePlotPickleCurriculum.filter((lesson) => lesson.topic === "foundations");
const standaloneSourceIds = standalonePlotPickleCurriculum.flatMap((lesson) => lesson.sources.map((source) => source.id));
if (standalonePlotPickleCurriculum.length !== 88 || standaloneFoundations.length !== 11) {
  throw new Error(`Expected 88 presentation lessons with 11 Foundations lessons, found ${standalonePlotPickleCurriculum.length} and ${standaloneFoundations.length}.`);
}
if (standaloneFoundations.some((lesson) => lesson.sources.length !== 0)) {
  throw new Error("Foundations presentation lessons must not contain embedded references.");
}
if (standaloneSourceIds.length !== 88 || new Set(standaloneSourceIds).size !== standaloneSourceIds.length) {
  throw new Error(`Expected 88 remaining embedded presentation references, found ${standaloneSourceIds.length}.`);
}

export { standalonePlotPickleCurriculum as plotPickleCurriculum };
