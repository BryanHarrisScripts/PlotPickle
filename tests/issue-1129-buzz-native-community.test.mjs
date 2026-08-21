import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const SOCIAL = "modules/community/community-buzz-social.tsx";

test("#1129 keeps Great Hall as the real BUZZ-backed PlotPickle BBS", async () => {
  const [workspace, terminal, mirror] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("app/community-backdoor-terminal.tsx"),
    read("config/buzz-guildhall.json").then(JSON.parse),
  ]);
  assert.match(workspace, /room\.id === "great-hall"/);
  assert.match(workspace, /createGreatHallActiveRoom/);
  assert.match(workspace, /<CommunityBackdoorTerminal/);
  assert.match(terminal, /PLOTPICKLE COMMUNITY BBS/);
  assert.match(terminal, /THE DOOR IS OPEN/);
  assert.match(terminal, /\(@::@\)/);
  assert.match(terminal, /postMessage\(activeRoom\.channelId, roomDraft\.trim\(\)\)/);
  assert.equal(mirror.conversationMirror.messageAuthority, "buzz");
  assert.equal(mirror.conversationMirror.historyModel, "one-buzz-room-history");
  assert.equal(mirror.conversationMirror.offlineShadowHistory, false);
});

test("#1129 exposes BUZZ Channels, Forums and native Direct Messages instead of a second social backend", async () => {
  const [workspace, social, gateway] = await Promise.all([
    read("app/community-workspace.tsx"),
    read(SOCIAL),
    read("build/buzz-guildhall-gateway.ts"),
  ]);
  assert.match(workspace, />Channels</);
  assert.match(workspace, />Forums</);
  assert.match(workspace, />Direct Messages</);
  assert.match(workspace, /room\.type === "stream"/);
  assert.match(workspace, /room\.type === "forum"/);
  assert.match(gateway, /\["dms", "list", "--limit", "100"\]/);
  assert.match(gateway, /const args = \["dms", "open"\]/);
  assert.match(gateway, /args\.push\("--pubkey", pubkey\)/);
  assert.match(social, /Participant-scoped native BUZZ direct message/);
  assert.doesNotMatch(`${workspace}\n${social}\n${gateway}`, /community-messages\.json|community-dms\.json|better-sqlite/i);
});

test("#1129 mirrors ordinary Channel Forum and DM conversation through the same BUZZ message route", async () => {
  const social = await read(SOCIAL);
  assert.match(social, /fetch\(`\$\{BUZZ_API\}\/messages\?channel=/);
  assert.match(social, /fetch\(`\$\{BUZZ_API\}\/messages`,/);
  assert.match(social, /body: JSON\.stringify\(\{ channel: channelId, content \}\)/);
  assert.match(social, /data-buzz-event-id=\{message\.id\}/);
  assert.match(social, /window\.setInterval/);
  assert.match(social, /5000/);
  assert.match(social, /Buzz Desktop will see the same event/);
  assert.doesNotMatch(social, /localStorage|sessionStorage|indexedDB/i);
});

test("#1129 requires the verified Human BUZZ signer for messages and DM creation", async () => {
  const [workspace, guard] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("build/buzz-human-identity-guard.ts"),
  ]);
  assert.match(workspace, /isKnownHumanBuzzIdentity\(humanIdentity\)/);
  assert.match(workspace, /Open Profile · BUZZ Identity/);
  assert.match(workspace, /\[aria-label="PlotPickle Profile"\] details/);
  assert.match(guard, /url\.pathname === `\$\{API\}\/messages`/);
  assert.match(guard, /url\.pathname === `\$\{API\}\/guildhall\/dms\/open`/);
  assert.match(guard, /human-buzz-identity-required/);
  assert.match(guard, /kind: "agent"/);
});

test("#1129 keeps Huddle voice native to BUZZ instead of faking a browser audio stack", async () => {
  const [social, reuse] = await Promise.all([
    read(SOCIAL),
    read("docs/third-party/buzz-community-reuse.md"),
  ]);
  assert.match(social, /data-native-buzz-huddle="desktop"/);
  assert.match(social, /Open Huddle in Buzz Desktop/);
  assert.match(social, /native Tauri\/Rust audio owner and WebSocket Opus relay/);
  assert.match(social, /Text remains usable if voice is unavailable/);
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
  assert.match(reuse, /Great Hall reads\/writes the same authoritative BUZZ channel history visible from Buzz Desktop/);
});
