import { spawn } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { BUZZ_GUILDHALL_ACTORS } from "../lib/buzz/buzz-guildhall";
import { BUZZ_STORY_ROOMS } from "../lib/buzz/buzz-story-room";
import { buzzChannelMemberPubkeys, buzzChannelMemberRows } from "../lib/buzz/membership/buzz-channel-members";
import { normalizeBuzzStoryRoomBindings } from "../lib/buzz/story-room-identity";
import { resolveBuzzCliExecutable } from "./buzz-desktop-discovery";
import { readCredentialJson } from "./local-credentials";
import { currentProfileRequestContext } from "./auth/profile-request-context";

const API = "/api/local-buzz/story-room-access";
const RESOLVE_API = `${API}/resolve`;
const CONNECTION_FILE = "buzz-connection.json";
const BINDINGS_OBJECT_ID = "story-room-bindings-v1";
const MAX_BODY = 64 * 1024;
const MAX_COMMAND_OUTPUT = 2 * 1024 * 1024;

export type BuzzConnection = {
  version: 1;
  mode: "existing-relay" | "managed";
  relayUrl: string;
  community: string;
  identityLabel: string;
  cliPath: string;
  privateKey: string;
  verifiedAt: string;
  verificationVersion?: 2;
  identityPubkey?: string;
  identityRole?: "human";
};
type CommandResult = { stdout: string; stderr: string; code: number };
type BuzzChannel = { id: string; name: string; description: string };
type BuzzMember = { pubkey: string; displayName: string; presence: string; updatedAt: string; role: string; isOwner: boolean };
type ResolvedHuman = { pubkey: string; displayName: string; kind: "human" };

function isLoopback(value: string | undefined) {
  return value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1";
}

export function isLocalRequest(request: IncomingMessage) {
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

export function sendJson(response: ServerResponse, statusCode: number, body: Record<string, unknown>) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

export async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_BODY) throw new Error("The Story Room access request is too large.");
    chunks.push(buffer);
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The Story Room access request is invalid.");
  return value as Record<string, unknown>;
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Story Room access is unavailable.";
  return message
    .replace(/nsec1[a-z0-9]+/gi, "[redacted-nsec]")
    .replace(/(password|secret|private[_ -]?key|api[_ -]?key|token)\s*[=:]\s*\S+/gi, "$1=[redacted]")
    .slice(0, 600);
}

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function validConnection(value: unknown): value is BuzzConnection {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Partial<BuzzConnection>;
  return item.version === 1 && (item.mode === "existing-relay" || item.mode === "managed")
    && typeof item.relayUrl === "string" && typeof item.community === "string"
    && typeof item.identityLabel === "string" && typeof item.cliPath === "string"
    && typeof item.privateKey === "string" && typeof item.verifiedAt === "string";
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

export async function runStoryRoomBuzz(connection: BuzzConnection, args: string[]) {
  if (!connection.privateKey) throw new Error("Authorize PlotPickle with your BUZZ identity before managing Story Room access.");
  const resolution = await resolveBuzzCliExecutable(connection.cliPath);
  const result = await command(resolution.executable, args, {
    BUZZ_RELAY_URL: relayHttpUrl(connection.relayUrl),
    BUZZ_PRIVATE_KEY: connection.privateKey,
  });
  const output = result.stdout || "null";
  return JSON.parse(output) as unknown;
}

export function storyRoomBuzzArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const item = value as Record<string, unknown>;
  for (const key of ["channels", "items", "data", "results", "users", "presence", "dms", "messages"]) if (Array.isArray(item[key])) return item[key] as unknown[];
  return [];
}
export function storyRoomBuzzFirstString(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) { const value = item[key]; if (typeof value === "string" && value.trim()) return value.trim(); }
  return "";
}
function storyRoomBuzzRecords(value: unknown) {
  const nested = storyRoomBuzzArray(value).filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry));
  if (nested.length) return nested;
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const item = value as Record<string, unknown>;
  return ["pubkey", "public_key", "publicKey", "display_name", "displayName", "name"].some((key) => key in item) ? [item] : [];
}
function channelsFrom(value: unknown): BuzzChannel[] {
  return storyRoomBuzzArray(value).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const item = entry as Record<string, unknown>;
    const id = storyRoomBuzzFirstString(item, ["channel_id", "id", "channelId", "uuid"]);
    const name = storyRoomBuzzFirstString(item, ["name", "title", "slug"]);
    return id && name ? [{ id, name, description: storyRoomBuzzFirstString(item, ["description", "purpose", "topic"]) }] : [];
  });
}
export function validChannelId(value: unknown) {
  const channel = text(value);
  if (!/^[A-Za-z0-9-]{8,128}$/.test(channel)) throw new Error("Choose a valid Story Room channel.");
  return channel;
}
function validPubkey(value: unknown) {
  const pubkey = text(value).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(pubkey)) throw new Error("Enter a valid BUZZ ID (public): 64 hexadecimal characters.");
  return pubkey;
}
export async function verifiedStoryRoomBuzzConnection() {
  const connection = await readConnection();
  if (!connection || connection.verificationVersion !== 2 || !connection.verifiedAt || !connection.privateKey) throw new Error("Verify BUZZ before managing Story Room access.");
  return connection;
}
function connectedHumanPubkey(connection: BuzzConnection) {
  if (connection.identityRole !== "human") throw new Error("Verify the Human BUZZ identity before managing Story Room access.");
  return validPubkey(connection.identityPubkey);
}
async function mappedStoryRoomChannelIds() {
  const context = currentProfileRequestContext();
  if (!context) return new Set<string>();
  const value = await context.privateStorage.readPrivateJson(context.authContext, { domain: "buzz", objectId: BINDINGS_OBJECT_ID });
  return new Set(normalizeBuzzStoryRoomBindings(value).map((binding) => binding.channelId));
}
async function storyRoom(connection: BuzzConnection, channelId: string) {
  const [channels, mappedChannelIds] = await Promise.all([
    runStoryRoomBuzz(connection, ["--format", "compact", "channels", "list"]).then(channelsFrom),
    mappedStoryRoomChannelIds(),
  ]);
  const channel = channels.find((item) => item.id === channelId);
  if (!channel) throw new Error("The Story Room is not available to this BUZZ identity.");
  if (mappedChannelIds.has(channel.id)) return channel;
  const suffixes = BUZZ_STORY_ROOMS.map((room) => `-${room.suffix}`);
  if (!suffixes.some((suffix) => channel.name.endsWith(suffix))) throw new Error("PlotPickle refused to manage membership for a non-Story-Room channel.");
  return channel;
}
function normalizedActorName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function profileLooksLikeAgent(profile: Record<string, unknown>, displayName: string) {
  const declared = storyRoomBuzzFirstString(profile, ["kind", "type", "role"]).toLowerCase();
  if (declared === "agent" || declared === "bot") return true;
  const normalized = normalizedActorName(displayName);
  return BUZZ_GUILDHALL_ACTORS.some((actor) => normalized === normalizedActorName(actor.displayName) || normalized === normalizedActorName(actor.id));
}
async function resolveHuman(connection: BuzzConnection, pubkeyValue: unknown): Promise<ResolvedHuman> {
  const pubkey = validPubkey(pubkeyValue);
  const raw = await runStoryRoomBuzz(connection, ["--format", "compact", "users", "get", "--pubkey", pubkey]);
  const profile = storyRoomBuzzRecords(raw).find((item) => storyRoomBuzzFirstString(item, ["pubkey", "public_key", "publicKey"]).toLowerCase() === pubkey);
  if (!profile) throw new Error("That BUZZ ID could not be resolved to a public BUZZ profile. No Story Room access was changed.");
  const displayName = storyRoomBuzzFirstString(profile, ["display_name", "displayName", "name", "username"]) || `${pubkey.slice(0, 10)}…${pubkey.slice(-6)}`;
  if (profileLooksLikeAgent(profile, displayName)) throw new Error("That BUZZ identity is an Agent/Bot identity. Add Humans through this control; Agent access uses the separate Agent/Story Bridge contract.");
  return { pubkey, displayName, kind: "human" };
}
function membershipRoleMap(value: unknown) {
  const roles = new Map<string, string>();
  for (const entry of buzzChannelMemberRows(value)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const item = entry as Record<string, unknown>;
    const pubkey = text(item.pubkey).toLowerCase();
    if (/^[a-f0-9]{64}$/.test(pubkey)) roles.set(pubkey, text(item.role).toLowerCase());
  }
  return roles;
}
async function assertCurrentHumanOwnsRoom(connection: BuzzConnection, channel: BuzzChannel) {
  const ownerPubkey = connectedHumanPubkey(connection);
  const membership = await runStoryRoomBuzz(connection, ["channels", "members", "--channel", channel.id]);
  if (membershipRoleMap(membership).get(ownerPubkey) !== "owner") {
    throw new Error("Only the verified BUZZ Story Room owner can change Human access.");
  }
  return ownerPubkey;
}
async function loadMembers(connection: BuzzConnection, channel: BuzzChannel): Promise<BuzzMember[]> {
  const membershipRaw = await runStoryRoomBuzz(connection, ["channels", "members", "--channel", channel.id]);
  const pubkeys = buzzChannelMemberPubkeys(membershipRaw);
  if (!pubkeys.length) return [];
  const roles = membershipRoleMap(membershipRaw);
  const userArgs = ["--format", "compact", "users", "get"];
  for (const pubkey of pubkeys) userArgs.push("--pubkey", pubkey);
  const [profilesRaw, presenceRaw] = await Promise.all([
    runStoryRoomBuzz(connection, userArgs),
    runStoryRoomBuzz(connection, ["users", "presence", "--pubkeys", pubkeys.join(",")]).catch(() => []),
  ]);
  const profiles = storyRoomBuzzRecords(profilesRaw);
  const presence = storyRoomBuzzArray(presenceRaw).filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry));
  return pubkeys.map((pubkey) => {
    const profile = profiles.find((item) => storyRoomBuzzFirstString(item, ["pubkey", "public_key", "publicKey"]).toLowerCase() === pubkey);
    const state = presence.find((item) => storyRoomBuzzFirstString(item, ["pubkey"]).toLowerCase() === pubkey);
    const rawUpdated = state?.updated_at ?? state?.updatedAt;
    const role = roles.get(pubkey) || "member";
    return {
      pubkey,
      displayName: profile ? storyRoomBuzzFirstString(profile, ["display_name", "displayName", "name"]) || `${pubkey.slice(0, 8)}…` : `${pubkey.slice(0, 8)}…`,
      presence: state ? storyRoomBuzzFirstString(state, ["status"]) || "offline" : "offline",
      updatedAt: typeof rawUpdated === "number" ? new Date(rawUpdated * 1000).toISOString() : text(rawUpdated),
      role,
      isOwner: role === "owner",
    };
  });
}

async function status(channelValue: unknown) {
  const connection = await verifiedStoryRoomBuzzConnection();
  const channel = await storyRoom(connection, validChannelId(channelValue));
  const members = await loadMembers(connection, channel);
  return { ok: true, channel, members, ownerPubkey: members.find((member) => member.isOwner)?.pubkey || "", message: "Story Room membership is current. BUZZ remains the access authority." };
}
async function resolveCandidate(pubkeyValue: unknown) {
  const connection = await verifiedStoryRoomBuzzConnection();
  const identity = await resolveHuman(connection, pubkeyValue);
  return { ok: true, identity, message: `BUZZ ID resolved as ${identity.displayName}. Review the public fingerprint before adding.` };
}
async function addMember(body: Record<string, unknown>) {
  const connection = await verifiedStoryRoomBuzzConnection();
  const channel = await storyRoom(connection, validChannelId(body.channel));
  const ownerPubkey = await assertCurrentHumanOwnsRoom(connection, channel);
  const identity = await resolveHuman(connection, body.pubkey);
  if (identity.pubkey === ownerPubkey) throw new Error("The Story Room owner already has access and cannot be added again.");
  await runStoryRoomBuzz(connection, ["channels", "add-member", "--channel", channel.id, "--pubkey", identity.pubkey, "--role", "member"]);
  return status(channel.id);
}
async function removeMember(body: Record<string, unknown>) {
  const connection = await verifiedStoryRoomBuzzConnection();
  const channel = await storyRoom(connection, validChannelId(body.channel));
  const ownerPubkey = await assertCurrentHumanOwnsRoom(connection, channel);
  const pubkey = validPubkey(body.pubkey);
  if (pubkey === ownerPubkey) throw new Error("The Story Room owner cannot remove their own ownership access.");
  await runStoryRoomBuzz(connection, ["channels", "remove-member", "--channel", channel.id, "--pubkey", pubkey]);
  return status(channel.id);
}

async function handle(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (request.method === "GET" && url.pathname === RESOLVE_API) {
    sendJson(response, 200, await resolveCandidate(url.searchParams.get("pubkey")));
    return;
  }
  if (request.method === "GET" && url.pathname === API) {
    sendJson(response, 200, await status(url.searchParams.get("channel")));
    return;
  }
  if (request.method === "POST" && url.pathname === API) {
    sendJson(response, 200, await addMember(await readBody(request)));
    return;
  }
  if (request.method === "DELETE" && url.pathname === API) {
    sendJson(response, 200, await removeMember(await readBody(request)));
    return;
  }
  sendJson(response, 404, { ok: false, message: "Story Room access operation not found." });
}

export function buzzStoryRoomAccessGateway(): Plugin {
  return {
    name: "plotpickle-buzz-story-room-access-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const rawUrl = request.url;
        if (!rawUrl) { next(); return; }
        let url: URL;
        try { url = new URL(rawUrl, "http://127.0.0.1"); } catch { next(); return; }
        if (!url.pathname.startsWith(API)) { next(); return; }
        if (!isLocalRequest(request)) {
          sendJson(response, 403, { ok: false, message: "Story Room access controls are available only from the local PlotPickle application." });
          return;
        }
        void handle(request, response, url).catch((error) => sendJson(response, 500, { ok: false, message: safeError(error) }));
      });
    },
  };
}
