import { normalizeContractId } from "../contracts/identity-contract-validation.mjs";

export const PEER_NODE_COMPUTE_ENABLED = false;
export const COMPUTE_RELATIONSHIPS = Object.freeze([]);
export const COMPUTE_SHARING_SCOPES = Object.freeze([]);
export const COMPUTE_CAPABILITIES = Object.freeze([]);
export const COMPUTE_AVAILABILITY = Object.freeze([]);

const RETIRED_MESSAGE = "Peer-to-peer PlotPickle Node compute is retired by #1135. Community Nodes provide identity/presence provenance only; use the managed cloud-service boundary for explicit remote compute.";

function retiredPeerCompute() {
  throw new Error(RETIRED_MESSAGE);
}

export function createComputeNodeDirectory(personId) {
  return Object.freeze({ version: 2, personId: normalizeContractId(personId, "Person id"), nodes: Object.freeze({}), peerComputeEnabled: false });
}

export const createComputeNodeAdvertisement = retiredPeerCompute;
export const advertiseOwnedComputeNode = retiredPeerCompute;
export const registerDiscoveredComputeNode = retiredPeerCompute;
export const disableComputeNode = retiredPeerCompute;
export function discoverComputeNodes() { return []; }
export const requireSelectedComputeNode = retiredPeerCompute;
export const createScopedRemoteWorkPackage = retiredPeerCompute;
export const assertRemoteWorkPackageUsable = retiredPeerCompute;
export const createCandidateRemoteResult = retiredPeerCompute;

export const REMOTE_COMPUTE_ADVERTISEMENT_ALLOWLIST = Object.freeze([]);
export const REMOTE_WORK_PACKAGE_ALLOWLIST = Object.freeze([]);
export const REMOTE_RESULT_ALLOWLIST = Object.freeze([]);
export const PEER_NODE_COMPUTE_RETIRED_MESSAGE = RETIRED_MESSAGE;
