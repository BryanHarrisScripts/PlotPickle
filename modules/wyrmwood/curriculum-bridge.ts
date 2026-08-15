import type { CurriculumLesson } from "../../core/contracts/curriculum";
import type { WyrmwoodTrial } from "./contracts";

export const WYRMWOOD_FIRST_CAMPAIGN = {
  id: "fundamentals",
  title: "The Fundamentals Trials",
  curriculumTopic: "foundations",
  description: "Playable reinforcement for PlotPickle Foundations. Each trial asks the Spellscribe to use what LEARN has already taught rather than guess a disconnected game rule.",
} as const;

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
      lessonReminder: lesson.overview,
      pickleSeed: [
        `Create an absurd but internally playable narrative pickle for the lesson “${lesson.title}”.`,
        `The player must demonstrate: ${lesson.objectives[0] ?? lesson.overview}`,
        "Reward grounded cause-and-effect, use of established scene information, and practical problem solving.",
        "Do not let prophecy, unexplained magic, coincidence, or a newly invented fact solve the problem for the player.",
      ].join(" "),
    }));
}
