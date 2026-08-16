import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Story Rooms are the same private BUZZ channels in PlotPickle and Buzz Desktop", async () => {
  const [workspace, access, gateway, vite] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("app/community-story-room-access.tsx"),
    read("build/buzz-story-room-access-gateway.ts"),
    read("vite.config.ts"),
  ]);

  assert.match(workspace, /real private BUZZ channels/);
  assert.match(workspace, /<CommunityStoryRoomAccess channel=\{selectedRoom\.channel\}/);
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

test("PlotPickle agents can have visible BUZZ identities without moving reasoning out of Mastra", async () => {
  const [gateway, roster, config] = await Promise.all([
    read("build/buzz-agent-roster-gateway.ts"),
    read("app/community-agent-roster.tsx"),
    read("config/buzz-guildhall.json"),
  ]);

  assert.match(gateway, /actor\.buzzPresence === "mirrored" \|\| actor\.buzzPresence === "native-draft"/);
  assert.match(gateway, /"users", "get", "--name", actor\.displayName, "--owner", "me"/);
  assert.match(roster, /Visible in BUZZ/);
  assert.match(roster, /Mastra agent · BUZZ identity not created/);
  assert.match(roster, /matching BUZZ identity is only their community presence and signed authorship shell/);
  assert.match(roster, /never sign a human message and falsely label it as an agent/);
  const parsed = JSON.parse(config);
  assert.equal(parsed.authority.agentRuntime, "Mastra remains the PlotPickle product-agent runtime. Buzz coordinates those agents; it does not replace their reasoning runtime.");
});
