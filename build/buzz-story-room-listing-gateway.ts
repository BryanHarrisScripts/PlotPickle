import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import {
  BUZZ_STORY_ROOM_ACCESS_MODES,
  normalizeBuzzStoryRoomAccessMode,
  normalizeBuzzStoryRoomListing,
  publicBuzzStoryRoomListing,
  type BuzzStoryRoomAccessMode,
  type BuzzStoryRoomListing,
} from "../lib/buzz/story-room-listing";
import { normalizeBuzzStoryRoomBindings, type BuzzStoryRoomBinding } from "../lib/buzz/story-room-identity";
import { publicKeyFromPrivateKey } from "./buzz-key-identity";
import { redactBuzzDiagnostic } from "./buzz-cli-failure";
import { readCredentialJson } from "./local-credentials";
import { currentProfileRequestContext } from "./profile-request-context";

const API = "/api/local-buzz/story-room-listing";
const CONNECTION_FILE = "buzz-connection.json";
const BINDINGS_OBJECT_ID = "story-room-bindings-v1";
const LISTING_OBJECT_PREFIX = "story-room-listing-v1-";
const MAX_BODY = 64 * 1024;

type StoredConnection = {
  verificationVersion?: number;
  verifiedAt?: string;
  privateKey?: string;
  identityLabel?: string;
  identityPubkey?: string;
  identityRole?: "human";
  community?: string;
};

type VerifiedOwner = {
  displayName: string;
  pubkey: string;
  hostingCommunityName: string;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

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

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += value.length;
    if (bytes > MAX_BODY) throw new Error("The Story Room listing request is too large.");
    chunks.push(value);
  }
  const decoded: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) throw new Error("The Story Room listing request is invalid.");
  return decoded as Record<string, unknown>;
}

function safeError(error: unknown) {
  return redactBuzzDiagnostic(error instanceof Error ? error.message : "Story Room listing is unavailable.").slice(0, 600);
}

function validChannelId(value: unknown) {
  const channelId = text(value);
  if (!/^[A-Za-z0-9-]{8,128}$/.test(channelId)) throw new Error("Choose a valid mapped Story Room.");
  return channelId;
}

function listingObjectId(binding: BuzzStoryRoomBinding) {
  return `${LISTING_OBJECT_PREFIX}${binding.listingId}`;
}

function activeProfile() {
  const context = currentProfileRequestContext();
  if (!context) throw new Error("Unlock a PlotPickle Human profile before managing a Story Room listing.");
  return context;
}

async function verifiedOwner(): Promise<VerifiedOwner> {
  const value = await readCredentialJson<unknown>(CONNECTION_FILE);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Verify your Human BUZZ identity before managing a Story Room listing.");
  }
  const connection = value as StoredConnection;
  const pubkey = typeof connection.privateKey === "string" ? publicKeyFromPrivateKey(connection.privateKey) : "";
  const boundPubkey = text(connection.identityPubkey).toLowerCase();
  if (connection.verificationVersion !== 2
    || !text(connection.verifiedAt)
    || connection.identityRole !== "human"
    || !/^[a-f0-9]{64}$/.test(pubkey)
    || boundPubkey !== pubkey) {
    throw new Error("Re-verify the intended Human BUZZ identity before managing a Story Room listing.");
  }
  const displayName = text(connection.identityLabel).slice(0, 120) || "PlotPickle Human";
  const hostingCommunityName = text(connection.community).slice(0, 120) || "PlotPicklePlayhouse";
  return { displayName, pubkey, hostingCommunityName };
}

async function mappedPrimaryStoryRoom(channelValue: unknown) {
  const channelId = validChannelId(channelValue);
  const context = activeProfile();
  const saved = await context.privateStorage.readPrivateJson(context.authContext, {
    domain: "buzz",
    objectId: BINDINGS_OBJECT_ID,
  });
  const binding = normalizeBuzzStoryRoomBindings(saved).find((candidate) => candidate.channelId === channelId);
  if (!binding || binding.roomId !== "story") {
    throw new Error("PlotPickle will only publish the mapped primary private Story Room for this Human profile.");
  }
  return { context, binding };
}

async function readListing(binding: BuzzStoryRoomBinding) {
  const context = activeProfile();
  const saved = await context.privateStorage.readPrivateJson(context.authContext, {
    domain: "buzz",
    objectId: listingObjectId(binding),
  });
  if (saved === undefined || saved === null) return null;
  const listing = normalizeBuzzStoryRoomListing(saved);
  if (listing.listingId !== binding.listingId || listing.projectId !== binding.projectId) {
    throw new Error("The saved Story Room listing does not match the immutable room binding.");
  }
  return listing;
}

async function saveListing(binding: BuzzStoryRoomBinding, listing: BuzzStoryRoomListing) {
  const context = activeProfile();
  await context.privateStorage.writePrivateJson(context.authContext, {
    domain: "buzz",
    objectId: listingObjectId(binding),
    value: listing,
  });
}

function suggestedStoryTitle(binding: BuzzStoryRoomBinding) {
  const base = binding.lastKnownName.replace(/-story-default$/i, "").replace(/-+/g, " ").trim();
  return base ? base.replace(/\b\w/g, (letter) => letter.toUpperCase()).slice(0, 120) : "My Story";
}

function ownerDefaults(binding: BuzzStoryRoomBinding, owner: VerifiedOwner) {
  return {
    ownerDisplayName: owner.displayName,
    ownerPublicKey: owner.pubkey,
    hostingCommunityName: owner.hostingCommunityName,
    suggestedTitle: suggestedStoryTitle(binding),
  };
}

function listingReply(binding: BuzzStoryRoomBinding, owner: VerifiedOwner, listing: BuzzStoryRoomListing | null, message: string) {
  if (listing && listing.ownerPublicKey !== owner.pubkey) {
    throw new Error("This Story Room listing belongs to a different verified BUZZ owner identity.");
  }
  return {
    ok: true,
    listing,
    publicPreview: listing ? publicBuzzStoryRoomListing(listing) : null,
    defaults: ownerDefaults(binding, owner),
    capabilities: { openMembership: false },
    message,
  };
}

async function status(channelValue: unknown) {
  const owner = await verifiedOwner();
  const { binding } = await mappedPrimaryStoryRoom(channelValue);
  const listing = await readListing(binding);
  return listingReply(
    binding,
    owner,
    listing,
    listing
      ? listing.accessMode === "closed"
        ? "Story Room listing is Closed and absent from public discovery."
        : "Owner-approved Story Room listing metadata is ready for preview."
      : "Story Room listing defaults to Closed. Nothing is public until the owner explicitly saves Listed access.",
  );
}

function requestedAccessMode(value: unknown): BuzzStoryRoomAccessMode {
  const mode = normalizeBuzzStoryRoomAccessMode(value);
  if (!BUZZ_STORY_ROOM_ACCESS_MODES.includes(value as BuzzStoryRoomAccessMode)) {
    throw new Error("Choose Closed or Listed Story Room access.");
  }
  if (mode === "open") {
    throw new Error("Open Story Room admission is not available yet because BUZZ has not exposed a safe owner-authorized automatic admission capability. Choose Listed instead.");
  }
  return mode;
}

async function update(body: Record<string, unknown>) {
  const owner = await verifiedOwner();
  const { binding } = await mappedPrimaryStoryRoom(body.channel);
  const existing = await readListing(binding);
  if (existing && existing.ownerPublicKey !== owner.pubkey) {
    throw new Error("This Story Room listing belongs to a different verified BUZZ owner identity.");
  }
  const accessMode = requestedAccessMode(body.accessMode);
  const listing = normalizeBuzzStoryRoomListing({
    version: 1,
    listingId: binding.listingId,
    projectId: binding.projectId,
    accessMode,
    title: body.title,
    description: body.description,
    genre: body.genre,
    ownerDisplayName: owner.displayName,
    ownerPublicKey: owner.pubkey,
    hostingCommunityName: owner.hostingCommunityName,
    published: accessMode === "listed",
    requestsOpen: accessMode === "listed" && body.requestsOpen !== false,
    updatedAt: new Date().toISOString(),
  });
  await saveListing(binding, listing);
  return listingReply(
    binding,
    owner,
    listing,
    listing.accessMode === "closed"
      ? "Listing closed. The BUZZ Story Room, its history, and existing members were not deleted or revoked."
      : "Owner-approved listing saved. Only the previewed metadata is eligible for later directory publication.",
  );
}

async function handle(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (request.method === "GET" && url.pathname === API) {
    sendJson(response, 200, await status(url.searchParams.get("channel")));
    return;
  }
  if (request.method === "POST" && url.pathname === API) {
    sendJson(response, 200, await update(await readBody(request)));
    return;
  }
  sendJson(response, 404, { ok: false, message: "Story Room listing operation not found." });
}

export function buzzStoryRoomListingGateway(): Plugin {
  return {
    name: "plotpickle-buzz-story-room-listing-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const rawUrl = request.url;
        if (!rawUrl) { next(); return; }
        let url: URL;
        try { url = new URL(rawUrl, "http://127.0.0.1"); } catch { next(); return; }
        if (!url.pathname.startsWith(API)) { next(); return; }
        if (!isLocalRequest(request)) {
          sendJson(response, 403, { ok: false, message: "Story Room listing controls are available only from the local PlotPickle application." });
          return;
        }
        void handle(request, response, url).catch((error) => sendJson(response, 500, { ok: false, message: safeError(error) }));
      });
    },
  };
}
