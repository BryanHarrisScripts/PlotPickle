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
  assert.match(glyph, /#35c9b8|#7cf1df|#2aa99a/i);
  assert.match(glyph, /#f1d183|#e5bd67|#d7bc76/i);
  assert.doesNotMatch(glyph, /<rect[^>]+fill=/i);
});

test("Community exposes the Great Hall, Story Rooms, people, live agents, review queue and Guildhall", async () => {
  const workspace = await read("app/community-workspace.tsx");

  for (const label of ["Great Hall", "Story Rooms", "Connected Studios", "People", "Agents & Stewards", "Review Queue", "Guildhall"]) {
    assert.match(workspace, new RegExp(label.replace(/[&]/g, "&")));
  }
  assert.match(workspace, /CommunityAgentRoster/);
  assert.match(workspace, /<CommunityAgentRoster \/>/);
  assert.match(workspace, /\/community\/status/);
  assert.match(workspace, /\/guildhall\/status/);
  assert.match(workspace, /\/rooms\/ensure/);
  assert.match(workspace, /\/messages/);
  assert.match(workspace, /FOUNDATION_PROJECT_STORAGE_KEY/);
  assert.match(workspace, /Nothing changes PPF canon without approval/);
  assert.match(workspace, /Buzz provides the signed community layer underneath; the writer stays inside PlotPickle/);
});

test("Community navigation is expandable, room-first, keyboard-addressable and preserves every existing destination", async () => {
  const [workspace, navigationStyles] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("app/community-navigation.module.css"),
  ]);

  assert.match(workspace, /useState\(true\)/);
  assert.match(workspace, /aria-label="Community and Guildhall navigation"/);
  assert.match(workspace, /aria-expanded=\{navigationExpanded\}/);
  assert.match(workspace, /aria-controls="community-destinations"/);
  assert.match(workspace, /id="community-destinations"/);
  assert.match(workspace, /aria-label="Community destinations"/);
  assert.match(workspace, /aria-current=\{section === item\.id \? "page" : undefined\}/);
  assert.match(workspace, /data-primary=\{item\.primary \? "true" : undefined\}/);

  const greatHall = workspace.indexOf('{ id: "great-hall"');
  const storyRooms = workspace.indexOf('{ id: "story-rooms"');
  const connectedStudios = workspace.indexOf('{ id: "connected-studios"');
  const people = workspace.indexOf('{ id: "people"');
  assert.ok(greatHall > -1 && storyRooms > greatHall && connectedStudios > storyRooms && people > connectedStudios,
    "Great Hall and Story Rooms should remain the first room-first destinations after Overview");
  assert.match(workspace, /great-hall"[^\n]+primary: true/);
  assert.match(workspace, /story-rooms"[^\n]+primary: true/);

  assert.match(navigationStyles, /grid-template-columns:\s*minmax\(205px, 246px\) minmax\(0, 1fr\)/);
  assert.match(navigationStyles, /\.communityRail\s*\{[^}]*position:\s*sticky/s);
  assert.match(navigationStyles, /@media \(max-width: 900px\)[\s\S]*grid-template-columns:\s*1fr/);
});

test("Great Hall and Story Rooms behave like conversations with reply and room-return affordances", async () => {
  const workspace = await read("app/community-workspace.tsx");

  assert.match(workspace, /aria-label="Great Hall conversation"/);
  assert.match(workspace, /aria-label="Story Room conversation"/);
  assert.match(workspace, /aria-label=\{`Reply to \$\{author\} in the Great Hall`\}/);
  assert.match(workspace, /aria-label=\{`Reply to \$\{author\} in this Story Room`\}/);
  assert.match(workspace, /function replyToHall\(author: string\)/);
  assert.match(workspace, /function replyToStory\(author: string\)/);
  assert.match(workspace, /useState<BuzzStoryRoomId \| null>\(null\)/);
  assert.match(workspace, /function closeStoryRoom\(\)/);
  assert.match(workspace, /setSelectedRoomId\(null\)/);
  assert.match(workspace, />Back to Story Rooms<\/button>/);
});

test("Connected Studios is staged honestly and never becomes a dead-end before federation lands", async () => {
  const workspace = await read("app/community-workspace.tsx");

  assert.match(workspace, /section === "connected-studios"/);
  assert.match(workspace, /Community remains fully usable locally while Studio federation and presence are added/);
  assert.match(workspace, /Nothing on this screen opens your local PlotPickle server to another Studio/);
  assert.match(workspace, />Open Great Hall<\/button>/);
  assert.match(workspace, />See People<\/button>/);
});

test("Community overview adds a right-rail quick jump for recent public Great Hall conversations", async () => {
  const [shell, rail, railStyles] = await Promise.all([
    read("app/plotpickle-workspace-shell.tsx"),
    read("app/community-public-conversations-rail.tsx"),
    read("app/community-public-conversations-rail.module.css"),
  ]);

  assert.match(shell, /CommunityPublicConversationsRail/);
  assert.match(shell, /activeWorkspace === "community"/);
  assert.match(rail, /\/api\/local-buzz\/community\/status/);
  assert.match(rail, /recentActivity/);
  assert.match(rail, /slice\(0, 5\)/);
  assert.match(rail, /Recent public conversations/);
  assert.match(rail, /Jump back into the Great Hall/);
  assert.match(rail, /Private Story Rooms and Guildhall rooms stay out of this list/);
  assert.match(rail, /button\.textContent\?\.trim\(\) === "Great Hall"/);
  assert.match(rail, /greatHall\.click\(\)/);
  assert.match(railStyles, /grid-column:\s*3/);
  assert.match(railStyles, /grid-row:\s*2 \/ 4/);
  assert.match(railStyles, /header > div\[role="status"\]/);
});

test("native Community reads Great Hall membership, profile and presence through the supported Buzz CLI", async () => {
  const [gateway, vite] = await Promise.all([
    read("build/buzz-community-gateway.ts"),
    read("vite.config.ts"),
  ]);

  assert.match(vite, /import \{ buzzCommunityGateway \} from "\.\/build\/buzz-community-gateway"/);
  assert.match(vite, /buzzCommunityGateway\(\),\s*buzzAgentRosterGateway\(\),\s*buzzGuildhallGateway\(\),\s*buzzLiveHealthGateway\(\),\s*buzzStoryRoomAccessGateway\(\),\s*buzzGateway\(\)/);
  assert.match(gateway, /channels", "members", "--channel"/);
  assert.match(gateway, /"users", "get"/);
  assert.match(gateway, /"users", "presence", "--pubkeys"/);
  assert.match(gateway, /"messages", "get", "--channel"/);
  assert.match(gateway, /"channels", "add-member"/);
  assert.match(gateway, /"channels", "remove-member"/);
  assert.match(gateway, /fullRosterSupported: false/);
  assert.match(gateway, /inviteManagement: "buzz-desktop"/);
});

test("normal Great Hall conversation is projected away from BUZZ and UAT telemetry", async () => {
  const [projection, gateway] = await Promise.all([
    read("lib/community-conversation.ts"),
    read("build/buzz-community-gateway.ts"),
  ]);

  assert.match(projection, /if \(parsed\.type !== "agent\.note"\) return null/);
  assert.match(projection, /Synthetic Agent/);
  assert.match(projection, /Synthetic Writer/);
  assert.match(projection, /looksOperational/);
  assert.match(projection, /technical reference hidden/);
  assert.match(projection, /local path hidden/);
  assert.match(projection, /RAW_HASH/);
  assert.match(projection, /TRANSPORT_ID/);
  assert.match(projection, /displayAuthor\(name, role, badge\)/);
  assert.match(gateway, /projectCommunityConversationFeed/);
  assert.match(gateway, /const recentActivity = projectCommunityConversationFeed\(namedActivity\)\.slice\(0, 20\)/);
  assert.match(gateway, /operational BUZZ evidence stays in diagnostics/);
});

test("technical BUZZ evidence remains intact outside the human conversation projection", async () => {
  const [gateway, guildhall, liveActivity] = await Promise.all([
    read("build/buzz-community-gateway.ts"),
    read("lib/buzz-guildhall.ts"),
    read("scripts/buzz-live-activity.mjs"),
  ]);

  assert.match(gateway, /runBuzz\(connection, \["messages", "get", "--channel", greatHall\.id/);
  assert.match(guildhall, /formatBuzzGuildhallEvent/);
  assert.match(guildhall, /`type=\$\{event\.type\} severity=/);
  assert.match(guildhall, /evidence: \$\{evidence\.label\}/);
  assert.match(guildhall, /`route=\$\{channel\.name\}`/);
  assert.match(liveActivity, /type=\$\{event\.type\} severity=/);
  assert.match(liveActivity, /evidence: \$\{evidence\.label\}/);
  assert.match(liveActivity, /route=\$\{channel\.name\}/);
});

test("Community preserves the local credential and owner-review boundaries", async () => {
  const [gateway, workspace, roster] = await Promise.all([
    read("build/buzz-community-gateway.ts"),
    read("app/community-workspace.tsx"),
    read("app/community-agent-roster.tsx"),
  ]);

  assert.match(gateway, /readCredentialJson/);
  assert.match(gateway, /BUZZ_PRIVATE_KEY: connection\.privateKey/);
  assert.match(gateway, /if \(!isLocalRequest\(request\)\)/);
  assert.match(gateway, /\[redacted-nsec\]/);
  assert.match(workspace, /Full community-wide invitation issuance is not exposed by the current Buzz CLI/);
  assert.match(workspace, /use Buzz Desktop for the initial invite/);
  assert.match(roster, /Open Buzz Desktop → Agents to create and approve this steward/);
  assert.match(roster, /Needs owner approval/);
  assert.doesNotMatch(`${workspace}\n${roster}`, /automatic.*merge/i);
});