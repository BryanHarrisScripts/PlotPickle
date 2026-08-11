import { learningModules } from "../../app/learning-library";
import { loglinesThatCarryTheMovie } from "../../app/learning-loglines-that-carry-the-movie";
import { moodColourVisualLanguage } from "../../app/learning-mood-colour-visual-language";
import { earlyVisualDevelopmentLesson } from "../../app/learning-early-visual-development";
import { whyPlotPickleWorksInLayers } from "../../app/learning-why-plotpickle";
import { twentyFourBlocksLessons } from "../../app/learning-24-blocks";
import { aiRevisionLessons } from "../../app/learning-ai-revision";
import { collaborationOwnershipLessons } from "../../app/learning-collaboration-ownership";
import { workingTogetherLessons } from "../../app/learning-working-together";
import { characterMotionLessons } from "../../app/learning-characters-in-motion";
import { dialogueLessons } from "../../app/learning-dialogue-in-motion";
import { storyCraftLessons } from "../../app/learning-story-craft-essentials";
import type { CurriculumLesson } from "../../core/contracts/curriculum";

const currentSources = [
  ...learningModules,
  loglinesThatCarryTheMovie,
  moodColourVisualLanguage,
  earlyVisualDevelopmentLesson,
  whyPlotPickleWorksInLayers,
  ...twentyFourBlocksLessons,
  ...aiRevisionLessons,
  ...collaborationOwnershipLessons,
  ...workingTogetherLessons,
  ...characterMotionLessons,
  ...dialogueLessons,
  ...storyCraftLessons,
];

export const plotPickleCurriculum: readonly CurriculumLesson[] = currentSources.map((lesson) => ({
  id: lesson.id,
  number: lesson.number,
  path: lesson.path,
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

if (plotPickleCurriculum.length !== 81) {
  throw new Error(`Expected 81 PlotPickle curriculum modules, found ${plotPickleCurriculum.length}.`);
}
