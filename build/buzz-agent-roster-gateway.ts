import { spawn } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { BUZZ_GUILDHALL_ACTORS } from "../lib/buzz-guildhall";
import { resolveBuzzCliExecutable } from "./buzz-desktop-discovery";
import { readCredentialJson } from "./local-credentials";

const API = "/api/local-buzz/agent-roster";
const CONNECTION_FILE = "buzz-connection.json";
const MAX_COMMAND_OUTPUT = 2 * 1024 * 1024;

type BuzzConnection = {
  version: 1;
  mode: "existing-relay" | "managed";
  relayUrl: string;
  community: string;
  identityLabel: string;
  cliPath: string;
  privateKey: string;
  verifiedAt: string;
  verificationVersion?: 2;
};

type CommandResult = { stdout: string; stderr: string; code: number };
type NativeAgentStatus = {
  actorId: string;
  created: boolean;
  verified: boolean;
  ownedByMe: boolean;
  pubkey: string;
  presence: string;
  updatedAt: string;
  lookupError: boolean;
};

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

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "BUZZ agent status is unavailable.";
  return message
    .replace(/nsec1[a-z0-9]+/gi, "[redacted-nsec]")
    .replace(/\b[a-f0-9]{64}\b/gi, "[redacted-secret]")
    .replace(/(password|secret|private[_ -]?key|api[_ -]?key|token)\s*[=:]\s*\S+/gi, "$1=[redacted]")
    .slice(0, 500);
}

function validConnection(value: unknown): value is BuzzConnection {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Partial<BuzzConnection>;
  return item.version === 1
    && (item.mode === "existing-relay" || item.mode === "managed")
    && typeof item.relayUrl === "string"
    && typeof item.community === "string"
    && typeof item.identityLabel === "string"
    && typeof item.cliPath === "string"
    && typeof item.privateKey === "string"
    && typeof item.verifiedAt === "string";
}

async function readConnection() {
  const value = await readCredentialJson<unknown>(CONNECTION_FILE);
  return validConnection(value) ? value : null;
}

function relayHttpUrl(value: string) {
  const url = new URL(value);
  if (url.protocol === "ws:") url.protocol = "http:";
  if (url.protocol === "wss:") url.protocol = "https:";
  return url.toString().replace(/\/$/, "");
}

function command(executable: string, args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<CommandResult>((resolve, reject) => {
    const child = spawn(executable, args, {
      env: { ...process.env, ...env },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let bytes = 0;
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error("BUZZ CLI did not finish within the allowed time."));
    }, 30_000);
    const collect = (target: Buffer[], chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes <= MAX_COMMAND_OUTPUT) target.push(chunk);
      else if (!settled) {
        settled = true;
        clearTimeout(timer);
        child.kill("SIGKILL");
        reject(new Error("BUZZ CLI returned too much output."));
      }
    };
    child.stdout.on("data", (chunk: Buffer) => collect(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => collect(stderr, chunk));
    child.once("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error("BUZZ CLI is not installed or could not start."));
    });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const result = {
        stdout: Buffer.concat(stdout).toString("utf8").trim(),
        stderr: Buffer.concat(stderr).toString("utf8").trim(),
        code: code ?? 1,
      };
      if (result.code !== 0) reject(new Error(result.stderr || result.stdout || `BUZZ CLI exited with code ${result.code}.`));
      else resolve(result);
    });
  });
}

async function runBuzz(connection: BuzzConnection, args: string[]) {
  if (!connection.privateKey) throw new Error("Authorize PlotPickle with your BUZZ identity before reading agent presence.");
  const resolution = await resolveBuzzCliExecutable(connection.cliPath);
  const result = await command(resolution.executable, args, {
    BUZZ_RELAY_URL: relayHttpUrl(connection.relayUrl),
    BUZZ_PRIVATE_KEY: connection.privateKey,
  });
  try { return JSON.parse(result.stdout || "null") as unknown; }
  catch { throw new Error("BUZZ CLI returned invalid JSON."); }
}

function array(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const item = value as Record<string, unknown>;
  for (const key of ["items", "data", "results", "users", "presence"]) {
    if (Array.isArray(item[key])) return item[key] as unknown[];
  }
  return [];
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberDate(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000).toISOString() : text(value);
}

async function nativeAgentStatus(connection: BuzzConnection, actor: (typeof BUZZ_GUILDHALL_ACTORS)[number]): Promise<NativeAgentStatus> {
  const empty = {
    actorId: actor.id,
    created: false,
    verified: false,
    ownedByMe: false,
    pubkey: "",
    presence: "",
    updatedAt: "",
    lookupError: false,
  };
  try {
    const profilesRaw = await runBuzz(connection, ["--format", "compact", "users", "get", "--name", actor.displayName, "--owner", "me"]);
    const profile = array(profilesRaw).map(record).find(Boolean) ?? null;
    const pubkey = text(profile?.pubkey);
    if (!/^[a-f0-9]{64}$/i.test(pubkey)) return empty;
    const verification = text(profile?.verification);
    const ownedByMe = profile?.owned_by_me === true;
    const presenceRaw = await runBuzz(connection, ["users", "presence", "--pubkeys", pubkey]).catch(() => []);
    const presence = array(presenceRaw).map(record).find((entry) => text(entry?.pubkey) === pubkey) ?? null;
    return {
      actorId: actor.id,
      created: true,
      verified: verification === "verified",
      ownedByMe,
      pubkey,
      presence: text(presence?.status) || "offline",
      updatedAt: numberDate(presence?.updated_at ?? presence?.updatedAt),
      lookupError: false,
    };
  } catch {
    return { ...empty, lookupError: true };
  }
}

function visibleActors() {
  return BUZZ_GUILDHALL_ACTORS.filter((actor) => actor.buzzPresence === "mirrored" || actor.buzzPresence === "native-draft");
}

async function status() {
  const actors = visibleActors();
  const connection = await readConnection();
  const identityVerified = Boolean(connection?.verificationVersion === 2 && connection.verifiedAt && connection.privateKey);
  if (!connection || !identityVerified) {
    return {
      ok: true,
      identityVerified,
      agents: actors.map((actor) => ({
        actorId: actor.id,
        created: false,
        verified: false,
        ownedByMe: false,
        pubkey: "",
        presence: "",
        updatedAt: "",
        lookupError: false,
      })),
      message: "Connect and verify BUZZ to see which PlotPickle agents also have owner-approved BUZZ identities.",
    };
  }
  const agents = await Promise.all(actors.map((actor) => nativeAgentStatus(connection, actor)));
  return {
    ok: true,
    identityVerified: true,
    agents,
    message: agents.some((agent) => agent.lookupError)
      ? "Some BUZZ agent identity status could not be read. PlotPickle will show status unavailable rather than guessing."
      : "BUZZ identity status is current for PlotPickle agents and native stewards.",
  };
}

export function buzzAgentRosterGateway(): Plugin {
  return {
    name: "plotpickle-buzz-agent-roster-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const rawUrl = request.url;
        if (!rawUrl) { next(); return; }
        let url: URL;
        try { url = new URL(rawUrl, "http://127.0.0.1"); } catch { next(); return; }
        if (url.pathname !== API) { next(); return; }
        if (!isLocalRequest(request)) {
          sendJson(response, 403, { ok: false, message: "Agent roster status is available only from the local PlotPickle application." });
          return;
        }
        if (request.method !== "GET") {
          sendJson(response, 405, { ok: false, message: "Agent roster status is read-only." });
          return;
        }
        void status()
          .then((body) => sendJson(response, 200, body))
          .catch((error) => sendJson(response, 500, { ok: false, message: safeError(error) }));
      });
    },
  };
}
