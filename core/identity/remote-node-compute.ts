import * as core from "./remote-node-compute-core.mjs";

export type RetiredPeerComputeDirectory = {
  readonly version: 2;
  readonly personId: string;
  readonly nodes: Readonly<Record<string, never>>;
  readonly peerComputeEnabled: false;
};

export const PEER_NODE_COMPUTE_ENABLED = false as const;
export const createComputeNodeDirectory = core.createComputeNodeDirectory as (personId: string) => RetiredPeerComputeDirectory;
export const createComputeNodeAdvertisement = core.createComputeNodeAdvertisement as (...args: unknown[]) => never;
export const advertiseOwnedComputeNode = core.advertiseOwnedComputeNode as (...args: unknown[]) => never;
export const registerDiscoveredComputeNode = core.registerDiscoveredComputeNode as (...args: unknown[]) => never;
export const disableComputeNode = core.disableComputeNode as (...args: unknown[]) => never;
export const discoverComputeNodes = core.discoverComputeNodes as (...args: unknown[]) => readonly never[];
export const requireSelectedComputeNode = core.requireSelectedComputeNode as (...args: unknown[]) => never;
export const createScopedRemoteWorkPackage = core.createScopedRemoteWorkPackage as (...args: unknown[]) => never;
export const assertRemoteWorkPackageUsable = core.assertRemoteWorkPackageUsable as (...args: unknown[]) => never;
export const createCandidateRemoteResult = core.createCandidateRemoteResult as (...args: unknown[]) => never;
export const COMPUTE_RELATIONSHIPS = core.COMPUTE_RELATIONSHIPS as readonly never[];
export const COMPUTE_SHARING_SCOPES = core.COMPUTE_SHARING_SCOPES as readonly never[];
export const COMPUTE_CAPABILITIES = core.COMPUTE_CAPABILITIES as readonly never[];
export const COMPUTE_AVAILABILITY = core.COMPUTE_AVAILABILITY as readonly never[];
export const REMOTE_COMPUTE_ADVERTISEMENT_ALLOWLIST = core.REMOTE_COMPUTE_ADVERTISEMENT_ALLOWLIST as readonly never[];
export const REMOTE_WORK_PACKAGE_ALLOWLIST = core.REMOTE_WORK_PACKAGE_ALLOWLIST as readonly never[];
export const REMOTE_RESULT_ALLOWLIST = core.REMOTE_RESULT_ALLOWLIST as readonly never[];
export const PEER_NODE_COMPUTE_RETIRED_MESSAGE = core.PEER_NODE_COMPUTE_RETIRED_MESSAGE as string;
