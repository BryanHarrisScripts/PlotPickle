import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildAgentHealthCensus } from "../core/agents/agent-health-census.mjs";
import { createAgentHealthCommandSession, parseAgentHealthCommand } from "../modules/agent-health/command.mjs";

const root = new URL("../", import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root), "utf8"));
const fixture = async () => {
  const profiles = [...(await json("config/agent-profiles.json")).profiles,
    ...(await json("config/agent-profile-extensions/community.json")).profiles];
  const runtime = await readFile(new URL("build/mastra-agent-runtime.ts", root), "utf8");
  const rolesSection = runtime.split("export const PLOTPICKLE_AGENT_ROLES = {")[1].split("} as const")[0];
  const roleIds = [...rolesSection.matchAll(/^\s*(?:"([a-z0-9-]+)"|([a-z][a-z0-9-]+))\s*:/gmu)].map(x => x[1] || x[2]);
  const guildhallActorIds = [...(await json("config/buzz-guildhall.json")).actors,
    ...(await json("config/buzz-guildhall-community.json")).actors].map(x => x.id);
  const playhouseIds = (await json("plugins/plotpickle-playhouse/community.json")).agents.map(x => x.profileId);
  const workers = [
    "full-story-builder", "visual-production", "video-production", "ui-continuity", "creative-writer-uat",
  ].map(agentId => ({ agentId }));
  const developers = (await json("config/developer-agent-stack.json")).requiredAgents;
  return { profiles, roleIds, guildhallActorIds, playhouseIds, workers, developers };
};
function services(census, { route = "local", now = 200_000, changedProfile = false } = {}) {
  let profileId = "synthetic-unlocked-profile";
  const calls = [];
  let ticks = now;
  const routing = { ok: true, text: { selected: route, options: { [route]: {
    ready: true, model: route === "openai" ? "synthetic-cloud-model" : "synthetic-local-model",
  } } } };
  const writing = { ok: true, mastra: { ready: true, agents: census.entries.filter(x => x.roleId).map(x => x.roleId) } };
  const buzz = { ok: true, identityVerified: false, agents: [] };
  const fakeOutput = role => {
    if (role === "story-architect") return JSON.stringify({ structural: { state: "unresolved", reason: "No full block", passageIds: ["synthetic-01"] },
      characters: [], miniBlocks: [1, 2, 3, 4].map(ordinal => ({ ordinal, state: "unsupported", reason: "Synthetic source cannot prove this section", passageIds: ["synthetic-01"], storyboardCue: "" })) });
    if (role === "foundations-planner") return JSON.stringify({ values: { "output-1": "Provisional — a compass changes hands and prompts a trust dispute." } });
    if (role === "discovery-mapper") return JSON.stringify({ act: 1, lane: "scene", reason: "An opening situation.", evidenceRefs: ["synthetic-01"] });
    if (role === "wyrmwood-rival-director") return JSON.stringify({ oakenOpening: "A story challenge begins", pickle: { title: "Trust", situation: "One choice", goal: "Decide", constraints: ["No violence"], establishedElements: ["Compass","Table"], failurePressure: "Time" }, rivals: Object.fromEntries(["aiden-glowhart","damien-darkmore","barnaby-barnacle","master-spirit-talker","sienna-silvertongue"].map(x => [x, { action: "Choose", complication: "Time" }])) });
    if (role === "wyrmwood-curriculum-evaluator") return JSON.stringify({ dimensions: { storyLogic: 10, lessonApplication: 10, establishedElements: 10, consequences: 10, rivalCounter: 8, clarity: 7 }, whatWorked: ["A decision"], whatNeedsWork: ["Consent"], conceptUsed: "Choice", teachingDebrief: "Check a choice." });
    return "The synthetic compass changes hands before the original owner comes back; this could create a trust conflict.";
  };
  return {
    calls,
    expire: ms => { ticks += ms; },
    switchProfile: () => { profileId = "other-human"; },
    services: {
      profile: async () => profileId,
      now: () => ticks,
      token: () => "abcdef1234567890",
      progress: () => {},
      request: async (path, body, maxMs) => {
        calls.push({ path, body, maxMs });
        if (path.endsWith("/agent-compute")) return { ok: true, agentHealthCensus: census };
        if (path.endsWith("/status") && path.includes("writing-assistant")) return writing;
        if (path.endsWith("/agent-roster")) return buzz;
        if (path.endsWith("/ai-routing/status")) return routing;
        if (path.endsWith("/chat")) {
          if (changedProfile) profileId = "other-human";
          return { ok: true, provider: route, model: routing.text.options[route].model, text: fakeOutput(body.agentId) };
        }
        throw Error("Unapproved API");
      },
    },
  };
}
test("#3008 census reconciles all source owners and exposes mismatches without calling agents", async () => {
  const input = await fixture();
  assert.equal(input.profiles.length, 20);
  assert.equal(input.roleIds.length, 16);
  const census = buildAgentHealthCensus(input);
  assert.equal(census.entries.length, 35); // 20 profiles + 7 role-only + 5 workers + Supervisor + Pi/Cline
  assert.equal(census.entries.filter(x => x.testMode === "mastra").length, 16);
  assert.equal(census.entries.filter(x => x.owner === "production-worker").length, 5);
  assert.equal(census.entries.filter(x => x.owner === "buzz-managed").length, 6);
  assert.equal(census.entries.filter(x => x.owner === "external-developer").length, 2);
  assert.equal(census.entries.find(x => x.id === "merrin-bellwarden")?.sources.includes("guildhall"), true);
  for (const id of ["knot-pickle","thread-pickle","heart-pickle"]) assert.match(census.warnings.join(" "), new RegExp(id));
  assert.equal(census.entries.find(x => x.id === "elowen-mapweaver").roleId, "story-architect");
  assert.ok(census.entries.some(x => x.id === "mastra-role:graphic-novel"), "role-only Mastra agents cannot disappear");
  assert.ok(census.entries.some(x => x.id === "production-supervisor"), "orchestrator must be accounted for");
  const withAddedProfile = buildAgentHealthCensus({ ...input,
    profiles: [...input.profiles, { id: "synthetic-new", displayName: "Synthetic", execution: { kind: "buzz-managed" }, buzzBinding: { actorId: "synthetic-new" } }] });
  assert.equal(withAddedProfile.entries.length, 36);
  const withPeer = buildAgentHealthCensus({ ...input, dynamicPeers: [{ id: "synthetic-discovered-peer", name: "Visitor" }] });
  assert.equal(withPeer.entries.length, 36);
});
test("#3008 parser confines health actions and never parses arbitrary tokens or prompts", () => {
  assert.deepEqual(parseAgentHealthCommand("PlotPickle agents inventory"), { action: "inventory" });
  assert.deepEqual(parseAgentHealthCommand("PlotPickle agents test quick local"), { action: "test", selection: "quick", localOnly: true });
  assert.deepEqual(parseAgentHealthCommand("PlotPickle agents test one sage-brinewick"), { action: "test", selection: "one", agentId: "sage-brinewick", localOnly: false });
  assert.deepEqual(parseAgentHealthCommand("PlotPickle agents confirm abcdef1234567890 CHARGES SHARE"), { action: "confirm", token: "abcdef1234567890", charges: true, share: true });
  assert.equal(parseAgentHealthCommand("plotpickle agents test one sage-brinewick key=SECRET").action, "invalid");
  assert.equal(parseAgentHealthCommand("plotpickle agents confirm abcdef1234567890 charges charges").action, "invalid");
  assert.equal(parseAgentHealthCommand("freeform narration"), null);
});
test("#3008 registration is not success; no inference for inventory or report", async () => {
  const census = buildAgentHealthCensus(await fixture());
  const ctx = services(census); const session = createAgentHealthCommandSession(ctx.services);
  const output = await session.execute({ action: "inventory" });
  assert.match(output, /Discovered 35 distinct source entries/);
  assert.match(output, /External BUZZ peers are NOT enumerable/);
  assert.match(output, /0\/35 live I\/O results/);
  assert.equal(ctx.calls.filter(x => x.path.endsWith("/chat")).length, 0);
  assert.match(await session.execute({ action: "report" }), /NO REPORT/);
});
test("#3008 live requests require human confirmation and prohibit paid cloud without charges and share", async () => {
  const census = buildAgentHealthCensus(await fixture());
  const ctx = services(census, { route: "openai" }); const session = createAgentHealthCommandSession(ctx.services);
  const command = { action: "test", selection: "one", agentId: "elowen-mapweaver", localOnly: false };
  const preview = await session.execute(command);
  assert.match(preview, /PlotPickle agents confirm abcdef1234567890 CHARGES SHARE/);
  assert.match(preview, /exact usage\/charge quote unavailable/);
  assert.equal(ctx.calls.filter(x => x.path.endsWith("/chat")).length, 0);
  assert.match(await session.execute({ action: "confirm", token: "abcdef1234567890", charges: true, share: false }), /BLOCKED/);
  assert.match(await session.execute({ action: "confirm", token: "abcdef1234567890", charges: true, share: true }), /BLOCKED/);
  assert.equal(ctx.calls.filter(x => x.path.endsWith("/chat")).length, 0);
  assert.match(await session.execute(command), /PREVIEW/);
  const result = await session.execute({ action: "confirm", token: "abcdef1234567890", charges: true, share: true });
  assert.match(result, /elowen-mapweaver: PASS \[structured-output\]/);
  assert.match(result, /live PASS: 1/);
  assert.equal(ctx.calls.filter(x => x.path.endsWith("/chat")).length, 1);
  assert.ok(!result.includes("SYNTHETIC NONCANON FICTION"), "no synthetic prompt/response echoes");
  assert.match(await session.execute({ action: "confirm", token: "abcdef1234567890", charges: true, share: true }), /BLOCKED/);
});
test("#3008 expired previews, changed owner and unsupported BUZZ action fail closed", async () => {
  const census = buildAgentHealthCensus(await fixture());
  const ctx = services(census);
  const session = createAgentHealthCommandSession(ctx.services);
  assert.match(await session.execute({ action: "test", selection: "one", agentId: "knot-pickle", localOnly: false }), /BLOCKED/);
  assert.match(await session.execute({ action: "test", selection: "one", agentId: "not-real", localOnly: false }), /BLOCKED/);
  assert.match(await session.execute({ action: "test", selection: "one", agentId: "curriculum-guide", localOnly: false }), /PREVIEW/);
  ctx.expire(120_001);
  assert.match(await session.execute({ action: "confirm", token: "abcdef1234567890", charges: false, share: false }), /expired/);
  assert.equal(ctx.calls.filter(x => x.path.endsWith("/chat")).length, 0);
  assert.match(await session.execute({ action: "test", selection: "one", agentId: "curriculum-guide", localOnly: false }), /PREVIEW/);
  ctx.switchProfile();
  assert.match(await session.execute({ action: "confirm", token: "abcdef1234567890", charges: false, share: false }), /BLOCKED/);
  assert.equal(ctx.calls.filter(x => x.path.endsWith("/chat")).length, 0);
});
test("#3008 quick uses every Mastra role with bounded calls and names every uncallable/BUZZ worker", async () => {
  const census = buildAgentHealthCensus(await fixture());
  const ctx = services(census); const session = createAgentHealthCommandSession(ctx.services);
  const preview = await session.execute({ action: "test", selection: "quick", localOnly: true });
  assert.match(preview, /16 Mastra roles; 35 source entries/);
  assert.match(preview, /at most 120 seconds/);
  const result = await session.execute({ action: "confirm", token: "abcdef1234567890", charges: false, share: false });
  assert.equal(ctx.calls.filter(x => x.path.endsWith("/chat")).length, 16);
  assert.match(result, /35\/35 accounted for/);
  assert.match(result, /live PASS: 16/);
  assert.match(result, /knot-pickle: BLOCKED/);
  assert.match(result, /production-worker:video-production: BLOCKED/);
  assert.match(result, /external-developer:pi: BLOCKED/);
  assert.match(result, /NOT ALL AGENTS VERIFIED/);
  assert.match(await session.execute({ action: "report" }), /35\/35 accounted for/);
});
test("#3008 wiring is native command + real owner endpoints and never fabricates BUZZ posting", async () => {
  const [command, server, supervisor, gateway] = await Promise.all([
    readFile(new URL("app/skin-v1/global-dsdd-conversation.tsx",root),"utf8"),
    readFile(new URL("build/agent-compute-gateway.ts",root),"utf8"),
    readFile(new URL("scripts/production-supervisor-agent.mjs",root),"utf8"),
    readFile(new URL("modules/agent-health/command.mjs",root),"utf8"),
  ]);
  assert.match(command, /if \(await runAgentHealthCommand\(submitted\)\) return;/);
  assert.match(command, /authenticatedProfileFetch\(apiPath/);
  assert.match(server, /agentHealthCensus: buildAgentHealthCensus/);
  assert.match(supervisor, /const registry = PRODUCTION_SUPERVISOR_WORKERS/);
  assert.match(gateway, /"\/api\/writing-assistant\/chat"/);
  assert.match(gateway, /"\/api\/local-buzz\/agent-roster"/);
  assert.doesNotMatch(gateway, /\/api\/local-buzz\/(?:send|post|message)/);
});
