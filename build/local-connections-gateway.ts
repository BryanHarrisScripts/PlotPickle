import { createHash, randomBytes } from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import {
  GOOGLE_CALENDAR_SCOPE,
  GOOGLE_IDENTITY_SCOPES,
  GOOGLE_MEET_SCOPE,
  type ConnectionPermission,
  type PublicConnectionStatus,
} from "../lib/connection-status";
import {
  credentialInventory,
  defaultCredentialProtection,
  eraseAllCredentials,
  openCredentialsDirectory,
  persistentHome,
  readCredentialJson,
  removeCredentialFile,
  writeCredentialJson,
} from "./local-credentials";

const CONNECTIONS_API = "/api/local-connections";
const CREDENTIALS_API = `${CONNECTIONS_API}/credentials`;
const GOOGLE_API = "/api/local-google/connection";
const GOOGLE_CALLBACK = "/api/local-google/callback";
const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const AUTHORIZATION_MAX_AGE_MS = 10 * 60 * 1000;

type GooglePermissionId = "calendar" | "meet";

type PendingGoogleAuthorization = {
  version: 1;
  state: string;
  verifier: string;
  permissions: GooglePermissionId[];
  redirectUri: string;
  createdAt: string;
};

type GoogleConnection = {
  version: 1;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt: string;
  scopes: string[];
  account: {
    id: string;
    email: string;
    name: string;
  };
  verifiedAt: string;
};

type AiConnection = {
  version: 1;
  provider: string;
  baseUrl: string;
  textModel: string;
  imageModel: string;
  verifiedAt: string;
};

type GitHubConnection = {
  version: 1;
  owner: string;
  repo: string;
  branch: string;
  projectPath: string;
  verifiedAt: string;
  readiness?: {
    ready: boolean;
    checks: Array<{ id: string; label: string; ready: boolean; detail: string }>;
  };
};

function googleConnectionFile() { return "google-connection.json"; }
function googlePendingFile() { return "google-pending.json"; }
function aiConnectionFile() { return "ai-connection.json"; }
function githubConnectionFile() { return "github-connection.json"; }
function projectsDirectory() { return path.join(persistentHome(), "projects"); }
function backupsDirectory() { return path.join(persistentHome(), "backups"); }

function googleClientId() { return process.env.PLOTPICKLE_GOOGLE_CLIENT_ID?.trim() || ""; }
function googleClientSecret() { return process.env.PLOTPICKLE_GOOGLE_CLIENT_SECRET?.trim() || ""; }

function isLoopback(value: string | undefined) {
  return value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1";
}

function isLocalRequest(request: IncomingMessage) {
  if (!isLoopback(request.socket.remoteAddress)) return false;
  const host = request.headers.host;
  if (!host) return false;
  try {
    const hostUrl = new URL(`http://${host}`);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(hostUrl.hostname)) return false;
    const origin = request.headers.origin;
    return !origin || new URL(origin).host === hostUrl.host;
  } catch {
    return false;
  }
}

function sendJson(response: ServerResponse, statusCode: number, body: Record<string, unknown>) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
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
  response.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'");
  response.end(`<!doctype html><html lang="en"><meta charset="utf-8"><title>PlotPickle Google connection</title><style>body{font:16px system-ui;max-width:42rem;margin:12vh auto;padding:2rem;color:#173f43;background:#eff9f7}main{padding:2rem;border:1px solid #bcd8d1;border-radius:18px;background:#fff}h1{font-size:1.4rem}</style><main><h1>${ok ? "Google connected" : "Google connection needs attention"}</h1><p>${safeMessage}</p><p>You can close this window and return to PlotPickle.</p></main><script>window.opener?.postMessage({type:"plotpickle-google-oauth",ok:${ok ? "true" : "false"}},location.origin);window.setTimeout(()=>window.close(),900);</script></html>`);
}

async function readBody(request: IncomingMessage, maximum = 32 * 1024): Promise<unknown> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += value.length;
    if (length > maximum) throw new Error("The local connection request is too large.");
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function base64Url(value: Buffer) {
  return value.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
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

function permissionRows(scopes: string[]): ConnectionPermission[] {
  return [
    {
      id: "calendar",
      label: "Google Calendar",
      state: scopes.includes(GOOGLE_CALENDAR_SCOPE) ? "granted" : googleClientId() ? "not-granted" : "unavailable",
      scope: GOOGLE_CALENDAR_SCOPE,
      explanation: "Create and manage events only on calendars owned by the signed-in account.",
    },
    {
      id: "meet",
      label: "Google Meet",
      state: scopes.includes(GOOGLE_MEET_SCOPE) ? "granted" : googleClientId() ? "not-granted" : "unavailable",
      scope: GOOGLE_MEET_SCOPE,
      explanation: "Create and read metadata only for meeting spaces created by PlotPickle.",
    },
  ];
}

function status(
  id: PublicConnectionStatus["id"],
  label: string,
  patch: Partial<Omit<PublicConnectionStatus, "id" | "label" | "optional">>,
): PublicConnectionStatus {
  return {
    id,
    label,
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

function validGoogleConnection(value: GoogleConnection | null): value is GoogleConnection {
  return Boolean(value && value.version === 1
    && typeof value.accessToken === "string"
    && typeof value.refreshToken === "string"
    && Array.isArray(value.scopes)
    && value.account && typeof value.account.email === "string"
    && typeof value.verifiedAt === "string");
}

function publicGoogleConnection(value: GoogleConnection | null): PublicConnectionStatus {
  if (!googleClientId()) return status("google", "Google and Connected Services", {
    state: "unavailable",
    identity: "OAuth client not configured",
    detail: "Google remains optional. This installation needs a Google OAuth client ID before sign-in can begin.",
    repairGuidance: "Set PLOTPICKLE_GOOGLE_CLIENT_ID for the local server and register this server's loopback callback URI in Google Cloud.",
    dataShared: ["Nothing while Google is disconnected"],
    scopes: [...GOOGLE_IDENTITY_SCOPES],
    permissions: permissionRows([]),
  });
  if (!validGoogleConnection(value)) return status("google", "Google and Connected Services", {
    identity: "No Google account",
    detail: "Google sign-in, Calendar and Meet are optional and disconnected.",
    repairGuidance: "Choose Calendar, Meet or both, then review Google's consent screen.",
    dataShared: ["Nothing until the writer grants permission"],
    scopes: [...GOOGLE_IDENTITY_SCOPES],
    permissions: permissionRows([]),
  });
  return status("google", "Google and Connected Services", {
    state: "connected",
    identity: value.account.name ? `${value.account.name} · ${value.account.email}` : value.account.email,
    detail: "Google identity and approved permission state are available to PlotPickle.",
    lastSuccessfulConnection: value.verifiedAt,
    repairGuidance: "Test the connection again or revoke it and sign in with the intended account.",
    dataShared: ["Account name and email", "Non-sensitive meeting title, time and link only when explicitly saved"],
    scopes: value.scopes,
    permissions: permissionRows(value.scopes),
  });
}

async function countFiles(directory: string, extension: string) {
  try {
    return (await readdir(directory, { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name.endsWith(extension)).length;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
}

async function aggregateStatus() {
  const [ai, github, google, projectCount, backupCount] = await Promise.all([
    readCredentialJson<AiConnection>(aiConnectionFile()),
    readCredentialJson<GitHubConnection>(githubConnectionFile()),
    readCredentialJson<GoogleConnection>(googleConnectionFile()),
    countFiles(projectsDirectory(), ".ppf"),
    countFiles(backupsDirectory(), ".ppf"),
  ]);
  const aiStatus = ai?.version === 1 && ai.provider ? status("ai", "AI providers", {
    state: "connected",
    identity: ai.provider,
    detail: `${ai.textModel || "Text model"} is configured through the private local gateway.`,
    lastSuccessfulConnection: ai.verifiedAt,
    repairGuidance: "Test the saved provider again or remove and replace its local credential.",
    dataShared: ["Only context explicitly selected for an AI request"],
    scopes: ["Text generation", ...(ai.imageModel ? ["Image generation"] : [])],
  }) : status("ai", "AI providers", {
    identity: "No saved provider credential",
    dataShared: ["Nothing until an AI request is explicitly prepared and submitted"],
  });
  const githubReady = Boolean(github?.readiness?.ready);
  const githubStatus = github?.version === 1 && github.owner && github.repo ? status("github", "GitHub", {
    state: githubReady ? "connected" : "configured",
    identity: `${github.owner}/${github.repo}`,
    detail: `${github.branch || "main"} · ${github.projectPath || "No .ppf path"}`,
    lastSuccessfulConnection: github.verifiedAt,
    repairGuidance: githubReady
      ? "Use Test and update whenever the repository, token or permissions change."
      : "Open GitHub Settings and run Test and update before pulling or proposing changes.",
    dataShared: ["Selected .ppf content", "repository proposal metadata", "branch and project path"],
    scopes: ["Repository contents", "Pull requests"],
  }) : status("github", "GitHub", {
    identity: "No repository credential",
    dataShared: ["Nothing until the writer connects a repository and confirms an action"],
  });
  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    github: githubStatus,
    ai: aiStatus,
    google: publicGoogleConnection(google),
    storage: status("storage", "Storage", {
      state: "connected",
      identity: "This computer account",
      detail: `${projectCount} local .ppf project${projectCount === 1 ? "" : "s"} available.`,
      repairGuidance: "Open Storage and backups to save or review local projects.",
      dataShared: ["Project files remain under the current computer account"],
    }),
    backups: status("backups", "Backups", {
      state: backupCount ? "connected" : "configured",
      identity: "Local rolling backups",
      detail: `${backupCount} backup${backupCount === 1 ? "" : "s"} available.`,
      repairGuidance: "Save a local project to create or refresh rolling backups.",
      dataShared: ["Backup files remain under the current computer account"],
    }),
  };
}

function redirectUri(request: IncomingMessage) {
  const host = request.headers.host;
  if (!host) throw new Error("The local callback address is unavailable.");
  const parsed = new URL(`http://${host}`);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)) throw new Error("Google OAuth requires PlotPickle's local loopback address.");
  return `${parsed.origin}${GOOGLE_CALLBACK}`;
}

async function startGoogleAuthorization(request: IncomingMessage) {
  const clientId = googleClientId();
  if (!clientId) throw new Error("Google OAuth is not configured for this PlotPickle installation.");
  const input = await readBody(request) as { permissions?: unknown };
  const permissions = requestedPermissions(input.permissions);
  const verifier = base64Url(randomBytes(48));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  const pending: PendingGoogleAuthorization = {
    version: 1,
    state: base64Url(randomBytes(24)),
    verifier,
    permissions,
    redirectUri: redirectUri(request),
    createdAt: new Date().toISOString(),
  };
  await writeCredentialJson(googlePendingFile(), pending);
  const authorization = new URL(GOOGLE_AUTHORIZE_URL);
  authorization.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: pending.redirectUri,
    response_type: "code",
    scope: requestedScopes(permissions).join(" "),
    access_type: "offline",
    include_granted_scopes: "false",
    prompt: "consent",
    state: pending.state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return { ok: true, authorizationUrl: authorization.toString(), permissions, scopes: requestedScopes(permissions) };
}

async function tokenRequest(parameters: Record<string, string>) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(parameters),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let value: Record<string, unknown> = {};
  try { value = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch { /* Use the safe fallback below. */ }
  if (!response.ok) throw new Error(typeof value.error_description === "string" ? value.error_description : "Google did not complete the token exchange.");
  return value;
}

async function userInfo(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let value: Record<string, unknown> = {};
  try { value = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch { /* Use the safe fallback below. */ }
  if (!response.ok) throw new Error("Google account identity could not be verified.");
  return {
    id: typeof value.sub === "string" ? value.sub : "",
    email: typeof value.email === "string" ? value.email : "",
    name: typeof value.name === "string" ? value.name : "",
  };
}

async function completeGoogleAuthorization(url: URL) {
  const pending = await readCredentialJson<PendingGoogleAuthorization>(googlePendingFile());
  if (!pending || pending.version !== 1) throw new Error("The Google sign-in request expired. Start again from Settings.");
  if (Date.now() - Date.parse(pending.createdAt) > AUTHORIZATION_MAX_AGE_MS) throw new Error("The Google sign-in request expired. Start again from Settings.");
  if (url.searchParams.get("state") !== pending.state) throw new Error("Google returned an invalid authorization state.");
  const providerError = url.searchParams.get("error");
  if (providerError) throw new Error(providerError === "access_denied" ? "Google permission was declined. Local PlotPickle work is unchanged." : "Google did not authorize the requested connection.");
  const code = url.searchParams.get("code");
  if (!code) throw new Error("Google did not return an authorization code.");
  const secret = googleClientSecret();
  const token = await tokenRequest({
    client_id: googleClientId(),
    ...(secret ? { client_secret: secret } : {}),
    code,
    code_verifier: pending.verifier,
    grant_type: "authorization_code",
    redirect_uri: pending.redirectUri,
  });
  const accessToken = typeof token.access_token === "string" ? token.access_token : "";
  if (!accessToken) throw new Error("Google did not return an access token.");
  const previous = await readCredentialJson<GoogleConnection>(googleConnectionFile());
  const refreshToken = typeof token.refresh_token === "string" ? token.refresh_token : previous?.refreshToken || "";
  const expiresIn = Number(token.expires_in) || 3600;
  const account = await userInfo(accessToken);
  const scopes = typeof token.scope === "string" ? token.scope.split(/\s+/).filter(Boolean) : requestedScopes(pending.permissions);
  const saved: GoogleConnection = {
    version: 1,
    accessToken,
    refreshToken,
    tokenType: typeof token.token_type === "string" ? token.token_type : "Bearer",
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    scopes,
    account,
    verifiedAt: new Date().toISOString(),
  };
  await writeCredentialJson(googleConnectionFile(), saved);
  await removeCredentialFile(googlePendingFile());
  return saved;
}

async function liveGoogleConnection() {
  const saved = await readCredentialJson<GoogleConnection>(googleConnectionFile());
  if (!validGoogleConnection(saved)) throw new Error("No saved Google connection was found.");
  let current = saved;
  if (Date.parse(saved.expiresAt) <= Date.now() + 60_000) {
    if (!saved.refreshToken) throw new Error("The Google session expired. Revoke it locally and sign in again.");
    const secret = googleClientSecret();
    const token = await tokenRequest({
      client_id: googleClientId(),
      ...(secret ? { client_secret: secret } : {}),
      refresh_token: saved.refreshToken,
      grant_type: "refresh_token",
    });
    const accessToken = typeof token.access_token === "string" ? token.access_token : "";
    if (!accessToken) throw new Error("Google did not refresh the access token.");
    current = {
      ...saved,
      accessToken,
      expiresAt: new Date(Date.now() + (Number(token.expires_in) || 3600) * 1000).toISOString(),
      scopes: typeof token.scope === "string" ? token.scope.split(/\s+/).filter(Boolean) : saved.scopes,
    };
  }
  const account = await userInfo(current.accessToken);
  const verified = { ...current, account, verifiedAt: new Date().toISOString() };
  await writeCredentialJson(googleConnectionFile(), verified);
  return verified;
}

async function revokeGoogleConnection() {
  const saved = await readCredentialJson<GoogleConnection>(googleConnectionFile());
  let remoteRevoked = false;
  if (saved?.accessToken || saved?.refreshToken) {
    try {
      const response = await fetch(GOOGLE_REVOKE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: saved.refreshToken || saved.accessToken }),
        signal: AbortSignal.timeout(20_000),
      });
      remoteRevoked = response.ok;
    } catch { /* Local removal still protects this installation and cannot block local work. */ }
  }
  await Promise.all([removeCredentialFile(googleConnectionFile()), removeCredentialFile(googlePendingFile())]);
  return remoteRevoked;
}

async function publicCredentialState() {
  const inventory = await credentialInventory();
  const defaultProtection = defaultCredentialProtection();
  const protectedCount = inventory.files.filter((file) => file.protection === "windows-dpapi-current-user").length;
  return {
    ok: true,
    path: inventory.path,
    files: inventory.files,
    count: inventory.files.length,
    defaultProtection,
    protectedCount,
    protectionLabel: defaultProtection === "windows-dpapi-current-user"
      ? "New and updated credentials are encrypted for the current Windows user with DPAPI."
      : "Credential files are restricted to the current computer account with owner-only file permissions.",
  };
}

async function handle(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (request.method === "GET" && url.pathname === CONNECTIONS_API) {
    sendJson(response, 200, await aggregateStatus());
    return;
  }
  if (request.method === "GET" && url.pathname === CREDENTIALS_API) {
    sendJson(response, 200, await publicCredentialState());
    return;
  }
  if (request.method === "POST" && url.pathname === `${CREDENTIALS_API}/open`) {
    const directory = await openCredentialsDirectory();
    sendJson(response, 200, { ok: true, path: directory, message: "The private credentials folder was opened." });
    return;
  }
  if (request.method === "DELETE" && url.pathname === CREDENTIALS_API) {
    const before = await credentialInventory();
    let googleRemoteRevoked = false;
    try { googleRemoteRevoked = await revokeGoogleConnection(); } catch { /* Local deletion must still complete. */ }
    await eraseAllCredentials();
    sendJson(response, 200, {
      ok: true,
      removed: before.files.length,
      googleRemoteRevoked,
      message: `Removed ${before.files.length} local credential file${before.files.length === 1 ? "" : "s"}. Projects, assets and backups were kept.`,
    });
    return;
  }
  if (request.method === "GET" && url.pathname === GOOGLE_API) {
    sendJson(response, 200, { ok: true, ...(publicGoogleConnection(await readCredentialJson<GoogleConnection>(googleConnectionFile()))) });
    return;
  }
  if (request.method === "POST" && url.pathname === `${GOOGLE_API}/start`) {
    sendJson(response, 200, await startGoogleAuthorization(request));
    return;
  }
  if (request.method === "POST" && url.pathname === `${GOOGLE_API}/check`) {
    sendJson(response, 200, { ok: true, ...(publicGoogleConnection(await liveGoogleConnection())) });
    return;
  }
  if (request.method === "DELETE" && url.pathname === GOOGLE_API) {
    const remoteRevoked = await revokeGoogleConnection();
    sendJson(response, 200, {
      ok: true,
      remoteRevoked,
      message: remoteRevoked
        ? "Google access was revoked and local tokens were removed."
        : "Local Google tokens were removed. If Google was unreachable, also review access in your Google Account.",
    });
    return;
  }
  if (request.method === "GET" && url.pathname === GOOGLE_CALLBACK) {
    try {
      const connected = await completeGoogleAuthorization(url);
      sendCallbackPage(response, true, `Connected ${connected.account.email || "the selected Google account"}.`);
    } catch (error) {
      await removeCredentialFile(googlePendingFile());
      sendCallbackPage(response, false, error instanceof Error ? error.message : "Google sign-in could not be completed.");
    }
    return;
  }
  sendJson(response, 404, { ok: false, message: "Local connection operation not found." });
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "The local connection operation failed.";
  return message
    .replace(/ya29\.[A-Za-z0-9._-]+/g, "[redacted]")
    .replace(/1\/\/[A-Za-z0-9._-]+/g, "[redacted]")
    .slice(0, 500);
}

export function localConnectionsGateway(): Plugin {
  return {
    name: "plotpickle-local-connections-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const rawUrl = request.url;
        if (!rawUrl) { next(); return; }
        const url = new URL(rawUrl, "http://127.0.0.1");
        if (!url.pathname.startsWith(CONNECTIONS_API) && !url.pathname.startsWith(GOOGLE_API) && url.pathname !== GOOGLE_CALLBACK) {
          next();
          return;
        }
        if (!isLocalRequest(request)) {
          sendJson(response, 403, { ok: false, message: "Connection setup accepts requests only from this local PlotPickle server." });
          return;
        }
        void handle(request, response, url).catch((error) => {
          sendJson(response, 400, { ok: false, message: safeError(error) });
        });
      });
    },
  };
}
