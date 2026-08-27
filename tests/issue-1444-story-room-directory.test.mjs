import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1444 directory contracts never publish private Story Room channel identity", async () => {
  const source = await read("lib/buzz/story-room-directory.ts");
  assert.match(source, /STORY_ROOM_DIRECTORY_MARKER/);
  assert.match(source, /listingId/);
  assert.match(source, /ownerPublicKey/);
  assert.doesNotMatch(source, /channelId|projectId|screenplay|privateKey|nsec/i);
});

test("#1444 verifies signed BUZZ events before trusting directory, request, or decision authority", async () => {
  const source = await read("build/buzz-story-room-directory-gateway.ts");
  assert.match(source, /verifyNostrEventSignature\(candidate\)/);
  assert.match(source, /announcement\.ownerPublicKey !== message\.pubkey/);
  assert.match(source, /parsed\.requesterPublicKey === message\.pubkey/);
  assert.match(source, /parsed\.ownerPublicKey === message\.pubkey/);
});

test("#1444 uses deterministic request identity and bounded private BUZZ DMs", async () => {
  const source = await read("build/buzz-story-room-directory-gateway.ts");
  assert.match(source, /createHash\("sha256"\).*listingId.*requesterPublicKey/s);
  assert.match(source, /dms", "open", "--pubkey"/);
  assert.match(source, /REQUEST_TTL_MS/);
  assert.match(source, /MAX_DM_MESSAGES/);
});

test("#1444 approval is successful only after BUZZ confirms normal membership", async () => {
  const source = await read("build/buzz-story-room-directory-gateway.ts");
  assert.match(source, /"channels", "add-member"/);
  assert.match(source, /"--role", "member"/);
  assert.match(source, /"channels", "members"/);
  assert.match(source, /BUZZ did not confirm that Story Room access was/);
  assert.doesNotMatch(source, /"--role", "admin"|"--role", "bot"/);
});

test("#1444 keeps Open capability-gated instead of simulating automatic admission", async () => {
  const gateway = await read("build/buzz-story-room-directory-gateway.ts");
  const ownerUi = await read("app/_components/community/community-story-room-listing.tsx");
  assert.match(gateway, /capabilities: \{ openMembership: false \}/);
  assert.match(gateway, /Open Story Room admission remains capability-gated/);
  assert.match(ownerUi, /Open · unavailable until BUZZ supports safe admission/);
});

test("#1444 provides visitor directory cards and explicit owner decisions", async () => {
  const ui = await read("modules/community/story-room-directory.tsx");
  assert.match(ui, />Story Rooms Directory</);
  assert.match(ui, />Request Access</);
  assert.match(ui, />Approve</);
  assert.match(ui, />Decline</);
  assert.match(ui, />Revoke access</);
});

test("#1444 registers the directory gateway in the local Vite boundary", async () => {
  const vite = await read("vite.config.ts");
  assert.match(vite, /buzzStoryRoomDirectoryGateway/);
  assert.match(vite, /buzzStoryRoomDirectoryGateway\(\)/);
});
