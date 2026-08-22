import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("#1065 registers Merrin as a host-owned BUZZ-managed Community Agent Profile", async () => {
  const [profileExtension, loader, playhouse] = await Promise.all([
    read("config/agent-profile-extensions/community.json").then(JSON.parse),
    read("lib/agent-profiles.ts"),
    read("plugins/plotpickle-playhouse/community.json").then(JSON.parse),
  ]);
  const profile = profileExtension.profiles.find((item) => item.id === "merrin-bellwarden");
  assert.ok(profile, "Merrin Agent Profile is missing");
  assert.equal(profile.execution.kind, "buzz-managed");
  assert.equal(profile.execution.roleId, "community-moderator");
  assert.deepEqual(profile.buzzBinding, { actorId: "merrin-bellwarden", mode: "native" });
  assert.equal(profile.homeRoomId, "great-hall");
  assert.match(loader, /communityProfileConfig/);
  assert.match(loader, /profiles: \[\.\.\.BASE_AGENT_PROFILE_REGISTRY\.profiles, \.\.\.COMMUNITY_AGENT_PROFILES\]/);
  assert.ok(playhouse.agents.some((helper) => helper.profileId === "merrin-bellwarden" && helper.helpGroup === "community"));
});

test("#1065 keeps ordinary Great Hall greetings while later policy may expand eligible public-room coverage", async () => {
  const extension = JSON.parse(await read("config/buzz-guildhall-community.json"));
  const actor = extension.actors.find((item) => item.id === "merrin-bellwarden");
  assert.ok(actor, "Merrin BUZZ actor is missing");
  assert.equal(actor.kind, "buzz-native-agent");
  assert.equal(actor.runtime, "buzz");
  assert.equal(actor.primaryChannel, "great-hall");
  assert.equal(actor.buzzPresence, "native-draft");
  assert.equal(actor.managedAgent.respondTo, "anyone");
  assert.equal(actor.managedAgent.subscribe, "all");
  assert.equal(actor.managedAgent.noMentionFilter, true);
  assert.equal(actor.managedAgent.membership, "eligible-public-community-rooms");
  assert.equal(actor.managedAgent.privateStoryRoomPolicy, "explicit-membership-only");
  assert.match(actor.systemPrompt, /plain greeting such as hi, hello, hey/i);
  assert.match(actor.systemPrompt, /do not require an @mention/i);
});

test("#1065 requires conversation judgment instead of replying to every room message", async () => {
  const actor = JSON.parse(await read("config/buzz-guildhall-community.json")).actors[0];
  assert.match(actor.systemPrompt, /stay silent rather than answering every message/i);
  assert.match(actor.systemPrompt, /people are already having a useful conversation/i);
  assert.match(actor.systemPrompt, /Keep replies concise and human/i);
});

test("#1065 keeps Moderator memory bounded and outside private creative authority", async () => {
  const [profile, actor] = await Promise.all([
    read("config/agent-profile-extensions/community.json").then((source) => JSON.parse(source).profiles[0]),
    read("config/buzz-guildhall-community.json").then((source) => JSON.parse(source).actors[0]),
  ]);
  assert.ok(profile.readScopes.includes("great-hall-public-conversation"));
  assert.ok(profile.readScopes.includes("eligible-public-community-conversation"));
  assert.ok(profile.forbiddenCapabilities.includes("private-story-room-read-without-explicit-membership"));
  assert.ok(profile.forbiddenCapabilities.includes("ppf-project-read"));
  assert.ok(profile.forbiddenCapabilities.includes("moderation-enforcement"));
  assert.equal(profile.creativeAuthority, "none");
  assert.match(actor.systemPrompt, /Private Story Rooms are explicit-membership-only/i);
  assert.match(actor.systemPrompt, /Never ingest LEARN answers, PLAN decisions, BUILD artifacts, PPF project state/i);
  assert.match(actor.systemPrompt, /Never ban, delete, block, punish/i);
});

test("#1065 uses a real owner-approved BUZZ identity instead of PlotPickle impersonation", async () => {
  const [profile, actor, rosterGateway, mirror] = await Promise.all([
    read("config/agent-profile-extensions/community.json"),
    read("config/buzz-guildhall-community.json"),
    read("build/buzz-agent-roster-gateway.ts"),
    read("config/buzz-guildhall.json").then(JSON.parse),
  ]);
  assert.match(profile, /own signed BUZZ identity/);
  assert.match(actor, /own BUZZ identity/);
  assert.match(rosterGateway, /"users", "get", "--name", actor\.displayName, "--owner", "me"/);
  assert.match(rosterGateway, /verified: verification === "verified"/);
  assert.equal(mirror.conversationMirror.agentIdentityPolicy, "own-signed-buzz-identity");
  assert.equal(mirror.conversationMirror.agentImpersonationFallback, false);
});
