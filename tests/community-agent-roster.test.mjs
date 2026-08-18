import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the canonical Agent Contract registry includes every active slim-product agent identity", async () => {
  const config = JSON.parse(await read("config/agent-profiles.json"));
  const byRole = new Map(config.profiles.filter((profile) => profile.execution?.roleId).map((profile) => [profile.execution.roleId, profile]));

  assert.equal(config.schemaVersion, 2);
  assert.equal(byRole.get("curriculum-guide")?.displayName, "Sage Brinewick");
  assert.equal(byRole.get("foundations-planner")?.displayName, "Tamsin Hearthquill");
  assert.equal(byRole.get("wyrmwood-rival-director")?.displayName, "Master Oaken-Vague");
  assert.equal(byRole.get("wyrmwood-curriculum-evaluator")?.displayName, "Rowan Scalequill");
  assert.equal(byRole.get("visual-director")?.displayName, "The Marquee Director");
  assert.equal(byRole.get("critic")?.displayName, "Critics' Circle");
  assert.equal(byRole.get("foundations-planner")?.title, "Keeper of Foundations");
  assert.equal(byRole.get("foundations-planner")?.homeRoomId, "story-council");
  assert.equal(byRole.get("curriculum-guide")?.buzzBinding?.actorId, "sage-brinewick");
});

test("Community shows a live roster sourced from Agent Contracts plus Mastra activity and BUZZ presence", async () => {
  const [workspace, roster, model] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("app/community-agent-roster.tsx"),
    read("lib/community-agent-roster.ts"),
  ]);

  assert.match(workspace, /import CommunityAgentRoster from "\.\/community-agent-roster"/);
  assert.match(workspace, /<CommunityAgentRoster \/>/);
  assert.match(roster, /\/api\/writing-assistant\/status/);
  assert.match(roster, /\/api\/writing-assistant\/traces/);
  assert.match(roster, /\/api\/local-buzz\/agent-roster/);
  assert.match(roster, /setInterval\(\(\) => void refresh\(\), 7_500\)/);
  assert.match(roster, /Runs in/);
  assert.match(roster, /Home room/);
  assert.match(roster, /Active model/);
  assert.match(roster, /Last activity/);
  assert.match(roster, /Capabilities, memory & boundaries/);
  assert.match(roster, /Memory scope/);
  assert.match(roster, /Needs owner approval/);
  assert.match(model, /AGENT_PROFILES\.map/);
  assert.match(model, /trace\?\.status === "running"/);
  assert.match(model, /status\?\.mastra\?\.ready === true/);
  assert.match(model, /status\?\.mastra\?\.agents\?\.includes\(roleId\)/);
  assert.match(model, /profile\.buzzBinding\.actorId/);
  assert.match(model, /BUZZ reports this agent online/);
  assert.match(model, /avatarInitials/);
  assert.match(model, /projectMemoryPolicy/);
});

test("the roster derives active, on-demand and parked roles from PlotPickle availability without duplicating BUZZ lifecycle settings", async () => {
  const [profiles, model] = await Promise.all([
    read("config/agent-profiles.json"),
    read("lib/community-agent-roster.ts"),
  ]);

  assert.match(profiles, /"quillan-reedcloak"[\s\S]*?"defaultAvailability": "parked"/);
  assert.match(profiles, /"avery-north"[\s\S]*?"defaultAvailability": "on-demand"/);
  assert.doesNotMatch(profiles, /"startOnLaunch"|"autoRestart"|"parallelism"|"respondTo"/);
  assert.match(model, /profile\.defaultAvailability === "parked"/);
  assert.match(model, /state: "on-demand"/);
  assert.match(model, /Runs only when the Writer-in-Residence journey is started/);
  assert.match(model, /Starts when rendered visual review needs evidence/);
  assert.match(model, /Runs when PlotPickle executes deterministic quality gates/);
  assert.match(model, /intentionally inactive until this product area returns to the active workflow/);
  assert.match(model, /state: "unavailable"/);
  assert.match(model, /will not guess whether the agent exists or is online/);
});

test("BUZZ-native steward lookup is local, read-only and owner-scoped", async () => {
  const [gateway, vite] = await Promise.all([
    read("build/buzz-agent-roster-gateway.ts"),
    read("vite.config.ts"),
  ]);

  assert.match(vite, /import \{ buzzAgentRosterGateway \} from "\.\/build\/buzz-agent-roster-gateway"/);
  assert.match(vite, /buzzCommunityGateway\(\),\s*buzzAgentRosterGateway\(\),\s*buzzGuildhallGateway\(\)/);
  assert.match(gateway, /\/api\/local-buzz\/agent-roster/);
  assert.match(gateway, /if \(!isLocalRequest\(request\)\)/);
  assert.match(gateway, /request\.method !== "GET"/);
  assert.match(gateway, /"users", "get", "--name", actor\.displayName, "--owner", "me"/);
  assert.match(gateway, /"users", "presence", "--pubkeys", pubkey/);
  assert.match(gateway, /BUZZ_PRIVATE_KEY: connection\.privateKey/);
  assert.match(gateway, /\[redacted-nsec\]/);
  assert.doesNotMatch(gateway, /agents", "draft"|agents", "create"|channels", "add-member"/);
});