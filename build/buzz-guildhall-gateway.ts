import { spawn } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { resolveBuzzCliExecutable } from "./buzz-desktop-discovery";
import { readCredentialJson } from "./local-credentials";
import { BUZZ_GUILDHALL_ACTORS, BUZZ_GUILDHALL_CHANNELS } from "../lib/buzz-guildhall";

const API = "/api/local-buzz/guildhall";
const CONNECTION_FILE = "buzz-connection.json";
const MAX_COMMAND_OUTPUT = 4 * 1024 * 1024;

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
type BuzzChannel = { id: string; name: string; description: string };

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
  const message = error instanceof Error ? error.message : "The Buzz Guildhall operation failed.";
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
      child.kill("SIGKILL");
      settled = true;
      reject(new Error(`${executable} did not finish within the allowed time.`));
    }, 45_000);
    const collect = (target: Buffer[], chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes <= MAX_COMMAND_OUTPUT) target.push(chunk);
      else if (!settled) {
        child.kill("SIGKILL");
        settled = true;
        clearTimeout(timer);
        reject(new Error("Buzz CLI returned too much output."));
      }
    };
    child.stdout.on("data", (chunk: Buffer) => collect(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => collect(stderr, chunk));
    child.once("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error("Buzz CLI is not installed or could not start."));
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
      if (result.code !== 0) reject(new Error(result.stderr || result.stdout || `Buzz CLI exited with code ${result.code}.`));
      else resolve(result);
    });
  });
}

async function runBuzz(connection: BuzzConnection, args: string[]) {
  if (!connection.privateKey) throw new Error("Authorize PlotPickle with your Buzz private identity before setting up the Guildhall.");
  const resolution = await resolveBuzzCliExecutable(connection.cliPath);
  const result = await command(resolution.executable, args, {
    BUZZ_RELAY_URL: relayHttpUrl(connection.relayUrl),
    BUZZ_PRIVATE_KEY: connection.privateKey,
  });
  try { return JSON.parse(result.stdout || "null") as unknown; }
  catch { throw new Error("Buzz CLI returned invalid JSON."); }
}

function nestedArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const item = value as Record<string, unknown>;
  for (const key of ["channels", "items", "data", "results"]) {
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
    if (!id || !name) return [];
    return [{ id, name, description: firstString(item, ["description", "purpose", "topic"]) }];
  });
}

async function listChannels(connection: BuzzConnection) {
  return channelsFrom(await runBuzz(connection, ["--format", "compact", "channels", "list"]));
}

function stewardCards() {
  return BUZZ_GUILDHALL_ACTORS
    .filter((actor) => actor.buzzPresence === "native-draft")
    .map((actor) => ({
      id: actor.id,
      displayName: actor.displayName,
      title: actor.title,
      summary: actor.summary,
      primaryChannel: actor.primaryChannel,
      systemPrompt: "systemPrompt" in actor && typeof actor.systemPrompt === "string" ? actor.systemPrompt : "",
      ownerReviewRequired: true,
    }));
}

function roomStatus(channels: BuzzChannel[]) {
  const readyRooms = BUZZ_GUILDHALL_CHANNELS.flatMap((definition) => {
    const channel = channels.find((candidate) => candidate.name === definition.name);
    return channel ? [{ id: definition.id, name: definition.name, label: definition.label, channelId: channel.id }] : [];
  });
  const missingRooms = BUZZ_GUILDHALL_CHANNELS
    .filter((definition) => !channels.some((candidate) => candidate.name === definition.name))
    .map((definition) => ({ id: definition.id, name: definition.name, label: definition.label }));
  return {
    ready: missingRooms.length === 0,
    operational: missingRooms.length === 0,
    readyCount: readyRooms.length,
    totalCount: BUZZ_GUILDHALL_CHANNELS.length,
    readyRooms,
    missingRooms,
  };
}

async function status() {
  const connection = await readConnection();
  const base = {
    ok: true,
    configured: Boolean(connection),
    identityVerified: Boolean(connection?.verificationVersion === 2 && connection.verifiedAt && connection.privateKey),
    canSetup: false,
    ready: false,
    operational: false,
    readyCount: 0,
    totalCount: BUZZ_GUILDHALL_CHANNELS.length,
    readyRooms: [] as Array<Record<string, string>>,
    missingRooms: BUZZ_GUILDHALL_CHANNELS.map((room) => ({ id: room.id, name: room.name, label: room.label })),
    stewards: stewardCards(),
    upstreamAgentBoundary: "Buzz-native agent creation remains an explicit owner action in Buzz Desktop. PlotPickle does not bypass BUZZ_AUTH_TAG or owner review.",
    message: "Connect and verify Buzz before setting up the PlotPickle Guildhall.",
  };
  if (!connection) return base;
  if (!base.identityVerified) return { ...base, message: "The Buzz connection exists, but its identity has not passed verification yet." };
  try {
    const channels = await listChannels(connection);
    const rooms = roomStatus(channels);
    return {
      ...base,
      ...rooms,
      canSetup: true,
      message: rooms.ready
        ? "PlotPickle Guildhall is operational. All private coordination rooms are ready."
        : `${rooms.readyCount}/${rooms.totalCount} Guildhall rooms are ready. PlotPickle can create the missing rooms safely.`,
    };
  } catch (error) {
    return { ...base, message: safeError(error) };
  }
}

async function setup() {
  const connection = await readConnection();
  if (!connection) throw new Error("Connect Buzz before setting up the PlotPickle Guildhall.");
  if (connection.verificationVersion !== 2 || !connection.verifiedAt || !connection.privateKey) {
    throw new Error("Verify the Buzz community and identity before setting up the PlotPickle Guildhall.");
  }
  let channels = await listChannels(connection);
  const created: string[] = [];
  const kept: string[] = [];
  for (const definition of BUZZ_GUILDHALL_CHANNELS) {
    if (channels.some((channel) => channel.name === definition.name)) {
      kept.push(definition.name);
      continue;
    }
    await runBuzz(connection, [
      "channels", "create",
      "--name", definition.name,
      "--type", definition.type,
      "--visibility", definition.visibility,
      "--description", definition.description,
    ]);
    created.push(definition.name);
  }
  channels = await listChannels(connection);
  const rooms = roomStatus(channels);
  if (!rooms.ready) {
    throw new Error(`Buzz Guildhall setup is incomplete; missing ${rooms.missingRooms.map((room) => room.name).join(", ")}.`);
  }
  return {
    ok: true,
    ...rooms,
    configured: true,
    identityVerified: true,
    canSetup: true,
    created,
    kept,
    stewards: stewardCards(),
    upstreamAgentBoundary: "Orin Ledgerbark and Fen Copperwind are optional separate Buzz-native identities. BUZZ requires owner-reviewed creation in Buzz Desktop; the Guildhall itself is operational without bypassing that boundary.",
    message: created.length
      ? `PlotPickle Guildhall is operational. Created ${created.length} missing room${created.length === 1 ? "" : "s"}; all ${rooms.totalCount} are ready.`
      : `PlotPickle Guildhall was already operational. All ${rooms.totalCount} rooms are ready.`,
  };
}

async function handle(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (request.method === "GET" && url.pathname === `${API}/status`) {
    sendJson(response, 200, await status());
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/setup`) {
    sendJson(response, 200, await setup());
    return;
  }
  sendJson(response, 404, { ok: false, message: "Buzz Guildhall operation not found." });
}

export function buzzGuildhallGateway(): Plugin {
  return {
    name: "plotpickle-buzz-guildhall-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const rawUrl = request.url;
        if (!rawUrl) { next(); return; }
        let url: URL;
        try { url = new URL(rawUrl, "http://127.0.0.1"); } catch { next(); return; }
        if (!url.pathname.startsWith(API)) { next(); return; }
        if (!isLocalRequest(request)) {
          sendJson(response, 403, { ok: false, message: "Buzz Guildhall controls are available only from the local PlotPickle application." });
          return;
        }
        void handle(request, response, url).catch((error) => sendJson(response, 500, { ok: false, message: safeError(error) }));
      });
    },
  };
}
