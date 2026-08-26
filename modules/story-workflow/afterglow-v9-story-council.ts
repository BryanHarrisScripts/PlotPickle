import {
  storyWorkItemId,
  type StoryWorkItem,
} from "../../core/story-workflow/story-workflow-core.mjs";
import {
  CONTEXT_AUTHORITY,
  type ContextItemInput,
  type ContextPacket,
} from "../../lib/agents/context/context-engine";
import { createAfterglowV9FoundationsReference } from "../library/reference/afterglow-v9-foundations";
import {
  createStoryCouncilContextPacket,
  createStoryCouncilGraph,
  createStoryCouncilParentRun,
  createStoryCouncilResponsibilityRuns,
  planStoryCouncilForWorkItem,
} from "./story-council";

const AFTERGLOW_COUNCIL_REQUIREMENT_ID = "story-council:afterglow-v9:ren-motivation";
const AFTERGLOW_COUNCIL_TARGET_REFS = ["ppf:character:ren:motivation"] as const;
const AFTERGLOW_COUNCIL_EVIDENCE_REFS = [
  "character:ren",
  "development.foundations.storyEngine",
  "story.theme",
] as const;

function afterglowCouncilWorkItem(project: ReturnType<typeof createAfterglowV9FoundationsReference>): StoryWorkItem {
  const baseRevision = String(project.revision);
  return {
    workItemId: storyWorkItemId({
      projectId: project.id,
      baseRevision,
      curriculumRequirementId: AFTERGLOW_COUNCIL_REQUIREMENT_ID,
      targetRefs: AFTERGLOW_COUNCIL_TARGET_REFS,
    }),
    projectId: project.id,
    baseRevision,
    curriculumRequirementId: AFTERGLOW_COUNCIL_REQUIREMENT_ID,
    frontier: "Foundations",
    targetRefs: [...AFTERGLOW_COUNCIL_TARGET_REFS],
    status: "queued",
    reason: "Trace whether Ren's grief and protective need drive visible choices strongly enough to support the current Foundations story engine, while preserving any reasonable creative disagreement.",
    evidenceRefs: [...AFTERGLOW_COUNCIL_EVIDENCE_REFS],
    assignedAgentId: "tamsin-hearthquill",
    runId: "",
    proposalIds: [],
    dependencyRefs: ["ppf:foundations:protagonist", "ppf:foundations:stakes"],
    severity: "high",
    priority: "blocking",
    kind: "audit",
  };
}

function afterglowEvidenceItem(
  project: ReturnType<typeof createAfterglowV9FoundationsReference>,
  workItem: StoryWorkItem,
  agentId: string,
): ContextItemInput {
  const fixture = project.sourceEvidence?.referenceFixture;
  const selected = (fixture?.fields ?? [])
    .filter((field) => field.acceptanceState === "reference-defined")
    .filter((field) => field.sourceRefs.some((ref) => AFTERGLOW_COUNCIL_EVIDENCE_REFS.includes(ref as (typeof AFTERGLOW_COUNCIL_EVIDENCE_REFS)[number])))
    .slice(0, 6)
    .map((field) => ({
      key: field.key,
      kind: field.kind,
      sourceRefs: field.sourceRefs,
      reason: field.reason,
      acceptedAnswer: project.foundations.lessons[field.lessonId]?.answers[field.fieldId] ?? "",
    }));

  return {
    id: `afterglow-v9:council:evidence:${agentId}`,
    sourceType: "ppf-canon",
    sourceId: project.id,
    content: JSON.stringify({
      projectId: project.id,
      projectTitle: project.title,
      baseRevision: workItem.baseRevision,
      referenceFixtureId: fixture?.fixtureId ?? "",
      sourceVersion: fixture?.sourceVersion ?? "",
      targetRefs: workItem.targetRefs,
      evidenceRefs: workItem.evidenceRefs,
      selectedEvidence: selected,
    }),
    trust: "approved",
    authority: CONTEXT_AUTHORITY.ppfCanon,
    allowedUse: "canon",
    revision: project.revision,
    required: true,
  };
}

function afterglowCurriculumItem(workItem: StoryWorkItem, agentId: string): ContextItemInput {
  return {
    id: `afterglow-v9:council:curriculum:${agentId}`,
    sourceType: "curriculum-current",
    sourceId: workItem.curriculumRequirementId,
    content: JSON.stringify({
      frontier: workItem.frontier,
      curriculumRequirementId: workItem.curriculumRequirementId,
      targetRefs: workItem.targetRefs,
      instruction: "Use only the current PlotPickle curriculum available to the Agent Contract. Separate source-supported findings from creative judgment; do not invent missing canon.",
    }),
    trust: "trusted",
    authority: CONTEXT_AUTHORITY.currentCurriculum,
    allowedUse: "instruction",
    required: true,
  };
}

export function createAfterglowV9StoryCouncilExercise(input: {
  readonly buzzAvailable?: boolean;
} = {}) {
  const project = createAfterglowV9FoundationsReference();
  const workItem = afterglowCouncilWorkItem(project);
  const plan = planStoryCouncilForWorkItem(workItem, {
    maxSpecialists: 3,
    buzzAvailable: Boolean(input.buzzAvailable),
    allowPublicDiscussion: false,
  });
  const contextPackets: Readonly<Record<string, ContextPacket>> = Object.fromEntries(plan.specialists.map((specialist) => [
    specialist.agentId,
    createStoryCouncilContextPacket({
      workItem,
      agentId: specialist.agentId,
      items: [
        afterglowEvidenceItem(project, workItem, specialist.agentId),
        afterglowCurriculumItem(workItem, specialist.agentId),
      ],
    }),
  ]));
  const parentRun = createStoryCouncilParentRun({ workItem, plan });
  const contextByAgentId = Object.fromEntries(Object.entries(contextPackets).map(([agentId, packet]) => [
    agentId,
    {
      taskId: packet.taskId,
      sourceIds: packet.receipt.sources.map((source) => source.id),
      receiptGeneratedAt: packet.receipt.generatedAt,
    },
  ]));
  const assignments = createStoryCouncilResponsibilityRuns({
    workItem,
    parentRunId: parentRun.runId,
    contextByAgentId,
    buzzAvailable: Boolean(input.buzzAvailable),
    allowPublicDiscussion: false,
    maxSpecialists: 3,
  }).assignments;
  const graph = createStoryCouncilGraph({ workItem, plan, parentRun });

  return {
    projectId: project.id,
    projectTitle: project.title,
    projectRevision: project.revision,
    workItem,
    plan,
    contextPackets,
    parentRun,
    assignments,
    graph,
  };
}
