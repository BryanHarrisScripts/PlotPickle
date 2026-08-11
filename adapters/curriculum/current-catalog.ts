import curriculumData from "../../data/curriculum/plotpickle-curriculum.json";
import type { CurriculumLesson } from "../../core/contracts/curriculum";

type CurriculumCatalog = {
  readonly schemaVersion: string;
  readonly lessonCount: number;
  readonly lessons: readonly CurriculumLesson[];
};

const catalog = curriculumData as CurriculumCatalog;

if (catalog.lessonCount !== catalog.lessons.length) {
  throw new Error(`Curriculum manifest declares ${catalog.lessonCount} lessons but contains ${catalog.lessons.length}.`);
}

export const plotPickleCurriculum: readonly CurriculumLesson[] = catalog.lessons;

if (plotPickleCurriculum.length !== 81) {
  throw new Error(`Expected 81 PlotPickle curriculum modules, found ${plotPickleCurriculum.length}.`);
}
