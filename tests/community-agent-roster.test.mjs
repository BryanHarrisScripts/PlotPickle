import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the Guildhall roster includes every active slim-product agent with a lore identity", async () => {
  const config = JSON.parse(await read("config/buzz-guildhall.json"));
  const byRole = new Map(config.actors.filter((actor) => actor.existingRoleId).map((actor) => [actor.existingRoleId, actor]));

  assert.equal(byRole.get("curriculum-guide")?.displayName, "Sage Brinewick");
  assert.equal(byRole.get("foundations-planner")?.displayName, "Tamsin Hearthquill");
  assert.equal(byRole.get("wyrmwood-rival-director")?.displayName, "Master Oaken-Vague");
  assert.equal(byRole.get("wyrmwood-curriculum-evaluator")?.displayName, "Rowan Scalequill");
  assert.equal(byRole.get("foundations-planner")?.title, "Keeper of Foundations");
  assert.equal(byRole.get("foundations-planner")?.primaryChannel, "story-council");
});

test("Community shows a live roster sourced from Mastra activity and BUZZ-native presence", async () => {
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
  assert.match(roster, /Last activity/);
  assert.match(roster, /Needs owner approval/);
  assert.match(model, /trace\?\.status === "running"/);
  assert.match(model, /status\?\.mastra\?\.ready === true/);
  assert.match(model, /status\?\.mastra\?\.agents\?\.includes\(actorRoleId\)/);
  assert.match(model, /BUZZ reports this steward online/);
});

test("the roster distinguishes active, on-demand and preserved parked roles without pretending all services are online", async () => {
  const model = await read("lib/community-agent-roster.ts");

  assert.match(model, /PARKED_PRODUCT_ACTORS = new Set\(\["quillan-reedcloak", "elowen-mapweaver", "mira-threadmere"\]\)/);
  assert.match(model, /state: "on-demand"/);
  assert.match(model, /Runs only when the Writer-in-Residence journey is started/);
  assert.match(model, /Starts when rendered visual review needs evidence/);
  assert.match(model, /Runs when PlotPickle executes deterministic quality gates/);
  assert.match(model, /preserved off to the side until its broader story module is reworked into the slim app/);
  assert.match(model, /state: "unavailable"/);
  assert.match(model, /will not guess whether the steward exists or is online/);
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
