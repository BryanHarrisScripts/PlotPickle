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

test("Community uses the existing three-column shell with one simple room rail", async () => {
  const [workspace, navigationStyles, socialStyles, continuity] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("app/community-navigation.module.css"),
    read("modules/community/community-buzz-social.module.css"),
    read("app/workspace-continuity.css"),
  ]);
  assert.match(workspace, /aria-label="BUZZ Community navigation"/);
  assert.match(workspace, />Rooms</);
  assert.match(workspace, />Direct Messages</);
  assert.match(workspace, />Your PlotPickle</);
  assert.doesNotMatch(workspace, />Channels</);
  assert.doesNotMatch(workspace, />Forums</);
  assert.match(navigationStyles, /\.communityLayout\s*\{[^}]*display:\s*contents;/s);
  assert.match(navigationStyles, /\.communityRail\s*\{[^}]*grid-column:\s*1;/s);
  assert.match(navigationStyles, /\.communityContent\s*\{[^}]*grid-column:\s*2 \/ 4;[^}]*grid-template-columns:\s*subgrid;/s);
  assert.match(socialStyles, /\.conversation\s*\{[^}]*grid-column:\s*1;/s);
  assert.match(socialStyles, /\.context\s*\{[^}]*grid-column:\s*2;/s);
  assert.match(continuity, /--pp-workspace-columns:\s*minmax\(240px, 19%\) minmax\(440px, 56%\) minmax\(300px, 25%\)/);
});

test("normal Community rail exposes four Human-purpose rooms instead of internal architecture", async () => {
  const workspace = await read("app/community-workspace.tsx");
  for (const id of ["great-hall", "story-council", "wyrmwood-ring", "marquee"]) assert.match(workspace, new RegExp(`id: "${id}"`));
  for (const label of ["Great Hall", "Story Workshop", "Wyrmwood", "Marquee"]) assert.match(workspace, new RegExp(`label: "${label}"`));
  for (const hidden of ["gatehouse", "forge", "lantern-watch", "wayfarer-journal", "github-herald"]) {
    assert.doesNotMatch(workspace, new RegExp(`id: "${hidden}"`));
  }
  assert.match(workspace, /Private Story Room/);
  assert.match(workspace, /12 OFFICIAL/);
});

test("Great Hall uses the same readable BUZZ social surface as other public rooms", async () => {
  const [workspace, social] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("modules/community/community-buzz-social.tsx"),
  ]);
  assert.match(workspace, /chooseRoom\("great-hall"\)/);
  assert.match(workspace, /<CommunityBuzzSocial target=\{selectedTarget\}/);
  assert.doesNotMatch(workspace, /CommunityBackdoorTerminal|createGreatHallActiveRoom/);
  assert.match(social, /What this room is for/);
  assert.match(social, /Who helps here/);
  assert.match(social, /isLegacyOperationalDump/);
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
  assert.match(workspace, /You speak as yourself\. Agents use separate identities/);
  assert.match(guard, /Human BUZZ identity|human Community caller|human-buzz-identity-required/i);
});

test("purpose-led rooms and DMs use real BUZZ message and DM contracts", async () => {
  const [workspace, social, gateway] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("modules/community/community-buzz-social.tsx"),
    read("build/buzz-guildhall-gateway.ts"),
  ]);
  assert.match(workspace, /room\.type === "forum" \? "forum" : "channel"/);
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
  const [config, social] = await Promise.all([
    read("config/buzz-guildhall.json").then(JSON.parse),
    read("modules/community/community-buzz-social.tsx"),
  ]);
  assert.equal(config.conversationMirror.messageAuthority, "buzz");
  assert.deepEqual(config.conversationMirror.clients, ["plotpickle", "buzz-desktop"]);
  assert.equal(config.conversationMirror.historyModel, "one-buzz-room-history");
  assert.equal(config.conversationMirror.offlineShadowHistory, false);
  assert.match(social, /Message sent as your connected Human BUZZ identity/);
});

test("Huddles remain native to BUZZ Desktop instead of adding a browser audio stack", async () => {
  const social = await read("modules/community/community-buzz-social.tsx");
  assert.match(social, /data-native-buzz-huddle="desktop"/);
  assert.match(social, /Open BUZZ Desktop/);
  assert.doesNotMatch(social, /getUserMedia|AudioWorklet|start_huddle|join_huddle/);
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
  assert.match(guard, /redactBuzzDiagnostic/);
  assert.doesNotMatch(workspace, /privateKey|nsec1/i);
});

test("Community conversation cannot become PPF canon or peer compute implicitly", async () => {
  const [workspace, social, reuse] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("modules/community/community-buzz-social.tsx"),
    read("docs/third-party/buzz-community-reuse.md"),
  ]);
  assert.doesNotMatch(`${workspace}\n${social}`, /setItem\([^\n]*(project|ppf|canon)/i);
  assert.doesNotMatch(`${workspace}\n${social}`, /mesh-compute|GPU provider|comfyui|shell execution/i);
  assert.match(reuse, /does not adopt BUZZ Mesh or peer compute/);
});
