import curriculumData from "../../data/curriculum/plotpickle-curriculum.json";
import sourceLibraryData from "../../data/curriculum/plotpickle-source-library.json";
import type { CurriculumKnowledgeSource, CurriculumLesson } from "../../core/contracts/curriculum";

type CurriculumCatalog = {
  readonly schemaVersion: string;
  readonly lessonCount: number;
  readonly lessons: readonly CurriculumLesson[];
};

type CurriculumSourceLibrary = {
  readonly schemaVersion: string;
  readonly sourceCount: number;
  readonly afterglowBoundary: string;
  readonly sources: readonly CurriculumKnowledgeSource[];
};

const catalog = curriculumData as CurriculumCatalog;

if (catalog.lessonCount !== catalog.lessons.length) {
  throw new Error(`Curriculum manifest declares ${catalog.lessonCount} lessons but contains ${catalog.lessons.length}.`);
}

export const plotPickleCurriculum: readonly CurriculumLesson[] = catalog.lessons;

const sourceLibrary = sourceLibraryData as CurriculumSourceLibrary;

if (sourceLibrary.sourceCount !== sourceLibrary.sources.length) {
  throw new Error(`Curriculum source manifest declares ${sourceLibrary.sourceCount} sources but contains ${sourceLibrary.sources.length}.`);
}

export const plotPickleKnowledgeSources: readonly CurriculumKnowledgeSource[] = sourceLibrary.sources;

if (plotPickleCurriculum.length !== 81) {
  throw new Error(`Expected 81 PlotPickle curriculum modules, found ${plotPickleCurriculum.length}.`);
}
