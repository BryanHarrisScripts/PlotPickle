import { plotPickleCurriculum } from "../../../adapters/curriculum/current-catalog";
import type { CurriculumLesson } from "../../../core/contracts/curriculum";
import { buildFoundationPlanLessons } from "../../../core/contracts/foundation-plan";
import { buildWorldPlanLessons } from "../../../core/contracts/world-plan";
import type { StoryCommand } from "../../../core/contracts/story-command";
import { applyStoryCommand } from "../../../core/project/apply-command";
import type { PPFProject } from "../../../core/project/project";
import { deriveGuidedCreationProgression } from "../../../core/progression/guided-progression";
import type { StoryDecisionRecord } from "../../../core/story-workflow/story-decisions/core.mjs";
import {
  normalizeStoryChangePackage,
  reviewStoryChangePackage,
  storyWorkbenchConvergenceTelemetry,
  storyWorkbenchImpactMap,
  type StoryChangePackage,
  type StoryWorkbenchReview,
} from "../../../core/story-workflow/workbench/core.mjs";
import {
  planStoryWorkItems,
  type StoryWorkItem,
} from "../../../core/story-workflow/story-workflow-core.mjs";
import { buildFoundationsStoryWorkflowRequirements } from "../foundations-story-workflow";

export type StoryWorkbenchTarget = Readonly<{
  targetRef: string;
  frontier: "foundations" | "world";
  lessonId: string;
  fieldId: string;
  label: string;
  currentValue: string;
  editable: boolean;
}>;

export type PreparedStoryWorkbench = Readonly<{
  package: StoryChangePackage;
  review: StoryWorkbenchReview;
  impact: ReturnType<typeof storyWorkbenchImpactMap>;
  availableTargets: readonly StoryWorkbenchTarget[];
  selectedTarget: StoryWorkbenchTarget | null;
  proposedValue: string;
  currentValue: string;
}>;

type DecisionResponse = Readonly<{
  responseId?: unknown;
  responseClass?: unknown;
  humanProfileId?: unknown;
  replacementContent?: unknown;
  selectedAlternativeId?: unknown;
  rationale?: unknown;
  respondedAt?: unknown;
}>;

function clean(value: unknown, maximum = 8_000) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function responseOf(decision: StoryDecisionRecord): DecisionResponse {
  return decision.response && typeof decision.response === "object" && !Array.isArray(decision.response)
    ? decision.response as DecisionResponse
    : {};
}

function selectedAlternative(decision: StoryDecisionRecord, response: DecisionResponse) {
  const replacement = clean(response.replacementContent);
  if (replacement) return replacement;
  const match = clean(response.selectedAlternativeId, 80).match(/^alternative-(\d+)$/i);
  const index = match ? Number(match[1]) - 1 : -1;
  return index >= 0 ? clean(decision.alternatives[index]) : "";
}

function proposedValue(decision: StoryDecisionRecord, response: DecisionResponse, editedValue = "") {
  if (editedValue.trim()) return clean(editedValue);
  switch (clean(response.responseClass, 80)) {
    case "accept-proposal": return clean(decision.proposedChange);
    case "select-alternative": return selectedAlternative(decision, response);
    case "modify-proposal":
    case "freeform-decision": return clean(response.replacementContent);
    default: return "";
  }
}

function parseTargetRef(targetRef: string) {
  const match = targetRef.match(/^ppf:(foundations|world):([^:]+):([^:]+)$/i);
  if (!match || match[3] === "proposal-container") return null;
  return { frontier: match[1].toLowerCase() as "foundations" | "world", lessonId: match[2], fieldId: match[3] };
}

export function storyWorkbenchTargets(
  project: PPFProject,
  decision: Pick<StoryDecisionRecord, "targetRefs">,
  curriculum: readonly CurriculumLesson[] = plotPickleCurriculum,
): readonly StoryWorkbenchTarget[] {
  const progression = deriveGuidedCreationProgression(curriculum, project);
  const foundationLessons = buildFoundationPlanLessons(curriculum);
  const worldLessons = buildWorldPlanLessons(curriculum);
  return decision.targetRefs.flatMap((targetRef) => {
    const parsed = parseTargetRef(targetRef);
    if (!parsed) return [];
    if (parsed.frontier === "foundations") {
      const lesson = foundationLessons.find((item) => item.id === parsed.lessonId);
      const field = lesson?.fields.find((item) => item.id === parsed.fieldId);
      if (!lesson || !field) return [];
      return [{
        targetRef,
        frontier: parsed.frontier,
        lessonId: parsed.lessonId,
        fieldId: parsed.fieldId,
        label: `${lesson.title} · ${field.prompt}`,
        currentValue: project.foundations.lessons[parsed.lessonId]?.answers[parsed.fieldId] ?? "",
        editable: progression.foundations.plan !== "locked",
      } satisfies StoryWorkbenchTarget];
    }
    const lesson = worldLessons.find((item) => item.id === parsed.lessonId);
    const field = lesson?.fields.find((item) => item.id === parsed.fieldId);
    if (!lesson || !field) return [];
    return [{
      targetRef,
      frontier: parsed.frontier,
      lessonId: parsed.lessonId,
      fieldId: parsed.fieldId,
      label: `${lesson.title} · ${field.prompt}`,
      currentValue: project.world.lessons[parsed.lessonId]?.answers[parsed.fieldId] ?? "",
      editable: progression.world.unlocked && progression.world.plan !== "locked",
    } satisfies StoryWorkbenchTarget];
  }).filter((item, index, all) => all.findIndex((candidate) => candidate.targetRef === item.targetRef) === index);
}

function unsupportedTargetFlags(targetRef: string) {
  return {
    derivedTarget: /(?:^|:)(?:derived|graph|index)(?::|$)/i.test(targetRef),
    importedEvidenceTarget: /(?:imported|source-evidence|screenplay-evidence)/i.test(targetRef),
    structuralImpact: /^ppf:(?:structure|block|scene)(?::|$)/i.test(targetRef),
  };
}

export function prepareStoryWorkbenchReview(input: {
  readonly project: PPFProject;
  readonly decision: StoryDecisionRecord;
  readonly selectedTargetRef?: string;
  readonly editedValue?: string;
  readonly curriculum?: readonly CurriculumLesson[];
}): PreparedStoryWorkbench {
  const curriculum = input.curriculum ?? plotPickleCurriculum;
  const response = responseOf(input.decision);
  const responseClass = clean(response.responseClass, 80);
  const availableTargets = storyWorkbenchTargets(input.project, input.decision, curriculum);
  const selectedTarget = availableTargets.find((item) => item.targetRef === input.selectedTargetRef)
    ?? (availableTargets.length === 1 ? availableTargets[0] : null);
  const candidateTargetRef = selectedTarget?.targetRef || clean(input.selectedTargetRef, 360) || input.decision.targetRefs[0] || "";
  const value = proposedValue(input.decision, response, input.editedValue);
  const noChange = responseClass === "reject-proposal" || responseClass === "keep-current";
  const storyPackage = normalizeStoryChangePackage({
    projectId: input.decision.projectId,
    decisionId: input.decision.decisionId,
    responseId: response.responseId,
    responseClass,
    baseRevision: input.decision.baseRevision,
    targetRefs: input.decision.targetRefs,
    operation: noChange ? null : {
      targetRef: candidateTargetRef,
      beforeValue: selectedTarget?.currentValue ?? "",
      value,
      author: responseClass === "modify-proposal" || responseClass === "freeform-decision" ? "human" : "agent-proposed",
    },
    curriculumRefs: input.decision.curriculumRefs,
    evidenceRefs: input.decision.evidenceRefs,
    predictedImpactRefs: input.decision.predictedImpactRefs,
    provenance: {
      humanProfileId: response.humanProfileId,
      runRefs: input.decision.origin.runIds,
      councilResultId: input.decision.origin.councilResultId,
      rationale: response.rationale,
    },
    createdAt: response.respondedAt,
  });
  const targetFlags = unsupportedTargetFlags(candidateTargetRef);
  const review = reviewStoryChangePackage({
    package: storyPackage,
    currentRevision: input.project.revision,
    projectMatches: input.project.id === input.decision.projectId,
    targetOwned: noChange || Boolean(selectedTarget),
    frontierEditable: noChange || Boolean(selectedTarget?.editable),
    lockedPrerequisite: !noChange && Boolean(selectedTarget && !selectedTarget.editable),
    ...targetFlags,
    visualScriptImpact: input.decision.predictedImpactRefs.some((ref) => /(?:visual|storyboard|frame|shot|screenplay|script|draft)/i.test(ref)),
  });
  const impact = storyWorkbenchImpactMap({ package: storyPackage, dependencyEvidenceRefs: input.decision.predictedImpactRefs });
  return {
    package: storyPackage,
    review,
    impact,
    availableTargets,
    selectedTarget,
    proposedValue: value,
    currentValue: selectedTarget?.currentValue ?? "",
  };
}

function commandForTarget(target: StoryWorkbenchTarget, value: string, occurredAt: string): StoryCommand {
  return target.frontier === "foundations"
    ? { type: "foundations.answer.update", lessonId: target.lessonId, fieldId: target.fieldId, value, occurredAt }
    : { type: "world.answer.update", lessonId: target.lessonId, fieldId: target.fieldId, value, occurredAt };
}

export function applyStoryWorkbenchReview(input: {
  readonly project: PPFProject;
  readonly prepared: PreparedStoryWorkbench;
  readonly occurredAt?: string;
}) {
  const currentRevision = input.project.revision;
  if (input.project.id !== input.prepared.package.projectId || currentRevision !== input.prepared.package.baseRevision) {
    const error = new Error(`Story changed since Workbench review began. Expected revision ${input.prepared.package.baseRevision}; current revision is ${currentRevision}.`);
    (error as Error & { code?: string }).code = "STORY_WORKBENCH_STALE";
    throw error;
  }
  if (!input.prepared.review.canComplete) throw new Error("Story Workbench has blocking validation findings. Recompute the package before completing it.");
  if (!input.prepared.package.requiresCanonApply) {
    return { project: input.project, applied: false as const, previousRevision: currentRevision, revision: currentRevision, changedRefs: [] as string[] };
  }
  if (!input.prepared.review.canApply || !input.prepared.selectedTarget || !input.prepared.package.operation) {
    throw new Error("Story Workbench does not have one explicit editable canonical target to apply.");
  }
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const project = applyStoryCommand(input.project, commandForTarget(input.prepared.selectedTarget, input.prepared.package.operation.value, occurredAt));
  return {
    project,
    applied: true as const,
    previousRevision: currentRevision,
    revision: project.revision,
    changedRefs: input.prepared.impact.explainableRefs,
  };
}

function overlaps(left: readonly string[] | undefined, refs: ReadonlySet<string>) {
  return (left ?? []).some((value) => refs.has(value));
}

export function planTargetedStoryReevaluation(
  project: PPFProject,
  affectedRefs: readonly string[],
  input: { readonly curriculum?: readonly CurriculumLesson[]; readonly maxItems?: number } = {},
): readonly StoryWorkItem[] {
  const refs = new Set(affectedRefs.filter(Boolean));
  if (!refs.size) return [];
  const curriculum = input.curriculum ?? plotPickleCurriculum;
  const requirements = buildFoundationsStoryWorkflowRequirements(project, curriculum)
    .filter((requirement) => overlaps(requirement.targetRefs, refs) || overlaps(requirement.dependencyRefs, refs))
    .map((requirement) => ({ ...requirement, satisfied: false, stale: true, waitingHuman: false }));
  return planStoryWorkItems({
    projectId: project.id,
    baseRevision: project.revision,
    requirements,
    maxItems: input.maxItems ?? 12,
  });
}

export function storyWorkbenchTelemetry(input: {
  readonly project: PPFProject;
  readonly openRequiredDecisions: number;
  readonly reevaluationItems: readonly StoryWorkItem[];
  readonly unresolvedHighMediumFindings?: number;
  readonly specialistDisagreements?: number;
  readonly newMaterialFindings?: number;
  readonly currentFrontierBlockers?: readonly string[];
}) {
  const missing = planFoundationsStoryWorkCount(input.project);
  return storyWorkbenchConvergenceTelemetry({
    openRequiredDecisions: input.openRequiredDecisions,
    unresolvedHighMediumFindings: input.unresolvedHighMediumFindings ?? 0,
    missingCurrentFrontierRequirements: missing,
    staleWorkOrProposals: input.reevaluationItems.length,
    specialistDisagreements: input.specialistDisagreements ?? 0,
    affectedWorkItemsRerun: input.reevaluationItems.length,
    newMaterialFindings: input.newMaterialFindings ?? 0,
    currentFrontierBlockers: input.currentFrontierBlockers ?? [],
  });
}

function planFoundationsStoryWorkCount(project: PPFProject) {
  return planStoryWorkItems({
    projectId: project.id,
    baseRevision: project.revision,
    requirements: buildFoundationsStoryWorkflowRequirements(project, plotPickleCurriculum),
    maxItems: 64,
  }).length;
}
