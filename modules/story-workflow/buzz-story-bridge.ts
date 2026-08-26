import type { PPFProject } from "../../core/project/project";
import {
  resolveBuzzAgentIdentityBinding,
} from "../../core/story-workflow/buzz/agent-identity-binding.mjs";
import {
  createStoryBridgeRequest,
  type StoryBridgeContribution,
  type StoryBridgeRequest,
} from "../../core/story-workflow/buzz-story-bridge-core.mjs";
import type { StoryWorkItem } from "../../core/story-workflow/story-workflow-core.mjs";
import {
  agentExecutionContexts,
  agentProfileById,
  officialAgentPublicIdentity,
} from "../../lib/agents/agent-profiles";
import type { ContextPacket } from "../../lib/agents/context/context-engine";
import { inboundExternalContext, redactConnectorPayload } from "../../lib/agents/responsibility/connector-trust-policy";
import type { ResponsibilityRun } from "../../lib/agents/responsibility/responsibility-runs";
import { buzzProjectSlug, buzzRoomName, type BuzzStoryRoomId } from "../../lib/buzz/buzz-story-room";

declare const __PLOTPICKLE_BUZZ_AGENT_IDENTITIES__: Readonly<Record<string, string>> | undefined;

const RUNTIME_BINDING_KEY = "__PLOTPICKLE_BUZZ_AGENT_IDENTITIES_RUNTIME__";
const STORY_BRIDGE_ROOM_BY_FRONTIER: Readonly<Record<string, BuzzStoryRoomId>> = {
  Foundations: "story",
  World: "continuity",
  Character: "characters",
  Structure: "structure",
  Storyboard: "visual-development",
  Previs: "production-notes",
};

function bridgeRoomFor(workItem: StoryWorkItem): BuzzStoryRoomId {
  return STORY_BRIDGE_ROOM_BY_FRONTIER[workItem.frontier] ?? "story";
}

function localBuzzAgentIdentities() {
  const runtime = (globalThis as typeof globalThis & {
    [RUNTIME_BINDING_KEY]?: Readonly<Record<string, string>>;
  })[RUNTIME_BINDING_KEY];
  if (runtime && Object.keys(runtime).length) return runtime;
  return typeof __PLOTPICKLE_BUZZ_AGENT_IDENTITIES__ === "object"
    && __PLOTPICKLE_BUZZ_AGENT_IDENTITIES__
    ? __PLOTPICKLE_BUZZ_AGENT_IDENTITIES__
    : {};
}

function contextItems(packet: ContextPacket) {
  return packet.items.map((item) => ({
    id: item.id,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    allowedUse: item.allowedUse,
    content: String(redactConnectorPayload(item.content)),
  }));
}

function contextMatchesRun(run: ResponsibilityRun, packet: ContextPacket, workItem: StoryWorkItem) {
  if (!run.context || run.context.taskId !== workItem.workItemId) return false;
  if (run.context.receiptGeneratedAt !== packet.receipt.generatedAt) return false;
  const allowed = new Set(run.context.sourceIds);
  return packet.receipt.sources.every((source) => allowed.has(source.id));
}

/**
 * Adapt an existing Story Work Item + Responsibility Run into the optional BUZZ
 * transport. The Agent itself receives no new network or credential authority;
 * PlotPickle remains the host that decides whether this bounded task may leave
 * the local process and always defaults private project evidence to a private
 * project Story Room.
 */
export function prepareStoryBridgeRequest(input: {
  readonly project: Pick<PPFProject, "id" | "title" | "revision">;
  readonly workItem: StoryWorkItem;
  readonly run: ResponsibilityRun;
  readonly contextPacket: ContextPacket;
}): StoryBridgeRequest {
  const profile = agentProfileById(input.workItem.assignedAgentId);
  if (!profile) throw new Error(`Story Bridge cannot resolve Agent Profile ${input.workItem.assignedAgentId}.`);
  if (profile.id !== input.run.profileId) throw new Error("Story Bridge Agent Profile must match the existing Responsibility Run.");
  if (input.contextPacket.profileId !== profile.id || input.contextPacket.taskId !== input.workItem.workItemId) {
    throw new Error("Story Bridge context must remain bound to the exact Story Work Item and Agent Profile.");
  }
  if (!contextMatchesRun(input.run, input.contextPacket, input.workItem)) {
    throw new Error("Story Bridge context receipt must match the persisted Responsibility Run context before private evidence can leave the local workflow.");
  }
  if (!agentExecutionContexts(profile.id).includes("public-buzz")) {
    throw new Error(`${profile.displayName} is not approved for BUZZ execution context.`);
  }

  const roomId = bridgeRoomFor(input.workItem);
  const identity = officialAgentPublicIdentity(profile.id);
  const expectedAgentPubkey = resolveBuzzAgentIdentityBinding({
    profileId: profile.id,
    configuredPubkey: identity?.pubkey ?? "",
    localBindings: localBuzzAgentIdentities(),
  });
  return createStoryBridgeRequest({
    projectId: input.project.id,
    projectRoomPrefix: buzzProjectSlug(input.project),
    workItemId: input.workItem.workItemId,
    runId: input.run.runId,
    baseRevision: input.workItem.baseRevision,
    targetRefs: input.workItem.targetRefs,
    dependencyRefs: input.workItem.dependencyRefs,
    evidenceRefs: input.workItem.evidenceRefs,
    agentProfileId: profile.id,
    agentActorId: profile.buzzBinding.actorId,
    expectedAgentPubkey,
    localEquivalentAllowed: profile.execution.kind === "embedded-mastra",
    destination: {
      privacyClass: "private-project",
      federation: "private-only",
      roomId,
      roomName: buzzRoomName(input.project, roomId),
    },
    contextItems: contextItems(input.contextPacket),
    limits: {
      timeoutMs: input.run.limits.timeoutMs,
      maxContextCharacters: input.run.limits.maxContextCharacters,
      maxTokens: input.run.limits.maxTokens,
      maxToolCalls: input.run.limits.maxToolCalls,
      maxCloudCostUsd: input.run.limits.maxCloudCostUsd,
    },
  });
}

/**
 * Signed BUZZ content is still external/untrusted story evidence. A valid Agent
 * signature proves authorship, never truth and never permission to mutate PPF.
 */
export function storyBridgeContributionContext(contribution: StoryBridgeContribution) {
  if (!contribution.result) return null;
  return inboundExternalContext({
    source: "buzz-peer",
    sourceId: contribution.provenance.eventId || contribution.contributionId,
    content: JSON.stringify({
      agentProfileId: contribution.agentProfileId,
      actorId: contribution.agentActorId,
      state: contribution.state,
      result: contribution.result,
    }),
    signatureVerified: contribution.provenance.signatureVerified,
    revision: contribution.baseRevision,
  });
}
