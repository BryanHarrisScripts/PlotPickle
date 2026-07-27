import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import {
  readCredentialJson,
  removeCredentialFile,
  writeCredentialJson,
} from "./local-credentials";

const API = "/api/local-github-app";
const DEVICE_CODE_URL = "https://github.com/login/device/code";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_API = "https://api.github.com";
const AUTHORIZATION_FILE = "github-app-authorization.json";
const PENDING_FILE = "github-app-pending.json";
const CONNECTION_FILE = "github-connection.json";
const MAX_BODY = 64 * 1024;

export type GitHubAppAccount = {
  id: number;
  login: string;
  name: string;
  avatarUrl: string;
};

export type GitHubAppAuthorization = {
  version: 1;
  authMode: "github-app";
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt: string;
  refreshTokenExpiresAt: string;
  account: GitHubAppAccount;
  verifiedAt: string;
};

type PendingDeviceAuthorization = {
  version: 1;
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresAt: string;
  intervalSeconds: number;
  lastPolledAt: string;
};

type SelectedGitHubConnection = {
  version: 1;
  owner: string;
  repo: string;
  branch: string;
  projectPath: string;
  token: string;
  login?: string;
  verifiedAt: string;
  readiness?: { ready: boolean; checks?: unknown[] };
  authMode?: "github-app" | "fine-grained-token";
  tokenExpiresAt?: string;
};

type RepositoryChoice = {
  id: number;
  installationId: number;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  permissions: { pull: boolean; push: boolean; admin: boolean };
};

type GitHubError = Error & { status?: number; body?: unknown };

function clientId() { return process.env.PLOTPICKLE_GITHUB_APP_CLIENT_ID?.trim() || ""; }
function appSlug() { return process.env.PLOTPICKLE_GITHUB_APP_SLUG?.trim() || ""; }
function installUrl() {
  const explicit = process.env.PLOTPICKLE_GITHUB_APP_INSTALL_URL?.trim();
  if (explicit) return explicit;
  const slug = appSlug();
  return slug ? `https://github.com/apps/${slug}/installations/new` : "";
}

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

async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.length;
    if (length > MAX_BODY) throw new Error("The GitHub connection request is too large.");
    chunks.push(bytes);
  }
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("The GitHub connection request is invalid.");
  return parsed as Record<string, unknown>;
}

async function postForm(url: string, parameters: Record<string, string>) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "PlotPickle-Local",
    },
    body: new URLSearchParams(parameters),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try { body = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch { /* Use safe fallback. */ }
  if (!response.ok) {
    const error = new Error(typeof body.error_description === "string" ? body.error_description : `GitHub returned ${response.status}.`) as GitHubError;
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function githubRequest(accessToken: string, endpoint: string) {
  const response = await fetch(`${GITHUB_API}${endpoint}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "PlotPickle-Local",
    },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let body: unknown = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
  if (!response.ok) {
    const message = body && typeof body === "object" && typeof (body as { message?: unknown }).message === "string"
      ? String((body as { message: string }).message)
      : `GitHub returned ${response.status}.`;
    const error = new Error(message) as GitHubError;
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

function validAuthorization(value: GitHubAppAuthorization | null): value is GitHubAppAuthorization {
  return Boolean(value && value.version === 1 && value.authMode === "github-app"
    && typeof value.accessToken === "string" && typeof value.refreshToken === "string"
    && typeof value.expiresAt === "string" && value.account && typeof value.account.login === "string");
}

async function fetchAccount(accessToken: string): Promise<GitHubAppAccount> {
  const value = await githubRequest(accessToken, "/user");
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const login = typeof record.login === "string" ? record.login : "";
  if (!login) throw new Error("GitHub did not return the signed-in account identity.");
  return {
    id: Number(record.id) || 0,
    login,
    name: typeof record.name === "string" ? record.name : "",
    avatarUrl: typeof record.avatar_url === "string" ? record.avatar_url : "",
  };
}

async function syncSelectedConnectionToken(authorization: GitHubAppAuthorization) {
  const connection = await readCredentialJson<SelectedGitHubConnection>(CONNECTION_FILE);
  if (!connection || connection.authMode !== "github-app") return;
  await writeCredentialJson(CONNECTION_FILE, {
    ...connection,
    token: authorization.accessToken,
    login: authorization.account.login,
    tokenExpiresAt: authorization.expiresAt,
  });
}

async function refreshAuthorization(saved: GitHubAppAuthorization) {
  if (Date.parse(saved.expiresAt) > Date.now() + 60_000) return saved;
  if (!saved.refreshToken || Date.parse(saved.refreshTokenExpiresAt) <= Date.now()) {
    throw new Error("The GitHub session expired. Connect the GitHub account again.");
  }
  const id = clientId();
  if (!id) throw new Error("The PlotPickle GitHub App client ID is not configured.");
  const token = await postForm(TOKEN_URL, {
    client_id: id,
    grant_type: "refresh_token",
    refresh_token: saved.refreshToken,
  });
  const accessToken = typeof token.access_token === "string" ? token.access_token : "";
  if (!accessToken) throw new Error("GitHub did not refresh the user access token.");
  const refreshed: GitHubAppAuthorization = {
    ...saved,
    accessToken,
    refreshToken: typeof token.refresh_token === "string" ? token.refresh_token : saved.refreshToken,
    tokenType: typeof token.token_type === "string" ? token.token_type : saved.tokenType || "bearer",
    expiresAt: new Date(Date.now() + (Number(token.expires_in) || 28_800) * 1000).toISOString(),
    refreshTokenExpiresAt: new Date(Date.now() + (Number(token.refresh_token_expires_in) || 15_897_600) * 1000).toISOString(),
    verifiedAt: new Date().toISOString(),
  };
  refreshed.account = await fetchAccount(refreshed.accessToken);
  await writeCredentialJson(AUTHORIZATION_FILE, refreshed);
  await syncSelectedConnectionToken(refreshed);
  return refreshed;
}

async function liveAuthorization() {
  const saved = await readCredentialJson<GitHubAppAuthorization>(AUTHORIZATION_FILE);
  if (!validAuthorization(saved)) throw new Error("No GitHub App account is connected.");
  return refreshAuthorization(saved);
}

function publicAuthorization(value: GitHubAppAuthorization | null) {
  return {
    configured: Boolean(clientId()),
    authenticated: validAuthorization(value),
    authMode: validAuthorization(value) ? "github-app" : "none",
    identity: validAuthorization(value) ? value.account : null,
    expiresAt: validAuthorization(value) ? value.expiresAt : "",
    installUrl: installUrl(),
    permissions: ["Metadata: Read", "Contents: Read and write", "Pull requests: Read and write"],
  };
}

async function startAuthorization() {
  const id = clientId();
  if (!id) throw new Error("Set PLOTPICKLE_GITHUB_APP_CLIENT_ID before using GitHub App sign-in.");
  const body = await postForm(DEVICE_CODE_URL, { client_id: id });
  const deviceCode = typeof body.device_code === "string" ? body.device_code : "";
  const userCode = typeof body.user_code === "string" ? body.user_code : "";
  const verificationUri = typeof body.verification_uri === "string" ? body.verification_uri : "https://github.com/login/device";
  const expiresIn = Number(body.expires_in) || 900;
  const intervalSeconds = Math.max(5, Number(body.interval) || 5);
  if (!deviceCode || !userCode) throw new Error("GitHub did not return a device authorization code.");
  const pending: PendingDeviceAuthorization = {
    version: 1,
    deviceCode,
    userCode,
    verificationUri,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    intervalSeconds,
    lastPolledAt: "",
  };
  await writeCredentialJson(PENDING_FILE, pending);
  return {
    ok: true,
    state: "waiting",
    userCode,
    verificationUri,
    expiresAt: pending.expiresAt,
    intervalSeconds,
  };
}

async function pollAuthorization() {
  const pending = await readCredentialJson<PendingDeviceAuthorization>(PENDING_FILE);
  if (!pending || pending.version !== 1) throw new Error("The GitHub sign-in request expired. Start again.");
  if (Date.parse(pending.expiresAt) <= Date.now()) {
    await removeCredentialFile(PENDING_FILE);
    throw new Error("The GitHub device code expired. Start again.");
  }
  if (pending.lastPolledAt) {
    const nextAllowed = Date.parse(pending.lastPolledAt) + pending.intervalSeconds * 1000;
    if (Date.now() < nextAllowed) return { ok: true, state: "pending", retryAfterSeconds: Math.max(1, Math.ceil((nextAllowed - Date.now()) / 1000)) };
  }
  pending.lastPolledAt = new Date().toISOString();
  await writeCredentialJson(PENDING_FILE, pending);
  const body = await postForm(TOKEN_URL, {
    client_id: clientId(),
    device_code: pending.deviceCode,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  });
  const providerError = typeof body.error === "string" ? body.error : "";
  if (providerError === "authorization_pending") return { ok: true, state: "pending", retryAfterSeconds: pending.intervalSeconds };
  if (providerError === "slow_down") {
    pending.intervalSeconds += 5;
    await writeCredentialJson(PENDING_FILE, pending);
    return { ok: true, state: "pending", retryAfterSeconds: pending.intervalSeconds };
  }
  if (providerError) {
    await removeCredentialFile(PENDING_FILE);
    if (providerError === "access_denied") throw new Error("GitHub authorization was declined. Local PlotPickle work is unchanged.");
    if (providerError === "expired_token") throw new Error("The GitHub device code expired. Start again.");
    throw new Error(typeof body.error_description === "string" ? body.error_description : "GitHub did not complete authorization.");
  }
  const accessToken = typeof body.access_token === "string" ? body.access_token : "";
  if (!accessToken) throw new Error("GitHub did not return a user access token.");
  const authorization: GitHubAppAuthorization = {
    version: 1,
    authMode: "github-app",
    accessToken,
    refreshToken: typeof body.refresh_token === "string" ? body.refresh_token : "",
    tokenType: typeof body.token_type === "string" ? body.token_type : "bearer",
    expiresAt: new Date(Date.now() + (Number(body.expires_in) || 28_800) * 1000).toISOString(),
    refreshTokenExpiresAt: new Date(Date.now() + (Number(body.refresh_token_expires_in) || 15_897_600) * 1000).toISOString(),
    account: await fetchAccount(accessToken),
    verifiedAt: new Date().toISOString(),
  };
  await writeCredentialJson(AUTHORIZATION_FILE, authorization);
  await removeCredentialFile(PENDING_FILE);
  return { ok: true, state: "authenticated", ...publicAuthorization(authorization) };
}

async function availableRepositories(): Promise<RepositoryChoice[]> {
  const authorization = await liveAuthorization();
  const installationsBody = await githubRequest(authorization.accessToken, "/user/installations?per_page=100");
  const installations = installationsBody && typeof installationsBody === "object" && Array.isArray((installationsBody as Record<string, unknown>).installations)
    ? (installationsBody as { installations: unknown[] }).installations
    : [];
  const choices: RepositoryChoice[] = [];
  for (const installation of installations) {
    if (!installation || typeof installation !== "object") continue;
    const installationId = Number((installation as Record<string, unknown>).id) || 0;
    if (!installationId) continue;
    const body = await githubRequest(authorization.accessToken, `/user/installations/${installationId}/repositories?per_page=100`);
    const repositories = body && typeof body === "object" && Array.isArray((body as Record<string, unknown>).repositories)
      ? (body as { repositories: unknown[] }).repositories
      : [];
    for (const repository of repositories) {
      if (!repository || typeof repository !== "object") continue;
      const record = repository as Record<string, unknown>;
      const ownerRecord = record.owner && typeof record.owner === "object" ? record.owner as Record<string, unknown> : {};
      const permissionsRecord = record.permissions && typeof record.permissions === "object" ? record.permissions as Record<string, unknown> : {};
      const owner = typeof ownerRecord.login === "string" ? ownerRecord.login : "";
      const name = typeof record.name === "string" ? record.name : "";
      if (!owner || !name) continue;
      choices.push({
        id: Number(record.id) || 0,
        installationId,
        owner,
        name,
        fullName: typeof record.full_name === "string" ? record.full_name : `${owner}/${name}`,
        private: Boolean(record.private),
        defaultBranch: typeof record.default_branch === "string" && record.default_branch ? record.default_branch : "main",
        htmlUrl: typeof record.html_url === "string" ? record.html_url : `https://github.com/${owner}/${name}`,
        permissions: {
          pull: permissionsRecord.pull !== false,
          push: Boolean(permissionsRecord.push || permissionsRecord.maintain || permissionsRecord.admin),
          admin: Boolean(permissionsRecord.admin),
        },
      });
    }
  }
  return [...new Map(choices.map((choice) => [choice.fullName.toLowerCase(), choice])).values()]
    .sort((left, right) => left.fullName.localeCompare(right.fullName));
}

async function selectRepository(input: Record<string, unknown>) {
  const fullName = typeof input.fullName === "string" ? input.fullName.trim() : "";
  const projectPath = typeof input.projectPath === "string" && input.projectPath.trim()
    ? input.projectPath.trim().replace(/^\/+/, "")
    : "stories/plotpickle-story.ppf";
  if (!fullName.includes("/")) throw new Error("Choose a GitHub story repository.");
  const repositories = await availableRepositories();
  const repository = repositories.find((item) => item.fullName.toLowerCase() === fullName.toLowerCase());
  if (!repository) throw new Error("The selected repository is not available to the PlotPickle GitHub App.");
  if (!repository.permissions.push) throw new Error("The signed-in account does not have script editing access to this repository.");
  if (!projectPath.toLowerCase().endsWith(".ppf") || projectPath.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("The story path must be a safe .ppf path.");
  }
  const authorization = await liveAuthorization();
  const connection: SelectedGitHubConnection = {
    version: 1,
    owner: repository.owner,
    repo: repository.name,
    branch: repository.defaultBranch,
    projectPath,
    token: authorization.accessToken,
    login: authorization.account.login,
    verifiedAt: "",
    readiness: { ready: false, checks: [] },
    authMode: "github-app",
    tokenExpiresAt: authorization.expiresAt,
  };
  await writeCredentialJson(CONNECTION_FILE, connection);
  return { ok: true, repository, connection: { owner: connection.owner, repo: connection.repo, branch: connection.branch, projectPath: connection.projectPath } };
}

async function handle(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (request.method === "GET" && url.pathname === `${API}/status`) {
    const saved = await readCredentialJson<GitHubAppAuthorization>(AUTHORIZATION_FILE);
    if (!validAuthorization(saved)) {
      sendJson(response, 200, { ok: true, ...publicAuthorization(null) });
      return;
    }
    const live = await refreshAuthorization(saved);
    sendJson(response, 200, { ok: true, ...publicAuthorization(live) });
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/start`) {
    sendJson(response, 200, await startAuthorization());
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/poll`) {
    sendJson(response, 200, await pollAuthorization());
    return;
  }
  if (request.method === "GET" && url.pathname === `${API}/repositories`) {
    sendJson(response, 200, { ok: true, repositories: await availableRepositories() });
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/select`) {
    sendJson(response, 200, await selectRepository(await readBody(request)));
    return;
  }
  if (request.method === "DELETE" && url.pathname === `${API}/connection`) {
    await Promise.all([
      removeCredentialFile(AUTHORIZATION_FILE),
      removeCredentialFile(PENDING_FILE),
      removeCredentialFile(CONNECTION_FILE),
    ]);
    sendJson(response, 200, { ok: true, message: "The GitHub App account and selected repository were removed from this computer. Local projects, assets and backups were kept." });
    return;
  }
  sendJson(response, 404, { ok: false, message: "GitHub App operation not found." });
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "The GitHub App connection failed.";
  return message
    .replace(/gh[urs]_[A-Za-z0-9_]+/g, "[redacted]")
    .replace(/[A-Za-z0-9_-]{30,}/g, (value) => value.startsWith("Iv1.") ? value : "[redacted]")
    .slice(0, 500);
}

export function githubAppGateway(): Plugin {
  return {
    name: "plotpickle-github-app-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const rawUrl = request.url;
        if (!rawUrl) { next(); return; }
        const url = new URL(rawUrl, "http://127.0.0.1");
        if (!url.pathname.startsWith(API)) { next(); return; }
        if (!isLocalRequest(request)) {
          sendJson(response, 403, { ok: false, message: "GitHub App setup accepts requests only from this local PlotPickle server." });
          return;
        }
        void handle(request, response, url).catch((error) => {
          sendJson(response, 400, { ok: false, message: safeError(error) });
        });
      });
    },
  };
}
