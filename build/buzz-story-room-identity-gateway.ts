import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import {
  BUZZ_STORY_ROOM_BINDING_VERSION,
  normalizeBuzzStoryRoomBindings,
  storyRoomBindingFor,
  type BuzzStoryRoomBinding,
} from "../lib/buzz/story-room-identity";
import { BUZZ_STORY_ROOMS, type BuzzStoryRoomId } from "../lib/buzz/buzz-story-room";
import { resolveBuzzCliExecutable } from "./buzz-desktop-discovery";
import { readCredentialJson } from "./local-credentials";
import { currentProfileRequestContext } from "./profile-request-context";

const API = "/api/local-buzz/story-room-identity";
const CONNECTION_FILE = "buzz-connection.json";
const BINDINGS_OBJECT_ID = "story-room-bindings-v1";
const MAX_BODY = 64 * 1024;
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
type BuzzChannel = { id: string; name: string; description: string };
type RequestedRoom = {
  id: BuzzStoryRoomId;
  legacyName: string;
  displayName: string;
  description: string;
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
  } catch { return false; }
}

function sendJson(response: ServerResponse, statusCode: number, body: Record<string, unknown>) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_BODY) throw new Error("The Story Room identity request is too large.");
    chunks.push(buffer);
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The Story Room identity request is invalid.");
  return value as Record<string, unknown>;
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Story Room identity is unavailable.";
  return message
    .replace(/nsec1[a-z0-9]+/gi, "[redacted-nsec]")
    .replace(/\b[a-f0-9]{64}\b/gi, "[redacted-secret]")
    .replace(/(password|secret|private[_ -]?key|api[_ -]?key|token)\s*[=:]\s*\S+/gi, "$1=[redacted]")
    .slice(0, 700);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safeRoomName(value: unknown) {
  const room = text(value).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{2,71}$/.test(room)) throw new Error("The BUZZ Story Room name is invalid.");
  return room;
}

function validRoomId(value: unknown): BuzzStoryRoomId {
  const roomId = text(value) as BuzzStoryRoomId;
  if (!BUZZ_STORY_ROOMS.some((room) => room.id === roomId)) throw new Error("Choose a valid PlotPickle Story Room.");
  return roomId;
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

async function verifiedConnection() {
  const value = await readCredentialJson<unknown>(CONNECTION_FILE);
  const connection = validConnection(value) ? value : null;
  if (!connection || connection.verificationVersion !== 2 || !connection.verifiedAt || !connection.privateKey) {
    throw new Error("Verify BUZZ before resolving private Story Room identity.");
  }
  return connection;
}

function relayHttpUrl(value: string) {
  const url = new URL(value);
  if (url.protocol === "ws:") url.protocol = "http:";
  if (url.protocol === "wss:") url.protocol = "https:";
  return url.toString().replace(/\/$/, "");
}

function command(executable: string, args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<CommandResult>((resolve, reject) => {
    const child = spawn(executable, args, { env: { ...process.env, ...env }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
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
      const result = { stdout: Buffer.concat(stdout).toString("utf8").trim(), stderr: Buffer.concat(stderr).toString("utf8").trim(), code: code ?? 1 };
      if (result.code !== 0) reject(new Error(result.stderr || result.stdout || `BUZZ CLI exited with code ${result.code}.`));
      else resolve(result);
    });
  });
}

async function runBuzz(connection: BuzzConnection, args: string[]) {
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
  for (const key of ["channels", "items", "data", "results"]) if (Array.isArray(item[key])) return item[key] as unknown[];
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
  return array(value).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const item = entry as Record<string, unknown>;
    const id = firstString(item, ["channel_id", "id", "channelId", "uuid"]);
    const name = firstString(item, ["name", "title", "slug"]);
    return id && name ? [{ id, name, description: firstString(item, ["description", "purpose", "topic"]) }] : [];
  });
}

function requestRooms(body: Record<string, unknown>) {
  const projectId = text(body.projectId);
  if (!projectId || projectId.length > 240) throw new Error("Story Room identity requires a stable PlotPickle project id.");
  if (!Array.isArray(body.rooms) || !body.rooms.length || body.rooms.length > BUZZ_STORY_ROOMS.length) {
    throw new Error("Story Room identity requires the bounded PlotPickle room definitions.");
  }
  const rooms = body.rooms.map((value): RequestedRoom => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("A Story Room identity definition is invalid.");
    const item = value as Record<string, unknown>;
    return {
      id: validRoomId(item.id),
      legacyName: safeRoomName(item.legacyName),
      displayName: safeRoomName(item.displayName),
      description: text(item.description).slice(0, 300),
    };
  });
  if (new Set(rooms.map((room) => room.id)).size !== rooms.length) throw new Error("Story Room identity definitions contain duplicate room ids.");
  return { projectId, rooms, createMissing: body.createMissing === true };
}

function profileContext() {
  const context = currentProfileRequestContext();
  if (!context) throw new Error("Unlock a PlotPickle Human profile before resolving Story Room identity.");
  return context;
}

async function readBindings() {
  const context = profileContext();
  const value = await context.privateStorage.readPrivateJson(context.authContext, { domain: "buzz", objectId: BINDINGS_OBJECT_ID });
  return normalizeBuzzStoryRoomBindings(value);
}

async function writeBindings(bindings: readonly BuzzStoryRoomBinding[]) {
  const context = profileContext();
  await context.privateStorage.writePrivateJson(context.authContext, { domain: "buzz", objectId: BINDINGS_OBJECT_ID, value: bindings });
}

async function resolveRooms(body: Record<string, unknown>) {
  const request = requestRooms(body);
  const connection = await verifiedConnection();
  const [bindings, rawChannels] = await Promise.all([
    readBindings(),
    runBuzz(connection, ["--format", "compact", "channels", "list"]),
  ]);
  const channels = channelsFrom(rawChannels);
  const nextBindings = [...bindings];
  const resolved: Array<Record<string, unknown>> = [];
  let changed = false;

  for (const room of request.rooms) {
    const existingBinding = storyRoomBindingFor(nextBindings, request.projectId, room.id);
    if (existingBinding) {
      const channel = channels.find((candidate) => candidate.id === existingBinding.channelId);
      if (!channel) {
        throw new Error(`The mapped ${room.displayName} BUZZ channel is no longer available to this identity. PlotPickle will not create a duplicate while an immutable mapping exists.`);
      }
      if (channel.name !== existingBinding.lastKnownName) {
        const index = nextBindings.indexOf(existingBinding);
        nextBindings[index] = { ...existingBinding, lastKnownName: safeRoomName(channel.name), updatedAt: new Date().toISOString() };
        changed = true;
      }
      resolved.push({ roomId: room.id, displayName: room.displayName, channel, listingId: existingBinding.listingId, created: false, mappedFromLegacy: false });
      continue;
    }

    let channel = channels.find((candidate) => candidate.name === room.legacyName);
    let created = false;
    if (!channel && request.createMissing) {
      const raw = await runBuzz(connection, ["channels", "create", "--name", room.legacyName, "--type", "stream", "--visibility", "private"]);
      const createdChannels = channelsFrom(Array.isArray(raw) ? raw : [raw]);
      const rawRecord = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
      channel = createdChannels[0] ?? {
        id: firstString(rawRecord, ["id", "channel_id", "channelId"]),
        name: room.legacyName,
        description: room.description,
      };
      if (!channel.id) throw new Error(`BUZZ created ${room.displayName} but did not return its channel identifier.`);
      channels.push(channel);
      created = true;
    }
    if (!channel) continue;

    const now = new Date().toISOString();
    const binding: BuzzStoryRoomBinding = {
      version: BUZZ_STORY_ROOM_BINDING_VERSION,
      projectId: request.projectId,
      roomId: room.id,
      channelId: channel.id,
      listingId: randomUUID(),
      lastKnownName: safeRoomName(channel.name),
      createdAt: now,
      updatedAt: now,
    };
    nextBindings.push(binding);
    changed = true;
    resolved.push({ roomId: room.id, displayName: room.displayName, channel, listingId: binding.listingId, created, mappedFromLegacy: !created });
  }

  if (changed) await writeBindings(normalizeBuzzStoryRoomBindings(nextBindings));
  return {
    ok: true,
    rooms: resolved,
    mappedCount: resolved.length,
    requestedCount: request.rooms.length,
    message: resolved.length === request.rooms.length
      ? "Private Story Room identity is mapped by immutable BUZZ channel id. Human-facing names can change without rebinding the project."
      : "No matching private Story Room exists yet. Create it when you are ready; PlotPickle will bind the resulting BUZZ channel id before using it.",
  };
}

async function handle(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (request.method === "POST" && url.pathname === API) {
    sendJson(response, 200, await resolveRooms(await readBody(request)));
    return;
  }
  sendJson(response, 404, { ok: false, message: "Story Room identity operation not found." });
}

export function buzzStoryRoomIdentityGateway(): Plugin {
  return {
    name: "plotpickle-buzz-story-room-identity-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const rawUrl = request.url;
        if (!rawUrl) { next(); return; }
        let url: URL;
        try { url = new URL(rawUrl, "http://127.0.0.1"); } catch { next(); return; }
        if (!url.pathname.startsWith(API)) { next(); return; }
        if (!isLocalRequest(request)) {
          sendJson(response, 403, { ok: false, message: "Story Room identity controls are available only from the local PlotPickle application." });
          return;
        }
        void handle(request, response, url).catch((error) => sendJson(response, 500, { ok: false, message: safeError(error) }));
      });
    },
  };
}
