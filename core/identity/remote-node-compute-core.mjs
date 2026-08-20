const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{1,127}$/i;

export const PEER_NODE_COMPUTE_ENABLED = false;
export const COMPUTE_RELATIONSHIPS = Object.freeze([]);
export const COMPUTE_SHARING_SCOPES = Object.freeze([]);
export const COMPUTE_CAPABILITIES = Object.freeze([]);
export const COMPUTE_AVAILABILITY = Object.freeze([]);

const RETIRED_MESSAGE = "Peer-to-peer PlotPickle Node compute is retired by #1135. Community Nodes provide identity/presence provenance only; use the managed cloud-service boundary for explicit remote compute.";

function stableId(value, label) {
  const text = String(value || "").trim();
  if (!ID_PATTERN.test(text)) throw new Error(`${label} must be a stable 2-128 character identifier.`);
  return text;
}

function retiredPeerCompute() {
  throw new Error(RETIRED_MESSAGE);
}

export function createComputeNodeDirectory(personId) {
  return Object.freeze({ version: 2, personId: stableId(personId, "Person id"), nodes: Object.freeze({}), peerComputeEnabled: false });
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
