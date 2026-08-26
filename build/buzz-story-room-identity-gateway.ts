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

type StoryRoomReply = {
  statusCode: number;
  body: Record<string, unknown>;
};

function writeStoryRoomReply(response: ServerResponse, reply: StoryRoomReply) {
  response.statusCode = reply.statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(reply.body));
}

function storyText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseStoryRoomName(value: unknown, label: string) {
  const room = storyText(value).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{2,71}$/.test(room)) throw new Error(`${label} is not a valid BUZZ Story Room name.`);
  return room;
}

function parseStoryRoomId(value: unknown): BuzzStoryRoomId {
  const roomId = storyText(value) as BuzzStoryRoomId;
  if (!BUZZ_STORY_ROOMS.some((room) => room.id === roomId)) throw new Error("Choose a valid PlotPickle Story Room.");
  return roomId;
}

async function readVerifiedStoryRoomConnection() {
  const value = await readCredentialJson<unknown>(CONNECTION_FILE);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Verify BUZZ before resolving private Story Room identity.");
  }
  const item = value as Partial<BuzzConnection>;
  const valid = item.version === 1
    && (item.mode === "existing-relay" || item.mode === "managed")
    && typeof item.relayUrl === "string"
    && typeof item.community === "string"
    && typeof item.identityLabel === "string"
    && typeof item.cliPath === "string"
    && typeof item.privateKey === "string"
    && typeof item.verifiedAt === "string"
    && item.verificationVersion === 2
    && Boolean(item.verifiedAt)
    && Boolean(item.privateKey);
  if (!valid) throw new Error("Verify BUZZ before resolving private Story Room identity.");
  return item as BuzzConnection;
}

function runStoryRoomCommand(executable: string, args: string[], env: NodeJS.ProcessEnv) {
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

    child.stdout.on("data", (chunk: Buffer) => {
      if (settled) return;
      bytes += chunk.length;
      if (bytes > MAX_COMMAND_OUTPUT) {
        settled = true;
        clearTimeout(timer);
        child.kill("SIGKILL");
        reject(new Error("BUZZ CLI returned too much output."));
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (settled) return;
      bytes += chunk.length;
      if (bytes > MAX_COMMAND_OUTPUT) {
        settled = true;
        clearTimeout(timer);
        child.kill("SIGKILL");
        reject(new Error("BUZZ CLI returned too much output."));
        return;
      }
      stderr.push(chunk);
    });
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

async function runStoryRoomBuzz(connection: BuzzConnection, args: string[]) {
  const relay = new URL(connection.relayUrl);
  if (relay.protocol === "ws:") relay.protocol = "http:";
  if (relay.protocol === "wss:") relay.protocol = "https:";
  const resolution = await resolveBuzzCliExecutable(connection.cliPath);
  const result = await runStoryRoomCommand(resolution.executable, args, {
    BUZZ_RELAY_URL: relay.toString().replace(/\/$/, ""),
    BUZZ_PRIVATE_KEY: connection.privateKey,
  });
  return JSON.parse(result.stdout || "null") as unknown;
}

function decodeStoryRoomChannels(value: unknown): BuzzChannel[] {
  let entries: unknown[] = [];
  if (Array.isArray(value)) entries = value;
  else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["channels", "items", "data", "results"]) {
      if (Array.isArray(record[key])) {
        entries = record[key] as unknown[];
        break;
      }
    }
    if (!entries.length) entries = [value];
  }

  const channels: BuzzChannel[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const item = entry as Record<string, unknown>;
    let id = "";
    let name = "";
    let description = "";
    for (const key of ["channel_id", "id", "channelId", "uuid"]) {
      const candidate = item[key];
      if (typeof candidate === "string" && candidate.trim()) { id = candidate.trim(); break; }
    }
    for (const key of ["name", "title", "slug"]) {
      const candidate = item[key];
      if (typeof candidate === "string" && candidate.trim()) { name = candidate.trim(); break; }
    }
    for (const key of ["description", "purpose", "topic"]) {
      const candidate = item[key];
      if (typeof candidate === "string" && candidate.trim()) { description = candidate.trim(); break; }
    }
    if (id && name) channels.push({ id, name, description });
  }
  return channels;
}

function parseStoryRoomRequest(body: Record<string, unknown>) {
  const projectId = storyText(body.projectId);
  if (!projectId || projectId.length > 240) throw new Error("Story Room identity requires a stable PlotPickle project id.");
  if (!Array.isArray(body.rooms) || !body.rooms.length || body.rooms.length > BUZZ_STORY_ROOMS.length) {
    throw new Error("Story Room identity requires the bounded PlotPickle room definitions.");
  }
  const rooms = body.rooms.map((value): RequestedRoom => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("A Story Room identity definition is invalid.");
    const item = value as Record<string, unknown>;
    return {
      id: parseStoryRoomId(item.id),
      legacyName: parseStoryRoomName(item.legacyName, "Legacy room name"),
      displayName: parseStoryRoomName(item.displayName, "Display room name"),
      description: storyText(item.description).slice(0, 300),
    };
  });
  if (new Set(rooms.map((room) => room.id)).size !== rooms.length) throw new Error("Story Room identity definitions contain duplicate room ids.");
  return { projectId, rooms, createMissing: body.createMissing === true };
}

function activeStoryRoomProfile() {
  const context = currentProfileRequestContext();
  if (!context) throw new Error("Unlock a PlotPickle Human profile before resolving Story Room identity.");
  return context;
}

async function loadStoryRoomBindings() {
  const context = activeStoryRoomProfile();
  const value = await context.privateStorage.readPrivateJson(context.authContext, { domain: "buzz", objectId: BINDINGS_OBJECT_ID });
  return normalizeBuzzStoryRoomBindings(value);
}

async function saveStoryRoomBindings(bindings: readonly BuzzStoryRoomBinding[]) {
  const context = activeStoryRoomProfile();
  await context.privateStorage.writePrivateJson(context.authContext, {
    domain: "buzz",
    objectId: BINDINGS_OBJECT_ID,
    value: bindings,
  });
}

async function resolveStoryRoomMappings(body: Record<string, unknown>) {
  const request = parseStoryRoomRequest(body);
  const connection = await readVerifiedStoryRoomConnection();
  const [bindings, rawChannels] = await Promise.all([
    loadStoryRoomBindings(),
    runStoryRoomBuzz(connection, ["--format", "compact", "channels", "list"]),
  ]);
  const channels = decodeStoryRoomChannels(rawChannels);
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
        nextBindings[index] = {
          ...existingBinding,
          lastKnownName: parseStoryRoomName(channel.name, "Stored room name"),
          updatedAt: new Date().toISOString(),
        };
        changed = true;
      }
      resolved.push({
        roomId: room.id,
        displayName: room.displayName,
        channel,
        listingId: existingBinding.listingId,
        created: false,
        mappedFromLegacy: false,
      });
      continue;
    }

    let channel = channels.find((candidate) => candidate.name === room.legacyName);
    let created = false;
    if (!channel && request.createMissing) {
      const raw = await runStoryRoomBuzz(connection, [
        "channels", "create", "--name", room.legacyName, "--type", "stream", "--visibility", "private",
      ]);
      channel = decodeStoryRoomChannels(Array.isArray(raw) ? raw : [raw])[0];
      if (!channel && raw && typeof raw === "object" && !Array.isArray(raw)) {
        const record = raw as Record<string, unknown>;
        let id = "";
        for (const key of ["id", "channel_id", "channelId"]) {
          const candidate = record[key];
          if (typeof candidate === "string" && candidate.trim()) { id = candidate.trim(); break; }
        }
        if (id) channel = { id, name: room.legacyName, description: room.description };
      }
      if (!channel?.id) throw new Error(`BUZZ created ${room.displayName} but did not return its channel identifier.`);
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
      lastKnownName: parseStoryRoomName(channel.name, "Stored room name"),
      createdAt: now,
      updatedAt: now,
    };
    nextBindings.push(binding);
    changed = true;
    resolved.push({
      roomId: room.id,
      displayName: room.displayName,
      channel,
      listingId: binding.listingId,
      created,
      mappedFromLegacy: !created,
    });
  }

  if (changed) await saveStoryRoomBindings(normalizeBuzzStoryRoomBindings(nextBindings));
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

async function serveStoryRoomIdentity(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (request.method !== "POST" || url.pathname !== API) {
    writeStoryRoomReply(response, { statusCode: 404, body: { ok: false, message: "Story Room identity operation not found." } });
    return;
  }

  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_BODY) throw new Error("The Story Room identity request is too large.");
    chunks.push(buffer);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("The Story Room identity request is invalid.");
  writeStoryRoomReply(response, {
    statusCode: 200,
    body: await resolveStoryRoomMappings(parsed as Record<string, unknown>),
  });
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

        const remoteAddress = request.socket.remoteAddress;
        const loopback = remoteAddress === "127.0.0.1" || remoteAddress === "::1" || remoteAddress === "::ffff:127.0.0.1";
        const host = request.headers.host;
        let localRequest = false;
        if (loopback && host) {
          try {
            const hostUrl = new URL(`http://${host}`);
            const localHost = ["127.0.0.1", "localhost", "[::1]"].includes(hostUrl.hostname);
            const origin = request.headers.origin;
            localRequest = localHost && (!origin || new URL(origin).host === hostUrl.host);
          } catch {
            localRequest = false;
          }
        }
        if (!localRequest) {
          writeStoryRoomReply(response, {
            statusCode: 403,
            body: { ok: false, message: "Story Room identity controls are available only from the local PlotPickle application." },
          });
          return;
        }

        void serveStoryRoomIdentity(request, response, url).catch((error) => {
          const message = (error instanceof Error ? error.message : "Story Room identity is unavailable.")
            .replace(/nsec1[a-z0-9]+/gi, "[redacted-nsec]")
            .replace(/\b[a-f0-9]{64}\b/gi, "[redacted-secret]")
            .replace(/(password|secret|private[_ -]?key|api[_ -]?key|token)\s*[=:]\s*\S+/gi, "$1=[redacted]")
            .slice(0, 700);
          writeStoryRoomReply(response, { statusCode: 500, body: { ok: false, message } });
        });
      });
    },
  };
}
