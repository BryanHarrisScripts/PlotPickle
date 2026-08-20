import * as core from "./local-human-profile-core.mjs";

export type LocalHumanProfile = {
  readonly profileId: string;
  readonly personId: string | null;
  readonly displayName: string;
  readonly vaultRef: string;
  readonly buzzSignerRef: string | null;
  readonly settingsRef: string | null;
  readonly guest: boolean;
  readonly createdAt: string;
};

export type LocalHumanProfileRegistry = {
  readonly version: 1;
  readonly nodeId: string;
  readonly profiles: Readonly<Record<string, LocalHumanProfile>>;
  readonly activeProfileId: string | null;
  readonly sessionEpoch: number;
};

export type HumanProfileUnlockProof = { readonly method: "os" | "pin" | "passphrase" | "guest"; readonly verified: true };
export type HumanProfileSwitchCleanupReceipt = {
  readonly projectClosed: true;
  readonly vaultReleased: true;
  readonly agentContextCleared: true;
  readonly retrievalContextCleared: true;
  readonly privateUiCleared: true;
  readonly buzzSessionDetached: true;
  readonly credentialsCleared: true;
  readonly priorSessionInvalidated: true;
};

export const createLocalHumanProfileRegistry = core.createLocalHumanProfileRegistry as (nodeId: string) => LocalHumanProfileRegistry;
export const registerLocalHumanProfile = core.registerLocalHumanProfile as (registry: LocalHumanProfileRegistry, input: unknown) => LocalHumanProfileRegistry;
export const activateLocalHumanProfile = core.activateLocalHumanProfile as (registry: LocalHumanProfileRegistry, profileId: string, unlockProof: HumanProfileUnlockProof) => LocalHumanProfileRegistry;
export const switchLocalHumanProfile = core.switchLocalHumanProfile as (registry: LocalHumanProfileRegistry, profileId: string, cleanupReceipt: HumanProfileSwitchCleanupReceipt, unlockProof: HumanProfileUnlockProof) => LocalHumanProfileRegistry;
export const lockActiveHumanProfile = core.lockActiveHumanProfile as (registry: LocalHumanProfileRegistry, cleanupReceipt: HumanProfileSwitchCleanupReceipt) => LocalHumanProfileRegistry;
export const PROFILE_SWITCH_CLEANUP_FIELDS = core.PROFILE_SWITCH_CLEANUP_FIELDS as readonly string[];
export const LOCAL_HUMAN_PROFILE_ALLOWLIST = core.LOCAL_HUMAN_PROFILE_ALLOWLIST as readonly string[];
export const HUMAN_PROFILE_UNLOCK_ALLOWLIST = core.HUMAN_PROFILE_UNLOCK_ALLOWLIST as readonly string[];
