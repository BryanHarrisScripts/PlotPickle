import type { CurriculumLesson } from "../../core/contracts/curriculum";
import {
  buildFoundationPlanLessons,
  countFoundationAnswers,
} from "../../core/contracts/foundation-plan";
import type { PPFProject } from "../../core/project/project";

export const GUIDED_CURRICULUM_GROUPS = [
  { id: "foundations", label: "Foundations" },
  { id: "world", label: "World" },
  { id: "structure", label: "Structure" },
  { id: "drafting", label: "Drafting" },
  { id: "character", label: "Character" },
  { id: "industry", label: "Industry" },
  { id: "responsible-ai", label: "Responsible AI" },
  { id: "theme", label: "Theme" },
  { id: "visual-storytelling", label: "Visual Storytelling" },
  { id: "revision", label: "Revision" },
  { id: "dialogue", label: "Dialogue" },
  { id: "collaboration", label: "Collaboration" },
] as const;

export type GuidedCurriculumGroupId = (typeof GUIDED_CURRICULUM_GROUPS)[number]["id"];
export type ProgressStageState = "complete" | "available" | "locked";
export type GuidedWorkspace = "learn" | "plan" | "build";

export interface GuidedCurriculumGroupProgress {
  readonly id: GuidedCurriculumGroupId;
  readonly label: string;
  readonly lessonCount: number;
  readonly completedLessonCount: number;
  readonly learn: ProgressStageState;
  readonly plan: ProgressStageState;
  readonly build: ProgressStageState;
  readonly percentComplete: number;
  readonly unlocked: boolean;
  readonly implemented: boolean;
  readonly complete: boolean;
}

export interface GuidedNextAction {
  readonly groupId: GuidedCurriculumGroupId;
  readonly workspace: GuidedWorkspace | null;
  readonly label: string;
  readonly detail: string;
}

export interface GuidedCreationProgression {
  readonly groups: readonly GuidedCurriculumGroupProgress[];
  readonly foundations: GuidedCurriculumGroupProgress & {
    readonly totalPlanFields: number;
    readonly answeredPlanFields: number;
    readonly acceptedVisualArtifactCount: number;
  };
  readonly journeyPercentComplete: number;
  readonly nextAction: GuidedNextAction;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function lessonStats(
  curriculum: readonly CurriculumLesson[],
  completedIds: ReadonlySet<string>,
  topic: GuidedCurriculumGroupId,
) {
  const lessons = curriculum.filter((lesson) => lesson.topic === topic);
  return {
    lessonCount: lessons.length,
    completedLessonCount: lessons.filter((lesson) => completedIds.has(lesson.id)).length,
  };
}

export function deriveGuidedCreationProgression(
  curriculum: readonly CurriculumLesson[],
  project: PPFProject,
): GuidedCreationProgression {
  const completedIds = new Set(project.learning.completedLessonIds);
  const foundationStats = lessonStats(curriculum, completedIds, "foundations");
  const foundationLearnRatio = foundationStats.lessonCount > 0
    ? foundationStats.completedLessonCount / foundationStats.lessonCount
    : 0;
  const foundationLearnComplete = foundationStats.lessonCount > 0
    && foundationStats.completedLessonCount === foundationStats.lessonCount;

  const planLessons = buildFoundationPlanLessons(curriculum);
  const totalPlanFields = planLessons.reduce((total, lesson) => total + lesson.fields.length, 0);
  const answeredPlanFields = countFoundationAnswers(planLessons, project.foundations);
  const planRatio = totalPlanFields > 0 ? answeredPlanFields / totalPlanFields : 0;
  const planComplete = foundationLearnComplete && totalPlanFields > 0 && answeredPlanFields === totalPlanFields;

  const acceptedVisualArtifactCount = project.build.foundations.acceptedVisualArtifactIds.length;
  const buildComplete = planComplete && acceptedVisualArtifactCount > 0;
  const foundationsPercent = clampPercent(((foundationLearnRatio + (foundationLearnComplete ? planRatio : 0) + (buildComplete ? 1 : 0)) / 3) * 100);

  const foundations: GuidedCreationProgression["foundations"] = {
    id: "foundations",
    label: "Foundations",
    ...foundationStats,
    totalPlanFields,
    answeredPlanFields,
    acceptedVisualArtifactCount,
    learn: foundationLearnComplete ? "complete" : "available",
    plan: planComplete ? "complete" : foundationLearnComplete ? "available" : "locked",
    build: buildComplete ? "complete" : planComplete ? "available" : "locked",
    percentComplete: foundationsPercent,
    unlocked: true,
    implemented: true,
    complete: buildComplete,
  };

  const laterGroups = GUIDED_CURRICULUM_GROUPS.slice(1).map((definition, index) => {
    const stats = lessonStats(curriculum, completedIds, definition.id);
    const unlocked = index === 0 && foundations.complete;
    return {
      ...definition,
      ...stats,
      learn: "locked" as const,
      plan: "locked" as const,
      build: "locked" as const,
      percentComplete: 0,
      unlocked,
      implemented: false,
      complete: false,
    } satisfies GuidedCurriculumGroupProgress;
  });

  const groups: readonly GuidedCurriculumGroupProgress[] = [foundations, ...laterGroups];
  const journeyPercentComplete = clampPercent(
    groups.reduce((total, group) => total + group.percentComplete, 0) / groups.length,
  );

  let nextAction: GuidedNextAction;
  if (!foundationLearnComplete) {
    nextAction = {
      groupId: "foundations",
      workspace: "learn",
      label: "Continue Foundations LEARN",
      detail: `${foundationStats.completedLessonCount} of ${foundationStats.lessonCount} Foundations lessons complete.`,
    };
  } else if (!planComplete) {
    nextAction = {
      groupId: "foundations",
      workspace: "plan",
      label: "Continue Foundations PLAN",
      detail: `${answeredPlanFields} of ${totalPlanFields} Foundations PLAN answers saved.`,
    };
  } else if (!buildComplete) {
    nextAction = {
      groupId: "foundations",
      workspace: "build",
      label: "Continue Foundations BUILD",
      detail: "Generate and explicitly accept at least one real Foundations visual.",
    };
  } else {
    nextAction = {
      groupId: "world",
      workspace: null,
      label: "Foundations complete — World is next",
      detail: "WORLD is unlocked in the progression model, but its LEARN → PLAN → BUILD implementation remains intentionally gated until Foundations is approved.",
    };
  }

  return {
    groups,
    foundations,
    journeyPercentComplete,
    nextAction,
  };
}
