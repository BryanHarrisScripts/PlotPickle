import type { PlotPickleAccountSyncState } from "./account-learn-sync";
import * as core from "./remote-node-compute-core.mjs";

export type ComputeRelationship = "own" | "trusted" | "studio" | "public";
export type ComputeSharingScope = "private" | "trusted" | "studio" | "public";
export type ComputeCapability = "text" | "image" | "video";
export type ComputeAvailability = "available" | "busy" | "offline";

export type ComputeCost =
  | { readonly kind: "free" }
  | { readonly kind: "paid"; readonly currency: string; readonly amountMinor: number; readonly unit: "job" };

export type ComputeNodeAdvertisement = {
  readonly version: 1;
  readonly nodeId: string;
  readonly ownerPersonId: string;
  readonly sharingEnabled: true;
  readonly sharingScope: ComputeSharingScope;
  readonly availability: ComputeAvailability;
  readonly capabilities: readonly ComputeCapability[];
  readonly modelClasses: readonly string[];
  readonly workflowClasses: readonly string[];
  readonly memoryTier: "small" | "medium" | "large" | "xlarge";
  readonly currentLoadPercent: number;
  readonly protocolVersion: string;
  readonly cost: ComputeCost;
  readonly advertisedAt: string;
  readonly expiresAt: string;
};

export type ComputeDirectoryEntry = {
  readonly relationship: ComputeRelationship;
  readonly userApproved: boolean;
  readonly verifiedAt: string;
  readonly advertisement: ComputeNodeAdvertisement;
};

export type ComputeNodeDirectory = {
  readonly version: 1;
  readonly personId: string;
  readonly nodes: Readonly<Record<string, ComputeDirectoryEntry>>;
};

export type ScopedRemoteWorkPackage = {
  readonly version: 1;
  readonly jobId: string;
  readonly requesterPersonId: string;
  readonly requesterNodeId: string;
  readonly targetNodeId: string;
  readonly capability: ComputeCapability;
  readonly contextItems: readonly { readonly contextId: string; readonly kind: string; readonly text: string }[];
  readonly referenceAssets: readonly {
    readonly assetId: string;
    readonly contentHashSha256: string;
    readonly mediaType: string;
    readonly byteLength: number;
  }[];
  readonly modelClass: string | null;
  readonly workflowClass: string | null;
  readonly constraints: { readonly maxRuntimeSeconds: number; readonly maxOutputBytes: number };
  readonly grant: {
    readonly grantId: string;
    readonly issuedAt: string;
    readonly expiresAt: string;
    readonly targetNodeId: string;
    readonly capability: ComputeCapability;
    readonly maxUses: 1;
  };
  readonly returnRouteId: string;
  readonly billingConsentId: string | null;
  readonly requestedAt: string;
};

export type CandidateRemoteResult = {
  readonly version: 1;
  readonly resultId: string;
  readonly jobId: string;
  readonly candidateStatus: "candidate";
  readonly canonStatus: "not-canon";
  readonly accepted: false;
  readonly artifact: {
    readonly artifactId: string;
    readonly contentHashSha256: string;
    readonly mediaType: string;
    readonly byteLength: number;
    readonly remoteArtifactRef: string;
  };
  readonly provenance: {
    readonly nodeId: string;
    readonly signedReceiptId: string;
    readonly completedAt: string;
    readonly providerClass: string | null;
    readonly modelClass: string | null;
    readonly workflowClass: string | null;
  };
};

export const createComputeNodeDirectory = core.createComputeNodeDirectory as (personId: string) => ComputeNodeDirectory;
export const createComputeNodeAdvertisement = core.createComputeNodeAdvertisement as (input: unknown) => ComputeNodeAdvertisement;
export const advertiseOwnedComputeNode = core.advertiseOwnedComputeNode as (
  account: PlotPickleAccountSyncState,
  directory: ComputeNodeDirectory,
  nodeId: string,
  input: unknown,
) => ComputeNodeDirectory;
export const registerDiscoveredComputeNode = core.registerDiscoveredComputeNode as (
  directory: ComputeNodeDirectory,
  input: unknown,
) => ComputeNodeDirectory;
export const disableComputeNode = core.disableComputeNode as (directory: ComputeNodeDirectory, nodeId: string) => ComputeNodeDirectory;
export const discoverComputeNodes = core.discoverComputeNodes as (
  account: PlotPickleAccountSyncState,
  directory: ComputeNodeDirectory,
  options?: unknown,
) => readonly ComputeDirectoryEntry[];
export const requireSelectedComputeNode = core.requireSelectedComputeNode as (
  account: PlotPickleAccountSyncState,
  directory: ComputeNodeDirectory,
  nodeId: string,
  options?: unknown,
) => ComputeDirectoryEntry;
export const createScopedRemoteWorkPackage = core.createScopedRemoteWorkPackage as (
  account: PlotPickleAccountSyncState,
  selectedEntry: ComputeDirectoryEntry,
  input: unknown,
) => ScopedRemoteWorkPackage;
export const assertRemoteWorkPackageUsable = core.assertRemoteWorkPackageUsable as (
  workPackage: ScopedRemoteWorkPackage,
  nodeId: string,
  now?: string,
) => ScopedRemoteWorkPackage;
export const createCandidateRemoteResult = core.createCandidateRemoteResult as (
  workPackage: ScopedRemoteWorkPackage,
  input: unknown,
) => CandidateRemoteResult;

export const COMPUTE_RELATIONSHIPS = core.COMPUTE_RELATIONSHIPS as readonly ComputeRelationship[];
export const COMPUTE_SHARING_SCOPES = core.COMPUTE_SHARING_SCOPES as readonly ComputeSharingScope[];
export const COMPUTE_CAPABILITIES = core.COMPUTE_CAPABILITIES as readonly ComputeCapability[];
export const COMPUTE_AVAILABILITY = core.COMPUTE_AVAILABILITY as readonly ComputeAvailability[];
export const REMOTE_COMPUTE_ADVERTISEMENT_ALLOWLIST = core.REMOTE_COMPUTE_ADVERTISEMENT_ALLOWLIST as readonly string[];
export const REMOTE_WORK_PACKAGE_ALLOWLIST = core.REMOTE_WORK_PACKAGE_ALLOWLIST as readonly string[];
export const REMOTE_RESULT_ALLOWLIST = core.REMOTE_RESULT_ALLOWLIST as readonly string[];
