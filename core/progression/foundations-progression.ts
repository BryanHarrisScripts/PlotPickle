import type { CurriculumLesson } from "../../core/contracts/curriculum";
import type { PPFProject } from "../../core/project/project";
import {
  deriveGuidedCreationProgression,
  type ProgressStageState,
} from "./guided-progression";

export type { ProgressStageState } from "./guided-progression";

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

/**
 * Compatibility adapter for the existing Foundations BUILD workspace.
 * Dashboard and future curriculum slices use deriveGuidedCreationProgression directly.
 */
export function deriveFoundationsProgression(
  curriculum: readonly CurriculumLesson[],
  project: PPFProject,
): FoundationsProgression {
  const guided = deriveGuidedCreationProgression(curriculum, project);
  const foundations = guided.foundations;
  const world = guided.groups.find((group) => group.id === "world");
  return {
    foundationLessonCount: foundations.lessonCount,
    completedFoundationLessonCount: foundations.completedLessonCount,
    totalPlanFields: foundations.totalPlanFields,
    answeredPlanFields: foundations.answeredPlanFields,
    acceptedVisualArtifactCount: foundations.acceptedVisualArtifactCount,
    learn: foundations.learn,
    plan: foundations.plan,
    build: foundations.build,
    worldUnlocked: Boolean(world?.unlocked),
  };
}
