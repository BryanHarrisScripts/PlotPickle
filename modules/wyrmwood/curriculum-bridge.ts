import type { CurriculumLesson } from "../../core/contracts/curriculum";
import type { WyrmwoodCurriculumProgress, WyrmwoodTrial } from "./contracts";

export const WYRMWOOD_FIRST_CAMPAIGN = {
  id: "fundamentals",
  title: "The Fundamentals Trials",
  curriculumTopic: "foundations",
  description: "Playable reinforcement for PlotPickle Foundations. Each trial asks the Spellscribe to use what LEARN has already taught rather than guess a disconnected game rule.",
} as const;

function keyConceptsForLesson(lesson: CurriculumLesson) {
  const terms = lesson.definitions.map((definition) => definition.term.trim()).filter(Boolean);
  if (terms.length) return terms.slice(0, 4);
  return lesson.objectives.map((objective) => objective.trim()).filter(Boolean).slice(0, 4);
}

export function buildFundamentalsTrials(curriculum: readonly CurriculumLesson[]): readonly WyrmwoodTrial[] {
  return curriculum
    .filter((lesson) => lesson.topic === WYRMWOOD_FIRST_CAMPAIGN.curriculumTopic)
    .sort((left, right) => left.number - right.number)
    .map((lesson, index) => ({
      id: `fundamentals-${lesson.id}`,
      campaignId: WYRMWOOD_FIRST_CAMPAIGN.id,
      curriculumTopic: WYRMWOOD_FIRST_CAMPAIGN.curriculumTopic,
      lessonId: lesson.id,
      lessonNumber: index + 1,
      lessonTitle: lesson.title,
      learningTargets: lesson.objectives.slice(0, 3),
      keyConcepts: keyConceptsForLesson(lesson),
      lessonReminder: lesson.overview,
      pickleSeed: [
        `Create an absurd but internally playable narrative pickle for the lesson “${lesson.title}”.`,
        `The player must demonstrate: ${lesson.objectives[0] ?? lesson.overview}`,
        `Key concepts available to reinforce: ${keyConceptsForLesson(lesson).join(", ") || lesson.title}.`,
        "Reward grounded cause-and-effect, use of established scene information, and practical problem solving.",
        "Do not let prophecy, unexplained magic, coincidence, or a newly invented fact solve the problem for the player.",
      ].join(" "),
    }));
}

export function buildWyrmwoodCurriculumProgress(
  curriculum: readonly CurriculumLesson[],
  completedLessonIds: readonly string[],
  activeLessonId = "",
): WyrmwoodCurriculumProgress {
  const foundations = curriculum.filter((lesson) => lesson.topic === WYRMWOOD_FIRST_CAMPAIGN.curriculumTopic);
  const foundationIds = new Set(foundations.map((lesson) => lesson.id));
  const completed = [...new Set(completedLessonIds.filter((id) => foundationIds.has(id)))];
  return {
    stage: "Foundations",
    activeLessonId: foundationIds.has(activeLessonId) ? activeLessonId : "",
    completedLessonIds: completed,
    completedInStage: completed.length,
    totalInStage: foundations.length,
  };
}
