import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1444 gives the primary private room a clean Human-facing name without using the project UUID", async () => {
  const source = await read("lib/buzz/story-room-identity.ts");
  assert.match(source, /PRIMARY_PRIVATE_STORY_ROOM_ID[^\n]+"story"/);
  assert.match(source, /`\$\{buzzStoryTitleSlug\(project\)\}-story-default`/);
  assert.match(source, /buzzLegacyStoryRoomName[\s\S]+return buzzRoomName\(project, roomId\)/);
  assert.match(source, /projectId: string/);
  assert.match(source, /channelId: string/);
  assert.match(source, /listingId: string/);
});

test("#1444 persists Story Room identity inside the active Human profile and resolves by immutable BUZZ channel id", async () => {
  const gateway = await read("build/buzz-story-room-identity-gateway.ts");
  assert.match(gateway, /currentProfileRequestContext/);
  assert.match(gateway, /domain: "buzz", objectId: BINDINGS_OBJECT_ID/);
  assert.match(gateway, /storyRoomBindingFor\(nextBindings, request\.projectId, room\.id\)/);
  assert.match(gateway, /candidate\.id === existingBinding\.channelId/);
  assert.match(gateway, /will not create a duplicate while an immutable mapping exists/i);
  assert.match(gateway, /listingId: randomUUID\(\)/);
});

test("#1444 maps an existing legacy project room before creating anything new", async () => {
  const [gateway, community] = await Promise.all([
    read("build/buzz-story-room-identity-gateway.ts"),
    read("app/community-workspace.tsx"),
  ]);
  assert.match(gateway, /channels\.find\(\(candidate\) => candidate\.name === room\.legacyName\)/);
  assert.match(gateway, /if \(!channel && request\.createMissing\)/);
  assert.match(gateway, /mappedFromLegacy: !created/);
  assert.match(community, /projectId: project\.id/);
  assert.match(community, /legacyName: buzzLegacyStoryRoomName\(project, room\.id\)/);
  assert.match(community, /displayName: buzzStoryRoomDisplayName\(project, room\.id\)/);
});

test("#1444 rename detection keeps access bound to the mapped channel instead of the mutable room name", async () => {
  const [identityGateway, accessGateway] = await Promise.all([
    read("build/buzz-story-room-identity-gateway.ts"),
    read("build/buzz-story-room-access-gateway.ts"),
  ]);
  assert.match(identityGateway, /channel\.name !== existingBinding\.lastKnownName/);
  assert.match(identityGateway, /lastKnownName: safeRoomName\(channel\.name\)/);
  assert.match(accessGateway, /mappedStoryRoomChannelIds/);
  assert.match(accessGateway, /if \(mappedChannelIds\.has\(channel\.id\)\) return channel/);
});

test("#1444 Community uses the identity gateway and displays the clean alias rather than the BUZZ storage name", async () => {
  const [community, vite] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("vite.config.ts"),
  ]);
  assert.match(community, /"\/story-room-identity"/);
  assert.match(community, /privateStoryRoom\?\.displayName \|\| buzzStoryRoomDisplayName/);
  assert.match(community, /normal room name never exposes the project UUID/i);
  assert.match(vite, /buzzStoryRoomIdentityGateway/);
  assert.match(vite, /buzzStoryRoomIdentityGateway\(\)/);
});
