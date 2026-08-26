import type { StoryWorkItem } from "../../core/story-workflow/story-workflow-core.mjs";
import {
  STORY_COUNCIL_RUNTIME_KINDS,
  STORY_COUNCIL_RUNTIME_SEVERITIES,
  storyCouncilRuntimeMessage,
  type StoryCouncilRuntimeKind,
  type StoryCouncilRuntimeSeverity,
} from "../../core/story-workflow/story-council-runtime-protocol.mjs";
import {
  normalizeStoryCouncilContribution,
  storyCouncilSpecialistByAgentId,
  type StoryCouncilContribution,
} from "../../core/story-workflow/story-council-core.mjs";
import type { ContextPacket } from "../../lib/agents/context/context-engine";
import { agentProfileById } from "../../lib/agents/agent-profiles";

export type StoryCouncilRuntimeOutput = {
  readonly kind: StoryCouncilRuntimeKind;
  readonly severity: StoryCouncilRuntimeSeverity;
  readonly confidence: number;
  readonly changesCanon: boolean;
  readonly explanation: string;
  readonly proposal: string;
  readonly alternatives: readonly string[];
};

const OUTPUT_KEYS = new Set(["kind", "severity", "confidence", "changesCanon", "explanation", "proposal", "alternatives"]);
const RUNTIME_KINDS = new Set<string>(STORY_COUNCIL_RUNTIME_KINDS);
const RUNTIME_SEVERITIES = new Set<string>(STORY_COUNCIL_RUNTIME_SEVERITIES);

function boundedText(value: unknown, maximum: number) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function boundedStrings(value: unknown, maximum: number, itemMaximum: number) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => boundedText(item, itemMaximum)).filter(Boolean))].slice(0, maximum);
}

function parseObject(text: string) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) throw new Error("Story Council specialist did not return the required structured JSON object.");
  const parsed: unknown = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Story Council specialist returned an invalid structured object.");
  return parsed as Record<string, unknown>;
}

export function parseStoryCouncilRuntimeOutput(text: string): StoryCouncilRuntimeOutput {
  const value = parseObject(text);
  const unexpected = Object.keys(value).filter((key) => !OUTPUT_KEYS.has(key));
  if (unexpected.length) throw new Error(`Story Council specialist returned host-owned or unsupported fields: ${unexpected.join(", ")}.`);
  const kind = boundedText(value.kind, 40);
  const severity = boundedText(value.severity, 20);
  const confidence = Number(value.confidence);
  const explanation = boundedText(value.explanation, 2_400);
  const proposal = boundedText(value.proposal, 2_400);
  if (!RUNTIME_KINDS.has(kind)) throw new Error("Story Council specialist returned an invalid finding class.");
  if (!RUNTIME_SEVERITIES.has(severity)) throw new Error("Story Council specialist returned an invalid severity.");
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error("Story Council specialist confidence must be between 0 and 1.");
  if (typeof value.changesCanon !== "boolean") throw new Error("Story Council specialist must state whether the recommendation would change canon.");
  if (!explanation) throw new Error("Story Council specialist explanation is required.");
  if (kind === "proposal" && !proposal) throw new Error("Story Council proposal output requires a proposal.");
  return {
    kind: kind as StoryCouncilRuntimeKind,
    severity: severity as StoryCouncilRuntimeSeverity,
    confidence,
    changesCanon: value.changesCanon,
    explanation,
    proposal,
    alternatives: boundedStrings(value.alternatives, 4, 1_000),
  };
}

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
  const output = parseStoryCouncilRuntimeOutput(input.text);
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
