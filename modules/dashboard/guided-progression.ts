import type { CurriculumLesson } from "../../core/contracts/curriculum";
import {
  buildFoundationPlanLessons,
  countFoundationAnswers,
} from "../../core/contracts/foundation-plan";
import type { PPFProject } from "../../core/project/project";

export const VISUAL_WRITER_GROUP_ORDER = [
  "foundations",
  "world",
  "character",
  "theme",
  "structure",
  "visual-storytelling",
  "drafting",
  "dialogue",
  "revision",
  "responsible-ai",
  "industry",
  "collaboration",
] as const;

export type GuidedCurriculumGroupId = (typeof VISUAL_WRITER_GROUP_ORDER)[number];
export type ProgressStageState = "complete" | "available" | "locked";
export type GuidedWorkspace = "learn" | "plan" | "build";
export type GuidedOutputClassification = "knowledge-only" | "decision-producing" | "artifact-producing" | "mixture";

export interface GuidedGroupOutputContract {
  readonly prerequisiteGroupIds: readonly GuidedCurriculumGroupId[];
  readonly learned: readonly string[];
  readonly projectDecisionKinds: readonly string[];
  readonly affectsVisualGeneration: boolean;
  readonly buildCapability: string;
  readonly buildContextGroupIds: readonly GuidedCurriculumGroupId[];
  readonly artifactKinds: readonly string[];
  readonly approvalRequired: string;
  readonly classification: GuidedOutputClassification;
}

export interface GuidedCurriculumGroupDefinition {
  readonly id: GuidedCurriculumGroupId;
  readonly label: string;
  readonly outputContract: GuidedGroupOutputContract;
}

const GROUP_DEFINITIONS = {
  foundations: {
    label: "Foundations",
    outputContract: {
      prerequisiteGroupIds: [],
      learned: ["Premise, protagonist-level intent, central conflict/problem, stakes, genre, tone and story direction."],
      projectDecisionKinds: ["story foundation", "protagonist direction", "central conflict", "stakes", "genre and tone"],
      affectsVisualGeneration: true,
      buildCapability: "Create the first rough Visual Narrative Wireframe from accepted Foundations decisions only.",
      buildContextGroupIds: ["foundations"],
      artifactKinds: ["visual-narrative-wireframe"],
      approvalRequired: "Complete Foundations LEARN and PLAN, then explicitly accept at least one stored Foundations visual artifact.",
      classification: "mixture",
    },
  },
  world: {
    label: "World",
    outputContract: {
      prerequisiteGroupIds: ["foundations"],
      learned: ["Locations, environment, culture, geography, rules, genre constraints, mood and world anchors."],
      projectDecisionKinds: ["world rules", "locations", "culture", "geography", "environmental mood"],
      affectsVisualGeneration: true,
      buildCapability: "Extend or branch the Visual Narrative Wireframe with accepted World decisions without replacing accepted Foundations history.",
      buildContextGroupIds: ["foundations", "world"],
      artifactKinds: ["visual-narrative-wireframe"],
      approvalRequired: "Accept the World PLAN decisions and explicitly review any World-driven wireframe changes before the next group unlocks.",
      classification: "mixture",
    },
  },
  character: {
    label: "Character",
    outputContract: {
      prerequisiteGroupIds: ["foundations", "world"],
      learned: ["Stable character identity, wants, needs, relationships, contradictions, behaviour and continuity anchors."],
      projectDecisionKinds: ["character identity", "goals and needs", "relationships", "behaviour", "continuity anchors"],
      affectsVisualGeneration: true,
      buildCapability: "Refine people and performance anchors in the Visual Narrative Wireframe from accepted Character decisions.",
      buildContextGroupIds: ["foundations", "world", "character"],
      artifactKinds: ["visual-narrative-wireframe", "character-continuity-package"],
      approvalRequired: "Accept Character decisions and explicitly review character-driven artifact revisions.",
      classification: "mixture",
    },
  },
  theme: {
    label: "Theme",
    outputContract: {
      prerequisiteGroupIds: ["foundations", "character"],
      learned: ["Theme, dramatic intent, tone and motif as ideas tested through character choices and consequences."],
      projectDecisionKinds: ["theme", "dramatic question", "tone", "motif", "meaning and consequence"],
      affectsVisualGeneration: true,
      buildCapability: "Add accepted dramatic intent, tonal and motif guidance to the evolving wireframe without inventing future plot facts.",
      buildContextGroupIds: ["foundations", "world", "character", "theme"],
      artifactKinds: ["visual-narrative-wireframe", "dramatic-intent-package"],
      approvalRequired: "Accept Theme decisions before theme/motif changes become part of later visual context.",
      classification: "mixture",
    },
  },
  structure: {
    label: "Structure",
    outputContract: {
      prerequisiteGroupIds: ["foundations", "character", "theme"],
      learned: ["Causality, escalation, turning points, block progression, setup/payoff and narrative sequencing."],
      projectDecisionKinds: ["story blocks", "turning points", "causal sequence", "escalation", "setup and payoff"],
      affectsVisualGeneration: true,
      buildCapability: "Re-sequence or branch wireframe beats only where accepted Structure decisions justify the change.",
      buildContextGroupIds: ["foundations", "world", "character", "theme", "structure"],
      artifactKinds: ["visual-narrative-wireframe", "story-structure-map"],
      approvalRequired: "Accept Structure decisions and review sequence changes before later drafting treats them as project context.",
      classification: "mixture",
    },
  },
  "visual-storytelling": {
    label: "Visual Storytelling",
    outputContract: {
      prerequisiteGroupIds: ["world", "character", "theme", "structure"],
      learned: ["Composition, staging, visual grammar, shot intention, image continuity and visual narrative emphasis."],
      projectDecisionKinds: ["composition", "staging", "visual grammar", "shot intention", "visual continuity"],
      affectsVisualGeneration: true,
      buildCapability: "Refine the rough wireframe's composition and visual language while preserving its pre-final status and provenance.",
      buildContextGroupIds: ["foundations", "world", "character", "theme", "structure", "visual-storytelling"],
      artifactKinds: ["visual-narrative-wireframe", "visual-language-package"],
      approvalRequired: "Explicitly review visual-language refinements; a generated image never becomes canon by generation alone.",
      classification: "mixture",
    },
  },
  drafting: {
    label: "Drafting",
    outputContract: {
      prerequisiteGroupIds: ["character", "structure", "visual-storytelling"],
      learned: ["Scene construction, page-level drafting, action, scene purpose and screenplay execution."],
      projectDecisionKinds: ["scene purpose", "scene action", "page-level story facts", "draft choices"],
      affectsVisualGeneration: true,
      buildCapability: "Create draft pages and refine wireframe frames only from story facts accepted in the draft frontier.",
      buildContextGroupIds: ["foundations", "world", "character", "theme", "structure", "visual-storytelling", "drafting"],
      artifactKinds: ["screenplay-draft", "visual-narrative-wireframe"],
      approvalRequired: "Draft changes require writer review before later groups may treat them as accepted story facts.",
      classification: "mixture",
    },
  },
  dialogue: {
    label: "Dialogue",
    outputContract: {
      prerequisiteGroupIds: ["character", "drafting"],
      learned: ["Voice, subtext, rhythm, intention, conflict and dialogue as character action."],
      projectDecisionKinds: ["character voice", "subtext", "dialogue intention", "spoken conflict"],
      affectsVisualGeneration: false,
      buildCapability: "Refine accepted screenplay dialogue and performance intent without silently changing visual canon.",
      buildContextGroupIds: ["foundations", "world", "character", "theme", "structure", "drafting", "dialogue"],
      artifactKinds: ["screenplay-draft", "performance-intent-package"],
      approvalRequired: "Dialogue revisions require writer acceptance before they enter the next revision frontier.",
      classification: "decision-producing",
    },
  },
  revision: {
    label: "Revision",
    outputContract: {
      prerequisiteGroupIds: ["drafting", "dialogue"],
      learned: ["Diagnosis, comparison, rewrite strategy, continuity repair and deliberate acceptance/rejection of changes."],
      projectDecisionKinds: ["revision intent", "accepted rewrite", "continuity repair", "retained or rejected change"],
      affectsVisualGeneration: true,
      buildCapability: "Branch or update affected draft/wireframe artifacts with explicit before/after provenance instead of destructive replacement.",
      buildContextGroupIds: ["foundations", "world", "character", "theme", "structure", "visual-storytelling", "drafting", "dialogue", "revision"],
      artifactKinds: ["screenplay-revision", "visual-narrative-wireframe", "revision-diff"],
      approvalRequired: "Every canonical revision requires explicit writer acceptance; rejected and superseded versions remain reviewable.",
      classification: "mixture",
    },
  },
  "responsible-ai": {
    label: "Responsible AI",
    outputContract: {
      prerequisiteGroupIds: ["revision"],
      learned: ["Provenance, disclosure, authorship boundaries, rights awareness and safe human approval of AI-assisted work."],
      projectDecisionKinds: ["disclosure choice", "provenance requirement", "approval boundary", "rights constraint"],
      affectsVisualGeneration: false,
      buildCapability: "Produce responsibility/provenance readiness records for the creative artifacts already made; do not create story canon.",
      buildContextGroupIds: ["responsible-ai"],
      artifactKinds: ["responsibility-record"],
      approvalRequired: "The writer remains final authority; provenance/disclosure decisions must be explicit before outward-facing production handoff.",
      classification: "mixture",
    },
  },
  industry: {
    label: "Industry",
    outputContract: {
      prerequisiteGroupIds: ["revision", "responsible-ai"],
      learned: ["Professional positioning, deliverables, submission expectations and production-facing packaging."],
      projectDecisionKinds: ["format and deliverable", "submission target", "positioning", "production readiness"],
      affectsVisualGeneration: false,
      buildCapability: "Assemble an industry-readiness package from already accepted creative work without changing story canon.",
      buildContextGroupIds: ["industry", "responsible-ai"],
      artifactKinds: ["industry-readiness-package"],
      approvalRequired: "The writer approves outward-facing materials and target-specific packaging before release or submission.",
      classification: "mixture",
    },
  },
  collaboration: {
    label: "Collaboration",
    outputContract: {
      prerequisiteGroupIds: ["responsible-ai", "industry"],
      learned: ["Handoff, feedback, role clarity, change boundaries, attribution and collaborative review."],
      projectDecisionKinds: ["collaborator role", "handoff scope", "feedback boundary", "attribution", "change approval"],
      affectsVisualGeneration: false,
      buildCapability: "Create a collaboration handoff/review package from accepted artifacts; collaborators do not gain silent canon authority.",
      buildContextGroupIds: ["responsible-ai", "industry", "collaboration"],
      artifactKinds: ["collaboration-handoff"],
      approvalRequired: "Writer-owned approval remains required for creative changes received through collaboration.",
      classification: "mixture",
    },
  },
} as const satisfies Record<GuidedCurriculumGroupId, {
  readonly label: string;
  readonly outputContract: GuidedGroupOutputContract;
}>;

export const GUIDED_CURRICULUM_GROUPS: readonly GuidedCurriculumGroupDefinition[] = VISUAL_WRITER_GROUP_ORDER.map((id) => ({
  id,
  label: GROUP_DEFINITIONS[id].label,
  outputContract: GROUP_DEFINITIONS[id].outputContract,
}));

export interface GuidedLessonOutputContract {
  readonly lessonId: string;
  readonly groupId: GuidedCurriculumGroupId;
  readonly orderInGroup: number;
  readonly prerequisiteGroupIds: readonly GuidedCurriculumGroupId[];
  readonly prerequisiteLessonIds: readonly string[];
  readonly learned: readonly string[];
  readonly projectDecisionContribution: string;
  readonly affectsVisualGeneration: boolean;
  readonly mustPrecedeGroupIds: readonly GuidedCurriculumGroupId[];
  readonly mustPrecedeLessonIds: readonly string[];
  readonly buildCapability: string;
  readonly artifactKinds: readonly string[];
  readonly classification: GuidedOutputClassification;
}

export function guidedGroupDefinition(groupId: GuidedCurriculumGroupId) {
  return GUIDED_CURRICULUM_GROUPS.find((group) => group.id === groupId)!;
}

export function deriveGuidedLessonOutputContracts(
  curriculum: readonly CurriculumLesson[],
): readonly GuidedLessonOutputContract[] {
  return GUIDED_CURRICULUM_GROUPS.flatMap((definition) => {
    const lessons = curriculum
      .filter((lesson) => lesson.topic === definition.id)
      .toSorted((left, right) => left.number - right.number);
    const dependentGroupIds = GUIDED_CURRICULUM_GROUPS
      .filter((candidate) => candidate.outputContract.prerequisiteGroupIds.includes(definition.id))
      .map((candidate) => candidate.id);

    return lessons.map((lesson, index) => {
      const previous = lessons[index - 1];
      const next = lessons[index + 1];
      return {
        lessonId: lesson.id,
        groupId: definition.id,
        orderInGroup: index + 1,
        prerequisiteGroupIds: definition.outputContract.prerequisiteGroupIds,
        prerequisiteLessonIds: previous ? [previous.id] : [],
        learned: lesson.objectives.length ? lesson.objectives : [lesson.overview],
        projectDecisionContribution: lesson.apply.trim() || lesson.exercise.trim() || "Knowledge-only curriculum contribution.",
        affectsVisualGeneration: definition.outputContract.affectsVisualGeneration,
        mustPrecedeGroupIds: next ? [] : dependentGroupIds,
        mustPrecedeLessonIds: next ? [next.id] : [],
        buildCapability: definition.outputContract.buildCapability,
        artifactKinds: definition.outputContract.artifactKinds,
        classification: definition.outputContract.classification,
      } satisfies GuidedLessonOutputContract;
    });
  });
}

export interface GuidedCurriculumGroupProgress {
  readonly id: GuidedCurriculumGroupId;
  readonly label: string;
  readonly outputContract: GuidedGroupOutputContract;
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
  readonly lessonOutputContracts: readonly GuidedLessonOutputContract[];
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
  const foundationDefinition = guidedGroupDefinition("foundations");
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
    label: foundationDefinition.label,
    outputContract: foundationDefinition.outputContract,
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
    lessonOutputContracts: deriveGuidedLessonOutputContracts(curriculum),
    foundations,
    journeyPercentComplete,
    nextAction,
  };
}
