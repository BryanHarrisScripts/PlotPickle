export const BUZZ_STORY_ROOM_LISTING_VERSION = 1 as const;

export const BUZZ_STORY_ROOM_ACCESS_MODES = ["closed", "listed", "open"] as const;
export type BuzzStoryRoomAccessMode = (typeof BUZZ_STORY_ROOM_ACCESS_MODES)[number];

export type BuzzStoryRoomListing = {
  version: typeof BUZZ_STORY_ROOM_LISTING_VERSION;
  listingId: string;
  projectId: string;
  accessMode: BuzzStoryRoomAccessMode;
  title: string;
  description: string;
  genre: string;
  ownerDisplayName: string;
  ownerPublicKey: string;
  hostingCommunityName: string;
  published: boolean;
  requestsOpen: boolean;
  updatedAt: string;
};

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 500;
const MAX_GENRE = 80;
const MAX_OWNER_NAME = 120;
const MAX_COMMUNITY_NAME = 120;

function cleanText(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (text.length > max || /[\u0000-\u001f\u007f]/.test(text)) throw new Error("Story Room listing text is invalid.");
  return text;
}

function validListingId(value: unknown) {
  return typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
}

function validPublicKey(value: unknown) {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function validTimestamp(value: unknown) {
  return typeof value === "string" && value.length <= 64 && Number.isFinite(Date.parse(value));
}

export function normalizeBuzzStoryRoomAccessMode(value: unknown): BuzzStoryRoomAccessMode {
  return BUZZ_STORY_ROOM_ACCESS_MODES.includes(value as BuzzStoryRoomAccessMode)
    ? value as BuzzStoryRoomAccessMode
    : "closed";
}

export function normalizeBuzzStoryRoomListing(value: unknown): BuzzStoryRoomListing {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The saved Story Room listing is invalid.");
  const item = value as Partial<BuzzStoryRoomListing>;
  const accessMode = normalizeBuzzStoryRoomAccessMode(item.accessMode);
  const projectId = cleanText(item.projectId, 240);
  const title = cleanText(item.title, MAX_TITLE);
  const description = cleanText(item.description, MAX_DESCRIPTION);
  const genre = cleanText(item.genre, MAX_GENRE);
  const ownerDisplayName = cleanText(item.ownerDisplayName, MAX_OWNER_NAME);
  const hostingCommunityName = cleanText(item.hostingCommunityName, MAX_COMMUNITY_NAME);

  if (item.version !== BUZZ_STORY_ROOM_LISTING_VERSION
    || !validListingId(item.listingId)
    || !projectId
    || !title
    || !ownerDisplayName
    || !validPublicKey(item.ownerPublicKey)
    || !validTimestamp(item.updatedAt)) {
    throw new Error("The saved Story Room listing is invalid.");
  }

  const published = accessMode !== "closed" && item.published === true;
  const requestsOpen = accessMode === "listed" && published && item.requestsOpen !== false;

  return {
    version: BUZZ_STORY_ROOM_LISTING_VERSION,
    listingId: item.listingId,
    projectId,
    accessMode,
    title,
    description,
    genre,
    ownerDisplayName,
    ownerPublicKey: item.ownerPublicKey.toLowerCase(),
    hostingCommunityName,
    published,
    requestsOpen,
    updatedAt: item.updatedAt,
  };
}

export function closedBuzzStoryRoomListing(input: {
  listingId: string;
  projectId: string;
  title: string;
  ownerDisplayName: string;
  ownerPublicKey: string;
  hostingCommunityName?: string;
  now?: string;
}): BuzzStoryRoomListing {
  return normalizeBuzzStoryRoomListing({
    version: BUZZ_STORY_ROOM_LISTING_VERSION,
    listingId: input.listingId,
    projectId: input.projectId,
    accessMode: "closed",
    title: input.title,
    description: "",
    genre: "",
    ownerDisplayName: input.ownerDisplayName,
    ownerPublicKey: input.ownerPublicKey,
    hostingCommunityName: input.hostingCommunityName ?? "",
    published: false,
    requestsOpen: false,
    updatedAt: input.now ?? new Date().toISOString(),
  });
}

export function publicBuzzStoryRoomListing(listing: BuzzStoryRoomListing) {
  const normalized = normalizeBuzzStoryRoomListing(listing);
  if (!normalized.published || normalized.accessMode === "closed") return null;
  return {
    version: normalized.version,
    listingId: normalized.listingId,
    title: normalized.title,
    description: normalized.description,
    genre: normalized.genre,
    ownerDisplayName: normalized.ownerDisplayName,
    ownerPublicKey: normalized.ownerPublicKey,
    hostingCommunityName: normalized.hostingCommunityName,
    accessMode: normalized.accessMode,
    requestsOpen: normalized.requestsOpen,
    updatedAt: normalized.updatedAt,
  };
}
