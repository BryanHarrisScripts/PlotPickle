import * as core from "./server-session-boundary-core.mjs";
import type { AuthAccessMode, AuthContext, BrowserSessionSummary, PlotPickleAuthService, ProfileSummary, ProfileVaultKdfMaintenance } from "../plotpickle-auth";

export type ServerTlsMode = "direct" | "trusted-proxy";

export type ServerExposureInput = {
  readonly accessMode: AuthAccessMode;
  readonly bindHost?: string;
  readonly externalOrigin?: string;
  readonly allowedOrigins?: ReadonlyArray<string>;
  readonly allowedHosts?: ReadonlyArray<string>;
  readonly serverNetworkEnabled?: boolean;
  readonly tlsMode?: ServerTlsMode;
  readonly trustedProxyAddresses?: ReadonlyArray<string>;
  readonly bootstrapComplete?: boolean;
  readonly enableHsts?: boolean;
};

export type ServerExposurePolicy = {
  readonly version: 1;
  readonly accessMode: AuthAccessMode;
  readonly bindHost: string;
  readonly primaryOrigin: string;
  readonly allowedOrigins: ReadonlyArray<string>;
  readonly allowedHosts: ReadonlyArray<string>;
  readonly cookieName: "__Host-ppsid" | "ppsid";
  readonly secureCookies: boolean;
  readonly tlsMode: ServerTlsMode | "loopback-http" | null;
  readonly trustedProxyAddresses: ReadonlyArray<string>;
  readonly enableHsts: boolean;
  readonly ready: boolean;
  readonly reasons: ReadonlyArray<string>;
};

export type SessionRequest = {
  readonly method?: string;
  readonly url?: string;
  readonly headers?: Headers | Readonly<Record<string, string | ReadonlyArray<string> | undefined>>;
  readonly remoteAddress?: string;
  readonly secure?: boolean;
  readonly socketEncrypted?: boolean;
  readonly socket?: { readonly remoteAddress?: string; readonly encrypted?: boolean };
};

export type AuthorizationRequirements = {
  readonly mutation?: boolean;
  readonly profileId?: string;
  readonly projectId?: string;
  readonly profileSecretProfileId?: string;
  readonly nodeAdministrator?: boolean;
  readonly recentReauthentication?: boolean;
};

export type BrowserSessionResult = {
  readonly profile: ProfileSummary;
  readonly vaultMaintenance?: ProfileVaultKdfMaintenance;
  readonly recoverySecret?: string;
  readonly csrfToken: string;
  readonly idleExpiresAt: string;
  readonly absoluteExpiresAt: string;
  readonly headers: Readonly<Record<string, string>>;
};

export type ServerSessionBoundary = {
  readonly policy: ServerExposurePolicy;
  readiness(): Readonly<{ ready: boolean; accessMode: AuthAccessMode; bindHost: string; reasons: ReadonlyArray<string> }>;
  browserSecurityHeaders(): Readonly<Record<string, string>>;
  loginWithPassword(input: { profileId: string; password: string | Uint8Array }, request: SessionRequest): Promise<BrowserSessionResult>;
  resetPasswordWithRecovery(input: { profileId: string; recoverySecret: string; newPassword: string | Uint8Array }, request: SessionRequest): Promise<BrowserSessionResult>;
  createFirstProfile(input: { displayName: string; password: string | Uint8Array; avatarRef?: string | null }, bootstrapProof: string | undefined, request: SessionRequest): Promise<BrowserSessionResult>;
  authorizeRequest(request: SessionRequest, requirements?: AuthorizationRequirements): Promise<{ readonly authContext: AuthContext; readonly boundary: Readonly<Record<string, unknown>> }>;
  authorizePrivateStream(request: SessionRequest, requirements?: AuthorizationRequirements): Promise<{ readonly authContext: AuthContext; readonly boundary: Readonly<Record<string, unknown>> }>;
  logout(request: SessionRequest): Promise<{ readonly headers: Readonly<Record<string, string>> }>;
  listSessions(request: SessionRequest): Promise<ReadonlyArray<BrowserSessionSummary>>;
  revokeSession(request: SessionRequest, sessionRef: string): Promise<boolean>;
  revokeOtherSessions(request: SessionRequest): Promise<number>;
  throttleMetadata(): Readonly<{ activeBuckets: number; valuesLogged: false }>;
};

export const SERVER_SESSION_VERSION = core.SERVER_SESSION_VERSION as 1;
export const NETWORK_SESSION_COOKIE = core.NETWORK_SESSION_COOKIE as "__Host-ppsid";
export const LOOPBACK_SESSION_COOKIE = core.LOOPBACK_SESSION_COOKIE as "ppsid";
export const SAFE_HTTP_METHODS = core.SAFE_HTTP_METHODS as ReadonlyArray<string>;
export const DEFAULT_LOGIN_THROTTLE = core.DEFAULT_LOGIN_THROTTLE as Readonly<Record<string, number>>;
export const PlotPickleServerSessionError = core.PlotPickleServerSessionError;
export const createServerExposurePolicy = core.createServerExposurePolicy as (input: ServerExposureInput) => ServerExposurePolicy;
export const createAuthenticationThrottle = core.createAuthenticationThrottle as (options?: Readonly<Record<string, unknown>>) => Readonly<Record<string, unknown>>;
export const createAuthorizationGuards = core.createAuthorizationGuards as (options: {
  authService: PlotPickleAuthService;
  projectAccess?: (input: { authContext: AuthContext; projectId: string }) => boolean | Promise<boolean>;
}) => Readonly<Record<string, unknown>>;
export const toPublicServerSessionError = core.toPublicServerSessionError as (error: unknown) => Readonly<{ code: string; message: string; retryAfterMs?: number }>;
export const createServerSessionBoundary = core.createServerSessionBoundary as unknown as (options: {
  authService: PlotPickleAuthService;
  exposure: ServerExposureInput;
  now?: () => number;
  throttle?: Readonly<Record<string, unknown>>;
  projectAccess?: (input: { authContext: AuthContext; projectId: string }) => boolean | Promise<boolean>;
}) => ServerSessionBoundary;
