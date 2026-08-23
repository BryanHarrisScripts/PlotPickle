import * as core from "./plotpickle-auth-core.mjs";
import type { Argon2idParameters, PasswordWrappedProfileKey, ProfileSecretEnvelope, RecoveryWrappedProfileKey } from "./profile-crypto-contract";

export type AuthAccessMode = "desktop-loopback" | "server-network";
export type ProfileStatus = "active" | "disabled";
export type ProfileAuthMethod = "password" | "recovery" | "webauthn";
export type AuthStrength = "password" | "password+webauthn" | "recovery";
export type ProfileVaultState = "uninitialized" | "locked" | "unlocking" | "unlocked" | "locking" | "recovery-required" | "corrupt";
export type ProfileVaultKdfMaintenance = "current" | "upgrade-pending" | "upgraded" | "upgrade-deferred" | "not-applicable";

export type HumanProfile = {
  readonly profileId: string;
  readonly displayName: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly status: ProfileStatus;
  readonly vaultVersion: number;
  readonly authMethods: ReadonlyArray<ProfileAuthMethod>;
  readonly avatarRef: string | null;
};

export type ProfileSummary = Pick<HumanProfile, "profileId" | "displayName" | "avatarRef" | "status">;

export type AuthContext = {
  readonly sessionId: string;
  readonly profileId: string;
  readonly nodeId: string;
  readonly authStrength: AuthStrength;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly roles: ReadonlyArray<string>;
};

export type AuthPersistentState = {
  readonly format: "plotpickle-auth-state";
  readonly version: 1;
  readonly accessMode: AuthAccessMode;
  readonly registry: {
    readonly version: 1;
    readonly nodeId: string;
    readonly profiles: Readonly<Record<string, HumanProfile>>;
  };
  readonly credentials: Readonly<Record<string, {
    readonly profileId: string;
    readonly passwordEnvelope: PasswordWrappedProfileKey;
    readonly recoveryEnvelope: RecoveryWrappedProfileKey;
  }>>;
  readonly bootstrap: null | {
    readonly version: 1;
    readonly proofDigest: string | null;
    readonly createdAt: string;
    readonly expiresAt: string;
    readonly consumedAt: string | null;
  };
};

export type AuthStateStore = {
  read(): Promise<AuthPersistentState | null>;
  write(value: AuthPersistentState): Promise<void>;
};

export type ProfileCreation = {
  readonly profile: HumanProfile;
  readonly recoverySecret: string;
  readonly authContext: AuthContext;
};

export type ProfileVaultStatus = {
  readonly profileId: string | null;
  readonly state: ProfileVaultState;
  readonly vaultVersion: number | null;
  readonly kdfMaintenance: ProfileVaultKdfMaintenance;
};

export type ProfileVaultCleanupEvent = {
  readonly profileId: string;
  readonly reason: "lock" | "lock-profile" | "session-expired" | "session-revoked" | "other-sessions-revoked" | "profile-unavailable" | "profile-disabled" | "password-change" | "recovery-reset" | "service-close";
  readonly invalidatedSessionCount: number;
  readonly occurredAt: string;
};

export type ProfileVaultCapability = {
  readonly profileId: string;
  wrapSecret(input: { readonly secretId: string; readonly secret: string | Uint8Array }): Promise<ProfileSecretEnvelope>;
  unwrapSecret(input: { readonly envelope: ProfileSecretEnvelope; readonly secretId: string }): Promise<Uint8Array>;
};

export type BrowserSessionSummary = {
  readonly sessionRef: string;
  readonly current: boolean;
  readonly issuedAt: string;
  readonly lastSeenAt: string;
  readonly idleExpiresAt: string;
  readonly absoluteExpiresAt: string;
  readonly authStrength: AuthStrength;
  readonly deviceLabel: string;
  readonly originLabel: string;
};

export type PlotPickleAuthService = {
  readonly accessMode: AuthAccessMode;
  readonly nodeId: string;
  createServerBootstrapProof(): Promise<{ readonly proof: string; readonly expiresAt: string }>;
  createFirstProfile(input: { displayName: string; password: string | Uint8Array; avatarRef?: string | null }, bootstrapProof?: string): Promise<ProfileCreation>;
  createProfile(input: { displayName: string; password: string | Uint8Array; avatarRef?: string | null }, authContext: AuthContext): Promise<ProfileCreation>;
  authenticate(input: { profileId: string; password: string | Uint8Array }): Promise<{ readonly profile: ProfileSummary; readonly authContext: AuthContext; readonly vaultMaintenance: ProfileVaultKdfMaintenance }>;
  changePassword(input: { currentPassword: string | Uint8Array; newPassword: string | Uint8Array }, authContext: AuthContext): Promise<{ readonly profile: ProfileSummary; readonly authContext: AuthContext }>;
  resetPasswordWithRecovery(input: { profileId: string; recoverySecret: string; newPassword: string | Uint8Array }): Promise<{ readonly profile: ProfileSummary; readonly recoverySecret: string; readonly authContext: AuthContext }>;
  getVaultStatus(profileId?: string | null, authContext?: AuthContext | null): ProfileVaultStatus;
  createProfileVaultCapability(authContext: AuthContext): ProfileVaultCapability;
  resolveSession(sessionId: string, settings?: { readonly touch?: boolean }): AuthContext;
  createBrowserSession(authContext: AuthContext, presentation?: { readonly deviceLabel?: string; readonly originLabel?: string }): Readonly<{
    cookieValue: string;
    csrfToken: string;
    idleExpiresAt: string;
    absoluteExpiresAt: string;
  }>;
  validateCsrfToken(authContext: AuthContext, candidateToken: string): boolean;
  requireRecentReauthentication(authContext: AuthContext, maximumAgeMs?: number): AuthContext;
  listSessions(authContext: AuthContext): ReadonlyArray<BrowserSessionSummary>;
  revokeSession(sessionRef: string, authContext: AuthContext): boolean;
  revokeOtherSessions(authContext: AuthContext): number;
  registerVaultCleanupHook(hook: (event: ProfileVaultCleanupEvent) => void): () => boolean;
  listProfileSummaries(authContext?: AuthContext | null): ReadonlyArray<ProfileSummary>;
  getAuthStatus(authContext?: AuthContext | null): Readonly<Record<string, unknown>>;
  updateProfilePresentation(input: { profileId: string; displayName: string; avatarRef: string | null }, authContext: AuthContext): Promise<HumanProfile>;
  disableProfile(profileId: string, authContext: AuthContext): Promise<ProfileSummary>;
  lock(authContext: AuthContext): boolean;
  lockProfile(profileId: string, authContext: AuthContext): boolean;
  readRegistrySnapshot(authContext?: AuthContext | null): AuthPersistentState["registry"] | null;
  close(): void;
};

export const AUTH_STATE_FORMAT = "plotpickle-auth-state" as const;
export const AUTH_STATE_VERSION = 1 as const;
export const AUTH_ACCESS_MODES = core.AUTH_ACCESS_MODES as ReadonlyArray<AuthAccessMode>;
export const PROFILE_STATUSES = core.PROFILE_STATUSES as ReadonlyArray<ProfileStatus>;
export const PROFILE_AUTH_METHODS = core.PROFILE_AUTH_METHODS as ReadonlyArray<ProfileAuthMethod>;
export const AUTH_STRENGTHS = core.AUTH_STRENGTHS as ReadonlyArray<AuthStrength>;
export const PROFILE_VAULT_STATES = core.PROFILE_VAULT_STATES as ReadonlyArray<ProfileVaultState>;
export const PROFILE_VAULT_KDF_MAINTENANCE = core.PROFILE_VAULT_KDF_MAINTENANCE as ReadonlyArray<ProfileVaultKdfMaintenance>;
export const DEFAULT_SESSION_TTL_MS = core.DEFAULT_SESSION_TTL_MS as number;
export const DEFAULT_SESSION_IDLE_TTL_MS = core.DEFAULT_SESSION_IDLE_TTL_MS as number;
export const DEFAULT_RECENT_REAUTHENTICATION_MS = core.DEFAULT_RECENT_REAUTHENTICATION_MS as number;
export const DEFAULT_BOOTSTRAP_TTL_MS = core.DEFAULT_BOOTSTRAP_TTL_MS as number;
export const PlotPickleAuthError = core.PlotPickleAuthError;
export const parseAuthPersistentState = core.parseAuthPersistentState as (value: unknown, expected?: { nodeId?: string; accessMode?: AuthAccessMode }) => AuthPersistentState;
export const createInMemoryAuthStateStore = core.createInMemoryAuthStateStore as (initialState?: AuthPersistentState | null) => AuthStateStore;
export const createJsonFileAuthStateStore = core.createJsonFileAuthStateStore as (filePath: string) => AuthStateStore;
export const toPublicAuthError = core.toPublicAuthError as (error: unknown) => Readonly<{ code: string; message: string }>;
export const createPlotPickleAuthService = core.createPlotPickleAuthService as unknown as (options: {
  nodeId: string;
  accessMode: AuthAccessMode;
  stateStore: AuthStateStore;
  now?: () => number | Date;
  randomBytes?: (bytes: number) => Uint8Array;
  sessionTtlMs?: number;
  sessionIdleTtlMs?: number;
  recentReauthenticationMs?: number;
  bootstrapTtlMs?: number;
  passwordParameters?: Argon2idParameters;
}) => Promise<PlotPickleAuthService>;
