import type { CurriculumLesson } from "../../core/contracts/curriculum";
import {
  buildFoundationPlanLessons,
  countFoundationAnswers,
} from "../../core/contracts/foundation-plan";
import type { PPFProject } from "../../core/project/project";

export type ProgressStageState = "complete" | "available" | "locked";

export interface FoundationsProgression {
  readonly foundationLessonCount: number;
  readonly completedFoundationLessonCount: number;
  readonly totalPlanFields: number;
  readonly answeredPlanFields: number;
  readonly acceptedVisualArtifactCount: number;
  readonly learn: ProgressStageState;
  readonly plan: ProgressStageState;
  readonly build: ProgressStageState;
  readonly worldUnlocked: boolean;
}

export function deriveFoundationsProgression(
  curriculum: readonly CurriculumLesson[],
  project: PPFProject,
): FoundationsProgression {
  const foundationLessons = curriculum
    .filter((lesson) => lesson.topic === "foundations")
    .sort((left, right) => left.number - right.number);
  const completedIds = new Set(project.learning.completedLessonIds);
  const completedFoundationLessonCount = foundationLessons.filter((lesson) => completedIds.has(lesson.id)).length;
  const learnComplete = foundationLessons.length > 0 && completedFoundationLessonCount === foundationLessons.length;

  const planLessons = buildFoundationPlanLessons(curriculum);
  const totalPlanFields = planLessons.reduce((total, lesson) => total + lesson.fields.length, 0);
  const answeredPlanFields = countFoundationAnswers(planLessons, project.foundations);
  const planComplete = learnComplete && totalPlanFields > 0 && answeredPlanFields === totalPlanFields;

  const acceptedVisualArtifactCount = project.build.foundations.acceptedVisualArtifactIds.length;
  const buildComplete = planComplete && acceptedVisualArtifactCount > 0;

  return {
    foundationLessonCount: foundationLessons.length,
    completedFoundationLessonCount,
    totalPlanFields,
    answeredPlanFields,
    acceptedVisualArtifactCount,
    learn: learnComplete ? "complete" : "available",
    plan: planComplete ? "complete" : learnComplete ? "available" : "locked",
    build: buildComplete ? "complete" : planComplete ? "available" : "locked",
    worldUnlocked: buildComplete,
  };
}
