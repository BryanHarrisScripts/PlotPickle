import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const SOCIAL = "modules/community/community-buzz-social.tsx";

test("#1129 keeps Great Hall as a real BUZZ-backed PlotPickle room", async () => {
  const [workspace, social, mirror, playhouse] = await Promise.all([
    read("app/community-workspace.tsx"),
    read(SOCIAL),
    read("config/buzz-guildhall.json").then(JSON.parse),
    read("plugins/plotpickle-playhouse/community.json").then(JSON.parse),
  ]);
  assert.ok(playhouse.rooms.some((room) => room.id === "great-hall" && room.label === "Great Hall"));
  assert.match(workspace, /PLOTPICKLE_PLAYHOUSE_PLUGIN\.rooms/);
  assert.match(workspace, /<CommunityBuzzSocial target=\{selectedTarget\}/);
  assert.match(social, /roomGuideFor/);
  assert.equal(mirror.conversationMirror.messageAuthority, "buzz");
  assert.equal(mirror.conversationMirror.historyModel, "one-buzz-room-history");
  assert.equal(mirror.conversationMirror.offlineShadowHistory, false);
});

test("#1129 exposes four Human-purpose rooms and native Direct Messages instead of a second social backend", async () => {
  const [workspace, social, gateway, playhouse] = await Promise.all([
    read("app/community-workspace.tsx"),
    read(SOCIAL),
    read("build/buzz-guildhall-gateway.ts"),
    read("plugins/plotpickle-playhouse/community.json").then(JSON.parse),
  ]);
  assert.match(workspace, />Rooms</);
  assert.match(workspace, />Direct Messages</);
  assert.deepEqual(playhouse.rooms.map((room) => room.label), ["Great Hall", "Story Workshop", "Wyrmwood", "Marquee"]);
  assert.match(gateway, /\["dms", "list", "--limit", "100"\]/);
  assert.match(gateway, /const args = \["dms", "open"\]/);
  assert.match(gateway, /args\.push\("--pubkey", pubkey\)/);
  assert.match(social, /Direct Message/);
  assert.doesNotMatch(`${workspace}\n${social}\n${gateway}`, /community-messages\.json|community-dms\.json|better-sqlite/i);
});

test("#1129 mirrors streams and DMs through BUZZ messages while forums publish BUZZ topic roots", async () => {
  const [social, communityGateway] = await Promise.all([
    read(SOCIAL),
    read("build/buzz-community-gateway.ts"),
  ]);
  assert.match(social, /authenticatedProfileFetch\(`\$\{BUZZ_API\}\/messages\?channel=/);
  assert.match(social, /community\/forum-topic/);
  assert.match(social, /\? \{ roomId: target\.id, channel: target\.channelId, content \}/);
  assert.match(social, /: \{ channel: target\.channelId, content \}/);
  assert.match(communityGateway, /definition\.type !== "forum"/);
  assert.match(communityGateway, /"--kind", "45001"/);
  assert.match(social, /data-buzz-event-id=\{message\.id\}/);
  assert.match(social, /window\.setInterval/);
  assert.match(social, /5000/);
  assert.match(social, /Message sent as your connected Human BUZZ identity/);
  assert.match(social, /Forum topic published as your connected Human BUZZ identity/);
  assert.doesNotMatch(social, /localStorage|sessionStorage|indexedDB/i);
});

test("#1129 requires the verified Human BUZZ signer for messages and DM creation", async () => {
  const [workspace, guard] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("build/buzz-human-identity-guard.ts"),
  ]);
  assert.match(workspace, /isKnownHumanBuzzIdentity\(humanIdentity\)/);
  assert.match(workspace, /Open Profile · BUZZ Identity/);
  assert.match(guard, /url\.pathname === `\$\{API\}\/messages`/);
  assert.match(guard, /url\.pathname === `\$\{API\}\/guildhall\/dms\/open`/);
  assert.match(guard, /human-buzz-identity-required/);
});

test("#1129 keeps Huddle voice native to BUZZ instead of faking a browser audio stack", async () => {
  const [social, reuse] = await Promise.all([
    read(SOCIAL),
    read("docs/third-party/buzz-community-reuse.md"),
  ]);
  assert.match(social, /data-native-buzz-huddle="desktop"/);
  assert.match(social, /Open BUZZ Desktop/);
  assert.doesNotMatch(social, /getUserMedia|AudioWorklet|start_huddle|join_huddle/);
  assert.match(reuse, /2edacde4d4c01490834725774aa878dbc373c41d/);
  assert.match(reuse, /Apache License 2\.0/);
  assert.match(reuse, /HuddleContext\.tsx/);
  assert.match(reuse, /does not transplant or imitate that audio stack/);
});

test("#1129 excludes peer compute and keeps PPF out of the social write path", async () => {
  const [workspace, social, gateway, reuse] = await Promise.all([
    read("app/community-workspace.tsx"),
    read(SOCIAL),
    read("build/buzz-guildhall-gateway.ts"),
    read("docs/third-party/buzz-community-reuse.md"),
  ]);
  assert.doesNotMatch(`${workspace}\n${social}\n${gateway}`, /mesh-compute|remote compute|GPU provider|comfyui|shell execution/i);
  assert.doesNotMatch(`${workspace}\n${social}`, /setItem\([^\n]*(project|ppf|canon)/i);
  assert.match(reuse, /does not adopt BUZZ Mesh or peer compute/);
});