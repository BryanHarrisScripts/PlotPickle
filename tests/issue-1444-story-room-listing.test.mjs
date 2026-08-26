import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1444 makes Closed the fail-safe Story Room access mode", async () => {
  const source = await read("lib/buzz/story-room-listing.ts");
  assert.match(source, /BUZZ_STORY_ROOM_ACCESS_MODES = \["closed", "listed", "open"\]/);
  assert.match(source, /: "closed";/);
  assert.match(source, /accessMode: "closed"/);
  assert.match(source, /published: false/);
  assert.match(source, /requestsOpen: false/);
});

test("#1444 keeps public listing projection bounded and excludes private project/channel data", async () => {
  const source = await read("lib/buzz/story-room-listing.ts");
  assert.match(source, /export function publicBuzzStoryRoomListing/);
  assert.match(source, /if \(!normalized\.published \|\| normalized\.accessMode === "closed"\) return null/);
  assert.doesNotMatch(source, /channelId:/);
  assert.doesNotMatch(source, /privateKey:/);
  assert.doesNotMatch(source, /ppf:/i);
  assert.doesNotMatch(source, /messages:/i);
});

test("#1444 bounds owner-approved listing metadata and verified public identity", async () => {
  const source = await read("lib/buzz/story-room-listing.ts");
  assert.match(source, /MAX_DESCRIPTION = 500/);
  assert.match(source, /MAX_TITLE = 120/);
  assert.match(source, /\^\[a-f0-9\]\{64\}\$/i);
  assert.match(source, /ownerDisplayName: string/);
  assert.match(source, /hostingCommunityName: string/);
});

test("#1444 does not pretend Open supports automatic admission in the listing contract", async () => {
  const source = await read("lib/buzz/story-room-listing.ts");
  assert.match(source, /const requestsOpen = accessMode === "listed" && published/);
  assert.doesNotMatch(source, /autoJoin|automaticAdmission|grantMembership/);
});

test("#1444 listing writes require the live verified BUZZ Story Room owner", async () => {
  const [gateway, authority] = await Promise.all([
    read("build/buzz-story-room-listing-gateway.ts"),
    read("build/buzz-story-room-owner-authority.ts"),
  ]);
  assert.match(gateway, /assertBuzzStoryRoomOwner\(binding\.channelId, owner\.pubkey\)/);
  assert.match(authority, /\["channels", "members", "--channel", channelId\]/);
  assert.match(authority, /membership\.role !== "owner"/);
  assert.match(authority, /signerPubkey !== expectedPubkey/);
  assert.match(authority, /boundPubkey !== expectedPubkey/);
  assert.match(authority, /PlotPickle did not publish anything/);
  assert.doesNotMatch(authority, /shell\s*:\s*true/);
});

test("#1444 listing records stay profile-private and are keyed by the immutable listing id", async () => {
  const gateway = await read("build/buzz-story-room-listing-gateway.ts");
  assert.match(gateway, /LISTING_OBJECT_PREFIX = "story-room-listing-v1-"/);
  assert.match(gateway, /domain: "buzz"/);
  assert.match(gateway, /objectId: listingObjectId\(binding\)/);
  assert.match(gateway, /listing\.listingId !== binding\.listingId/);
  assert.match(gateway, /listing\.projectId !== binding\.projectId/);
});

test("#1444 server capability-gates Open and never silently publishes it", async () => {
  const gateway = await read("build/buzz-story-room-listing-gateway.ts");
  assert.match(gateway, /capabilities: \{ openMembership: false \}/);
  assert.match(gateway, /if \(mode === "open"\)/);
  assert.match(gateway, /Choose Listed instead/);
  assert.match(gateway, /published: accessMode === "listed"/);
});
