import { plotPickleCurriculum } from "../../../adapters/curriculum/current-catalog";
import {
  buildFoundationPlanLessons,
  isUsableFoundationAnswer,
  type FoundationPlanField,
  type FoundationPlanLesson,
} from "../../../core/contracts/foundation-plan";
import type { CurriculumLesson } from "../../../core/contracts/curriculum";
import type { ProjectSourceEvidence } from "../../../core/contracts/imported-screenplay-evidence";
import type { PPFProject } from "../../../core/project/project";
import {
  planStoryWorkItems,
  type StoryWorkItem,
  type StoryWorkflowRequirement,
} from "../../../core/story-workflow/story-workflow-core.mjs";
import {
  CONTEXT_AUTHORITY,
  assembleContextPacket,
  type ContextItemInput,
  type ContextPacket,
} from "../../../lib/agents/context/context-engine";
import {
  createResponsibilityGraph,
  type ResponsibilityGraphDefinition,
} from "../../../lib/agents/responsibility/responsibility-graph";
import {
  createResponsibilityRun,
  type ResponsibilityRun,
} from "../../../lib/agents/responsibility/responsibility-runs";

export const FOUNDATIONS_STORY_WORKFLOW_PROFILE_ID = "tamsin-hearthquill" as const;
export const FOUNDATIONS_STORY_WORKFLOW_FRONTIER = "Foundations" as const;

export type StoryWorkflowProject = PPFProject & {
  readonly sourceEvidence?: ProjectSourceEvidence;
};

function targetRef(lessonId: string, fieldId: string) {
  return `ppf:foundations:${lessonId}:${fieldId}`;
}

function proposalContainerRef(lessonId: string) {
  return `ppf:foundations:${lessonId}:proposal-container`;
}

function proposalRef(lessonId: string, fieldId: string) {
  return `proposal:foundations:${lessonId}:${fieldId}`;
}

function referenceField(project: StoryWorkflowProject, lessonId: string, fieldId: string) {
  return project.sourceEvidence?.referenceFixture?.fields.find((field) => (
    field.key === `${lessonId}:${fieldId}`
    || (field.lessonId === lessonId && field.fieldId === fieldId)
  ));
}

function requirementForField(
  project: StoryWorkflowProject,
  lesson: FoundationPlanLesson,
  field: FoundationPlanField,
  previousLesson: FoundationPlanLesson | null,
): StoryWorkflowRequirement {
  const state = project.foundations.lessons[lesson.id];
  const savedAnswer = state?.answers[field.id];
  const proposalAnswer = state?.proposal?.values[field.id];
  const reference = referenceField(project, lesson.id, field.id);
  const saved = isUsableFoundationAnswer(savedAnswer);
  const waitingHuman = !saved && isUsableFoundationAnswer(proposalAnswer);
  const evidenceRefs = [
    ...(saved ? [targetRef(lesson.id, field.id)] : []),
    ...(reference?.sourceRefs ?? []),
    ...(waitingHuman ? [proposalRef(lesson.id, field.id)] : []),
  ];
  const dependencyRefs = previousLesson
    ? previousLesson.fields.map((previousField) => targetRef(previousLesson.id, previousField.id))
    : [];

  return {
    id: `foundations:${lesson.id}:${field.id}`,
    frontier: FOUNDATIONS_STORY_WORKFLOW_FRONTIER,
    // The lesson-level proposal container is also an exclusive target because
    // FoundationDraftProposal stores one values map per lesson. Two fields in
    // the same lesson therefore cannot safely write proposals in parallel.
    targetRefs: [targetRef(lesson.id, field.id), proposalContainerRef(lesson.id)],
    evidenceRefs,
    dependencyRefs,
    assignedAgentId: FOUNDATIONS_STORY_WORKFLOW_PROFILE_ID,
    satisfied: saved,
    waitingHuman,
    locked: false,
    stale: false,
    contradiction: false,
    priority: waitingHuman ? "blocking" : "high",
    severity: "medium",
    reason: waitingHuman
      ? `${lesson.title} already has a reviewable proposal for “${field.prompt}”; do not wake another specialist until the Human decides it.`
      : `The current Foundations frontier still needs a usable answer for “${field.prompt}”.`,
  };
}

/**
 * Derive Story Workflow requirements from the same live Foundations application
 * fields used by PLAN/BUILD. There is no second lesson list for Agents.
 */
export function buildFoundationsStoryWorkflowRequirements(
  project: StoryWorkflowProject,
  curriculum: readonly CurriculumLesson[] = plotPickleCurriculum,
): readonly StoryWorkflowRequirement[] {
  const lessons = buildFoundationPlanLessons(curriculum);
  return lessons.flatMap((lesson, lessonIndex) => lesson.fields.map((field) => (
    requirementForField(project, lesson, field, lessons[lessonIndex - 1] ?? null)
  )));
}

export function planFoundationsStoryWork(
  project: StoryWorkflowProject,
  input: { readonly maxItems?: number; readonly curriculum?: readonly CurriculumLesson[] } = {},
): readonly StoryWorkItem[] {
  return planStoryWorkItems({
    projectId: project.id,
    baseRevision: project.revision,
    requirements: buildFoundationsStoryWorkflowRequirements(project, input.curriculum ?? plotPickleCurriculum),
    maxItems: input.maxItems ?? 8,
  });
}

export function resolveFoundationsStoryWorkItem(
  workItem: StoryWorkItem,
  curriculum: readonly CurriculumLesson[] = plotPickleCurriculum,
) {
  return buildFoundationPlanLessons(curriculum)
    .flatMap((lesson) => lesson.fields.map((field) => ({ lesson, field })))
    .find(({ lesson, field }) => `foundations:${lesson.id}:${field.id}` === workItem.curriculumRequirementId) ?? null;
}

function boundedProjectContext(
  project: StoryWorkflowProject,
  lesson: FoundationPlanLesson,
  field: FoundationPlanField,
): ContextItemInput {
  const state = project.foundations.lessons[lesson.id];
  const reference = referenceField(project, lesson.id, field.id);
  return {
    id: `story-workflow:ppf:${lesson.id}:${field.id}`,
    sourceType: "ppf-canon",
    sourceId: project.id,
    content: JSON.stringify({
      projectId: project.id,
      projectTitle: project.title,
      revision: project.revision,
      lessonId: lesson.id,
      fieldId: field.id,
      savedAnswer: state?.answers[field.id] ?? "",
      reviewableProposal: state?.proposal?.values[field.id] ?? "",
      referenceEvidence: reference ? {
        kind: reference.kind,
        acceptanceState: reference.acceptanceState,
        sourceRefs: reference.sourceRefs,
        reason: reference.reason,
      } : null,
    }),
    trust: "approved",
    authority: CONTEXT_AUTHORITY.ppfCanon,
    allowedUse: "canon",
    revision: project.revision,
    required: true,
  };
}

function boundedCurriculumContext(lesson: FoundationPlanLesson, field: FoundationPlanField): ContextItemInput {
  return {
    id: `story-workflow:curriculum:${lesson.id}:${field.id}`,
    sourceType: "curriculum-current",
    sourceId: lesson.id,
    content: JSON.stringify({
      frontier: FOUNDATIONS_STORY_WORKFLOW_FRONTIER,
      lessonNumber: lesson.number,
      lessonTitle: lesson.title,
      overview: lesson.overview,
      applicationFieldId: field.id,
      applicationPrompt: field.prompt,
    }),
    trust: "trusted",
    authority: CONTEXT_AUTHORITY.currentCurriculum,
    allowedUse: "instruction",
    required: true,
  };
}

function storyResultSchemaContext(workItem: StoryWorkItem): ContextItemInput {
  return {
    id: `story-workflow:schema:${workItem.workItemId}`,
    sourceType: "task-schema",
    sourceId: "story-workflow-result-v1",
    content: JSON.stringify({
      resultKinds: ["finding", "proposal", "alternatives", "no-finding", "blocked", "needs-human"],
      required: ["workItemId", "kind", "targetRefs", "evidenceRefs", "explanation", "changesCanon"],
      rule: "Creative changes remain proposals. Never write PPF/canon directly and never store hidden reasoning as evidence.",
    }),
    trust: "owner-trusted",
    authority: CONTEXT_AUTHORITY.taskSchema,
    allowedUse: "schema",
    required: true,
  };
}

export function createFoundationsStoryResponsibilityRun(input: {
  readonly project: StoryWorkflowProject;
  readonly workItem: StoryWorkItem;
  readonly curriculum?: readonly CurriculumLesson[];
}): { readonly run: ResponsibilityRun; readonly contextPacket: ContextPacket } {
  if (input.workItem.status !== "queued") throw new Error("Only queued Story Work Items may start a Responsibility Run.");
  const curriculum = input.curriculum ?? plotPickleCurriculum;
  const requirement = resolveFoundationsStoryWorkItem(input.workItem, curriculum);
  if (!requirement) throw new Error(`Story Workflow requirement ${input.workItem.curriculumRequirementId} is not in the live Foundations curriculum.`);
  const { lesson, field } = requirement;
  const contextPacket = assembleContextPacket({
    profileId: input.workItem.assignedAgentId || FOUNDATIONS_STORY_WORKFLOW_PROFILE_ID,
    taskId: input.workItem.workItemId,
    goal: `Resolve one bounded current-frontier story requirement: ${field.prompt}`,
    budgetCharacters: 18_000,
    expectedOutputSchema: "StoryWorkflowResult v1 structured object",
    items: [
      boundedProjectContext(input.project, lesson, field),
      boundedCurriculumContext(lesson, field),
      storyResultSchemaContext(input.workItem),
    ],
  });
  const run = createResponsibilityRun({
    kind: "creative-proposal",
    goal: `Review ${input.project.title}: ${field.prompt}`,
    profileId: input.workItem.assignedAgentId || FOUNDATIONS_STORY_WORKFLOW_PROFILE_ID,
    context: {
      taskId: contextPacket.taskId,
      sourceIds: contextPacket.receipt.sources.map((source) => source.id),
      receiptGeneratedAt: contextPacket.receipt.generatedAt,
    },
    verificationMode: "writer-approval",
    limits: {
      maxAttempts: 3,
      timeoutMs: 10 * 60_000,
      maxParallelChildren: 2,
      maxContextCharacters: 18_000,
      maxTokens: 12_000,
      maxToolCalls: 12,
      maxCloudCostUsd: 0,
    },
  });
  return { run, contextPacket };
}

const STORY_RESULT_OUTPUT_FIELDS = [
  "resultId",
  "workItemId",
  "kind",
  "targetRefs",
  "evidenceRefs",
  "curriculumRequirementId",
  "principleRef",
  "severity",
  "confidence",
  "changesCanon",
  "explanation",
  "proposal",
  "alternatives",
  "affectedDownstreamRefs",
] as const;

/**
 * Build graph width only for queued independent work. Target refs are exclusive
 * resources, so two workers can never race on the same story decision or the
 * same lesson-level proposal container.
 */
export function createFoundationsStoryWorkflowGraph(input: {
  readonly parentRun: ResponsibilityRun;
  readonly workItems: readonly StoryWorkItem[];
}): ResponsibilityGraphDefinition {
  const queued = input.workItems.filter((item) => item.status === "queued");
  if (!queued.length) throw new Error("Story Workflow graph requires at least one queued work item.");
  const maxParallelism = Math.max(1, Math.min(2, input.parentRun.limits.maxParallelChildren, queued.length));
  return createResponsibilityGraph({
    version: 1,
    graphId: `story-workflow:${input.parentRun.runId}`,
    parentRunId: input.parentRun.runId,
    goal: "Execute only independent bounded Foundations Story Work Items.",
    nodes: queued.map((item) => ({
      id: item.workItemId,
      job: item.reason,
      profileId: item.assignedAgentId || FOUNDATIONS_STORY_WORKFLOW_PROFILE_ID,
      workerType: "product-agent",
      capabilityRole: null,
      allowedScopes: [],
      allowedConnectorIds: [],
      inputSchema: {
        type: "object",
        required: ["workItemId", "curriculumRequirementId", "targetRefs", "evidenceRefs"],
        allowed: ["workItemId", "curriculumRequirementId", "targetRefs", "evidenceRefs"],
        maxBytes: 8_192,
      },
      outputSchema: {
        type: "object",
        required: ["workItemId", "kind", "targetRefs", "evidenceRefs", "changesCanon", "explanation"],
        allowed: [...STORY_RESULT_OUTPUT_FIELDS],
        maxBytes: 24_000,
      },
      dependencies: [],
      exclusiveResources: item.targetRefs,
      isolation: { mode: "proposal-revision", workspaceId: `${input.parentRun.runId}:${item.workItemId}` },
      timeoutMs: 10 * 60_000,
      tokenBudget: Math.min(12_000, input.parentRun.limits.maxTokens),
      cloudCostBudgetUsd: 0,
      maxRetries: 1,
      failureRoutes: {
        pass: "continue",
        retry: "retry",
        reroute: "reroute",
        escalate: "human",
        stop: "stop",
      },
      verification: {
        mode: "writer",
        verifierProfileId: "",
        evidenceRequired: true,
      },
    })),
    limits: {
      maxNodes: Math.min(24, queued.length),
      maxParallelism,
      maxRounds: 2,
      maxTokens: input.parentRun.limits.maxTokens,
      maxContextCharacters: input.parentRun.limits.maxContextCharacters,
      maxCloudCostUsd: 0,
      maxRawFanInBytes: 64 * 1024,
    },
  }, input.parentRun);
}

export function storyWorkflowActivitySummary(workItems: readonly StoryWorkItem[]) {
  const queued = workItems.filter((item) => item.status === "queued").length;
  const waiting = workItems.filter((item) => item.status === "waiting-human").length;
  if (!queued && !waiting) return "Current Foundations story checks are complete.";
  if (!queued && waiting) return `${waiting} story ${waiting === 1 ? "decision is" : "decisions are"} waiting for you.`;
  return `${queued} bounded story ${queued === 1 ? "check" : "checks"} ready${waiting ? ` · ${waiting} ${waiting === 1 ? "needs" : "need"} your decision` : ""}.`;
}
