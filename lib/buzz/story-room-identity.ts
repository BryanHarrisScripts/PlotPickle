import {
  BUZZ_STORY_ROOMS,
  buzzRoomName,
  projectIdentity,
  type BuzzStoryRoomId,
} from "./buzz-story-room";

export const BUZZ_STORY_ROOM_BINDING_VERSION = 1 as const;
export const PRIMARY_PRIVATE_STORY_ROOM_ID: BuzzStoryRoomId = "story";
export const buzzLegacyStoryRoomName = buzzRoomName;

export type BuzzStoryRoomBinding = {
  version: typeof BUZZ_STORY_ROOM_BINDING_VERSION;
  projectId: string;
  roomId: BuzzStoryRoomId;
  channelId: string;
  listingId: string;
  lastKnownName: string;
  createdAt: string;
  updatedAt: string;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validRoomId(value: unknown): value is BuzzStoryRoomId {
  return typeof value === "string" && BUZZ_STORY_ROOMS.some((room) => room.id === value);
}

function validChannelId(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9-]{8,128}$/.test(value);
}

function validListingId(value: unknown) {
  return typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
}

function validStoredRoomName(value: unknown) {
  return typeof value === "string"
    && value.trim().length > 0
    && value.trim().length <= 160
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function validTimestamp(value: unknown) {
  return typeof value === "string" && value.length > 0 && value.length <= 64 && Number.isFinite(Date.parse(value));
}

export function buzzStoryTitleSlug(project: unknown) {
  const title = projectIdentity(project).title;
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 58) || "plotpickle-story";
}

export function buzzStoryRoomDisplayName(project: unknown, roomId: BuzzStoryRoomId) {
  if (roomId !== PRIMARY_PRIVATE_STORY_ROOM_ID) return buzzRoomName(project, roomId);
  return `${buzzStoryTitleSlug(project)}-story-default`.slice(0, 72);
}

export function normalizeBuzzStoryRoomBindings(value: unknown): BuzzStoryRoomBinding[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error("The saved BUZZ Story Room identity map is invalid.");
  const bindings = value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("A saved BUZZ Story Room identity is invalid.");
    const item = entry as Partial<BuzzStoryRoomBinding>;
    const projectId = text(item.projectId);
    if (item.version !== BUZZ_STORY_ROOM_BINDING_VERSION
      || !projectId || projectId.length > 240
      || !validRoomId(item.roomId)
      || !validChannelId(item.channelId)
      || !validListingId(item.listingId)
      || !validStoredRoomName(item.lastKnownName)
      || !validTimestamp(item.createdAt)
      || !validTimestamp(item.updatedAt)) {
      throw new Error("A saved BUZZ Story Room identity is invalid.");
    }
    return {
      version: BUZZ_STORY_ROOM_BINDING_VERSION,
      projectId,
      roomId: item.roomId,
      channelId: item.channelId,
      listingId: item.listingId,
      lastKnownName: item.lastKnownName.trim(),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    } satisfies BuzzStoryRoomBinding;
  });
  const keys = new Set<string>();
  const channels = new Set<string>();
  for (const binding of bindings) {
    const key = `${binding.projectId}\u0000${binding.roomId}`;
    if (keys.has(key) || channels.has(binding.channelId)) throw new Error("The saved BUZZ Story Room identity map contains a duplicate binding.");
    keys.add(key);
    channels.add(binding.channelId);
  }
  return bindings;
}

export function storyRoomBindingFor(bindings: readonly BuzzStoryRoomBinding[], projectId: string, roomId: BuzzStoryRoomId) {
  return bindings.find((binding) => binding.projectId === projectId && binding.roomId === roomId) ?? null;
}
