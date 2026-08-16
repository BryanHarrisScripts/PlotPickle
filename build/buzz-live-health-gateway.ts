import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { resolveBuzzCliExecutable } from "./buzz-desktop-discovery";
import { readCredentialJson } from "./local-credentials";

const API = "/api/local-buzz/live-health";
const CONNECTION_FILE = "buzz-connection.json";
const MAX_COMMAND_OUTPUT = 2 * 1024 * 1024;
const HEALTH_ROOM = "gatehouse";

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
type BuzzChannel = { id: string; name: string };

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
  const message = error instanceof Error ? error.message : "The BUZZ live test failed.";
  return message
    .replace(/nsec1[a-z0-9]+/gi, "[redacted-nsec]")
    .replace(/\b[a-f0-9]{64}\b/gi, "[redacted-secret]")
    .replace(/(password|secret|private[_ -]?key|api[_ -]?key|token)\s*[=:]\s*\S+/gi, "$1=[redacted]")
    .slice(0, 700);
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
    }, 45_000);
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
  if (!connection.privateKey) throw new Error("Authorize PlotPickle with your BUZZ identity before running the live test.");
  const resolution = await resolveBuzzCliExecutable(connection.cliPath);
  const result = await command(resolution.executable, args, {
    BUZZ_RELAY_URL: relayHttpUrl(connection.relayUrl),
    BUZZ_PRIVATE_KEY: connection.privateKey,
  });
  try { return JSON.parse(result.stdout || "null") as unknown; }
  catch { throw new Error("BUZZ CLI returned invalid JSON."); }
}

function nestedArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const item = value as Record<string, unknown>;
  for (const key of ["channels", "messages", "items", "data", "results"]) {
    if (Array.isArray(item[key])) return item[key] as unknown[];
  }
  return [];
}

function firstString(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function channelsFrom(value: unknown): BuzzChannel[] {
  return nestedArray(value).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const item = entry as Record<string, unknown>;
    const id = firstString(item, ["channel_id", "id", "channelId", "uuid"]);
    const name = firstString(item, ["name", "title", "slug"]);
    return id && name ? [{ id, name }] : [];
  });
}

function messageContents(value: unknown) {
  return nestedArray(value).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const item = entry as Record<string, unknown>;
    const content = firstString(item, ["content", "body", "text"]);
    return content ? [content] : [];
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function liveRoundTrip() {
  const connection = await readConnection();
  if (!connection) throw new Error("Connect BUZZ before running the live round-trip test.");
  if (connection.verificationVersion !== 2 || !connection.verifiedAt || !connection.privateKey) {
    throw new Error("Verify the BUZZ community and identity before running the live round-trip test.");
  }

  const channels = channelsFrom(await runBuzz(connection, ["--format", "compact", "channels", "list"]));
  const gatehouse = channels.find((channel) => channel.name === HEALTH_ROOM);
  if (!gatehouse) throw new Error("The Guildhall Gatehouse is missing. Set up the PlotPickle Guildhall first.");

  const sentAt = new Date().toISOString();
  const tag = `plotpickle-buzz-health:${randomUUID()}`;
  const content = `${tag}\nPlotPickle signed BUZZ round-trip health probe · ${sentAt}`;
  await runBuzz(connection, ["messages", "send", "--channel", gatehouse.id, "--content", content]);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (attempt > 0) await sleep(400);
    const messages = await runBuzz(connection, ["messages", "get", "--channel", gatehouse.id, "--limit", "30"]);
    if (messageContents(messages).some((message) => message.includes(tag))) {
      const receivedAt = new Date().toISOString();
      return {
        ok: true,
        roundTrip: true,
        room: HEALTH_ROOM,
        sentAt,
        receivedAt,
        message: "Guildhall reachable. Signed test message received from BUZZ.",
      };
    }
  }

  throw new Error("BUZZ accepted the signed Gatehouse message, but PlotPickle could not read the same message back. The live round trip is not proven yet.");
}

async function handle(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (request.method === "POST" && url.pathname === API) {
    try {
      sendJson(response, 200, await liveRoundTrip());
    } catch (error) {
      sendJson(response, 503, { ok: false, roundTrip: false, room: HEALTH_ROOM, message: safeError(error) });
    }
    return;
  }
  sendJson(response, 404, { ok: false, roundTrip: false, message: "BUZZ live health operation not found." });
}

export function buzzLiveHealthGateway(): Plugin {
  return {
    name: "plotpickle-buzz-live-health-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const rawUrl = request.url;
        if (!rawUrl) { next(); return; }
        let url: URL;
        try { url = new URL(rawUrl, "http://127.0.0.1"); } catch { next(); return; }
        if (!url.pathname.startsWith(API)) { next(); return; }
        if (!isLocalRequest(request)) {
          sendJson(response, 403, { ok: false, roundTrip: false, message: "BUZZ live health is available only from the local PlotPickle application." });
          return;
        }
        void handle(request, response, url).catch((error) => sendJson(response, 500, { ok: false, roundTrip: false, message: safeError(error) }));
      });
    },
  };
}
