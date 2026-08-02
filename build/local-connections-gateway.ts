import { readdir } from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import type { PublicConnectionStatus } from "../lib/connection-status";
import {
  cancelGoogleAuthorization,
  checkGoogleConnection,
  googleAuthorizationStatus,
  publicGoogleConnection,
  readPublicGoogleConnection,
  revokeGoogleConnection,
  shutdownGoogleAuthorization,
  startGoogleAuthorization,
} from "./google-desktop-oauth";
import {
  credentialInventory,
  credentialProtectionLabel,
  defaultCredentialProtection,
  eraseAllCredentials,
  openCredentialsDirectory,
  persistentHome,
  readCredentialJson,
} from "./local-credentials";

const CONNECTIONS_API = "/api/local-connections";
const CREDENTIALS_API = `${CONNECTIONS_API}/credentials`;
const GOOGLE_API = "/api/local-google/connection";

const OLLAMA_TAGS_URL = "http://127.0.0.1:11434/api/tags";
const COMFYUI_SYSTEM_URL = "http://127.0.0.1:8188/system_stats";
const COMFYUI_CHECKPOINTS_URL = "http://127.0.0.1:8188/object_info/CheckpointLoaderSimple";
const LOCAL_SERVICE_TIMEOUT_MS = 1_500;

type LocalCreativeServiceId = "ollama" | "comfyui";
type LocalCreativeServiceStatus = Omit<PublicConnectionStatus, "id"> & { id: LocalCreativeServiceId };
const localServiceLastVerified: Record<LocalCreativeServiceId, string> = { ollama: "", comfyui: "" };

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

function aiConnectionFile() { return "ai-connection.json"; }
function githubConnectionFile() { return "github-connection.json"; }
function projectsDirectory() { return path.join(persistentHome(), "projects"); }
function backupsDirectory() { return path.join(persistentHome(), "backups"); }

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

function localServiceStatus(
  id: LocalCreativeServiceId,
  label: string,
  patch: Partial<Omit<LocalCreativeServiceStatus, "id" | "label" | "optional">>,
): LocalCreativeServiceStatus {
  return {
    id,
    label,
    state: "disconnected",
    identity: "",
    detail: "Optional local service is not running.",
    lastSuccessfulConnection: localServiceLastVerified[id],
    error: "",
    repairGuidance: "Start the local application or use its official installer.",
    dataShared: [],
    scopes: [],
    permissions: [],
    optional: true,
    ...patch,
  };
}

async function fetchLoopbackJson(endpoint: string): Promise<Record<string, unknown>> {
  const url = new URL(endpoint);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1") {
    throw new Error("Local creative-service checks are restricted to 127.0.0.1.");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOCAL_SERVICE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Local service returned HTTP ${response.status}.`);
    const body = await response.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Local service returned an invalid response.");
    return body as Record<string, unknown>;
  } finally {
    clearTimeout(timeout);
  }
}

async function probeOllama(): Promise<LocalCreativeServiceStatus> {
  const checkedAt = new Date().toISOString();
  try {
    const body = await fetchLoopbackJson(OLLAMA_TAGS_URL);
    const models = Array.isArray(body.models)
      ? body.models.filter((model): model is Record<string, unknown> => Boolean(model && typeof model === "object"))
      : [];
    if (models.length) localServiceLastVerified.ollama = checkedAt;
    return localServiceStatus("ollama", "Ollama", {
      state: models.length ? "connected" : "configured",
      identity: models.length
        ? models.map((model) => String(model.name || model.model || "")).filter(Boolean).slice(0, 3).join(", ")
        : "Ollama is running",
      detail: models.length
        ? `${models.length} installed local writing model${models.length === 1 ? "" : "s"} available.`
        : "Ollama is running, but no local writing model is installed yet.",
      lastSuccessfulConnection: models.length ? checkedAt : localServiceLastVerified.ollama,
      repairGuidance: models.length
        ? "Select an installed Ollama model in Story & Art."
        : "Install a compatible local model in Ollama, then test connections again.",
      dataShared: ["Only explicitly selected story context; requests remain on 127.0.0.1"],
      scopes: ["Local writing", "Story planning"],
    });
  } catch (error) {
    const previous = localServiceLastVerified.ollama;
    return localServiceStatus("ollama", "Ollama", {
      state: previous ? "error" : "disconnected",
      identity: previous ? "Previously verified on 127.0.0.1:11434" : "Not running on 127.0.0.1:11434",
      detail: previous ? "The previously verified Ollama service is no longer responding." : "Ollama is optional and was not detected.",
      lastSuccessfulConnection: previous,
      error: error instanceof Error ? error.message : "Ollama health check failed.",
    });
  }
}

function comfyCheckpointNames(body: Record<string, unknown>) {
  const loader = body.CheckpointLoaderSimple;
  if (!loader || typeof loader !== "object" || Array.isArray(loader)) return [];
  const input = (loader as Record<string, unknown>).input;
  if (!input || typeof input !== "object" || Array.isArray(input)) return [];
  const required = (input as Record<string, unknown>).required;
  if (!required || typeof required !== "object" || Array.isArray(required)) return [];
  const checkpoint = (required as Record<string, unknown>).ckpt_name;
  if (!Array.isArray(checkpoint) || !Array.isArray(checkpoint[0])) return [];
  return checkpoint[0].filter((name): name is string => typeof name === "string" && Boolean(name.trim()));
}

async function probeComfyUI(): Promise<LocalCreativeServiceStatus> {
  const checkedAt = new Date().toISOString();
  try {
    const [system, loaders] = await Promise.all([
      fetchLoopbackJson(COMFYUI_SYSTEM_URL),
      fetchLoopbackJson(COMFYUI_CHECKPOINTS_URL),
    ]);
    const checkpoints = comfyCheckpointNames(loaders);
    const systemInfo = system.system;
    const version = systemInfo && typeof systemInfo === "object" && !Array.isArray(systemInfo)
      ? String((systemInfo as Record<string, unknown>).comfyui_version || "")
      : "";
    if (checkpoints.length) localServiceLastVerified.comfyui = checkedAt;
    return localServiceStatus("comfyui", "ComfyUI", {
      state: checkpoints.length ? "connected" : "configured",
      identity: [version ? `ComfyUI ${version}` : "ComfyUI is running", "127.0.0.1:8188"].join(" · "),
      detail: checkpoints.length
        ? `${checkpoints.length} local image checkpoint${checkpoints.length === 1 ? "" : "s"} available for reviewed workflows.`
        : "ComfyUI is running, but no image checkpoint is available yet.",
      lastSuccessfulConnection: checkpoints.length ? checkedAt : localServiceLastVerified.comfyui,
      repairGuidance: checkpoints.length
        ? "The local image engine is ready for a future reviewed Graphic Novel workflow."
        : "Install an image checkpoint in ComfyUI, then test connections again.",
      dataShared: ["Only explicitly submitted prompts and approved references; requests remain on 127.0.0.1"],
      scopes: ["Local image generation"],
    });
  } catch (error) {
    const previous = localServiceLastVerified.comfyui;
    return localServiceStatus("comfyui", "ComfyUI", {
      state: previous ? "error" : "disconnected",
      identity: previous ? "Previously verified on 127.0.0.1:8188" : "Not running on 127.0.0.1:8188",
      detail: previous ? "The previously verified ComfyUI service is no longer responding." : "ComfyUI is optional and was not detected.",
      lastSuccessfulConnection: previous,
      error: error instanceof Error ? error.message : "ComfyUI health check failed.",
    });
  }
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
  const [ai, github, google, projectCount, backupCount, ollama, comfyui] = await Promise.all([
    readCredentialJson<AiConnection>(aiConnectionFile()),
    readCredentialJson<GitHubConnection>(githubConnectionFile()),
    readPublicGoogleConnection(),
    countFiles(projectsDirectory(), ".ppf"),
    countFiles(backupsDirectory(), ".ppf"),
    probeOllama(),
    probeComfyUI(),
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
    google,
    ollama,
    comfyui,
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

async function publicCredentialState() {
  const inventory = await credentialInventory();
  const defaultProtection = defaultCredentialProtection();
  const protectedCount = inventory.files.filter((file) => !["legacy-plaintext", "unsupported-platform"].includes(file.protection)).length;
  const migrationRequiredCount = inventory.files.filter((file) => file.protection === "legacy-plaintext").length;
  return {
    ok: true,
    path: inventory.path,
    files: inventory.files,
    count: inventory.files.length,
    protectedCount,
    migrationRequiredCount,
    defaultProtection,
    protectionLabel: credentialProtectionLabel(defaultProtection),
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
    sendJson(response, 200, { ok: true, ...(await readPublicGoogleConnection()) });
    return;
  }
  if (request.method === "POST" && url.pathname === `${GOOGLE_API}/start`) {
    sendJson(response, 200, await startGoogleAuthorization(await readBody(request)));
    return;
  }
  if (request.method === "GET" && url.pathname === `${GOOGLE_API}/authorization`) {
    sendJson(response, 200, { ok: true, ...googleAuthorizationStatus(url.searchParams.get("attemptId") || "") });
    return;
  }
  if (request.method === "DELETE" && url.pathname === `${GOOGLE_API}/authorization`) {
    const body = await readBody(request) as { attemptId?: unknown };
    const attemptId = typeof body.attemptId === "string" ? body.attemptId : "";
    sendJson(response, 200, { ok: true, ...(await cancelGoogleAuthorization(attemptId)) });
    return;
  }
  if (request.method === "POST" && url.pathname === `${GOOGLE_API}/check`) {
    sendJson(response, 200, { ok: true, ...publicGoogleConnection(await checkGoogleConnection()) });
    return;
  }
  if (request.method === "DELETE" && url.pathname === GOOGLE_API) {
    const remoteRevoked = await revokeGoogleConnection();
    sendJson(response, 200, {
      ok: true,
      remoteRevoked,
      message: remoteRevoked
        ? "Google access was revoked and local encrypted tokens were removed."
        : "Local encrypted Google tokens were removed. If Google was unreachable, also review access in your Google Account.",
    });
    return;
  }
  sendJson(response, 404, { ok: false, message: "Local connection operation not found." });
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "The local connection operation failed.";
  return message
    .replace(/ya29\.[A-Za-z0-9._-]+/g, "[redacted]")
    .replace(/1\/\/[A-Za-z0-9._-]+/g, "[redacted]")
    .replace(/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-token]")
    .slice(0, 500);
}

export function localConnectionsGateway(): Plugin {
  return {
    name: "plotpickle-local-connections-gateway",
    apply: "serve",
    configureServer(server) {
      server.httpServer?.once("close", () => { void shutdownGoogleAuthorization(); });
      server.middlewares.use((request, response, next) => {
        const rawUrl = request.url;
        if (!rawUrl) { next(); return; }
        const url = new URL(rawUrl, "http://127.0.0.1");
        if (!url.pathname.startsWith(CONNECTIONS_API) && !url.pathname.startsWith(GOOGLE_API)) {
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
