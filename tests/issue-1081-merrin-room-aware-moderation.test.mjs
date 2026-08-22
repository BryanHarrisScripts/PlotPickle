import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

async function moderationFixture() {
  const [community, profileExtension, playhouse] = await Promise.all([
    read("config/buzz-guildhall-community.json").then(JSON.parse),
    read("config/agent-profile-extensions/community.json").then(JSON.parse),
    read("plugins/plotpickle-playhouse/community.json").then(JSON.parse),
  ]);
  return {
    policy: community.moderationPolicy,
    actor: community.actors.find((item) => item.id === "merrin-bellwarden"),
    profile: profileExtension.profiles.find((item) => item.id === "merrin-bellwarden"),
    helper: playhouse.agents.find((item) => item.profileId === "merrin-bellwarden"),
  };
}

test("#1081 defines one host-owned contextual moderation policy with proportionate outcomes", async () => {
  const { policy, actor } = await moderationFixture();
  assert.ok(policy, "Community moderation policy is missing");
  assert.equal(policy.id, "merrin-room-aware-v1");
  assert.equal(policy.actorId, "merrin-bellwarden");
  assert.equal(policy.decisionModel, "context-not-keywords");
  assert.deepEqual(policy.outcomes, [
    "allow",
    "allow-and-observe",
    "redirect",
    "deescalate",
    "safety-intervene",
    "escalate-for-human-review",
  ]);
  assert.equal(policy.fictionalSensitiveContentAllowed, true);
  assert.equal(policy.hardEnforcement, false);
  assert.equal(actor.managedAgent.moderationPolicyId, policy.id);
});

test("#1081 covers eligible public rooms by default without silently entering private Story Rooms", async () => {
  const { policy, actor, profile } = await moderationFixture();
  assert.deepEqual(policy.roomCoverage, {
    greatHall: "default",
    publicCommunityRooms: "default",
    privateStoryRooms: "explicit-membership-only",
  });
  assert.equal(actor.managedAgent.membership, "eligible-public-community-rooms");
  assert.equal(actor.managedAgent.privateStoryRoomPolicy, "explicit-membership-only");
  assert.ok(profile.readScopes.includes("eligible-public-community-conversation"));
  assert.ok(profile.readScopes.includes("explicit-member-private-story-room-conversation"));
  assert.ok(profile.forbiddenCapabilities.includes("private-story-room-read-without-explicit-membership"));
  assert.match(actor.systemPrompt, /never silently subscribe to or ingest a private Story Room/i);
});

test("#1081 protects legitimate fictional mature story discussion from keyword moderation", async () => {
  const { actor } = await moderationFixture();
  const prompt = actor.systemPrompt;
  assert.match(prompt, /context, not banned words/i);
  assert.match(prompt, /fictional character carrying a gun/i);
  assert.match(prompt, /addiction or drug use in a story/i);
  assert.match(prompt, /fictional suicide attempt/i);
  assert.match(prompt, /fictional mass-casualty event/i);
  assert.match(prompt, /Strong language inside fictional dialogue is not automatically harassment/i);
  assert.match(prompt, /should normally be allowed or quietly observed/i);
});

test("#1081 distinguishes real-world harmful behavior from story-building context", async () => {
  const { actor, policy } = await moderationFixture();
  const prompt = actor.systemPrompt;
  assert.deepEqual(policy.categories, [
    "harassment-and-rudeness",
    "persistent-off-topic",
    "real-world-drugs",
    "real-world-weapons",
    "self-harm-or-suicide",
    "mass-violence",
  ]);
  assert.match(prompt, /real-world sourcing, trafficking, production\/preparation instructions/i);
  assert.match(prompt, /real-world threats, harm planning, procurement intended to evade controls/i);
  assert.match(prompt, /their own current risk/i);
  assert.match(prompt, /credible real-world threats, planning, encouragement or glorification/i);
  assert.match(prompt, /requiring human review/i);
});

test("#1081 handles rudeness and off-topic behavior proportionately rather than punishing automatically", async () => {
  const { actor } = await moderationFixture();
  const prompt = actor.systemPrompt;
  assert.match(prompt, /targeted insults, bullying, harassment or repeated disruption/i);
  assert.match(prompt, /briefly de-escalate and remind people of room norms/i);
  assert.match(prompt, /do not punish ordinary disagreement/i);
  assert.match(prompt, /brief harmless side conversation, stay silent/i);
  assert.match(prompt, /persistently unrelated to PlotPickle, writing, storytelling, filmmaking, visual creation/i);
  assert.match(prompt, /gently redirect/i);
});

test("#1081 keeps safety escalation human-reviewed and denies hard moderation authority", async () => {
  const { policy, actor, profile } = await moderationFixture();
  assert.equal(policy.humanReviewRoute, "existing-report-block-controls");
  assert.ok(profile.requestedCapabilities.includes("human-review-escalation"));
  for (const capability of ["moderation-enforcement", "message-delete", "member-ban", "member-block", "room-permission-mutation"]) {
    assert.ok(profile.forbiddenCapabilities.includes(capability), `${capability} must remain forbidden`);
  }
  assert.match(actor.systemPrompt, /Never ban, delete, block, punish, alter permissions/i);
  assert.match(actor.systemPrompt, /surface the existing human report\/review path/i);
  assert.match(actor.systemPrompt, /never expose internal scores or hidden moderation reasoning/i);
});

test("#1081 forbids sensitive-person profiling and keeps private creative state outside moderation memory", async () => {
  const { policy, actor, profile, helper } = await moderationFixture();
  assert.equal(policy.sensitiveMemoryPolicy, "do-not-profile");
  assert.ok(profile.forbiddenCapabilities.includes("sensitive-person-profiling"));
  assert.ok(profile.forbiddenCapabilities.includes("ppf-project-read"));
  assert.match(actor.systemPrompt, /never build sensitive profiles about addiction, mental health, weapon ownership, politics, religion/i);
  assert.match(actor.systemPrompt, /Never copy private Story Room text into public memory, public conversation, training data or PPF canon/i);
  assert.match(helper.helpPrompt, /Community conduct/i);
  assert.ok(helper.roomIds.includes("great-hall"));
});
