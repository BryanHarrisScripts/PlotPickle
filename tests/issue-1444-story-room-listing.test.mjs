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
