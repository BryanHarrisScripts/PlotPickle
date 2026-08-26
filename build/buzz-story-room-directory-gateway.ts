import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { verifyNostrEventSignature } from "../core/buzz/nostr-event-verification.mjs";
import { BUZZ_COMMUNITY_CHANNELS } from "../lib/buzz/buzz-guildhall";
import {
  normalizeStoryRoomAccessDecision,
  normalizeStoryRoomAccessRequest,
  normalizeStoryRoomDirectoryAnnouncement,
  parseStoryRoomAccessDecision,
  parseStoryRoomAccessRequest,
  parseStoryRoomDirectoryAnnouncement,
  serializeStoryRoomAccessDecision,
  serializeStoryRoomAccessRequest,
  serializeStoryRoomDirectoryAnnouncement,
  STORY_ROOM_ACCESS_DECISION_MARKER,
  STORY_ROOM_ACCESS_REQUEST_MARKER,
  STORY_ROOM_DIRECTORY_MARKER,
  STORY_ROOM_DIRECTORY_VERSION,
  type StoryRoomAccessDecision,
  type StoryRoomAccessRequest,
  type StoryRoomDirectoryAnnouncement,
  type StoryRoomDirectoryListing,
} from "../lib/buzz/story-room-directory";
import { normalizeBuzzStoryRoomBindings } from "../lib/buzz/story-room-identity";
import { publicKeyFromPrivateKey } from "./buzz-key-identity";
import { redactBuzzDiagnostic } from "./buzz-cli-failure";
import { resolveBuzzCliExecutable } from "./buzz-desktop-discovery";
import { isLocalRequest, readBody, sendJson, validChannelId } from "./buzz-story-room-access-gateway";
import { assertBuzzStoryRoomOwner } from "./buzz-story-room-owner-authority";
import { readCredentialJson } from "./local-credentials";
import { currentProfileRequestContext } from "./profile-request-context";

const API = "/api/local-buzz/story-room-directory";
const CONNECTION_FILE = "buzz-connection.json";
const BINDINGS_OBJECT_ID = "story-room-bindings-v1";
const MAX_COMMAND_OUTPUT = 4 * 1024 * 1024;
const MAX_DIRECTORY_MESSAGES = 120;
const MAX_DM_MESSAGES = 80;
const REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
type BuzzChannel = { id: string; name: string; archived: boolean };
type BuzzDm = { id: string; participants: string[] };
type SignedMessage = {
  id: string;
  pubkey: string;
  sig: string;
  content: string;
  created_at: number;
  kind: number;
  tags: string[][];
};
type RequestState = {
  request: StoryRoomAccessRequest;
  decision: StoryRoomAccessDecision | null;
  status: "pending" | "approved" | "declined" | "revoked" | "expired";
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safeError(error: unknown) {
  return redactBuzzDiagnostic(error instanceof Error ? error.message : "Story Rooms Directory is unavailable.").slice(0, 700);
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
  if (!validConnection(value)
    || value.verificationVersion !== 2
    || !value.verifiedAt
    || !value.privateKey) {
    throw new Error("Verify your Human BUZZ identity before using the Story Rooms Directory.");
  }
  const pubkey = publicKeyFromPrivateKey(value.privateKey);
  if (!/^[a-f0-9]{64}$/.test(pubkey)) throw new Error("The verified Human BUZZ identity could not be resolved.");
  return { connection: value, pubkey };
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
    const finish = (error?: Error, result?: CommandResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(result as CommandResult);
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error("BUZZ CLI did not finish within the allowed time."));
    }, 45_000);
    const collect = (target: Buffer[], chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes <= MAX_COMMAND_OUTPUT) target.push(chunk);
      else {
        child.kill("SIGKILL");
        finish(new Error("BUZZ CLI returned too much output."));
      }
    };
    child.stdout.on("data", (chunk: Buffer) => collect(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => collect(stderr, chunk));
    child.once("error", () => finish(new Error("BUZZ CLI is not installed or could not start.")));
    child.once("close", (code) => {
      const result = {
        stdout: Buffer.concat(stdout).toString("utf8").trim(),
        stderr: Buffer.concat(stderr).toString("utf8").trim(),
        code: code ?? 1,
      };
      if (result.code !== 0) finish(new Error(result.stderr || result.stdout || `BUZZ CLI exited with code ${result.code}.`));
      else finish(undefined, result);
    });
  });
}

async function runBuzz(connection: BuzzConnection, args: string[]) {
  const resolution = await resolveBuzzCliExecutable(connection.cliPath);
  const result = await command(resolution.executable, args, {
    BUZZ_RELAY_URL: relayHttpUrl(connection.relayUrl),
    BUZZ_PRIVATE_KEY: connection.privateKey,
  });
  try {
    return JSON.parse(result.stdout || "null") as unknown;
  } catch (error) {
    throw new Error(`BUZZ CLI returned invalid JSON: ${error instanceof Error ? error.message : "parse failure"}`);
  }
}

function array(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const item = value as Record<string, unknown>;
  for (const key of ["channels", "dms", "messages", "items", "data", "results"]) {
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
  return array(value).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const item = entry as Record<string, unknown>;
    const id = firstString(item, ["channel_id", "id", "channelId", "uuid"]);
    const name = firstString(item, ["name", "title", "slug"]);
    return id && name ? [{ id, name, archived: item.archived === true }] : [];
  });
}

function dmsFrom(value: unknown): BuzzDm[] {
  return array(value).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const item = entry as Record<string, unknown>;
    const id = firstString(item, ["dm_id", "channel_id", "id", "channelId"]);
    const participants = Array.isArray(item.participants)
      ? item.participants.filter((candidate): candidate is string => typeof candidate === "string" && /^[a-f0-9]{64}$/i.test(candidate)).map((candidate) => candidate.toLowerCase())
      : [];
    return id ? [{ id, participants }] : [];
  });
}

function signedMessages(value: unknown): SignedMessage[] {
  return array(value).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const item = entry as Record<string, unknown>;
    const candidate = {
      id: text(item.id).toLowerCase(),
      pubkey: text(item.pubkey).toLowerCase(),
      sig: text(item.sig).toLowerCase(),
      content: typeof item.content === "string" ? item.content : "",
      created_at: Number(item.created_at ?? item.createdAt),
      kind: Number(item.kind),
      tags: Array.isArray(item.tags) ? item.tags as string[][] : [],
    };
    const verification = verifyNostrEventSignature(candidate);
    return verification.valid ? [candidate] : [];
  });
}

async function greatHall(connection: BuzzConnection) {
  const definition = BUZZ_COMMUNITY_CHANNELS.find((room) => room.id === "great-hall");
  if (!definition) throw new Error("PlotPickle Great Hall configuration is unavailable.");
  const channels = channelsFrom(await runBuzz(connection, ["channels", "search", "--query", definition.name, "--exact"]));
  const channel = channels.find((candidate) => candidate.name === definition.name && !candidate.archived);
  if (!channel) throw new Error("Prepare the PlotPickle Great Hall before using the Story Rooms Directory.");
  return channel;
}

async function sendMessage(connection: BuzzConnection, channelId: string, content: string) {
  await runBuzz(connection, ["messages", "send", "--channel", channelId, "--content", content]);
}

async function directoryState(connection: BuzzConnection) {
  const hall = await greatHall(connection);
  const messages = signedMessages(await runBuzz(connection, ["messages", "get", "--channel", hall.id, "--limit", String(MAX_DIRECTORY_MESSAGES)]));
  const latest = new Map<string, { eventAt: number; announcement: StoryRoomDirectoryAnnouncement }>();
  let invalidMarkedEvents = 0;
  for (const message of messages) {
    if (!message.content.startsWith(STORY_ROOM_DIRECTORY_MARKER)) continue;
    let announcement: StoryRoomDirectoryAnnouncement;
    try {
      const parsed = parseStoryRoomDirectoryAnnouncement(message.content);
      if (!parsed) continue;
      announcement = parsed;
    } catch {
      invalidMarkedEvents += 1;
      continue;
    }
    if (announcement.ownerPublicKey !== message.pubkey) {
      invalidMarkedEvents += 1;
      continue;
    }
    const previous = latest.get(announcement.listingId);
    if (!previous || message.created_at >= previous.eventAt) latest.set(announcement.listingId, { eventAt: message.created_at, announcement });
  }
  const listings = [...latest.values()]
    .flatMap(({ announcement }) => announcement.type === "listing" ? [announcement] : [])
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  return { listings, invalidMarkedEvents };
}

function deterministicRequestId(listingId: string, requesterPublicKey: string) {
  return `sra_${createHash("sha256").update(`${listingId}:${requesterPublicKey}`).digest("hex").slice(0, 32)}`;
}

async function dmWith(connection: BuzzConnection, participant: string) {
  const opened = await runBuzz(connection, ["dms", "open", "--pubkey", participant]);
  if (!opened || typeof opened !== "object" || Array.isArray(opened)) throw new Error("BUZZ did not return the private request route.");
  const id = firstString(opened as Record<string, unknown>, ["dm_id", "channel_id", "id"]);
  if (!id) throw new Error("BUZZ opened the private request route but did not return its identifier.");
  return id;
}

async function requestState(connection: BuzzConnection, dmId: string, requestId: string, listingId: string) {
  const messages = signedMessages(await runBuzz(connection, ["messages", "get", "--channel", dmId, "--limit", String(MAX_DM_MESSAGES)]));
  let request: StoryRoomAccessRequest | null = null;
  let requestEventAt = -1;
  let decision: StoryRoomAccessDecision | null = null;
  let decisionEventAt = -1;
  for (const message of messages) {
    if (message.content.startsWith(STORY_ROOM_ACCESS_REQUEST_MARKER)) {
      let parsed: StoryRoomAccessRequest;
      try {
        const value = parseStoryRoomAccessRequest(message.content);
        if (!value) continue;
        parsed = value;
      } catch {
        continue;
      }
      if (parsed.requestId === requestId && parsed.listingId === listingId && parsed.requesterPublicKey === message.pubkey && message.created_at >= requestEventAt) {
        request = parsed;
        requestEventAt = message.created_at;
      }
    }
    if (message.content.startsWith(STORY_ROOM_ACCESS_DECISION_MARKER)) {
      let parsed: StoryRoomAccessDecision;
      try {
        const value = parseStoryRoomAccessDecision(message.content);
        if (!value) continue;
        parsed = value;
      } catch {
        continue;
      }
      if (parsed.requestId === requestId && parsed.listingId === listingId && parsed.ownerPublicKey === message.pubkey && message.created_at >= decisionEventAt) {
        decision = parsed;
        decisionEventAt = message.created_at;
      }
    }
  }
  if (!request) return null;
  if (decision && decisionEventAt >= requestEventAt) return { request, decision, status: decision.status } satisfies RequestState;
  return {
    request,
    decision: null,
    status: Date.parse(request.expiresAt) <= Date.now() ? "expired" : "pending",
  } satisfies RequestState;
}

async function listDirectory() {
  const { connection, pubkey } = await verifiedConnection();
  const state = await directoryState(connection);
  return {
    ok: true,
    listings: state.listings,
    viewerPublicKey: pubkey,
    invalidMarkedEvents: state.invalidMarkedEvents,
    capabilities: { openMembership: false },
    message: state.listings.length ? `${state.listings.length} owner-approved Story Room listing${state.listings.length === 1 ? "" : "s"} available.` : "No Story Rooms are listed for discovery right now.",
  };
}

async function publishAnnouncement(body: Record<string, unknown>) {
  const { connection, pubkey } = await verifiedConnection();
  const announcement = normalizeStoryRoomDirectoryAnnouncement(body.announcement);
  if (announcement.ownerPublicKey !== pubkey) throw new Error("Only the verified Story Room owner may publish or close this directory listing.");
  if (announcement.type === "listing" && announcement.accessMode === "open") {
    throw new Error("Open Story Room admission remains capability-gated. Publish as Listed instead.");
  }
  const hall = await greatHall(connection);
  await sendMessage(connection, hall.id, serializeStoryRoomDirectoryAnnouncement(announcement));
  return { ok: true, announcement, message: announcement.type === "closed" ? "Story Room removed from public discovery." : "Owner-approved Story Room metadata published to the signed directory." };
}

async function requestAccess(body: Record<string, unknown>) {
  const { connection, pubkey } = await verifiedConnection();
  const listingId = text(body.listingId).toLowerCase();
  const ownerPublicKey = text(body.ownerPublicKey).toLowerCase();
  const state = await directoryState(connection);
  const listing = state.listings.find((candidate) => candidate.listingId === listingId && candidate.ownerPublicKey === ownerPublicKey);
  if (!listing || listing.accessMode !== "listed") throw new Error("That Story Room is no longer listed for access requests.");
  if (!listing.requestsOpen) throw new Error("That Story Room is listed, but new access requests are currently closed.");
  if (listing.ownerPublicKey === pubkey) throw new Error("You already own this Story Room.");
  const dmId = await dmWith(connection, listing.ownerPublicKey);
  const requestId = deterministicRequestId(listing.listingId, pubkey);
  const existing = await requestState(connection, dmId, requestId, listing.listingId);
  if (existing && existing.status !== "expired") return { ok: true, request: existing.request, status: existing.status, message: `Your Story Room access request is ${existing.status}.` };
  const now = new Date();
  const request = normalizeStoryRoomAccessRequest({
    version: STORY_ROOM_DIRECTORY_VERSION,
    type: "request",
    requestId,
    listingId: listing.listingId,
    ownerPublicKey: listing.ownerPublicKey,
    requesterPublicKey: pubkey,
    requestedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + REQUEST_TTL_MS).toISOString(),
  });
  await sendMessage(connection, dmId, serializeStoryRoomAccessRequest(request));
  return { ok: true, request, status: "pending", message: "Signed Request Access sent privately to the Story Room owner." };
}

async function mappedOwnerBinding(channelValue: unknown, listingIdValue: unknown, ownerPublicKey: string) {
  const channelId = validChannelId(channelValue);
  const listingId = text(listingIdValue).toLowerCase();
  const context = currentProfileRequestContext();
  if (!context) throw new Error("Unlock a PlotPickle Human profile before deciding Story Room access.");
  const saved = await context.privateStorage.readPrivateJson(context.authContext, { domain: "buzz", objectId: BINDINGS_OBJECT_ID });
  const binding = normalizeBuzzStoryRoomBindings(saved).find((candidate) => candidate.channelId === channelId && candidate.listingId === listingId && candidate.roomId === "story");
  if (!binding) throw new Error("The access request does not match this profile's immutable primary Story Room binding.");
  await assertBuzzStoryRoomOwner(binding.channelId, ownerPublicKey);
  return binding;
}

function memberPubkeys(value: unknown) {
  const source = Array.isArray(value) ? value : array(value);
  return source.flatMap((entry) => {
    if (typeof entry === "string" && /^[a-f0-9]{64}$/i.test(entry)) return [entry.toLowerCase()];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const pubkey = firstString(entry as Record<string, unknown>, ["pubkey", "public_key", "id"]).toLowerCase();
    return /^[a-f0-9]{64}$/.test(pubkey) ? [pubkey] : [];
  });
}

async function applyMembershipDecision(connection: BuzzConnection, channelId: string, requesterPublicKey: string, status: "approved" | "revoked") {
  const before = memberPubkeys(await runBuzz(connection, ["channels", "members", "--channel", channelId]));
  if (status === "approved" && !before.includes(requesterPublicKey)) {
    await runBuzz(connection, ["channels", "add-member", "--channel", channelId, "--pubkey", requesterPublicKey, "--role", "member"]);
  }
  if (status === "revoked" && before.includes(requesterPublicKey)) {
    await runBuzz(connection, ["channels", "remove-member", "--channel", channelId, "--pubkey", requesterPublicKey]);
  }
  const after = memberPubkeys(await runBuzz(connection, ["channels", "members", "--channel", channelId]));
  const expected = status === "approved";
  if (after.includes(requesterPublicKey) !== expected) throw new Error(`BUZZ did not confirm that Story Room access was ${status === "approved" ? "granted" : "revoked"}.`);
}

async function decideAccess(body: Record<string, unknown>) {
  const { connection, pubkey } = await verifiedConnection();
  const request = normalizeStoryRoomAccessRequest(body.request);
  if (request.ownerPublicKey !== pubkey) throw new Error("Only the verified Story Room owner may decide this access request.");
  const status = body.status === "approved" || body.status === "declined" || body.status === "revoked" ? body.status : "";
  if (!status) throw new Error("Choose Approve, Decline, or Revoke for this Story Room request.");
  const binding = await mappedOwnerBinding(body.channel, request.listingId, pubkey);
  const dmId = await dmWith(connection, request.requesterPublicKey);
  const live = await requestState(connection, dmId, request.requestId, request.listingId);
  if (!live || live.request.requesterPublicKey !== request.requesterPublicKey || live.request.ownerPublicKey !== pubkey) {
    throw new Error("PlotPickle could not verify the requester's signed BUZZ access request.");
  }
  if (status === "approved" && Date.parse(live.request.expiresAt) <= Date.now()) throw new Error("This Story Room access request has expired. Ask the requester to submit it again.");
  if (status === "approved" || status === "revoked") await applyMembershipDecision(connection, binding.channelId, request.requesterPublicKey, status);
  const decision = normalizeStoryRoomAccessDecision({
    version: STORY_ROOM_DIRECTORY_VERSION,
    type: "decision",
    requestId: request.requestId,
    listingId: request.listingId,
    ownerPublicKey: pubkey,
    requesterPublicKey: request.requesterPublicKey,
    status,
    decidedAt: new Date().toISOString(),
  });
  await sendMessage(connection, dmId, serializeStoryRoomAccessDecision(decision));
  return { ok: true, decision, status, message: status === "approved" ? "BUZZ confirmed membership before PlotPickle recorded approval." : status === "revoked" ? "BUZZ confirmed Story Room access was revoked." : "Access request declined. No Story Room membership was granted." };
}

async function ownerRequests(channelValue: unknown) {
  const { connection, pubkey } = await verifiedConnection();
  const channelId = validChannelId(channelValue);
  const context = currentProfileRequestContext();
  if (!context) throw new Error("Unlock a PlotPickle Human profile before reviewing Story Room requests.");
  const saved = await context.privateStorage.readPrivateJson(context.authContext, { domain: "buzz", objectId: BINDINGS_OBJECT_ID });
  const binding = normalizeBuzzStoryRoomBindings(saved).find((candidate) => candidate.channelId === channelId && candidate.roomId === "story");
  if (!binding) throw new Error("That channel is not this profile's mapped primary Story Room.");
  await assertBuzzStoryRoomOwner(binding.channelId, pubkey);
  const dms = dmsFrom(await runBuzz(connection, ["dms", "list", "--limit", "40"])).slice(0, 24);
  const states: RequestState[] = [];
  for (const dm of dms) {
    const messages = signedMessages(await runBuzz(connection, ["messages", "get", "--channel", dm.id, "--limit", String(MAX_DM_MESSAGES)]));
    const requests = new Map<string, StoryRoomAccessRequest>();
    const decisions = new Map<string, StoryRoomAccessDecision>();
    for (const message of messages) {
      if (message.content.startsWith(STORY_ROOM_ACCESS_REQUEST_MARKER)) {
        try {
          const request = parseStoryRoomAccessRequest(message.content);
          if (request && request.listingId === binding.listingId && request.ownerPublicKey === pubkey && request.requesterPublicKey === message.pubkey) requests.set(request.requestId, request);
        } catch {
          // Invalid marked events are ignored but never treated as authority.
        }
      }
      if (message.content.startsWith(STORY_ROOM_ACCESS_DECISION_MARKER)) {
        try {
          const decision = parseStoryRoomAccessDecision(message.content);
          if (decision && decision.listingId === binding.listingId && decision.ownerPublicKey === pubkey && message.pubkey === pubkey) decisions.set(decision.requestId, decision);
        } catch {
          // Invalid marked events are ignored but never treated as authority.
        }
      }
    }
    for (const request of requests.values()) {
      const decision = decisions.get(request.requestId) ?? null;
      states.push({
        request,
        decision,
        status: decision?.status ?? (Date.parse(request.expiresAt) <= Date.now() ? "expired" : "pending"),
      });
    }
  }
  states.sort((left, right) => Date.parse(right.request.requestedAt) - Date.parse(left.request.requestedAt));
  return { ok: true, requests: states, listingId: binding.listingId, message: states.length ? `${states.length} Story Room access request${states.length === 1 ? "" : "s"} found.` : "No Story Room access requests yet." };
}

async function handle(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (request.method === "GET" && url.pathname === API && url.searchParams.get("ownerRequests") === "1") {
    sendJson(response, 200, await ownerRequests(url.searchParams.get("channel")));
    return;
  }
  if (request.method === "GET" && url.pathname === API) {
    sendJson(response, 200, await listDirectory());
    return;
  }
  if (request.method === "POST" && url.pathname === API) {
    const body = await readBody(request);
    if (body.action === "publish") sendJson(response, 200, await publishAnnouncement(body));
    else if (body.action === "request") sendJson(response, 200, await requestAccess(body));
    else if (body.action === "decide") sendJson(response, 200, await decideAccess(body));
    else sendJson(response, 400, { ok: false, message: "Choose a supported Story Rooms Directory action." });
    return;
  }
  sendJson(response, 404, { ok: false, message: "Story Rooms Directory operation not found." });
}

export function buzzStoryRoomDirectoryGateway(): Plugin {
  return {
    name: "plotpickle-buzz-story-room-directory-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const rawUrl = request.url;
        if (!rawUrl) { next(); return; }
        let url: URL;
        try { url = new URL(rawUrl, "http://127.0.0.1"); } catch { next(); return; }
        if (url.pathname !== API) { next(); return; }
        if (!isLocalRequest(request)) {
          sendJson(response, 403, { ok: false, message: "Story Rooms Directory controls are available only from the local PlotPickle application." });
          return;
        }
        void handle(request, response, url).catch((error) => sendJson(response, 500, { ok: false, message: safeError(error) }));
      });
    },
  };
}
