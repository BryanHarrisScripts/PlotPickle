import type { StoryWorkItem } from "../../core/story-workflow/story-workflow-core.mjs";
import {
  STORY_COUNCIL_SPECIALISTS,
  selectStoryCouncilSpecialists,
  type StoryCouncilPlan,
} from "../../core/story-workflow/story-council-core.mjs";
import { agentProfileById } from "../../lib/agents/agent-profiles";
import {
  createResponsibilityRun,
  type ResponsibilityRun,
  type ResponsibilityRunContextRef,
} from "../../lib/agents/responsibility/responsibility-runs";

export type StoryCouncilRunAssignment = {
  readonly agentId: string;
  readonly responsibility: string;
  readonly run: ResponsibilityRun;
};

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
