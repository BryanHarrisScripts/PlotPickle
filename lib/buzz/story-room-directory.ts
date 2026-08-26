export const STORY_ROOM_DIRECTORY_MARKER = "[PLOTPICKLE_STORY_ROOM_DIRECTORY]";
export const STORY_ROOM_ACCESS_REQUEST_MARKER = "[PLOTPICKLE_STORY_ROOM_ACCESS_REQUEST]";
export const STORY_ROOM_ACCESS_DECISION_MARKER = "[PLOTPICKLE_STORY_ROOM_ACCESS_DECISION]";
export const STORY_ROOM_DIRECTORY_VERSION = 1 as const;

export type StoryRoomDirectoryListing = {
  version: typeof STORY_ROOM_DIRECTORY_VERSION;
  listingId: string;
  title: string;
  description: string;
  genre: string;
  ownerDisplayName: string;
  ownerPublicKey: string;
  hostingCommunityName: string;
  accessMode: "listed" | "open";
  requestsOpen: boolean;
  updatedAt: string;
};

export type StoryRoomDirectoryAnnouncement =
  | ({ type: "listing" } & StoryRoomDirectoryListing)
  | {
      version: typeof STORY_ROOM_DIRECTORY_VERSION;
      type: "closed";
      listingId: string;
      ownerPublicKey: string;
      updatedAt: string;
    };

export type StoryRoomAccessRequest = {
  version: typeof STORY_ROOM_DIRECTORY_VERSION;
  type: "request";
  requestId: string;
  listingId: string;
  ownerPublicKey: string;
  requesterPublicKey: string;
  requestedAt: string;
  expiresAt: string;
};

export type StoryRoomAccessDecisionStatus = "approved" | "declined" | "revoked";
export type StoryRoomAccessDecision = {
  version: typeof STORY_ROOM_DIRECTORY_VERSION;
  type: "decision";
  requestId: string;
  listingId: string;
  ownerPublicKey: string;
  requesterPublicKey: string;
  status: StoryRoomAccessDecisionStatus;
  decidedAt: string;
};

const LISTING_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const PUBKEY = /^[a-f0-9]{64}$/i;
const REQUEST_ID = /^sra_[a-f0-9]{32}$/;

function text(value: unknown, maximum: number) {
  if (typeof value !== "string") return "";
  const result = value.trim();
  if (result.length > maximum || /[\u0000-\u001f\u007f]/.test(result)) throw new Error("Story Room directory text is invalid.");
  return result;
}

function timestamp(value: unknown) {
  const result = text(value, 64);
  if (!result || !Number.isFinite(Date.parse(result))) throw new Error("Story Room directory timestamp is invalid.");
  return result;
}

function listingId(value: unknown) {
  const result = text(value, 64);
  if (!LISTING_ID.test(result)) throw new Error("Story Room directory listing identity is invalid.");
  return result.toLowerCase();
}

function publicKey(value: unknown) {
  const result = text(value, 64).toLowerCase();
  if (!PUBKEY.test(result)) throw new Error("Story Room directory public identity is invalid.");
  return result;
}

function requestId(value: unknown) {
  const result = text(value, 40).toLowerCase();
  if (!REQUEST_ID.test(result)) throw new Error("Story Room access request identity is invalid.");
  return result;
}

function envelope(marker: string, value: Record<string, unknown>) {
  return `${marker}\n${JSON.stringify(value)}`;
}

function payload(marker: string, content: string) {
  if (!content.startsWith(`${marker}\n`)) return null;
  const source = content.slice(marker.length).trim();
  if (!source || source.length > 4_096) throw new Error("Story Room directory payload is missing or too large.");
  const value: unknown = JSON.parse(source);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Story Room directory payload is invalid.");
  return value as Record<string, unknown>;
}

export function normalizeStoryRoomDirectoryAnnouncement(value: unknown): StoryRoomDirectoryAnnouncement {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Story Room directory announcement is invalid.");
  const item = value as Record<string, unknown>;
  if (item.version !== STORY_ROOM_DIRECTORY_VERSION) throw new Error("Story Room directory announcement version is unsupported.");
  const type = item.type === "listing" || item.type === "closed" ? item.type : "";
  if (!type) throw new Error("Story Room directory announcement type is invalid.");
  const common = {
    version: STORY_ROOM_DIRECTORY_VERSION,
    type,
    listingId: listingId(item.listingId),
    ownerPublicKey: publicKey(item.ownerPublicKey),
    updatedAt: timestamp(item.updatedAt),
  } as const;
  if (type === "closed") return common;
  const accessMode = item.accessMode === "listed" || item.accessMode === "open" ? item.accessMode : "";
  if (!accessMode) throw new Error("Story Room directory access mode is invalid.");
  const title = text(item.title, 120);
  const ownerDisplayName = text(item.ownerDisplayName, 120);
  if (!title || !ownerDisplayName) throw new Error("Story Room directory listing is missing required public metadata.");
  return {
    ...common,
    type: "listing",
    title,
    description: text(item.description, 500),
    genre: text(item.genre, 80),
    ownerDisplayName,
    hostingCommunityName: text(item.hostingCommunityName, 120),
    accessMode,
    requestsOpen: accessMode === "listed" && item.requestsOpen !== false,
  };
}

export function serializeStoryRoomDirectoryAnnouncement(value: StoryRoomDirectoryAnnouncement) {
  return envelope(STORY_ROOM_DIRECTORY_MARKER, normalizeStoryRoomDirectoryAnnouncement(value) as unknown as Record<string, unknown>);
}

export function parseStoryRoomDirectoryAnnouncement(content: string) {
  const value = payload(STORY_ROOM_DIRECTORY_MARKER, content);
  return value ? normalizeStoryRoomDirectoryAnnouncement(value) : null;
}

export function normalizeStoryRoomAccessRequest(value: unknown): StoryRoomAccessRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Story Room access request is invalid.");
  const item = value as Record<string, unknown>;
  if (item.version !== STORY_ROOM_DIRECTORY_VERSION || item.type !== "request") throw new Error("Story Room access request version or type is invalid.");
  const requestedAt = timestamp(item.requestedAt);
  const expiresAt = timestamp(item.expiresAt);
  if (Date.parse(expiresAt) <= Date.parse(requestedAt)) throw new Error("Story Room access request expiry is invalid.");
  return {
    version: STORY_ROOM_DIRECTORY_VERSION,
    type: "request",
    requestId: requestId(item.requestId),
    listingId: listingId(item.listingId),
    ownerPublicKey: publicKey(item.ownerPublicKey),
    requesterPublicKey: publicKey(item.requesterPublicKey),
    requestedAt,
    expiresAt,
  };
}

export function serializeStoryRoomAccessRequest(value: StoryRoomAccessRequest) {
  return envelope(STORY_ROOM_ACCESS_REQUEST_MARKER, normalizeStoryRoomAccessRequest(value) as unknown as Record<string, unknown>);
}

export function parseStoryRoomAccessRequest(content: string) {
  const value = payload(STORY_ROOM_ACCESS_REQUEST_MARKER, content);
  return value ? normalizeStoryRoomAccessRequest(value) : null;
}

export function normalizeStoryRoomAccessDecision(value: unknown): StoryRoomAccessDecision {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Story Room access decision is invalid.");
  const item = value as Record<string, unknown>;
  const status = item.status === "approved" || item.status === "declined" || item.status === "revoked" ? item.status : "";
  if (item.version !== STORY_ROOM_DIRECTORY_VERSION || item.type !== "decision" || !status) throw new Error("Story Room access decision version, type or status is invalid.");
  return {
    version: STORY_ROOM_DIRECTORY_VERSION,
    type: "decision",
    requestId: requestId(item.requestId),
    listingId: listingId(item.listingId),
    ownerPublicKey: publicKey(item.ownerPublicKey),
    requesterPublicKey: publicKey(item.requesterPublicKey),
    status,
    decidedAt: timestamp(item.decidedAt),
  };
}

export function serializeStoryRoomAccessDecision(value: StoryRoomAccessDecision) {
  return envelope(STORY_ROOM_ACCESS_DECISION_MARKER, normalizeStoryRoomAccessDecision(value) as unknown as Record<string, unknown>);
}

export function parseStoryRoomAccessDecision(content: string) {
  const value = payload(STORY_ROOM_ACCESS_DECISION_MARKER, content);
  return value ? normalizeStoryRoomAccessDecision(value) : null;
}
