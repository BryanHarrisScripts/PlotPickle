import { mkdir, open, readFile, rename } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import type { Plugin } from "vite";
import {
  AFTERGLOW_REPOSITORY_FULL_NAME,
  AFTERGLOW_REPOSITORY_NAME,
  AFTERGLOW_REPOSITORY_OWNER,
  AFTERGLOW_REPOSITORY_PROJECT_PATH,
  isExpectedAfterglowRepository,
} from "../lib/afterglow-persistence";
import { readCredentialJson } from "./local-credentials";

const API = "/api/local-afterglow";
const STATE_FILE = "afterglow-persistence.json";
const GITHUB_CONNECTION_FILE = "github-connection.json";

type PersistenceState = {
  version: 1;
  enabled: boolean;
  repository: typeof AFTERGLOW_REPOSITORY_FULL_NAME;
  enabledAt: string;
  disabledAt: string;
};

type GitHubConnection = {
  version?: number;
  owner?: string;
  repo?: string;
  branch?: string;
  projectPath?: string;
  verifiedAt?: string;
  readiness?: { ready?: boolean };
};

function home() {
  if (process.env.PLOTPICKLE_HOME) return path.resolve(process.env.PLOTPICKLE_HOME);
  if (process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, "PlotPickle");
  return path.join(os.homedir(), ".plotpickle");
}

function statePath() {
  return path.join(home(), STATE_FILE);
}

function isLoopback(value?: string) {
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

function sendJson(response: ServerResponse, status: number, payload: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(payload));
}

function emptyState(): PersistenceState {
  return {
    version: 1,
    enabled: false,
    repository: AFTERGLOW_REPOSITORY_FULL_NAME,
    enabledAt: "",
    disabledAt: "",
  };
}

async function readState() {
  try {
    const parsed = JSON.parse(await readFile(statePath(), "utf8")) as Partial<PersistenceState>;
    return {
      ...emptyState(),
      enabled: parsed.version === 1 && parsed.repository === AFTERGLOW_REPOSITORY_FULL_NAME && parsed.enabled === true,
      enabledAt: typeof parsed.enabledAt === "string" ? parsed.enabledAt : "",
      disabledAt: typeof parsed.disabledAt === "string" ? parsed.disabledAt : "",
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyState();
    throw new Error("The saved Afterglow persistence preference could not be read.");
  }
}

async function writeState(state: PersistenceState) {
  await mkdir(home(), { recursive: true, mode: 0o700 });
  const destination = statePath();
  const temporary = `${destination}.${process.pid}.${Date.now()}.tmp`;
  const handle = await open(temporary, "w", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporary, destination);
}

async function publicStatus() {
  const [state, connection] = await Promise.all([
    readState(),
    readCredentialJson<GitHubConnection>(GITHUB_CONNECTION_FILE),
  ]);
  const expectedRepository = isExpectedAfterglowRepository(connection?.owner, connection?.repo);
  const ready = expectedRepository && connection?.readiness?.ready === true;
  const error = state.enabled && !ready
    ? expectedRepository
      ? "The Afterglow GitHub connection needs to be checked again. The persistent local project has not been removed."
      : `Connect ${AFTERGLOW_REPOSITORY_FULL_NAME} in PlotPickle. The persistent local project has not been removed.`
    : "";
  return {
    available: true,
    enabled: state.enabled,
    repository: {
      owner: expectedRepository ? AFTERGLOW_REPOSITORY_OWNER : "",
      repo: expectedRepository ? AFTERGLOW_REPOSITORY_NAME : "",
      branch: expectedRepository && connection?.branch ? connection.branch : "main",
      projectPath: expectedRepository && connection?.projectPath
        ? connection.projectPath
        : AFTERGLOW_REPOSITORY_PROJECT_PATH,
      ready,
      verifiedAt: ready && connection?.verifiedAt ? connection.verifiedAt : "",
    },
    error,
  };
}

async function enable() {
  const connection = await readCredentialJson<GitHubConnection>(GITHUB_CONNECTION_FILE);
  if (!isExpectedAfterglowRepository(connection?.owner, connection?.repo) || connection?.readiness?.ready !== true) {
    throw new Error(`Verify ${AFTERGLOW_REPOSITORY_FULL_NAME} and wait for the green Ready light before enabling GitHub persistence.`);
  }
  const previous = await readState();
  await writeState({
    ...previous,
    enabled: true,
    repository: AFTERGLOW_REPOSITORY_FULL_NAME,
    enabledAt: previous.enabledAt || new Date().toISOString(),
    disabledAt: "",
  });
  return publicStatus();
}

async function disable() {
  const previous = await readState();
  await writeState({
    ...previous,
    enabled: false,
    repository: AFTERGLOW_REPOSITORY_FULL_NAME,
    disabledAt: new Date().toISOString(),
  });
  return publicStatus();
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : "The Afterglow persistence preference could not be updated.")
    .replace(/gh[pousr]_[A-Za-z0-9_]+/g, "[redacted]")
    .slice(0, 700);
}

export function afterglowProjectGateway(): Plugin {
  return {
    name: "plotpickle-afterglow-project-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const rawUrl = request.url;
        if (!rawUrl) {
          next();
          return;
        }
        const url = new URL(rawUrl, "http://127.0.0.1");
        if (!url.pathname.startsWith(API)) {
          next();
          return;
        }
        if (!isLocalRequest(request)) {
          sendJson(response, 403, { ok: false, message: "Afterglow persistence accepts requests only from this local PlotPickle server." });
          return;
        }
        void (async () => {
          if (request.method === "GET" && url.pathname === `${API}/status`) {
            sendJson(response, 200, { ok: true, ...(await publicStatus()) });
            return;
          }
          if (request.method === "POST" && url.pathname === `${API}/enable`) {
            sendJson(response, 200, { ok: true, ...(await enable()) });
            return;
          }
          if (request.method === "POST" && url.pathname === `${API}/disable`) {
            sendJson(response, 200, { ok: true, ...(await disable()) });
            return;
          }
          sendJson(response, 404, { ok: false, message: "Afterglow persistence operation not found." });
        })().catch((error) => sendJson(response, 400, { ok: false, message: safeError(error) }));
      });
    },
  };
}
