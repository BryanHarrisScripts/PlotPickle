import { writeFile } from "node:fs/promises";
import { learningModules } from "../app/learning-library";
import { loglinesThatCarryTheMovie } from "../app/learning-loglines-that-carry-the-movie";
import { moodColourVisualLanguage } from "../app/learning-mood-colour-visual-language";
import { earlyVisualDevelopmentLesson } from "../app/learning-early-visual-development";
import { whyPlotPickleWorksInLayers } from "../app/learning-why-plotpickle";
import { twentyFourBlocksLessons } from "../app/learning-24-blocks";
import { aiRevisionLessons } from "../app/learning-ai-revision";
import { collaborationOwnershipLessons } from "../app/learning-collaboration-ownership";
import { workingTogetherLessons } from "../app/learning-working-together";
import { characterMotionLessons } from "../app/learning-characters-in-motion";
import { dialogueLessons } from "../app/learning-dialogue-in-motion";
import { storyCraftLessons } from "../app/learning-story-craft-essentials";

const modules = [
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
].map((module) => ({
  id: module.id,
  title: module.title,
  overview: module.overview,
  objectives: module.objectives,
  sections: module.sections,
  definitions: module.definitions,
  checklist: module.checklist,
  mistakes: module.mistakes,
  exercise: module.exercise,
  tags: module.tags,
}));

if (modules.length !== 81) throw new Error(`Expected 81 PlotPickle modules, found ${modules.length}.`);
await writeFile(new URL("../build/plotpickle-curriculum-index.json", import.meta.url), `${JSON.stringify(modules, null, 2)}\n`, "utf8");
console.log(`Generated curriculum index with ${modules.length} modules.`);
