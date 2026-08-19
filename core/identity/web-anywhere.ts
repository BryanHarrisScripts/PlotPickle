import type { PlotPickleAccountSyncState, PortableLearnState } from "./account-learn-sync";
import type {
  CandidateRemoteResult,
  ComputeNodeDirectory,
  ScopedRemoteWorkPackage,
} from "./remote-node-compute";
import * as core from "./web-anywhere-core.mjs";

export type WebClientTrust = "public-computer" | "private-browser";

export type WebAnywhereSession = {
  readonly version: 1;
  readonly sessionId: string;
  readonly personId: string;
  readonly avatarId: string;
  readonly authenticationEvidenceId: string;
  readonly authenticatedAt: string;
  readonly reauthenticatedAt: string;
  readonly expiresAt: string;
  readonly clientTrust: WebClientTrust;
  readonly storagePolicy: "memory-only";
  readonly cachePolicy: "no-store";
  readonly revokedAt: string | null;
};

export type WebIdentityProjection = {
  readonly version: 1;
  readonly personId: string;
  readonly avatar: {
    readonly avatarId: string;
    readonly displayName: string;
    readonly claimedAt: string;
  };
  readonly session: {
    readonly sessionId: string;
    readonly clientTrust: WebClientTrust;
    readonly expiresAt: string;
    readonly storagePolicy: "memory-only";
    readonly cachePolicy: "no-store";
  };
};

export type WebLearnProjection = {
  readonly version: 1;
  readonly authority: "portable-learn-sync";
  readonly personId: string;
  readonly avatarId: string;
  readonly state: PortableLearnState;
};

export type WebCommunityEvent = {
  readonly eventId: string;
  readonly roomId: string;
  readonly avatarId: string;
  readonly nodeId: string;
  readonly content: string;
  readonly createdAt: string;
  readonly signatureVerified: true;
};

export type WebCommunityProjection = {
  readonly version: 1;
  readonly authority: "buzz";
  readonly roomId: string;
  readonly roomName: string;
  readonly events: readonly WebCommunityEvent[];
  readonly projectedAt: string;
  readonly webMessageStore: false;
};

export type WebReviewArtifact = {
  readonly artifactId: string;
  readonly kind: "image" | "video" | "audio" | "document" | "story";
  readonly contentHashSha256: string;
  readonly mediaType: string;
  readonly byteLength: number;
  readonly acceptedAt: string;
};

export type WebRemoteContextItem = {
  readonly contextId: string;
  readonly kind: "story" | "character" | "world" | "visual" | "instruction";
  readonly text: string;
};

export type WebProjectReviewExport = {
  readonly version: 1;
  readonly sessionId: string;
  readonly projectId: string;
  readonly projectRevision: number;
  readonly title: string;
  readonly frontier: string;
  readonly acceptedArtifacts: readonly WebReviewArtifact[];
  readonly remoteContextItems: readonly WebRemoteContextItem[];
  readonly exportedAt: string;
  readonly unrestrictedProjectIncluded: false;
  readonly providerCredentialsIncluded: false;
  readonly localPathsIncluded: false;
};

export type WebComputeNodeView = {
  readonly nodeId: string;
  readonly relationship: "own" | "trusted" | "studio" | "public";
  readonly availability: "available" | "busy" | "offline";
  readonly capabilities: readonly ("text" | "image" | "video")[];
  readonly modelClasses: readonly string[];
  readonly workflowClasses: readonly string[];
  readonly memoryTier: "small" | "medium" | "large" | "xlarge";
  readonly currentLoadPercent: number;
  readonly protocolVersion: string;
  readonly cost: Readonly<Record<string, unknown>>;
  readonly requiresBillingConsent: boolean;
  readonly advertisementExpiresAt: string;
};

export type WebComputeDiscovery = {
  readonly version: 1;
  readonly yourNodes: readonly WebComputeNodeView[];
  readonly trustedNodes: readonly WebComputeNodeView[];
  readonly publicNodes: readonly WebComputeNodeView[];
};

export type WebRemoteBuildDispatch = {
  readonly version: 1;
  readonly dispatchId: string;
  readonly sessionId: string;
  readonly projectId: string;
  readonly projectRevision: number;
  readonly authoritativeProjectNodeId: string;
  readonly selectedNodeId: string;
  readonly selectedRelationship: "own" | "trusted" | "studio" | "public";
  readonly status: "dispatched";
  readonly savedToProject: false;
  readonly requestedAt: string;
  readonly workPackage: ScopedRemoteWorkPackage;
};

export type WebCandidateEnvelope = {
  readonly version: 1;
  readonly dispatchId: string;
  readonly projectId: string;
  readonly authoritativeProjectNodeId: string;
  readonly candidate: CandidateRemoteResult;
  readonly reviewStatus: "awaiting-user-review";
  readonly reconciliationStatus: "not-requested";
  readonly savedToProject: false;
};

export type WebPendingReconciliation = {
  readonly version: 1;
  readonly reconciliationId: string;
  readonly sessionId: string;
  readonly projectId: string;
  readonly authoritativeProjectNodeId: string;
  readonly candidate: CandidateRemoteResult;
  readonly reviewStatus: "accepted-for-project-reconciliation";
  readonly reconciliationStatus: "pending-authoritative-project";
  readonly savedToProject: false;
  readonly requestedAt: string;
};

export const createAuthenticatedWebSession = core.createAuthenticatedWebSession as (
  account: PlotPickleAccountSyncState,
  input: unknown,
) => WebAnywhereSession;

export const revokeWebSession = core.revokeWebSession as (
  session: WebAnywhereSession,
  revokedAt: string,
) => WebAnywhereSession;

export const assertWebSessionActive = core.assertWebSessionActive as (
  account: PlotPickleAccountSyncState,
  session: WebAnywhereSession,
  now?: string,
) => WebAnywhereSession;

export const assertFreshWebReauthentication = core.assertFreshWebReauthentication as (
  account: PlotPickleAccountSyncState,
  session: WebAnywhereSession,
  now?: string,
) => WebAnywhereSession;

export const projectWebIdentity = core.projectWebIdentity as (
  account: PlotPickleAccountSyncState,
  session: WebAnywhereSession,
  now?: string,
) => WebIdentityProjection;

export const projectWebLearnState = core.projectWebLearnState as (
  account: PlotPickleAccountSyncState,
  session: WebAnywhereSession,
  portableLearnState: PortableLearnState,
  now?: string,
) => WebLearnProjection;

export const projectWebCommunity = core.projectWebCommunity as (
  account: PlotPickleAccountSyncState,
  session: WebAnywhereSession,
  input: unknown,
  now?: string,
) => WebCommunityProjection;

export const createWebProjectReviewExport = core.createWebProjectReviewExport as (
  account: PlotPickleAccountSyncState,
  session: WebAnywhereSession,
  input: unknown,
  now?: string,
) => WebProjectReviewExport;

export const discoverWebComputeNodes = core.discoverWebComputeNodes as (
  account: PlotPickleAccountSyncState,
  session: WebAnywhereSession,
  directory: ComputeNodeDirectory,
  options?: unknown,
) => WebComputeDiscovery;

export const createWebRemoteBuildDispatch = core.createWebRemoteBuildDispatch as (
  account: PlotPickleAccountSyncState,
  session: WebAnywhereSession,
  directory: ComputeNodeDirectory,
  projectExport: WebProjectReviewExport,
  input: unknown,
) => WebRemoteBuildDispatch;

export const receiveWebRemoteCandidate = core.receiveWebRemoteCandidate as (
  account: PlotPickleAccountSyncState,
  session: WebAnywhereSession,
  dispatch: WebRemoteBuildDispatch,
  resultInput: unknown,
  now?: string,
) => WebCandidateEnvelope;

export const requestWebCandidateReconciliation = core.requestWebCandidateReconciliation as (
  account: PlotPickleAccountSyncState,
  session: WebAnywhereSession,
  candidateEnvelope: WebCandidateEnvelope,
  input: unknown,
) => WebPendingReconciliation;

export const applyAuthoritativeReconciliationReceipt = core.applyAuthoritativeReconciliationReceipt as (
  account: PlotPickleAccountSyncState,
  session: WebAnywhereSession,
  pending: WebPendingReconciliation,
  input: unknown,
) => WebPendingReconciliation & {
  readonly reconciliation: {
    readonly receiptId: string;
    readonly authoritativeProjectNodeId: string;
    readonly status: "applied" | "rejected";
    readonly projectRevision: number;
    readonly reconciledAt: string;
  };
  readonly reconciliationStatus: "applied-by-authoritative-project" | "rejected-by-authoritative-project";
  readonly savedToProject: boolean;
};

export const WEB_SESSION_ALLOWLIST = core.WEB_SESSION_ALLOWLIST as readonly string[];
export const WEB_COMMUNITY_ALLOWLIST = core.WEB_COMMUNITY_ALLOWLIST as readonly string[];
export const WEB_PROJECT_EXPORT_ALLOWLIST = core.WEB_PROJECT_EXPORT_ALLOWLIST as readonly string[];
export const WEB_REMOTE_DISPATCH_ALLOWLIST = core.WEB_REMOTE_DISPATCH_ALLOWLIST as readonly string[];
