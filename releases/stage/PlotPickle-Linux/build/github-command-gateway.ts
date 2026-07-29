import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import {
  cancelPersistentGitHubCommand,
  readGitHubCommandOutbox,
  retryPersistentGitHubCommand,
} from "./github-command-service";
import { publicGitHubCommandEntry } from "../lib/github-command-outbox";
import { summarizeGitHubRecovery } from "../lib/github-recovery-status";
import { readCredentialJson } from "./local-credentials";

const API = "/api/local-github-commands";

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

function safeCommandId(value: string) {
  const id = decodeURIComponent(value);
  if (!/^ghcmd_[a-f0-9]{24}$/.test(id)) throw new Error("Choose a valid GitHub recovery command.");
  return id;
}

async function githubAuthenticationReady() {
  const connection = await readCredentialJson<unknown>("github-connection.json");
  if (!connection || typeof connection !== "object") return false;
  const readiness = (connection as { readiness?: { ready?: unknown } }).readiness;
  return readiness?.ready === true;
}

async function recoverySnapshot() {
  const outbox = await readGitHubCommandOutbox();
  const commands = outbox.entries.map(publicGitHubCommandEntry);
  return {
    ok: true,
    available: true,
    outboxUpdatedAt: outbox.updatedAt,
    summary: summarizeGitHubRecovery(commands),
    commands,
    payloadsExposed: false,
  };
}

async function handle(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (request.method === "GET" && url.pathname === API) {
    sendJson(response, 200, await recoverySnapshot());
    return;
  }
  const match = url.pathname.match(/^\/api\/local-github-commands\/([^/]+)\/(retry|cancel)$/);
  if (request.method === "POST" && match) {
    const id = safeCommandId(match[1]);
    const command = match[2] === "retry"
      ? await retryPersistentGitHubCommand(id, new Date().toISOString(), { authenticationReady: await githubAuthenticationReady() })
      : await cancelPersistentGitHubCommand(id);
    sendJson(response, 200, { ...(await recoverySnapshot()), command });
    return;
  }
  sendJson(response, 404, { ok: false, message: "GitHub recovery operation not found." });
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : "The GitHub recovery operation failed.")
    .replace(/gh[pousr]_[A-Za-z0-9_]+/g, "[redacted]")
    .slice(0, 700);
}

export function githubCommandGateway(): Plugin {
  return {
    name: "plotpickle-github-command-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const rawUrl = request.url;
        if (!rawUrl) { next(); return; }
        const url = new URL(rawUrl, "http://127.0.0.1");
        if (!url.pathname.startsWith(API)) { next(); return; }
        if (!isLocalRequest(request)) {
          sendJson(response, 403, { ok: false, message: "GitHub recovery accepts requests only from this local PlotPickle server." });
          return;
        }
        void handle(request, response, url).catch((error) => {
          sendJson(response, 400, { ok: false, message: safeError(error) });
        });
      });
    },
  };
}
