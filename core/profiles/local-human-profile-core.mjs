import {
  assertAllowedContractFields,
  normalizeContractId,
  normalizeIsoDateTime,
} from "../node-boundary/identity-contract-validation.mjs";

const PROFILE_FIELDS = Object.freeze([
  "profileId", "personId", "displayName", "vaultRef", "buzzSignerRef", "settingsRef", "guest", "createdAt",
]);
const UNLOCK_FIELDS = Object.freeze(["method", "verified"]);
export const PROFILE_SWITCH_CLEANUP_FIELDS = Object.freeze([
  "projectClosed", "vaultReleased", "agentContextCleared", "retrievalContextCleared",
  "privateUiCleared", "buzzSessionDetached", "credentialsCleared", "priorSessionInvalidated",
]);

function optionalRef(value, label) {
  if (value === null || value === undefined || value === "") return null;
  return normalizeContractId(value, label);
}

export function createLocalHumanProfileRegistry(nodeId) {
  return { version: 1, nodeId: normalizeContractId(nodeId, "Node id"), profiles: {}, activeProfileId: null, sessionEpoch: 0 };
}

export function registerLocalHumanProfile(registry, input) {
  assertAllowedContractFields(input, PROFILE_FIELDS, "Local Human profile");
  const guest = input?.guest === true;
  const profileId = normalizeContractId(input?.profileId, "Local Human profile id");
  const personId = guest ? null : normalizeContractId(input?.personId, "Human person id");
  if (registry.profiles[profileId]) throw new Error("Local Human profile id is already registered on this Node.");
  if (personId && Object.values(registry.profiles).some((profile) => profile.personId === personId)) {
    throw new Error("A Human person identity may have only one local profile on a given Node.");
  }
  const displayName = String(input?.displayName || "").trim();
  if (!displayName || displayName.length > 120) throw new Error("Local Human profile display name must be 1-120 characters.");
  const profile = Object.freeze({
    profileId,
    personId,
    displayName,
    vaultRef: normalizeContractId(input?.vaultRef, "Human vault reference"),
    buzzSignerRef: guest ? null : optionalRef(input?.buzzSignerRef, "Human BUZZ signer reference"),
    settingsRef: optionalRef(input?.settingsRef, "Human settings reference"),
    guest,
    createdAt: normalizeIsoDateTime(input?.createdAt, "Human profile creation time"),
  });
  return { ...registry, profiles: { ...registry.profiles, [profileId]: profile } };
}

function verifiedUnlock(profile, input) {
  assertAllowedContractFields(input, UNLOCK_FIELDS, "Human profile unlock proof");
  if (input?.verified !== true) throw new Error("Human profile unlock must be verified before private workspace access.");
  const method = String(input?.method || "");
  const allowed = profile.guest ? ["guest"] : ["os", "pin", "passphrase"];
  if (!allowed.includes(method)) throw new Error(`Human profile unlock method must be one of: ${allowed.join(", ")}.`);
  return true;
}

function requireProfile(registry, profileId) {
  const id = normalizeContractId(profileId, "Local Human profile id");
  const profile = registry.profiles[id];
  if (!profile) throw new Error("Local Human profile is not registered on this Node.");
  return profile;
}

function verifyCleanup(input) {
  assertAllowedContractFields(input, PROFILE_SWITCH_CLEANUP_FIELDS, "Human profile switch cleanup receipt");
  for (const field of PROFILE_SWITCH_CLEANUP_FIELDS) {
    if (input?.[field] !== true) throw new Error(`Human profile switch requires cleanup evidence: ${field}.`);
  }
  return true;
}

export function activateLocalHumanProfile(registry, profileId, unlockProof) {
  if (registry.activeProfileId) throw new Error("An active Human profile must be locked or switched before another profile can activate.");
  const profile = requireProfile(registry, profileId);
  verifiedUnlock(profile, unlockProof);
  return { ...registry, activeProfileId: profile.profileId, sessionEpoch: registry.sessionEpoch + 1 };
}

export function switchLocalHumanProfile(registry, profileId, cleanupReceipt, unlockProof) {
  if (!registry.activeProfileId) return activateLocalHumanProfile(registry, profileId, unlockProof);
  const target = requireProfile(registry, profileId);
  if (target.profileId === registry.activeProfileId) return registry;
  verifyCleanup(cleanupReceipt);
  verifiedUnlock(target, unlockProof);
  return { ...registry, activeProfileId: target.profileId, sessionEpoch: registry.sessionEpoch + 1 };
}

export function lockActiveHumanProfile(registry, cleanupReceipt) {
  if (!registry.activeProfileId) return registry;
  verifyCleanup(cleanupReceipt);
  return { ...registry, activeProfileId: null, sessionEpoch: registry.sessionEpoch + 1 };
}

export const LOCAL_HUMAN_PROFILE_ALLOWLIST = PROFILE_FIELDS;
export const HUMAN_PROFILE_UNLOCK_ALLOWLIST = UNLOCK_FIELDS;
