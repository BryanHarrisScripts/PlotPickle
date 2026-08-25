import type { StoryResult } from "./story-workflow-core.mjs";

export type StoryBridgePrivacyClass = "private-project" | "human-purpose" | "public-great-hall" | "guildhall";
export type StoryBridgeState = "ready" | "degraded-local" | "blocked" | "accepted" | "stale" | "rejected" | "unverified";

export type StoryBridgeContextItem = {
  readonly id: string;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly allowedUse: string;
  readonly content: string;
};

export type StoryBridgeRequest = {
  readonly version: 1;
  readonly requestId: string;
  readonly projectId: string;
  readonly projectRoomPrefix: string;
  readonly workItemId: string;
  readonly runId: string;
  readonly baseRevision: string;
  readonly targetRefs: readonly string[];
  readonly dependencyRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly agentProfileId: string;
  readonly agentActorId: string;
  readonly expectedAgentPubkey: string;
  readonly localEquivalentAllowed: boolean;
  readonly destination: {
    readonly privacyClass: "private-project";
    readonly roomId: string;
    readonly roomName: string;
  };
  readonly contextItems: readonly StoryBridgeContextItem[];
  readonly expectedResultSchema: "StoryWorkflowResult v1";
  readonly createdAt: string;
  readonly state: "ready" | "degraded-local" | "blocked";
  readonly stateReason: string;
};

export type StoryBridgeContribution = {
  readonly contributionId: string;
  readonly requestId: string;
  readonly workItemId: string;
  readonly runId: string;
  readonly baseRevision: string;
  readonly agentProfileId: string;
  readonly agentActorId: string;
  readonly state: "accepted" | "stale" | "rejected" | "unverified" | "blocked";
  readonly accepted: boolean;
  readonly reason: string;
  readonly result: StoryResult | null;
  readonly provenance: {
    readonly transport: "buzz";
    readonly eventId: string;
    readonly pubkey: string;
    readonly signatureVerified: boolean;
  };
};

export const STORY_BRIDGE_VERSION: 1;
export const STORY_BRIDGE_DISPATCH_MARKER: string;
export const STORY_BRIDGE_RESULT_MARKER: string;
export const STORY_BRIDGE_PRIVACY_CLASSES: readonly StoryBridgePrivacyClass[];
export const STORY_BRIDGE_STATES: readonly StoryBridgeState[];

export function createStoryBridgeRequest(input: {
  readonly projectId: string;
  readonly projectRoomPrefix: string;
  readonly workItemId: string;
  readonly runId: string;
  readonly baseRevision: string | number;
  readonly targetRefs: readonly string[];
  readonly dependencyRefs?: readonly string[];
  readonly evidenceRefs?: readonly string[];
  readonly agentProfileId: string;
  readonly agentActorId: string;
  readonly expectedAgentPubkey?: string | null;
  readonly localEquivalentAllowed?: boolean;
  readonly destination: { readonly privacyClass: StoryBridgePrivacyClass; readonly roomId: string; readonly roomName: string };
  readonly contextItems: readonly StoryBridgeContextItem[];
  readonly createdAt?: string;
}): StoryBridgeRequest;

export function encodeStoryBridgeDispatchEnvelope(request: StoryBridgeRequest): string;
export function decodeStoryBridgeResultEnvelope(content: string): Record<string, unknown> | null;
export function normalizeStoryBridgeContribution(input: {
  readonly request: StoryBridgeRequest;
  readonly envelope: string | Record<string, unknown>;
  readonly rawEvent: unknown;
  readonly currentRevision?: string | number;
}): StoryBridgeContribution;
export function dedupeStoryBridgeContributions(values: readonly StoryBridgeContribution[]): readonly StoryBridgeContribution[];
export function createAffectedStoryBridgeUpdate(request: StoryBridgeRequest, input: {
  readonly baseRevision: string | number;
  readonly changedRefs: readonly string[];
  readonly acceptedDecisionId?: string;
  readonly priorFindingIds?: readonly string[];
  readonly reason?: string;
}): {
  readonly version: 1;
  readonly requestId: string;
  readonly workItemId: string;
  readonly priorBaseRevision: string;
  readonly baseRevision: string;
  readonly acceptedDecisionId: string;
  readonly changedRefs: readonly string[];
  readonly priorFindingIds: readonly string[];
  readonly reason: string;
} | null;
