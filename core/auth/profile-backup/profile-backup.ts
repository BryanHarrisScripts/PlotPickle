import * as core from "./profile-backup-core.mjs";
import type { AuthAccessMode, AuthContext, AuthStateStore, HumanProfile, PlotPickleAuthService } from "../plotpickle-auth";
import type { PasswordWrappedProfileKey, ProfileSecretEnvelope, RecoveryWrappedProfileKey } from "../profile-crypto-contract";

export type ProfileBackupEntry = Readonly<{
  ref: string;
  sha256: string;
  bytes: number;
  data: string;
}>;

export type ProfileBackupBundle = Readonly<{
  format: "plotpickle-human-backup";
  version: 1;
  header: Readonly<{
    profileId: string;
    backupId: string;
    createdAt: string;
  }>;
  credential: Readonly<{
    profileId: string;
    passwordEnvelope: PasswordWrappedProfileKey;
    recoveryEnvelope: RecoveryWrappedProfileKey;
  }>;
  manifestEnvelope: ProfileSecretEnvelope;
  entries: ReadonlyArray<ProfileBackupEntry>;
}>;

export type ProfileBackupVerification = Readonly<{
  profileId: string;
  displayName: string;
  createdAt: string;
  objectCount: number;
  includesNetworkIdentity: boolean;
}>;

export type ProfileBackupRestoreResult = Readonly<{
  profileId: string;
  displayName: string;
  includesNetworkIdentity: boolean;
  recoverySecret: string | null;
}>;

export const PROFILE_BACKUP_FORMAT = core.PROFILE_BACKUP_FORMAT as "plotpickle-human-backup";
export const PROFILE_BACKUP_VERSION = core.PROFILE_BACKUP_VERSION as 1;
export const PROFILE_BACKUP_MANIFEST_FORMAT = core.PROFILE_BACKUP_MANIFEST_FORMAT as "plotpickle-human-backup-manifest";

export const parseProfileBackupBundle = core.parseProfileBackupBundle as (value: unknown) => ProfileBackupBundle;
export const serializeProfileBackupBundle = core.serializeProfileBackupBundle as (value: ProfileBackupBundle) => string;
export const verifyProfileBackupBundle = core.verifyProfileBackupBundle as (
  value: unknown,
  secret: Readonly<{ password: string | Uint8Array } | { recoverySecret: string }>,
) => Promise<ProfileBackupVerification>;
export const createProfileBackupBundle = core.createProfileBackupBundle as (options: Readonly<{
  root: string;
  authService: Pick<PlotPickleAuthService, "requireRecentReauthentication" | "createProfileVaultCapability">;
  stateStore: AuthStateStore;
  authContext: AuthContext;
  includeNetworkIdentity?: boolean;
  now?: () => number | Date;
  randomBytes?: (bytes: number) => Uint8Array;
}>) => Promise<ProfileBackupBundle>;
export const writeProfileBackupFile = core.writeProfileBackupFile as (value: ProfileBackupBundle, destination: string) => Promise<string>;
export const readProfileBackupFile = core.readProfileBackupFile as (source: string) => Promise<ProfileBackupBundle>;
export const restoreProfileBackupToStateStore = core.restoreProfileBackupToStateStore as (options: Readonly<{
  root: string;
  stateStore: AuthStateStore;
  bundle: unknown;
  password?: string | Uint8Array;
  recoverySecret?: string;
  newPassword?: string | Uint8Array;
  bootstrapProof?: string;
  nodeId?: string;
  accessMode?: AuthAccessMode;
  now?: () => number | Date;
}>) => Promise<ProfileBackupRestoreResult>;

export type ProfileBackupManifestProfile = HumanProfile;
