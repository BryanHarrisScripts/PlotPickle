import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

async function communityConfig() {
  return JSON.parse(await read("config/buzz-guildhall-community.json"));
}

async function merrinProfile() {
  const config = JSON.parse(await read("config/agent-profile-extensions/community.json"));
  return config.profiles.find((profile) => profile.id === "merrin-bellwarden");
}

test("#1081 uses a contextual moderation contract instead of a sensitive-word blacklist", async () => {
  const config = await communityConfig();
  const policy = config.moderationPolicy;
  assert.equal(policy.schemaVersion, 1);
  assert.equal(policy.principle, "context-not-keywords");
  assert.deepEqual(policy.outcomes, [
    "allow",
    "allow-and-observe",
    "redirect",
    "deescalate",
    "safety-intervene",
    "escalate-for-human-review",
  ]);
  assert.equal("blockedKeywords" in policy, false);
  assert.equal("bannedWords" in policy, false);

  const safeByCategory = new Map(policy.creativeSafeExamples.map((example) => [example.category, example]));
  const interventionByCategory = new Map(policy.interventionExamples.map((example) => [example.category, example]));
  for (const category of ["drugs", "weapons", "self-harm", "mass-violence"]) {
    assert.ok(safeByCategory.has(category), `${category} needs a legitimate story-context regression`);
    assert.ok(interventionByCategory.has(category), `${category} needs a real-world intervention regression`);
    assert.match(safeByCategory.get(category).outcome, /^allow(?:-and-observe)?$/);
    assert.doesNotMatch(interventionByCategory.get(category).outcome, /^allow/);
  }
});

test("#1081 protects legitimate mature story-building from automatic moderation", async () => {
  const config = await communityConfig();
  const safe = config.moderationPolicy.creativeSafeExamples;
  const ids = new Set(safe.map((example) => example.id));
  for (const id of [
    "fictional-firearm",
    "fictional-addiction",
    "fictional-self-harm-scene",
    "fictional-mass-casualty-plot",
    "dialogue-profanity",
  ]) assert.ok(ids.has(id), `missing safe-context regression ${id}`);

  const prompt = config.actors[0].systemPrompt;
  assert.match(prompt, /MODERATE BY CONTEXT, NOT KEYWORDS/i);
  assert.match(prompt, /fictional gun, addiction, drug reference, suicide attempt, mass-casualty event, profanity/i);
  assert.match(prompt, /not misconduct merely because it appears in a story/i);
  assert.match(prompt, /Allow legitimate fictional, historical, educational and analytical story-building discussion/i);
});

test("#1081 covers real-world harmful behavior harassment and persistent disruption proportionately", async () => {
  const config = await communityConfig();
  const interventions = new Map(config.moderationPolicy.interventionExamples.map((example) => [example.id, example.outcome]));
  assert.equal(interventions.get("real-drug-sourcing"), "safety-intervene");
  assert.equal(interventions.get("real-weapon-harm"), "escalate-for-human-review");
  assert.equal(interventions.get("current-self-harm-risk"), "safety-intervene");
  assert.equal(interventions.get("credible-mass-violence-threat"), "escalate-for-human-review");
  assert.equal(interventions.get("targeted-harassment"), "deescalate");
  assert.equal(interventions.get("persistent-off-topic-disruption"), "redirect");

  const prompt = config.actors[0].systemPrompt;
  assert.match(prompt, /real-world harmful, threatening, instructional, promotional, coercive or abusive/i);
  assert.match(prompt, /only persistent unrelated disruption should receive a friendly redirect/i);
  assert.match(prompt, /do not investigate, interrogate or independently punish/i);
});

test("#1081 treats apparent current self-harm risk as a safety concern without diagnosis or profile memory", async () => {
  const config = await communityConfig();
  const prompt = config.actors[0].systemPrompt;
  assert.match(prompt, /their own current suicide or self-harm risk/i);
  assert.match(prompt, /respond supportively and seriously/i);
  assert.match(prompt, /encourage immediate human help through the appropriate available safety\/reporting path/i);
  assert.match(prompt, /do not diagnose them/i);
  assert.match(prompt, /do not store the crisis disclosure as ordinary preference memory/i);

  const forbiddenProfiles = config.moderationPolicy.memory.forbiddenSensitiveProfiles.join("\n");
  assert.match(forbiddenProfiles, /addiction or substance-use history/i);
  assert.match(forbiddenProfiles, /mental-health diagnosis/i);
  assert.match(forbiddenProfiles, /weapon ownership/i);
  assert.match(forbiddenProfiles, /political or religious identity/i);
  assert.match(forbiddenProfiles, /private crisis disclosures/i);
});

test("#1081 expands only through explicit BUZZ room membership and keeps private Story Rooms opt-in", async () => {
  const [config, profile, publicRail] = await Promise.all([
    communityConfig(),
    merrinProfile(),
    read("app/community-public-conversations-rail.tsx"),
  ]);
  const actor = config.actors[0];
  assert.equal(actor.primaryChannel, "great-hall");
  assert.equal(actor.managedAgent.respondTo, "anyone");
  assert.equal(actor.managedAgent.subscribe, "all");
  assert.equal(actor.managedAgent.noMentionFilter, true);
  assert.equal(actor.managedAgent.membership, "explicit-eligible-room-memberships");
  assert.equal(config.moderationPolicy.roomCoverage.publicCommunity, "all-eligible-rooms-where-merrin-is-a-buzz-member");
  assert.equal(config.moderationPolicy.roomCoverage.privateStoryRooms, "explicit-owner-opt-in-and-buzz-membership-only");
  assert.equal(config.moderationPolicy.roomCoverage.inaccessibleRooms, "no-observation-no-moderation-claim");
  assert.ok(profile.readScopes.includes("explicit-owner-opted-in-private-room-moderation-context"));
  assert.ok(profile.forbiddenCapabilities.includes("private-story-room-read-without-owner-opt-in"));
  assert.match(profile.verificationContract, /BUZZ membership remains runtime authority/i);
  assert.match(actor.systemPrompt, /Never claim to have observed or moderated a room you could not read/i);
  assert.match(publicRail, /Great Hall is PlotPickle's public conversation surface/i);
  assert.match(publicRail, /Private Story Rooms and Guildhall rooms stay out of this list/i);
});

test("#1081 keeps Merrin conversational and human-review based rather than autonomous enforcement", async () => {
  const [config, profile] = await Promise.all([communityConfig(), merrinProfile()]);
  const allowed = new Set(config.moderationPolicy.enforcement.allowed);
  const forbidden = new Set(config.moderationPolicy.enforcement.forbidden);
  for (const action of ["reply", "warn-or-remind", "redirect", "deescalate", "surface-human-review-concern"]) {
    assert.ok(allowed.has(action), `missing allowed moderation action ${action}`);
  }
  for (const action of ["delete-history", "permanent-ban", "block-user-on-behalf-of-owner", "alter-room-permissions", "change-code", "write-github", "change-ppf-canon"]) {
    assert.ok(forbidden.has(action), `missing forbidden enforcement action ${action}`);
  }
  assert.ok(profile.forbiddenCapabilities.includes("moderation-enforcement"));
  assert.ok(profile.requestedCapabilities.includes("human-review-escalation-proposal"));
  assert.equal(profile.creativeAuthority, "none");
  assert.match(config.actors[0].systemPrompt, /Never expose internal moderation labels, scores, hidden reasoning or policy deliberation/i);
});

test("#1081 preserves signed BUZZ identity and never turns moderation into PPF or developer authority", async () => {
  const [config, profile, guildhall] = await Promise.all([
    communityConfig(),
    merrinProfile(),
    read("config/buzz-guildhall.json").then(JSON.parse),
  ]);
  const actor = config.actors[0];
  assert.match(actor.systemPrompt, /under your own BUZZ identity/i);
  assert.match(actor.systemPrompt, /never impersonate the writer or another PlotPickle agent/i);
  assert.ok(profile.forbiddenCapabilities.includes("ppf-project-read"));
  assert.equal(guildhall.conversationMirror.agentIdentityPolicy, "own-signed-buzz-identity");
  assert.equal(guildhall.conversationMirror.agentImpersonationFallback, false);
  assert.equal(guildhall.conversationMirror.messageAuthority, "buzz");
});
