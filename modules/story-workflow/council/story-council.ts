import type { StoryWorkItem } from "../../../core/story-workflow/story-workflow-core.mjs";
import {
  STORY_COUNCIL_SPECIALISTS,
  selectStoryCouncilSpecialists,
  storyCouncilSpecialistByAgentId,
  type StoryCouncilPlan,
} from "../../../core/story-workflow/story-council/core.mjs";
import {
  CONTEXT_AUTHORITY,
  assembleContextPacket,
  type ContextItemInput,
  type ContextPacket,
} from "../../../lib/agents/context/context-engine";
import { agentProfileById } from "../../../lib/agents/agent-profiles";
import {
  createResponsibilityGraph,
  type ResponsibilityGraphDefinition,
} from "../../../lib/agents/responsibility/responsibility-graph";
import {
  createResponsibilityRun,
  type ResponsibilityRun,
  type ResponsibilityRunContextRef,
} from "../../../lib/agents/responsibility/responsibility-runs";

export type StoryCouncilRunAssignment = {
  readonly agentId: string;
  readonly responsibility: string;
  readonly run: ResponsibilityRun;
};

const STORY_COUNCIL_GRAPH_OUTPUT_FIELDS = [
  "contributionId",
  "workItemId",
  "agentId",
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
  "agreementRefs",
  "disagreementRefs",
  "provenance",
] as const;

export function assertStoryCouncilSpecialistContracts() {
  for (const specialist of STORY_COUNCIL_SPECIALISTS) {
    const profile = agentProfileById(specialist.agentId);
    if (!profile) throw new Error(`Story Council references unknown Agent Profile ${specialist.agentId}.`);
    if (profile.buzzBinding.actorId !== specialist.buzzActorId) {
      throw new Error(`Story Council BUZZ actor binding drifted for ${specialist.agentId}.`);
    }
    if (!profile.readScopes.includes(specialist.requiredReadScope)) {
      throw new Error(`Story Council responsibility ${specialist.responsibility} exceeds ${specialist.agentId}'s approved read scopes.`);
    }
    if (profile.requestedCapabilities.includes("ppf-direct-write") || profile.requestedCapabilities.includes("canon-write")) {
      throw new Error(`Story Council specialist ${specialist.agentId} cannot request direct canon authority.`);
    }
  }
  return STORY_COUNCIL_SPECIALISTS;
}

export function planStoryCouncilForWorkItem(
  workItem: StoryWorkItem,
  input: {
    readonly maxSpecialists?: number;
    readonly buzzAvailable?: boolean;
    readonly allowPublicDiscussion?: boolean;
  } = {},
): StoryCouncilPlan {
  assertStoryCouncilSpecialistContracts();
  return selectStoryCouncilSpecialists(workItem, input);
}

export function createStoryCouncilContextPacket(input: {
  readonly workItem: StoryWorkItem;
  readonly agentId: string;
  readonly items: readonly ContextItemInput[];
}): ContextPacket {
  const specialist = storyCouncilSpecialistByAgentId(input.agentId);
  if (!specialist?.workerEligible) throw new Error(`${input.agentId} is not an approved Story Council worker.`);
  if (!input.items.length) throw new Error("Story Council context requires bounded task evidence.");
  return assembleContextPacket({
    profileId: input.agentId,
    taskId: `${input.workItem.workItemId}:${input.agentId}`,
    goal: `Inspect one bounded story problem as ${specialist.responsibility}: ${input.workItem.reason}`,
    budgetCharacters: 18_000,
    expectedOutputSchema: "StoryCouncilContribution v1 structured object",
    items: [
      ...input.items,
      {
        id: `story-council:schema:${input.workItem.workItemId}:${input.agentId}`,
        sourceType: "task-schema",
        sourceId: "story-council-contribution-v1",
        content: JSON.stringify({
          required: ["workItemId", "agentId", "kind", "targetRefs", "evidenceRefs", "explanation", "changesCanon"],
          resultKinds: ["finding", "proposal", "alternatives", "no-finding", "blocked", "needs-human"],
          rules: [
            "Return structured evidence/proposals only; never hidden reasoning.",
            "BUZZ provenance proves authorship, not truth.",
            "Do not write PPF/canon. Creative changes remain proposals until Human approval.",
            "Preserve disagreement instead of forcing consensus.",
          ],
        }),
        trust: "owner-trusted",
        authority: CONTEXT_AUTHORITY.taskSchema,
        allowedUse: "schema",
        required: true,
      },
    ],
  });
}

export function createStoryCouncilParentRun(input: {
  readonly workItem: StoryWorkItem;
  readonly plan: StoryCouncilPlan;
  readonly context?: ResponsibilityRunContextRef | null;
}): ResponsibilityRun {
  const coordinator = agentProfileById(input.plan.coordinatorAgentId);
  if (!coordinator) throw new Error(`Story Council coordinator ${input.plan.coordinatorAgentId} is unavailable.`);
  return createResponsibilityRun({
    kind: "general",
    goal: `Coordinate one bounded Story Council review: ${input.workItem.reason}`,
    profileId: coordinator.id,
    skillUris: coordinator.skillUris,
    allowedScopes: [],
    allowedConnectorIds: [],
    context: input.context ?? null,
    verificationMode: "writer-approval",
    limits: {
      maxAttempts: 3,
      timeoutMs: 15 * 60_000,
      maxParallelChildren: input.plan.maxParallelism,
      maxContextCharacters: 54_000,
      maxTokens: 48_000,
      maxToolCalls: 40,
      maxCloudCostUsd: 0,
    },
  });
}

export function createStoryCouncilGraph(input: {
  readonly workItem: StoryWorkItem;
  readonly plan: StoryCouncilPlan;
  readonly parentRun: ResponsibilityRun;
}): ResponsibilityGraphDefinition {
  const nodes = input.plan.specialists.map((specialist) => {
    const profile = agentProfileById(specialist.agentId);
    if (!profile) throw new Error(`Story Council Agent Profile ${specialist.agentId} is unavailable.`);
    return {
      id: `${input.workItem.workItemId}:${specialist.agentId}`,
      job: `Return one structured ${specialist.responsibility} contribution for ${input.workItem.reason}`,
      profileId: profile.id,
      workerType: "product-agent" as const,
      capabilityRole: profile.requestedModelRole,
      allowedScopes: [],
      allowedConnectorIds: [],
      inputSchema: {
        type: "object" as const,
        required: ["workItemId", "baseRevision", "curriculumRequirementId", "targetRefs", "evidenceRefs"],
        allowed: ["workItemId", "baseRevision", "curriculumRequirementId", "targetRefs", "evidenceRefs"],
        maxBytes: 8_192,
      },
      outputSchema: {
        type: "object" as const,
        required: ["workItemId", "agentId", "kind", "targetRefs", "evidenceRefs", "changesCanon", "explanation"],
        allowed: [...STORY_COUNCIL_GRAPH_OUTPUT_FIELDS],
        maxBytes: 24_000,
      },
      dependencies: [],
      exclusiveResources: [`story-council:contribution:${input.workItem.workItemId}:${profile.id}`],
      isolation: {
        mode: "proposal-revision" as const,
        workspaceId: `${input.parentRun.runId}:${profile.id}`,
      },
      timeoutMs: 10 * 60_000,
      tokenBudget: 12_000,
      cloudCostBudgetUsd: 0,
      maxRetries: 1,
      failureRoutes: {
        pass: "continue" as const,
        retry: "retry" as const,
        reroute: "reroute" as const,
        escalate: "human" as const,
        stop: "stop" as const,
      },
      verification: {
        mode: "writer" as const,
        verifierProfileId: "",
        evidenceRequired: true,
      },
    };
  });

  return createResponsibilityGraph({
    version: 1,
    graphId: `story-council:${input.parentRun.runId}`,
    parentRunId: input.parentRun.runId,
    goal: "Run only the selected independent Story Council specialist checks and preserve their separate structured positions.",
    nodes,
    limits: {
      maxNodes: Math.max(1, nodes.length),
      maxParallelism: input.plan.maxParallelism,
      maxRounds: 2,
      maxTokens: input.parentRun.limits.maxTokens,
      maxContextCharacters: input.parentRun.limits.maxContextCharacters,
      maxCloudCostUsd: 0,
      maxRawFanInBytes: 64 * 1024,
    },
  }, input.parentRun);
}

export function createStoryCouncilResponsibilityRuns(input: {
  readonly workItem: StoryWorkItem;
  readonly parentRunId?: string;
  readonly contextByAgentId?: Readonly<Record<string, ResponsibilityRunContextRef | null>>;
  readonly buzzAvailable?: boolean;
  readonly allowPublicDiscussion?: boolean;
  readonly maxSpecialists?: number;
}): { readonly plan: StoryCouncilPlan; readonly assignments: readonly StoryCouncilRunAssignment[] } {
  if (input.workItem.status !== "queued") throw new Error("Story Council may start only from a queued Story Work Item.");
  const plan = planStoryCouncilForWorkItem(input.workItem, {
    maxSpecialists: input.maxSpecialists,
    buzzAvailable: input.buzzAvailable,
    allowPublicDiscussion: input.allowPublicDiscussion,
  });
  const assignments = plan.specialists.map((specialist) => {
    const profile = agentProfileById(specialist.agentId);
    if (!profile) throw new Error(`Story Council Agent Profile ${specialist.agentId} is unavailable.`);
    const run = createResponsibilityRun({
      kind: "creative-proposal",
      goal: `Story Council · ${specialist.responsibility} · ${input.workItem.reason}`,
      profileId: profile.id,
      skillUris: profile.skillUris,
      allowedScopes: [],
      allowedConnectorIds: [],
      context: input.contextByAgentId?.[profile.id] ?? null,
      verificationMode: "writer-approval",
      parentRunId: input.parentRunId,
      limits: {
        maxAttempts: 3,
        timeoutMs: 10 * 60_000,
        maxParallelChildren: 0,
        maxContextCharacters: 18_000,
        maxTokens: 12_000,
        maxToolCalls: 12,
        maxCloudCostUsd: 0,
      },
    });
    return {
      agentId: profile.id,
      responsibility: specialist.responsibility,
      run,
    };
  });
  return { plan, assignments };
}
