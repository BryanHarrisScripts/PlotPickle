import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { verifyNostrEventSignature } from "../core/buzz/nostr-event-verification.mjs";
import { BUZZ_COMMUNITY_CHANNELS } from "../lib/buzz/buzz-guildhall";
import { buzzChannelMemberPubkeys } from "../lib/buzz/membership/buzz-channel-members";
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
} from "../lib/buzz/story-room-directory";
import { normalizeBuzzStoryRoomBindings } from "../lib/buzz/story-room-identity";
import { publicKeyFromPrivateKey } from "./buzz-key-identity";
import { redactBuzzDiagnostic } from "./buzz-cli-failure";
import {
  isLocalRequest,
  readBody,
  runStoryRoomBuzz,
  sendJson,
  storyRoomBuzzArray,
  storyRoomBuzzFirstString,
  validChannelId,
  verifiedStoryRoomBuzzConnection,
  type BuzzConnection,
} from "./buzz-story-room-access-gateway";
import { assertBuzzStoryRoomOwner } from "./buzz-story-room-owner-authority";
import { currentProfileRequestContext } from "./profile-request-context";

const API = "/api/local-buzz/story-room-directory";
const BINDINGS_OBJECT_ID = "story-room-bindings-v1";
const MAX_DIRECTORY_MESSAGES = 120;
const MAX_DM_MESSAGES = 80;
const REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

async function verifiedDirectoryConnection() {
  const connection = await verifiedStoryRoomBuzzConnection();
  const pubkey = publicKeyFromPrivateKey(connection.privateKey);
  if (!/^[a-f0-9]{64}$/.test(pubkey)) throw new Error("The verified Human BUZZ identity could not be resolved.");
  return { connection, pubkey };
}

function channelsFrom(value: unknown): BuzzChannel[] {
  return storyRoomBuzzArray(value).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const item = entry as Record<string, unknown>;
    const id = storyRoomBuzzFirstString(item, ["channel_id", "id", "channelId", "uuid"]);
    const name = storyRoomBuzzFirstString(item, ["name", "title", "slug"]);
    return id && name ? [{ id, name, archived: item.archived === true }] : [];
  });
}

function dmsFrom(value: unknown): BuzzDm[] {
  return storyRoomBuzzArray(value).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const item = entry as Record<string, unknown>;
    const id = storyRoomBuzzFirstString(item, ["dm_id", "channel_id", "id", "channelId"]);
    const participants = Array.isArray(item.participants)
      ? item.participants
        .filter((candidate): candidate is string => typeof candidate === "string" && /^[a-f0-9]{64}$/i.test(candidate))
        .map((candidate) => candidate.toLowerCase())
      : [];
    return id ? [{ id, participants }] : [];
  });
}

function signedMessages(value: unknown): SignedMessage[] {
  return storyRoomBuzzArray(value).flatMap((entry) => {
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
    return verifyNostrEventSignature(candidate).valid ? [candidate] : [];
  });
}

async function greatHall(connection: BuzzConnection) {
  const definition = BUZZ_COMMUNITY_CHANNELS.find((room) => room.id === "great-hall");
  if (!definition) throw new Error("PlotPickle Great Hall configuration is unavailable.");
  const channels = channelsFrom(await runStoryRoomBuzz(connection, ["channels", "search", "--query", definition.name, "--exact"]));
  const channel = channels.find((candidate) => candidate.name === definition.name && !candidate.archived);
  if (!channel) throw new Error("Prepare the PlotPickle Great Hall before using the Story Rooms Directory.");
  return channel;
}

async function sendMessage(connection: BuzzConnection, channelId: string, content: string) {
  await runStoryRoomBuzz(connection, ["messages", "send", "--channel", channelId, "--content", content]);
}

async function directoryState(connection: BuzzConnection) {
  const hall = await greatHall(connection);
  const messages = signedMessages(await runStoryRoomBuzz(connection, ["messages", "get", "--channel", hall.id, "--limit", String(MAX_DIRECTORY_MESSAGES)]));
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
  const opened = await runStoryRoomBuzz(connection, ["dms", "open", "--pubkey", participant]);
  if (!opened || typeof opened !== "object" || Array.isArray(opened)) throw new Error("BUZZ did not return the private request route.");
  const id = storyRoomBuzzFirstString(opened as Record<string, unknown>, ["dm_id", "channel_id", "id"]);
  if (!id) throw new Error("BUZZ opened the private request route but did not return its identifier.");
  return id;
}

async function requestState(connection: BuzzConnection, dmId: string, requestId: string, listingId: string) {
  const messages = signedMessages(await runStoryRoomBuzz(connection, ["messages", "get", "--channel", dmId, "--limit", String(MAX_DM_MESSAGES)]));
  let request: StoryRoomAccessRequest | null = null;
  let requestEventAt = -1;
  let decision: StoryRoomAccessDecision | null = null;
  let decisionEventAt = -1;
  let invalidMarkedEvents = 0;
  for (const message of messages) {
    if (message.content.startsWith(STORY_ROOM_ACCESS_REQUEST_MARKER)) {
      let parsed: StoryRoomAccessRequest;
      try {
        const value = parseStoryRoomAccessRequest(message.content);
        if (!value) continue;
        parsed = value;
      } catch {
        invalidMarkedEvents += 1;
        continue;
      }
      if (parsed.requestId === requestId
        && parsed.listingId === listingId
        && parsed.requesterPublicKey === message.pubkey
        && message.created_at >= requestEventAt) {
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
        invalidMarkedEvents += 1;
        continue;
      }
      if (parsed.requestId === requestId
        && parsed.listingId === listingId
        && parsed.ownerPublicKey === message.pubkey
        && message.created_at >= decisionEventAt) {
        decision = parsed;
        decisionEventAt = message.created_at;
      }
    }
  }
  if (!request) return null;
  const correlatedDecision = decision
    && decision.requesterPublicKey === request.requesterPublicKey
    && decision.ownerPublicKey === request.ownerPublicKey
    && decisionEventAt >= requestEventAt
    ? decision
    : null;
  if (correlatedDecision) return { request, decision: correlatedDecision, status: correlatedDecision.status, invalidMarkedEvents };
  return {
    request,
    decision: null,
    status: Date.parse(request.expiresAt) <= Date.now() ? "expired" : "pending",
    invalidMarkedEvents,
  };
}

async function listDirectory() {
  const { connection, pubkey } = await verifiedDirectoryConnection();
  const state = await directoryState(connection);
  return {
    ok: true,
    listings: state.listings,
    viewerPublicKey: pubkey,
    invalidMarkedEvents: state.invalidMarkedEvents,
    capabilities: { openMembership: false, federatedPublication: false },
    message: state.listings.length
      ? `${state.listings.length} owner-approved Story Room listing${state.listings.length === 1 ? "" : "s"} available.`
      : "No Story Rooms are listed for discovery right now.",
  };
}

async function publishAnnouncement(body: Record<string, unknown>) {
  const { connection, pubkey } = await verifiedDirectoryConnection();
  const announcement = normalizeStoryRoomDirectoryAnnouncement(body.announcement);
  if (announcement.ownerPublicKey !== pubkey) throw new Error("Only the verified Story Room owner may publish or close this directory listing.");
  if (announcement.type === "listing" && announcement.accessMode === "open") {
    throw new Error("Open Story Room admission remains capability-gated. Publish as Listed instead.");
  }
  const hall = await greatHall(connection);
  await sendMessage(connection, hall.id, serializeStoryRoomDirectoryAnnouncement(announcement));
  return {
    ok: true,
    announcement,
    message: announcement.type === "closed"
      ? "Story Room removed from public discovery."
      : "Owner-approved Story Room metadata published to the signed directory.",
  };
}

async function requestAccess(body: Record<string, unknown>) {
  const { connection, pubkey } = await verifiedDirectoryConnection();
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
  if (existing && existing.status !== "expired") {
    return { ok: true, request: existing.request, status: existing.status, message: `Your Story Room access request is ${existing.status}.` };
  }
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
  return buzzChannelMemberPubkeys(value).map((pubkey) => pubkey.toLowerCase());
}

async function applyMembershipDecision(connection: BuzzConnection, channelId: string, requesterPublicKey: string, status: "approved" | "revoked") {
  const before = memberPubkeys(await runStoryRoomBuzz(connection, ["channels", "members", "--channel", channelId]));
  if (status === "approved" && !before.includes(requesterPublicKey)) {
    await runStoryRoomBuzz(connection, ["channels", "add-member", "--channel", channelId, "--pubkey", requesterPublicKey, "--role", "member"]);
  }
  if (status === "revoked" && before.includes(requesterPublicKey)) {
    await runStoryRoomBuzz(connection, ["channels", "remove-member", "--channel", channelId, "--pubkey", requesterPublicKey]);
  }
  const after = memberPubkeys(await runStoryRoomBuzz(connection, ["channels", "members", "--channel", channelId]));
  const expected = status === "approved";
  if (after.includes(requesterPublicKey) !== expected) {
    throw new Error(`BUZZ did not confirm that Story Room access was ${status === "approved" ? "granted" : "revoked"}.`);
  }
}

async function decideAccess(body: Record<string, unknown>) {
  const { connection, pubkey } = await verifiedDirectoryConnection();
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
  if (status === "approved" && Date.parse(live.request.expiresAt) <= Date.now()) {
    throw new Error("This Story Room access request has expired. Ask the requester to submit it again.");
  }
  if (status === "approved" || status === "revoked") {
    await applyMembershipDecision(connection, binding.channelId, request.requesterPublicKey, status);
  }
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
  return {
    ok: true,
    decision,
    status,
    message: status === "approved"
      ? "BUZZ confirmed membership before PlotPickle recorded approval."
      : status === "revoked"
        ? "BUZZ confirmed Story Room access was revoked."
        : "Access request declined. No Story Room membership was granted.",
  };
}

async function ownerRequests(channelValue: unknown) {
  const { connection, pubkey } = await verifiedDirectoryConnection();
  const channelId = validChannelId(channelValue);
  const context = currentProfileRequestContext();
  if (!context) throw new Error("Unlock a PlotPickle Human profile before reviewing Story Room requests.");
  const saved = await context.privateStorage.readPrivateJson(context.authContext, { domain: "buzz", objectId: BINDINGS_OBJECT_ID });
  const binding = normalizeBuzzStoryRoomBindings(saved).find((candidate) => candidate.channelId === channelId && candidate.roomId === "story");
  if (!binding) throw new Error("That channel is not this profile's mapped primary Story Room.");
  await assertBuzzStoryRoomOwner(binding.channelId, pubkey);
  const dms = dmsFrom(await runStoryRoomBuzz(connection, ["dms", "list", "--limit", "40"])).slice(0, 24);
  const states: RequestState[] = [];
  let invalidMarkedEvents = 0;
  for (const dm of dms) {
    const messages = signedMessages(await runStoryRoomBuzz(connection, ["messages", "get", "--channel", dm.id, "--limit", String(MAX_DM_MESSAGES)]));
    const requests = new Map<string, StoryRoomAccessRequest>();
    const decisions = new Map<string, StoryRoomAccessDecision>();
    for (const message of messages) {
      if (message.content.startsWith(STORY_ROOM_ACCESS_REQUEST_MARKER)) {
        try {
          const request = parseStoryRoomAccessRequest(message.content);
          if (request
            && request.listingId === binding.listingId
            && request.ownerPublicKey === pubkey
            && request.requesterPublicKey === message.pubkey) {
            requests.set(request.requestId, request);
          }
        } catch {
          invalidMarkedEvents += 1;
        }
      }
      if (message.content.startsWith(STORY_ROOM_ACCESS_DECISION_MARKER)) {
        try {
          const decision = parseStoryRoomAccessDecision(message.content);
          if (decision
            && decision.listingId === binding.listingId
            && decision.ownerPublicKey === pubkey
            && message.pubkey === pubkey) {
            decisions.set(decision.requestId, decision);
          }
        } catch {
          invalidMarkedEvents += 1;
        }
      }
    }
    for (const request of requests.values()) {
      const candidate = decisions.get(request.requestId) ?? null;
      const decision = candidate
        && candidate.requesterPublicKey === request.requesterPublicKey
        && candidate.ownerPublicKey === request.ownerPublicKey
        ? candidate
        : null;
      states.push({
        request,
        decision,
        status: decision?.status ?? (Date.parse(request.expiresAt) <= Date.now() ? "expired" : "pending"),
      });
    }
  }
  states.sort((left, right) => Date.parse(right.request.requestedAt) - Date.parse(left.request.requestedAt));
  return {
    ok: true,
    requests: states,
    listingId: binding.listingId,
    invalidMarkedEvents,
    message: states.length
      ? `${states.length} Story Room access request${states.length === 1 ? "" : "s"} found.`
      : "No Story Room access requests yet.",
  };
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
