import type { StoryWorkItem } from "../../core/story-workflow/story-workflow-core.mjs";
import {
  parseStoryCouncilRuntimeText,
  storyCouncilRuntimeMessage,
} from "../../core/story-workflow/story-council/runtime-protocol.mjs";
import {
  normalizeStoryCouncilContribution,
  storyCouncilSpecialistByAgentId,
  type StoryCouncilContribution,
} from "../../core/story-workflow/story-council/core.mjs";
import type { ContextPacket } from "../../lib/agents/context/context-engine";
import { agentProfileById } from "../../lib/agents/agent-profiles";

export function storyCouncilRuntimeRequest(input: {
  readonly workItem: StoryWorkItem;
  readonly agentId: string;
  readonly context: ContextPacket;
}) {
  const specialist = storyCouncilSpecialistByAgentId(input.agentId);
  const profile = agentProfileById(input.agentId);
  if (!specialist?.workerEligible || !profile) throw new Error(`${input.agentId} is not an approved Story Council runtime worker.`);
  if (input.context.profileId !== profile.id) throw new Error("Story Council Context packet belongs to a different Agent Contract.");
  if (input.context.taskId !== `${input.workItem.workItemId}:${profile.id}`) throw new Error("Story Council Context packet is not bound to this work item and Agent.");

  const evidence = input.context.items.map((item) => ({
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    trust: item.trust,
    authority: item.authority,
    allowedUse: item.allowedUse,
    revision: item.revision ?? "",
    content: item.content,
  }));
  const message = storyCouncilRuntimeMessage([
    `Responsibility: ${specialist.responsibility}.`,
    `Inspect only this bounded Story Work Item: ${input.workItem.reason}`,
    "Return only the structured Story Council object requested by the runtime schema.",
    "Do not output workItemId, runId, agentId, baseRevision, target refs, evidence refs, curriculum refs, provenance, hidden reasoning, or a canon-write instruction; PlotPickle owns those fields.",
    `Host-owned target refs: ${JSON.stringify(input.workItem.targetRefs)}.`,
    `Host-owned evidence refs: ${JSON.stringify(input.workItem.evidenceRefs)}.`,
    `Bounded context: ${JSON.stringify(evidence)}.`,
  ].join("\n"));
  return {
    provider: "local" as const,
    agentId: profile.runtimeRoleId,
    modelRole: profile.requestedModelRole,
    tone: "direct" as const,
    history: [] as const,
    message,
  };
}

export function bindStoryCouncilRuntimeOutput(input: {
  readonly text: string;
  readonly workItem: StoryWorkItem;
  readonly runId: string;
  readonly agentId: string;
  readonly recordedAt?: string;
}): StoryCouncilContribution {
  const output = parseStoryCouncilRuntimeText(input.text);
  const contributionId = `${input.runId}:council`;
  return normalizeStoryCouncilContribution({
    contributionId,
    workItemId: input.workItem.workItemId,
    runId: input.runId,
    agentId: input.agentId,
    baseRevision: input.workItem.baseRevision,
    kind: output.kind,
    targetRefs: input.workItem.targetRefs,
    evidenceRefs: input.workItem.evidenceRefs,
    curriculumRequirementId: input.workItem.curriculumRequirementId,
    severity: output.severity,
    confidence: output.confidence,
    changesCanon: output.changesCanon,
    explanation: output.explanation,
    proposal: output.proposal,
    alternatives: output.alternatives,
    affectedDownstreamRefs: input.workItem.dependencyRefs,
    agreementRefs: [],
    disagreementRefs: [],
    provenance: {
      transport: "local-runtime",
      roomClass: "local-only",
      recordedAt: input.recordedAt,
    },
  });
}
