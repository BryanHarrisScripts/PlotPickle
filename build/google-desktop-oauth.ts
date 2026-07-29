import { createHash, randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import {
  GOOGLE_CALENDAR_SCOPE,
  GOOGLE_IDENTITY_SCOPES,
  GOOGLE_MEET_SCOPE,
  type ConnectionPermission,
  type PublicConnectionStatus,
} from "../lib/connection-status";
import { resolveGoogleOAuthPublicConfig } from "./google-oauth-public-config";
import { readCredentialJson, removeCredentialFile, writeCredentialJson } from "./local-credentials";

const AUTHORIZATION_MAX_AGE_MS = 10 * 60 * 1000;
const GOOGLE_CONNECTION_FILE = "google-connection.json";
const LEGACY_GOOGLE_PENDING_FILE = "google-pending.json";
const LOOPBACK_CALLBACK_PATH = "/oauth2/callback";

export type GooglePermissionId = "calendar" | "meet";
export type GoogleAuthorizationState = "idle" | "pending" | "completed" | "failed" | "expired" | "cancelled";

export type GoogleAuthorizationStatus = {
  attemptId: string;
  state: GoogleAuthorizationState;
  message: string;
  createdAt: string;
  completedAt: string;
};

type GoogleConnectionV1 = {
  version: 1;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt: string;
  scopes: string[];
  account: { id: string; email: string; name: string };
  verifiedAt: string;
};

type GoogleConnection = {
  version: 2;
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresAt: string;
  scopes: string[];
  issuer: "https://accounts.google.com" | "accounts.google.com";
  audience: string;
  account: { id: string; email: string; name: string };
  verifiedAt: string;
};

type ActiveAuthorization = {
  attemptId: string;
  state: string;
  verifier: string;
  permissions: GooglePermissionId[];
  redirectUri: string;
  createdAt: string;
  expiresAt: string;
  consumed: boolean;
  server: Server;
  expiryTimer: NodeJS.Timeout;
};

let activeAuthorization: ActiveAuthorization | null = null;
let lastAuthorizationStatus: GoogleAuthorizationStatus = {
  attemptId: "",
  state: "idle",
  message: "No Google authorization is in progress.",
  createdAt: "",
  completedAt: "",
};

function base64Url(value: Buffer) {
  return value.toString("base64url");
}

function isLoopback(value: string | undefined) {
  return value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1";
}

function requestedPermissions(value: unknown): GooglePermissionId[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is GooglePermissionId => item === "calendar" || item === "meet"))];
}

function requestedScopes(permissions: GooglePermissionId[]) {
  return [
    ...GOOGLE_IDENTITY_SCOPES,
    ...(permissions.includes("calendar") ? [GOOGLE_CALENDAR_SCOPE] : []),
    ...(permissions.includes("meet") ? [GOOGLE_MEET_SCOPE] : []),
  ];
}

function normalizeScopes(scopes: string[]) {
  const normalized = scopes.map((scope) => {
    if (scope === "https://www.googleapis.com/auth/userinfo.email") return "email";
    if (scope === "https://www.googleapis.com/auth/userinfo.profile") return "profile";
    return scope;
  });
  return [...new Set(normalized)];
}

function permissionRows(scopes: string[]): ConnectionPermission[] {
  const configured = resolveGoogleOAuthPublicConfig().configured;
  return [
    {
      id: "calendar",
      label: "Google Calendar",
      state: scopes.includes(GOOGLE_CALENDAR_SCOPE) ? "granted" : configured ? "not-granted" : "unavailable",
      scope: GOOGLE_CALENDAR_SCOPE,
      explanation: "Create and manage events only on calendars owned by the signed-in account.",
    },
    {
      id: "meet",
      label: "Google Meet",
      state: scopes.includes(GOOGLE_MEET_SCOPE) ? "granted" : configured ? "not-granted" : "unavailable",
      scope: GOOGLE_MEET_SCOPE,
      explanation: "Create and read metadata only for meeting spaces created by PlotPickle.",
    },
  ];
}

function status(patch: Partial<Omit<PublicConnectionStatus, "id" | "label" | "optional">>): PublicConnectionStatus {
  return {
    id: "google",
    label: "Google and Connected Services",
    state: "disconnected",
    identity: "",
    detail: "Not connected. PlotPickle remains fully usable locally.",
    lastSuccessfulConnection: "",
    error: "",
    repairGuidance: "Open Settings to configure this optional connection.",
    dataShared: [],
    scopes: [],
    permissions: [],
    optional: true,
    ...patch,
  };
}

function validGoogleConnection(value: GoogleConnection | GoogleConnectionV1 | null): value is GoogleConnection {
  return Boolean(value && value.version === 2
    && typeof value.accessToken === "string" && value.accessToken.length > 0
    && typeof value.refreshToken === "string"
    && value.tokenType === "Bearer"
    && typeof value.expiresAt === "string"
    && Array.isArray(value.scopes)
    && (value.issuer === "https://accounts.google.com" || value.issuer === "accounts.google.com")
    && typeof value.audience === "string"
    && value.account && typeof value.account.id === "string"
    && typeof value.account.email === "string"
    && typeof value.verifiedAt === "string");
}

export function publicGoogleConnection(value: GoogleConnection | GoogleConnectionV1 | null): PublicConnectionStatus {
  const config = resolveGoogleOAuthPublicConfig();
  if (!config.configured) return status({
    state: "unavailable",
    identity: "Official Google connection not packaged",
    detail: "Google remains optional. This download was published before the official PlotPickle Google Desktop OAuth client was registered.",
    repairGuidance: "Install a later PlotPickle release after the official Google connection is registered, or use a documented development override.",
    dataShared: ["Nothing while Google is disconnected"],
    scopes: [...GOOGLE_IDENTITY_SCOPES],
    permissions: permissionRows([]),
  });
  if (value?.version === 1) return status({
    state: "error",
    identity: value.account?.email || "Earlier Google connection",
    detail: "This saved Google session predates desktop issuer validation and encrypted cross-platform storage.",
    error: "Reauthorization required",
    repairGuidance: "Disconnect the earlier session and sign in again through the system browser.",
    dataShared: ["No new data is shared until the account is reauthorized"],
    scopes: Array.isArray(value.scopes) ? value.scopes : [...GOOGLE_IDENTITY_SCOPES],
    permissions: permissionRows(Array.isArray(value.scopes) ? value.scopes : []),
  });
  if (!validGoogleConnection(value)) return status({
    identity: "No Google account",
    detail: "Google sign-in, Calendar and Meet are optional and disconnected.",
    repairGuidance: "Choose only the permissions you need, then review Google's consent screen in the system browser.",
    dataShared: ["Nothing until the writer grants permission"],
    scopes: [...GOOGLE_IDENTITY_SCOPES],
    permissions: permissionRows([]),
  });
  return status({
    state: "connected",
    identity: value.account.name ? `${value.account.name} · ${value.account.email}` : value.account.email,
    detail: "Google identity and approved permission state were verified for this desktop installation.",
    lastSuccessfulConnection: value.verifiedAt,
    repairGuidance: "Test the connection again, add permissions deliberately, or disconnect and revoke it.",
    dataShared: ["Account name and email", "Non-sensitive project meeting metadata only after an explicit action"],
    scopes: value.scopes,
    permissions: permissionRows(value.scopes),
  });
}

function sendCallbackPage(response: ServerResponse, ok: boolean, message: string) {
  const safeMessage = message.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] || character);
  response.statusCode = ok ? 200 : 400;
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
  response.end(`<!doctype html><html lang="en"><meta charset="utf-8"><title>PlotPickle Google connection</title><style>body{font:16px system-ui;max-width:42rem;margin:12vh auto;padding:2rem;color:#173f43;background:#eff9f7}main{padding:2rem;border:1px solid #bcd8d1;border-radius:18px;background:#fff}h1{font-size:1.4rem}</style><main><h1>${ok ? "Google connected" : "Google connection needs attention"}</h1><p>${safeMessage}</p><p>You can close this browser tab and return to PlotPickle.</p></main></html>`);
}

function updateAuthorizationStatus(attempt: ActiveAuthorization, state: GoogleAuthorizationState, message: string) {
  lastAuthorizationStatus = {
    attemptId: attempt.attemptId,
    state,
    message,
    createdAt: attempt.createdAt,
    completedAt: state === "pending" ? "" : new Date().toISOString(),
  };
}

async function closeAuthorization(attempt: ActiveAuthorization) {
  clearTimeout(attempt.expiryTimer);
  if (activeAuthorization?.attemptId === attempt.attemptId) activeAuthorization = null;
  if (!attempt.server.listening) return;
  await new Promise<void>((resolve) => attempt.server.close(() => resolve()));
}

function tokenResponse(value: Record<string, unknown>, requireIdToken: boolean) {
  const accessToken = typeof value.access_token === "string" ? value.access_token : "";
  const tokenType = typeof value.token_type === "string" ? value.token_type : "";
  const expiresIn = Number(value.expires_in);
  const idToken = typeof value.id_token === "string" ? value.id_token : "";
  if (!accessToken) throw new Error("Google did not return an access token.");
  if (tokenType.toLowerCase() !== "bearer") throw new Error("Google returned an unsupported token type.");
  if (!Number.isFinite(expiresIn) || expiresIn < 60 || expiresIn > 86_400) throw new Error("Google returned an invalid access-token lifetime.");
  if (requireIdToken && !idToken) throw new Error("Google did not return the identity token required for desktop verification.");
  return {
    accessToken,
    refreshToken: typeof value.refresh_token === "string" ? value.refresh_token : "",
    expiresIn,
    idToken,
    scopes: typeof value.scope === "string" ? normalizeScopes(value.scope.split(/\s+/).filter(Boolean)) : [],
  };
}

async function jsonFetch(url: URL | string, init: RequestInit, failureMessage: string) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  const text = await response.text();
  let value: Record<string, unknown> = {};
  try { value = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch { /* Safe fallback below. */ }
  if (!response.ok) throw new Error(typeof value.error_description === "string" ? value.error_description : failureMessage);
  return value;
}

async function exchangeCode(attempt: ActiveAuthorization, code: string) {
  const config = resolveGoogleOAuthPublicConfig();
  return jsonFetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      code,
      code_verifier: attempt.verifier,
      grant_type: "authorization_code",
      redirect_uri: attempt.redirectUri,
    }),
  }, "Google did not complete the desktop token exchange.");
}

async function refreshAccessToken(refreshToken: string) {
  const config = resolveGoogleOAuthPublicConfig();
  return jsonFetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  }, "Google did not refresh the access token.");
}

async function verifiedIdentity(idToken: string, accessToken: string) {
  const config = resolveGoogleOAuthPublicConfig();
  const tokenInfoUrl = new URL(config.tokenInfoUrl);
  tokenInfoUrl.searchParams.set("id_token", idToken);
  const tokenInfo = await jsonFetch(tokenInfoUrl, { method: "GET", headers: { Accept: "application/json" } }, "Google identity token validation failed.");
  const issuer = typeof tokenInfo.iss === "string" ? tokenInfo.iss : "";
  const audience = typeof tokenInfo.aud === "string" ? tokenInfo.aud : "";
  const subject = typeof tokenInfo.sub === "string" ? tokenInfo.sub : "";
  const email = typeof tokenInfo.email === "string" ? tokenInfo.email : "";
  const expiresAt = Number(tokenInfo.exp);
  const emailVerified = tokenInfo.email_verified === true || tokenInfo.email_verified === "true";
  if (issuer !== "https://accounts.google.com" && issuer !== "accounts.google.com") throw new Error("Google returned an unexpected identity issuer.");
  if (audience !== config.clientId) throw new Error("Google returned an identity token for a different desktop client.");
  if (!Number.isFinite(expiresAt) || expiresAt * 1000 <= Date.now()) throw new Error("Google returned an expired identity token.");
  if (!subject || !email || !emailVerified) throw new Error("Google account identity could not be verified.");

  const userInfo = await jsonFetch(config.userInfoUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  }, "Google account identity could not be verified.");
  const userSubject = typeof userInfo.sub === "string" ? userInfo.sub : "";
  const userEmail = typeof userInfo.email === "string" ? userInfo.email : "";
  if (userSubject !== subject || userEmail.toLowerCase() !== email.toLowerCase()) throw new Error("Google account identity did not match the issued token.");
  return {
    issuer: issuer as GoogleConnection["issuer"],
    audience,
    account: {
      id: subject,
      email,
      name: typeof userInfo.name === "string" ? userInfo.name : typeof tokenInfo.name === "string" ? tokenInfo.name : "",
    },
  };
}

async function verifyUserInfo(connection: GoogleConnection, accessToken: string) {
  const config = resolveGoogleOAuthPublicConfig();
  const userInfo = await jsonFetch(config.userInfoUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  }, "Google account identity could not be verified.");
  const subject = typeof userInfo.sub === "string" ? userInfo.sub : "";
  const email = typeof userInfo.email === "string" ? userInfo.email : "";
  if (subject !== connection.account.id || email.toLowerCase() !== connection.account.email.toLowerCase()) throw new Error("The refreshed Google account did not match the connected identity.");
  return { ...connection.account, name: typeof userInfo.name === "string" ? userInfo.name : connection.account.name };
}

async function completeAuthorization(attempt: ActiveAuthorization, callbackUrl: URL) {
  if (Date.now() > Date.parse(attempt.expiresAt)) throw new Error("The Google sign-in request expired. Start again from Settings.");
  if (callbackUrl.searchParams.get("state") !== attempt.state) throw new Error("Google returned an invalid authorization state.");
  const providerError = callbackUrl.searchParams.get("error");
  if (providerError) throw new Error(providerError === "access_denied" ? "Google permission was declined. Local PlotPickle work is unchanged." : "Google did not authorize the requested connection.");
  const code = callbackUrl.searchParams.get("code");
  if (!code) throw new Error("Google did not return an authorization code.");
  const issued = tokenResponse(await exchangeCode(attempt, code), true);
  const identity = await verifiedIdentity(issued.idToken, issued.accessToken);
  const previous = await readCredentialJson<GoogleConnection | GoogleConnectionV1>(GOOGLE_CONNECTION_FILE);
  const previousRefresh = validGoogleConnection(previous)
    && previous.account.id === identity.account.id
    && previous.audience === identity.audience
    ? previous.refreshToken
    : "";
  const refreshToken = issued.refreshToken || previousRefresh;
  if (!refreshToken) throw new Error("Google did not return a refresh token. Revoke earlier access for PlotPickle, then sign in again.");
  const scopes = issued.scopes.length ? issued.scopes : requestedScopes(attempt.permissions);
  for (const required of GOOGLE_IDENTITY_SCOPES) if (!scopes.includes(required)) throw new Error(`Google did not grant the required ${required} identity scope.`);
  const saved: GoogleConnection = {
    version: 2,
    accessToken: issued.accessToken,
    refreshToken,
    tokenType: "Bearer",
    expiresAt: new Date(Date.now() + issued.expiresIn * 1000).toISOString(),
    scopes,
    issuer: identity.issuer,
    audience: identity.audience,
    account: identity.account,
    verifiedAt: new Date().toISOString(),
  };
  await writeCredentialJson(GOOGLE_CONNECTION_FILE, saved);
  await removeCredentialFile(LEGACY_GOOGLE_PENDING_FILE);
  return saved;
}

async function handleLoopbackCallback(request: IncomingMessage, response: ServerResponse, attempt: ActiveAuthorization) {
  const address = attempt.server.address() as AddressInfo | null;
  const expectedHost = address ? `127.0.0.1:${address.port}` : "";
  if (request.method !== "GET" || !isLoopback(request.socket.remoteAddress) || request.headers.host !== expectedHost) {
    response.statusCode = 403;
    response.end("Local callback rejected.");
    return;
  }
  const callbackUrl = new URL(request.url || "/", `http://${expectedHost}`);
  if (callbackUrl.pathname !== LOOPBACK_CALLBACK_PATH) {
    response.statusCode = 404;
    response.end("Callback not found.");
    return;
  }
  if (attempt.consumed) {
    response.statusCode = 409;
    response.end("This authorization callback was already used.");
    return;
  }
  if (callbackUrl.searchParams.get("state") !== attempt.state) {
    sendCallbackPage(response, false, "Google returned an invalid authorization state. Return to PlotPickle and start again.");
    return;
  }
  attempt.consumed = true;
  try {
    const connected = await completeAuthorization(attempt, callbackUrl);
    updateAuthorizationStatus(attempt, "completed", `Connected ${connected.account.email || "the selected Google account"}.`);
    sendCallbackPage(response, true, lastAuthorizationStatus.message);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google sign-in could not be completed.";
    updateAuthorizationStatus(attempt, "failed", message);
    sendCallbackPage(response, false, message);
  } finally {
    await closeAuthorization(attempt);
  }
}

export async function startGoogleAuthorization(value: unknown) {
  const config = resolveGoogleOAuthPublicConfig();
  if (!config.configured) throw new Error("The official Google Desktop OAuth client is not configured for this PlotPickle release.");
  if (activeAuthorization && Date.now() <= Date.parse(activeAuthorization.expiresAt)) throw new Error("A Google sign-in is already in progress. Finish or cancel it before starting another.");
  if (activeAuthorization) await closeAuthorization(activeAuthorization);
  const permissions = requestedPermissions((value as { permissions?: unknown } | null)?.permissions);
  const verifier = base64Url(randomBytes(64));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  const attemptId = base64Url(randomBytes(18));
  const state = base64Url(randomBytes(32));
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + AUTHORIZATION_MAX_AGE_MS).toISOString();
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0, exclusive: true }, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address() as AddressInfo | null;
  if (!address || typeof address.port !== "number") {
    server.close();
    throw new Error("PlotPickle could not reserve a local Google OAuth callback port.");
  }
  const redirectUri = `http://127.0.0.1:${address.port}${LOOPBACK_CALLBACK_PATH}`;
  const placeholder = setTimeout(() => {}, AUTHORIZATION_MAX_AGE_MS);
  const attempt: ActiveAuthorization = {
    attemptId,
    state,
    verifier,
    permissions,
    redirectUri,
    createdAt,
    expiresAt,
    consumed: false,
    server,
    expiryTimer: placeholder,
  };
  clearTimeout(placeholder);
  attempt.expiryTimer = setTimeout(() => {
    if (activeAuthorization?.attemptId !== attempt.attemptId) return;
    updateAuthorizationStatus(attempt, "expired", "The Google sign-in request expired. Start again from Settings.");
    void closeAuthorization(attempt);
  }, AUTHORIZATION_MAX_AGE_MS);
  server.on("request", (request, response) => { void handleLoopbackCallback(request, response, attempt); });
  activeAuthorization = attempt;
  updateAuthorizationStatus(attempt, "pending", "Waiting for Google authorization in the system browser.");

  const authorization = new URL(config.authorizationUrl);
  authorization.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: requestedScopes(permissions).join(" "),
    access_type: "offline",
    include_granted_scopes: "false",
    prompt: "consent",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return {
    ok: true,
    authorizationUrl: authorization.toString(),
    attemptId,
    expiresAt,
    permissions,
    scopes: requestedScopes(permissions),
  };
}

export function googleAuthorizationStatus(attemptId: string) {
  if (!attemptId || lastAuthorizationStatus.attemptId !== attemptId) return {
    attemptId,
    state: "idle" as const,
    message: "No matching Google authorization attempt was found.",
    createdAt: "",
    completedAt: "",
  };
  return lastAuthorizationStatus;
}

export async function cancelGoogleAuthorization(attemptId: string) {
  if (!activeAuthorization || activeAuthorization.attemptId !== attemptId) return googleAuthorizationStatus(attemptId);
  const attempt = activeAuthorization;
  updateAuthorizationStatus(attempt, "cancelled", "Google sign-in was cancelled. Local PlotPickle work is unchanged.");
  await closeAuthorization(attempt);
  return lastAuthorizationStatus;
}

export async function readPublicGoogleConnection() {
  const saved = await readCredentialJson<GoogleConnection | GoogleConnectionV1>(GOOGLE_CONNECTION_FILE);
  return publicGoogleConnection(saved);
}

export async function checkGoogleConnection() {
  const saved = await readCredentialJson<GoogleConnection | GoogleConnectionV1>(GOOGLE_CONNECTION_FILE);
  if (!validGoogleConnection(saved)) throw new Error(saved?.version === 1 ? "Reconnect Google to upgrade this earlier session." : "No saved Google connection was found.");
  const config = resolveGoogleOAuthPublicConfig();
  if (saved.audience !== config.clientId) throw new Error("The saved Google session belongs to a different PlotPickle Desktop OAuth client. Reconnect it.");
  let current = saved;
  if (Date.parse(saved.expiresAt) <= Date.now() + 60_000) {
    if (!saved.refreshToken) throw new Error("The Google session expired. Disconnect it locally and sign in again.");
    const refreshed = tokenResponse(await refreshAccessToken(saved.refreshToken), false);
    current = {
      ...saved,
      accessToken: refreshed.accessToken,
      expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
      scopes: refreshed.scopes.length ? refreshed.scopes : saved.scopes,
    };
  }
  const account = await verifyUserInfo(current, current.accessToken);
  const verified: GoogleConnection = { ...current, account, verifiedAt: new Date().toISOString() };
  await writeCredentialJson(GOOGLE_CONNECTION_FILE, verified);
  return verified;
}

export async function revokeGoogleConnection() {
  if (activeAuthorization) {
    const attempt = activeAuthorization;
    updateAuthorizationStatus(attempt, "cancelled", "Google sign-in was cancelled because the connection was removed.");
    await closeAuthorization(attempt);
  }
  const saved = await readCredentialJson<GoogleConnection | GoogleConnectionV1>(GOOGLE_CONNECTION_FILE);
  let remoteRevoked = false;
  const token = saved && typeof saved === "object" ? saved.refreshToken || saved.accessToken : "";
  if (token) {
    try {
      const config = resolveGoogleOAuthPublicConfig();
      const response = await fetch(config.revokeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
        signal: AbortSignal.timeout(20_000),
      });
      remoteRevoked = response.ok;
    } catch { /* Local removal still protects this installation and cannot block local work. */ }
  }
  await Promise.all([removeCredentialFile(GOOGLE_CONNECTION_FILE), removeCredentialFile(LEGACY_GOOGLE_PENDING_FILE)]);
  return remoteRevoked;
}

export async function shutdownGoogleAuthorization() {
  if (!activeAuthorization) return;
  const attempt = activeAuthorization;
  updateAuthorizationStatus(attempt, "cancelled", "Google sign-in stopped because PlotPickle closed.");
  await closeAuthorization(attempt);
}
