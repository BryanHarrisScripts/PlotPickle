import { BUZZ_STORY_ROOMS, type BuzzStoryRoomId } from "./buzz-story-room";

export const COMMUNITY_GREAT_HALL_ROOM_ID = "great-hall" as const;
export const LEGACY_BROAD_STORY_ROOM_ID: BuzzStoryRoomId = "story";

export type CommunityBbsRoomKind = "great-hall" | "story-room";

export type CommunityBbsChannel = {
  id: string;
  name: string;
  description?: string;
};

export type ActiveBbsRoom = {
  roomId: typeof COMMUNITY_GREAT_HALL_ROOM_ID | BuzzStoryRoomId;
  roomName: string;
  hallNumber: number;
  channelId: string;
  kind: CommunityBbsRoomKind;
};

export type HumanBuzzIdentity = {
  ready: boolean;
  identityVerified: boolean;
  humanCommunityAllowed: boolean;
  pubkey: string;
  displayName: string;
  kind: "human" | "agent" | "unknown";
  agentId: string;
  message: string;
};

export const UNVERIFIED_HUMAN_BUZZ_IDENTITY: HumanBuzzIdentity = {
  ready: false,
  identityVerified: false,
  humanCommunityAllowed: false,
  pubkey: "",
  displayName: "",
  kind: "unknown",
  agentId: "",
  message: "Connect and verify your personal Buzz identity before posting to PlotPickle Community.",
};

export const COMMUNITY_VISIBLE_STORY_ROOMS = BUZZ_STORY_ROOMS
  .filter((room) => room.id !== LEGACY_BROAD_STORY_ROOM_ID)
  .map((room, index) => ({ ...room, hallNumber: index + 2 }));

export function createGreatHallActiveRoom(channel: CommunityBbsChannel | null | undefined): ActiveBbsRoom | null {
  if (!channel?.id) return null;
  return {
    roomId: COMMUNITY_GREAT_HALL_ROOM_ID,
    roomName: "Great Hall",
    hallNumber: 1,
    channelId: channel.id,
    kind: "great-hall",
  };
}

export function createStoryActiveRoom(
  roomId: BuzzStoryRoomId,
  channel: CommunityBbsChannel | null | undefined,
): ActiveBbsRoom | null {
  if (!channel?.id || roomId === LEGACY_BROAD_STORY_ROOM_ID) return null;
  const definition = COMMUNITY_VISIBLE_STORY_ROOMS.find((room) => room.id === roomId);
  if (!definition) return null;
  return {
    roomId,
    roomName: definition.label,
    hallNumber: definition.hallNumber,
    channelId: channel.id,
    kind: "story-room",
  };
}

export function humanBuzzFingerprint(pubkey: string) {
  const value = pubkey.trim();
  if (!value) return "";
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}…${value.slice(-6)}`;
}

export function isKnownHumanBuzzIdentity(identity: HumanBuzzIdentity | null | undefined) {
  return Boolean(identity?.ready && identity.identityVerified && identity.humanCommunityAllowed && identity.kind === "human");
}
