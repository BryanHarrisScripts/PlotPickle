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

  for (const label of ["Great Hall", "Story Rooms", "People", "Agents & Stewards", "Review Queue", "Guildhall"]) {
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

test("native Community reads Great Hall membership, profile and presence through the supported Buzz CLI", async () => {
  const [gateway, vite] = await Promise.all([
    read("build/buzz-community-gateway.ts"),
    read("vite.config.ts"),
  ]);

  assert.match(vite, /import \{ buzzCommunityGateway \} from "\.\/build\/buzz-community-gateway"/);
  assert.match(vite, /buzzCommunityGateway\(\),\s*buzzAgentRosterGateway\(\),\s*buzzGuildhallGateway\(\),\s*buzzLiveHealthGateway\(\),\s*buzzGateway\(\)/);
  assert.match(gateway, /channels", "members", "--channel"/);
  assert.match(gateway, /"users", "get"/);
  assert.match(gateway, /"users", "presence", "--pubkeys"/);
  assert.match(gateway, /"messages", "get", "--channel"/);
  assert.match(gateway, /"channels", "add-member"/);
  assert.match(gateway, /"channels", "remove-member"/);
  assert.match(gateway, /fullRosterSupported: false/);
  assert.match(gateway, /inviteManagement: "buzz-desktop"/);
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
