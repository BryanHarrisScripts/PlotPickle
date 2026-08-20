import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Community is a native slim PlotPickle workspace beside Dashboard", async () => {
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
  assert.doesNotMatch(glyph, /<rect[^>]+fill=/i);
});

test("Community keeps its established destinations while Great Hall becomes Hall 1 instead of a standalone sibling", async () => {
  const workspace = await read("app/community-workspace.tsx");

  for (const label of ["Great Hall", "Story Rooms", "Connected Studios", "People", "Agents & Stewards", "Review Queue", "Guildhall"]) {
    assert.match(workspace, new RegExp(label.replace(/[&]/g, "&")));
  }
  assert.match(workspace, /CommunityAgentRoster/);
  assert.match(workspace, /<CommunityAgentRoster \/>/);
  assert.match(workspace, /\/community\/status/);
  assert.match(workspace, /\/guildhall\/status/);
  assert.match(workspace, /\/human-identity/);
  assert.match(workspace, /\/rooms\/ensure/);
  assert.match(workspace, /loadFoundationProject/);
  assert.match(workspace, /Nothing changes PPF canon without approval/);
  assert.match(workspace, /Buzz provides the signed community layer underneath; the writer stays inside PlotPickle/);
  assert.doesNotMatch(workspace, /\{ id: "great-hall", label: "Great Hall"/);
  assert.match(workspace, /data-community-room=\{COMMUNITY_GREAT_HALL_ROOM_ID\}/);
  assert.match(workspace, /Hall 1 · Great Hall/);
});

test("Story Rooms owns the six visible hall destinations and legacy broad story remains compatibility-only", async () => {
  const [workspace, contract, navigationStyles, continuity] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("lib/buzz-story-room.ts"),
    read("app/community-navigation.module.css"),
    read("app/workspace-continuity.css"),
  ]);

  assert.match(workspace, /useState<CommunitySection \| null>\("story-rooms"\)/);
  assert.match(workspace, /useState<ActiveBbsRoom \| null>\(null\)/);
  assert.match(workspace, /COMMUNITY_VISIBLE_STORY_ROOMS\.map/);
  assert.match(workspace, /createGreatHallActiveRoom/);
  assert.match(workspace, /createStoryActiveRoom/);
  assert.match(workspace, /onClick=\{openGreatHall\}/);
  assert.match(workspace, /onClick=\{\(\) => openStoryRoom\(definition\.id\)\}/);
  assert.match(workspace, /legacy broad `story` channel remains compatibility data only/i);
  assert.doesNotMatch(workspace, /selectedRoomId/);
  assert.doesNotMatch(workspace, /hallDraft/);
  assert.doesNotMatch(workspace, /storyDraft/);

  assert.match(contract, /LEGACY_BROAD_STORY_ROOM_ID: BuzzStoryRoomId = "story"/);
  assert.match(contract, /filter\(\(room\) => room\.id !== LEGACY_BROAD_STORY_ROOM_ID\)/);
  assert.match(contract, /hallNumber: index \+ 2/);
  assert.match(contract, /hallNumber: 1/);
  assert.match(contract, /kind: "great-hall"/);
  assert.match(contract, /kind: "story-room"/);

  assert.match(continuity, /--pp-workspace-columns:\s*minmax\(240px, 19%\) minmax\(440px, 56%\) minmax\(300px, 25%\)/);
  assert.match(continuity, /\[data-active-workspace="community"\][\s\S]*grid-template-columns:\s*var\(--pp-workspace-columns\)\s*!important;/);
  assert.match(navigationStyles, /\.communityLayout\s*\{[^}]*display:\s*contents;/s);
  assert.match(navigationStyles, /\.communityRail\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*1 \/ 5;/s);
  assert.match(navigationStyles, /\.communityContent\s*\{[^}]*display:\s*grid;[^}]*grid-column:\s*2 \/ 4;[^}]*grid-row:\s*2 \/ 4;[^}]*grid-template-columns:\s*subgrid;/s);
  assert.match(navigationStyles, /\.communityContent > main\[data-community-terminal="backdoor-v1"\]\s*\{[^}]*padding:\s*0;/s);
  assert.doesNotMatch(navigationStyles, /19fr|81fr|56fr|25fr/);
});

test("Community caller is resolved from the authoritative human identity endpoint rather than identityLabel", async () => {
  const [workspace, terminal, settings, contract] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("app/community-backdoor-terminal.tsx"),
    read("app/buzz-settings-panel.tsx"),
    read("lib/buzz-story-room.ts"),
  ]);

  assert.match(workspace, /request<HumanBuzzIdentity & \{ ok: true \}>\("\/human-identity"\)/);
  assert.match(workspace, /data-community-caller="verified-human"/);
  assert.match(workspace, /humanBuzzFingerprint/);
  assert.match(workspace, /humanCanPost = isKnownHumanBuzzIdentity\(humanIdentity\)/);
  assert.match(workspace, /data-community-identity-mismatch/);
  assert.match(workspace, /Connect \/ Claim writer identity/);
  assert.doesNotMatch(workspace, /<CommunityBackdoorTerminal[^>]+identityLabel=/s);
  assert.doesNotMatch(workspace, /CALLER[\s\S]{0,250}identityLabel/);

  assert.match(terminal, /readonly humanIdentity: HumanBuzzIdentity \| null/);
  assert.match(terminal, /readonly canPost: boolean/);
  assert.match(terminal, /CALLER/);
  assert.match(terminal, /humanBuzzFingerprint/);
  assert.match(terminal, /data-human-identity-blocked="true"/);
  assert.match(terminal, /Sage is your PlotPickle guide; Sage is not your Community identity/);
  assert.match(terminal, /disabled=\{!canPost\}/);
  assert.match(terminal, /!canPost \|\| !roomDraft\.trim\(\)/);

  assert.match(settings, /Friendly local label/);
  assert.match(settings, /Verified Buzz signer \/ profile/);
  assert.match(settings, /Convenience label only\. It never determines signed BUZZ authorship/);
  assert.match(settings, /Local identity label \(optional\)/);
  assert.match(settings, /It never overrides the verified BUZZ signer\/profile or Community authorship/);
  assert.match(settings, /Sage is your PlotPickle guide; Sage is not your Community identity/);

  assert.match(contract, /humanCommunityAllowed/);
  assert.match(contract, /kind: "human" \| "agent" \| "unknown"/);
  assert.match(contract, /isKnownHumanBuzzIdentity/);
});

test("room-first terminal loads the selected BUZZ channel, sends only when the human signer is valid, and preserves HOLD plus typing safety", async () => {
  const terminal = await read("app/community-backdoor-terminal.tsx");

  assert.match(terminal, /activeRoom\.channelId/);
  assert.match(terminal, /readMessages\(activeRoom\.channelId\)/);
  assert.match(terminal, /postMessage\(activeRoom\.channelId, roomDraft\.trim\(\)\)/);
  assert.match(terminal, /chronological/);
  assert.match(terminal, /window\.setInterval/);
  assert.match(terminal, /5000/);
  assert.match(terminal, /if \(halted \|\| !screenRef\.current\) return/);
  assert.match(terminal, /editableTarget\(event\.target\)/);
  assert.ok(terminal.includes("(@[A-Za-z0-9._-]+)"), "terminal must parse simple @username tokens");
  assert.match(terminal, /data-mention="true"/);
  assert.match(terminal, /setRoomDraft\(\(current\) => current \|\| `@\$\{author\} `\)/);
  assert.match(terminal, /HALL \$\{activeRoom\.hallNumber\}/);
  assert.match(terminal, /desktopUrl \? <a href=\{desktopUrl\}>BUZZ DESKTOP<\/a>/);
  assert.match(terminal, /filter\(\(channel\) => channel\.id !== "great-hall"\)/);
});

test("Connected Studios and the public-conversations rail both return through Hall 1", async () => {
  const [workspace, panel, rail, railStyles] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("app/connected-studios-panel.tsx"),
    read("app/community-public-conversations-rail.tsx"),
    read("app/community-public-conversations-rail.module.css"),
  ]);

  assert.match(workspace, /section === "connected-studios"/);
  assert.match(workspace, /ConnectedStudiosPanel/);
  assert.match(workspace, /onOpenGreatHall=\{openGreatHall\}/);
  assert.match(panel, /\/api\/playhouse-directory/);
  assert.match(panel, /Visit Great Hall/);
  assert.match(panel, /Community discovery offline/);
  assert.match(panel, /permanent Studio ID/);

  assert.match(rail, /\/api\/local-buzz\/community\/status/);
  assert.match(rail, /recentActivity/);
  assert.match(rail, /slice\(0, 5\)/);
  assert.match(rail, /Hall 1 · Great Hall/);
  assert.match(rail, /Private Story Rooms and Guildhall agent routes stay out of this list/);
  assert.match(rail, /\[data-community-room="great-hall"\]/);
  assert.match(rail, /getAttribute\("aria-current"\) === "page"/);
  assert.match(rail, /greatHall\.click\(\)/);
  assert.match(railStyles, /grid-column:\s*3/);
  assert.match(railStyles, /grid-row:\s*2 \/ 4/);
});

test("native Community preserves the server-side human signer guard and private-key redaction", async () => {
  const [gateway, guard, vite] = await Promise.all([
    read("build/buzz-community-gateway.ts"),
    read("build/buzz-human-identity-guard.ts"),
    read("vite.config.ts"),
  ]);

  assert.match(vite, /import \{ buzzCommunityGateway \} from "\.\/build\/buzz-community-gateway"/);
  assert.match(vite, /import \{ buzzHumanIdentityGuard \} from "\.\/build\/buzz-human-identity-guard"/);
  assert.match(vite, /buzzHumanIdentityGuard\(\)/);
  assert.match(gateway, /"users", "get"/);
  assert.match(gateway, /"messages", "get", "--channel"/);
  assert.match(gateway, /fullRosterSupported: false/);
  assert.match(gateway, /inviteManagement: "buzz-desktop"/);

  assert.match(guard, /humanCommunityAllowed/);
  assert.match(guard, /BUZZ_GUILDHALL_ACTORS/);
  assert.match(guard, /"--format", "compact", "users", "get"/);
  assert.match(guard, /human-buzz-identity-required/);
  assert.match(guard, /Sage is your PlotPickle guide; Sage is not your Community identity/);
  assert.match(guard, /url\.pathname === `\$\{API\}\/messages` && isBrowserAuthoredRequest\(request\)/);
  assert.match(guard, /url\.pathname === `\$\{API\}\/human-identity`/);
  assert.match(guard, /\[redacted-nsec\]/);
});

test("normal Great Hall conversation is projected away from BUZZ and UAT telemetry while Guildhall keeps technical evidence", async () => {
  const [projection, gateway, guildhall, liveActivity] = await Promise.all([
    read("lib/community-conversation.ts"),
    read("build/buzz-community-gateway.ts"),
    read("lib/buzz-guildhall.ts"),
    read("scripts/buzz-live-activity.mjs"),
  ]);

  assert.match(projection, /if \(parsed\.type !== "agent\.note"\) return null/);
  assert.match(projection, /Synthetic Agent/);
  assert.match(projection, /Synthetic Writer/);
  assert.match(projection, /looksOperational/);
  assert.match(projection, /technical reference hidden/);
  assert.match(projection, /RAW_HASH/);
  assert.match(gateway, /projectCommunityConversationFeed/);
  assert.match(gateway, /operational BUZZ evidence stays in diagnostics/);
  assert.match(guildhall, /formatBuzzGuildhallEvent/);
  assert.match(guildhall, /`route=\$\{channel\.name\}`/);
  assert.match(liveActivity, /route=\$\{channel\.name\}/);
});

test("Community preserves local credentials, owner review, and no-secret boundaries", async () => {
  const [gateway, guard, workspace, roster, settings] = await Promise.all([
    read("build/buzz-community-gateway.ts"),
    read("build/buzz-human-identity-guard.ts"),
    read("app/community-workspace.tsx"),
    read("app/community-agent-roster.tsx"),
    read("app/buzz-settings-panel.tsx"),
  ]);

  assert.match(gateway, /readCredentialJson/);
  assert.match(gateway, /BUZZ_PRIVATE_KEY: connection\.privateKey/);
  assert.match(gateway, /if \(!isLocalRequest\(request\)\)/);
  assert.match(gateway, /\[redacted-nsec\]/);
  assert.match(guard, /\[redacted-secret\]/);
  assert.match(workspace, /Full community-wide invitation issuance is not exposed by the current Buzz CLI/);
  assert.match(workspace, /use Buzz Desktop for the initial invite/);
  assert.match(roster, /Open Buzz Desktop → Agents to create and approve this steward/);
  assert.match(roster, /Needs owner approval/);
  assert.match(settings, /Do not put your Buzz nsec in GitHub/);
  assert.doesNotMatch(`${workspace}\n${roster}`, /automatic.*merge/i);
});
