import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Community remains a native PlotPickle workspace beside Dashboard", async () => {
  const [page, nav, glyph] = await Promise.all([
    read("app/page.tsx"),
    read("app/plotpickle-workspace-shell.tsx"),
    read("public/assets/workflow-relics/community.svg"),
  ]);
  assert.match(page, /requested === "community"/);
  assert.match(page, /<CommunityWorkspace onOpenSettings=\{\(\) => navigateWorkspace\("settings"\)\}/);
  const dashboard = nav.indexOf('id: "dashboard"');
  const community = nav.indexOf('id: "community"');
  const learn = nav.indexOf('id: "learn"');
  assert.ok(dashboard >= 0 && dashboard < community && community < learn);
  assert.match(nav, /community\.svg/);
  assert.match(glyph, /transparent PlotPickle guild sigil/i);
});

test("Community uses the existing three-column shell for BUZZ social navigation, conversation, and context", async () => {
  const [workspace, navigationStyles, socialStyles, continuity] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("app/community-navigation.module.css"),
    read("app/community-buzz-social.module.css"),
    read("app/workspace-continuity.css"),
  ]);
  assert.match(workspace, /aria-label="BUZZ Community navigation"/);
  assert.match(workspace, />Channels</);
  assert.match(workspace, />Forums</);
  assert.match(workspace, />Direct Messages</);
  assert.match(navigationStyles, /\.communityLayout\s*\{[^}]*display:\s*contents;/s);
  assert.match(navigationStyles, /\.communityRail\s*\{[^}]*grid-column:\s*1;/s);
  assert.match(navigationStyles, /\.communityContent\s*\{[^}]*grid-column:\s*2 \/ 4;[^}]*grid-template-columns:\s*subgrid;/s);
  assert.match(socialStyles, /\.conversation\s*\{[^}]*grid-column:\s*1;/s);
  assert.match(socialStyles, /\.context\s*\{[^}]*grid-column:\s*2;/s);
  assert.match(continuity, /--pp-workspace-columns:\s*minmax\(240px, 19%\) minmax\(440px, 56%\) minmax\(300px, 25%\)/);
});

test("Great Hall remains the PlotPickle terminal while other rooms use the BUZZ social surface", async () => {
  const [workspace, terminal, social] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("app/community-backdoor-terminal.tsx"),
    read("app/community-buzz-social.tsx"),
  ]);
  assert.match(workspace, /room\.id === "great-hall"/);
  assert.match(workspace, /createGreatHallActiveRoom/);
  assert.match(workspace, /terminalRoom \? <CommunityBackdoorTerminal/);
  assert.match(workspace, /<CommunityBuzzSocial target=\{selectedTarget\}/);
  assert.match(terminal, /PLOTPICKLE COMMUNITY BBS/);
  assert.match(terminal, /THE DOOR IS OPEN/);
  assert.match(terminal, /postMessage\(activeRoom\.channelId, roomDraft\.trim\(\)\)/);
  assert.match(social, /kind: "channel" \| "forum" \| "dm"/);
});

test("Community caller comes from the authoritative Human BUZZ identity and Profile is the setup surface", async () => {
  const [workspace, guard] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("build/buzz-human-identity-guard.ts"),
  ]);
  assert.match(workspace, /request<HumanBuzzIdentity & \{ ok: true \}>\("\/human-identity"\)/);
  assert.match(workspace, /humanCanPost = isKnownHumanBuzzIdentity\(humanIdentity\)/);
  assert.match(workspace, /data-community-caller="verified-human"/);
  assert.match(workspace, /Open Profile · BUZZ Identity/);
  assert.match(workspace, /\[aria-label="PlotPickle Profile"\] details/);
  assert.match(guard, /Human BUZZ identity|human Community caller|human-buzz-identity-required/i);
  assert.match(guard, /kind: "agent"/);
});

test("Channels Forums and DMs use real BUZZ message and DM contracts", async () => {
  const [workspace, social, gateway] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("app/community-buzz-social.tsx"),
    read("build/buzz-guildhall-gateway.ts"),
  ]);
  assert.match(workspace, /room\.type === "stream"/);
  assert.match(workspace, /room\.type === "forum"/);
  assert.match(workspace, /\/guildhall\/dms/);
  assert.match(workspace, /\/guildhall\/dms\/open/);
  assert.match(gateway, /\["dms", "list", "--limit", "100"\]/);
  assert.match(gateway, /const args = \["dms", "open"\]/);
  assert.match(social, /\/messages\?channel=/);
  assert.match(social, /body: JSON\.stringify\(\{ channel: channelId, content \}\)/);
  assert.match(social, /data-buzz-event-id/);
  assert.doesNotMatch(`${workspace}\n${social}`, /localStorage|sessionStorage|indexedDB/i);
});

test("Buzz Desktop and PlotPickle retain one conversation authority", async () => {
  const [config, mirrorTest, social] = await Promise.all([
    read("config/buzz-guildhall.json").then(JSON.parse),
    read("tests/issue-1067-buzz-conversation-mirror.test.mjs"),
    read("app/community-buzz-social.tsx"),
  ]);
  assert.equal(config.conversationMirror.messageAuthority, "buzz");
  assert.deepEqual(config.conversationMirror.clients, ["plotpickle", "buzz-desktop"]);
  assert.equal(config.conversationMirror.historyModel, "one-buzz-room-history");
  assert.equal(config.conversationMirror.offlineShadowHistory, false);
  assert.match(mirrorTest, /one BUZZ room history shared by PlotPickle and Buzz Desktop/);
  assert.match(social, /Buzz Desktop will see the same event/);
});

test("Huddles remain native BUZZ voice and never fake browser ownership", async () => {
  const [social, reuse] = await Promise.all([
    read("app/community-buzz-social.tsx"),
    read("docs/third-party/buzz-community-reuse.md"),
  ]);
  assert.match(social, /data-native-buzz-huddle="desktop"/);
  assert.match(social, /Open Huddle in Buzz Desktop/);
  assert.match(social, /Tauri\/Rust audio owner and WebSocket Opus relay/);
  assert.doesNotMatch(social, /getUserMedia|AudioWorklet|start_huddle|join_huddle/);
  assert.match(reuse, /desktop\/src\/features\/huddle\/HuddleContext\.tsx/);
});

test("Community preserves local credential, agent separation, and no-secret boundaries", async () => {
  const [gateway, guard, workspace] = await Promise.all([
    read("build/buzz-guildhall-gateway.ts"),
    read("build/buzz-human-identity-guard.ts"),
    read("app/community-workspace.tsx"),
  ]);
  assert.match(gateway, /readCredentialJson/);
  assert.match(gateway, /BUZZ_PRIVATE_KEY: connection\.privateKey/);
  assert.match(gateway, /if \(!isLocalRequest\(request\)\)/);
  assert.match(gateway, /\[redacted-nsec\]/);
  assert.match(guard, /BUZZ_GUILDHALL_ACTORS/);
  assert.match(guard, /humanCommunityAllowed/);
  assert.match(guard, /\[redacted-secret\]/);
  assert.doesNotMatch(workspace, /privateKey|nsec1/i);
});

test("Community conversation cannot become PPF canon or peer compute implicitly", async () => {
  const [workspace, social, reuse] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("app/community-buzz-social.tsx"),
    read("docs/third-party/buzz-community-reuse.md"),
  ]);
  assert.doesNotMatch(`${workspace}\n${social}`, /setItem\([^\n]*(project|ppf|canon)/i);
  assert.doesNotMatch(`${workspace}\n${social}`, /mesh-compute|GPU provider|comfyui|shell execution/i);
  assert.match(reuse, /does not adopt BUZZ Mesh or peer compute/);
});
