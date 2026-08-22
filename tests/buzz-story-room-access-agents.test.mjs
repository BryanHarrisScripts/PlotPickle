import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Story Rooms are the same private BUZZ channels in PlotPickle and Buzz Desktop", async () => {
  const [workspace, contract, access, gateway, vite] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("lib/buzz-story-room.ts"),
    read("app/community-story-room-access.tsx"),
    read("build/buzz-story-room-access-gateway.ts"),
    read("vite.config.ts"),
  ]);

  assert.match(workspace, /PRIVATE_STORY_ROOM_ID: BuzzStoryRoomId = "story"/);
  assert.match(workspace, /older category channels underneath for compatibility/);
  assert.match(workspace, /<CommunityStoryRoomAccess channel=\{privateStoryRoom\.channel\}/);
  assert.match(contract, /channelId: channel\.id/);
  assert.match(contract, /LEGACY_BROAD_STORY_ROOM_ID/);
  assert.match(access, /One room, two interfaces/);
  assert.match(access, /same conversation in Buzz Desktop and PlotPickle/);
  assert.match(access, /\/api\/local-buzz\/story-room-access/);
  assert.match(gateway, /channels", "members", "--channel"/);
  assert.match(gateway, /channels", "add-member", "--channel"/);
  assert.match(gateway, /channels", "remove-member", "--channel"/);
  assert.match(gateway, /BUZZ_STORY_ROOMS\.map/);
  assert.match(gateway, /refused to manage membership for a non-Story-Room channel/);
  assert.match(vite, /buzzStoryRoomAccessGateway\(\)/);
});

test("Story Room access remains local, private and enforced by BUZZ permissions", async () => {
  const [gateway, access] = await Promise.all([
    read("build/buzz-story-room-access-gateway.ts"),
    read("app/community-story-room-access.tsx"),
  ]);

  assert.match(gateway, /if \(!isLocalRequest\(request\)\)/);
  assert.match(gateway, /verificationVersion !== 2/);
  assert.match(gateway, /BUZZ_PRIVATE_KEY: connection\.privateKey/);
  assert.match(gateway, /\[redacted-nsec\]/);
  assert.match(access, /BUZZ enforces the actual channel permissions/);
  assert.doesNotMatch(gateway, /visibility", "public"|automatic.*invite/i);
});

test("PlotPickle agents can have visible BUZZ identities without moving reasoning or authority out of Mastra and the host", async () => {
  const [gateway, roster, config] = await Promise.all([
    read("build/buzz-agent-roster-gateway.ts"),
    read("app/community-agent-roster.tsx"),
    read("config/buzz-guildhall.json"),
  ]);

  assert.match(gateway, /BUZZ_GUILDHALL_ACTORS\.filter\(\(actor\) => Boolean\(agentProfileById\(actor\.id\)\?\.publicPresentation\)\)/);
  assert.match(gateway, /"users", "get", "--name", actor\.displayName, "--owner", "me"/);
  assert.match(gateway, /request\.method !== "GET"/);
  assert.match(gateway, /Agent roster status is read-only/);
  assert.doesNotMatch(gateway, /"messages",\s*"send"|"agents",\s*"run"|"agents",\s*"create"/);
  assert.match(roster, /Official BUZZ identity available/);
  assert.match(roster, /Official BUZZ identity awaiting provisioning/);
  assert.match(roster, /The connected Human signer is never an Agent signer/);
  assert.match(roster, /Official PlotPickle Agent private signers stay with PlotPickle Admin outside the distributed app/);
  const parsed = JSON.parse(config);
  assert.equal(parsed.authority.agentRuntime, "Mastra remains the PlotPickle product-agent runtime. Buzz coordinates those agents; it does not replace their reasoning runtime.");
});
