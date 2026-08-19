import assert from "node:assert/strict";
import test from "node:test";
import { authorizeNode, claimOrAdoptAvatar, createAccountSyncState, createPortableLearnState } from "../core/identity/account-learn-sync-core.mjs";
import { IOS_COMPANION_COMMUNITIES, IOS_COMPANION_TOP_LEVEL, assertIosCompanionSessionActive, createIosAgentDirectory, createIosAgentRequest, createIosCommunityCatalog, createIosCompanionSession, normalizeIosBuzzEvent, projectIosLearnState, revokeIosCompanionSession } from "../core/identity/ios-companion-core.mjs";

const KEY = "-----BEGIN PUBLIC KEY-----\nIOS-HOME\n-----END PUBLIC KEY-----";

function account() {
  let value = createAccountSyncState("person-bryan");
  value = authorizeNode(value, { nodeId: "node-home", publicKeyPem: KEY, authorizedAt: "2026-08-19T18:00:00.000Z" });
  return claimOrAdoptAvatar(value, "node-home", { draftId: "draft-home", displayName: "Bryan" }, { avatarId: "avatar-bryan", now: "2026-08-19T18:01:00.000Z" }).account;
}

function session(value) {
  return createIosCompanionSession(value, { sessionId: "ios-session-001", personId: value.personId, avatarId: value.avatar.avatarId, deviceId: "ios-device-001", authenticatedAt: "2026-08-19T18:10:00.000Z", expiresAt: "2026-09-01T18:10:00.000Z" });
}

const profiles = [
  { agentId: "sage-brinewick", displayName: "Sage Brinewick", communityId: "scriptorium", roomId: "lore-library", requiredMilestones: [], capabilityIds: ["story-guidance"], visibleOnMobile: true, kind: "product-agent" },
  { agentId: "marquee-director", displayName: "The Marquee Director", communityId: "atelier", roomId: "marquee", requiredMilestones: ["foundations-complete"], capabilityIds: ["key-art-discussion"], visibleOnMobile: true, kind: "product-agent" },
  { agentId: "ben", displayName: "BEN", communityId: "engine-room", roomId: "gatehouse", requiredMilestones: [], capabilityIds: ["verification-status"], visibleOnMobile: true, kind: "support-agent" },
  { agentId: "merrin-bellwarden", displayName: "Merrin Bellwarden", communityId: "great-hall", roomId: "great-hall", requiredMilestones: [], capabilityIds: [], visibleOnMobile: true, kind: "moderator" },
];

test("iOS exposes only LEARN and COMMUNITY with exactly five communities", () => {
  const value = account();
  const mobile = session(value);
  const catalog = createIosCommunityCatalog(value, mobile, "2026-08-19T18:20:00.000Z");
  assert.deepEqual(IOS_COMPANION_TOP_LEVEL, ["learn", "community"]);
  assert.equal(catalog.communities.length, 5);
  assert.deepEqual(IOS_COMPANION_COMMUNITIES.map((item) => item.id), ["scriptorium", "atelier", "workshop", "engine-room", "great-hall"]);
  assert.equal(mobile.buildUi, false);
  assert.equal(mobile.directPpfAccess, false);
  assert.equal(mobile.nodeManagement, false);
  assert.equal(mobile.shellExecution, false);
});

test("mobile identity is the same account and canonical Avatar", () => {
  const value = account();
  const mobile = session(value);
  assert.equal(mobile.personId, value.personId);
  assert.equal(mobile.avatarId, value.avatar.avatarId);
  assert.throws(() => createIosCompanionSession(value, { sessionId: "other-session", personId: value.personId, avatarId: "avatar-other", deviceId: "ios-device-002", authenticatedAt: "2026-08-19T18:10:00.000Z", expiresAt: "2026-08-20T18:10:00.000Z" }), /canonical PlotPickle Avatar/i);
});

test("mobile LEARN reuses portable #1073 state and excludes project/provider state", () => {
  const value = account();
  const mobile = session(value);
  const learn = createPortableLearnState({ activeLessonId: "world-03", activeLessonUpdatedAt: "2026-08-19T18:20:00.000Z", completedLessonIds: ["world-01", "world-02"], bookmarks: { "world-03": "2026-08-19T18:19:00.000Z" } });
  const projection = projectIosLearnState(value, mobile, learn, "2026-08-19T18:21:00.000Z");
  assert.equal(projection.authority, "portable-learn-sync");
  assert.equal(projection.ppfIncluded, false);
  assert.equal(projection.providerStateIncluded, false);
  assert.equal(projection.state.activeLessonId, "world-03");
});

test("curriculum progression gates specialist availability", () => {
  const value = account();
  const mobile = session(value);
  const before = createIosAgentDirectory(value, mobile, profiles, [], "2026-08-19T18:22:00.000Z");
  const after = createIosAgentDirectory(value, mobile, profiles, ["foundations-complete"], "2026-08-19T18:22:00.000Z");
  assert.equal(before.agents.find((item) => item.agentId === "sage-brinewick").unlocked, true);
  assert.equal(before.agents.find((item) => item.agentId === "marquee-director").unlocked, false);
  assert.equal(after.agents.find((item) => item.agentId === "marquee-director").unlocked, true);
});

test("Great Hall remains human-only except Merrin moderation", () => {
  const value = account();
  const mobile = session(value);
  assert.doesNotThrow(() => createIosAgentDirectory(value, mobile, profiles, [], "2026-08-19T18:22:00.000Z"));
  assert.throws(() => createIosAgentDirectory(value, mobile, [...profiles, { agentId: "sage-hall", displayName: "Sage", communityId: "great-hall", roomId: "great-hall", requiredMilestones: [], capabilityIds: ["story-guidance"], visibleOnMobile: true, kind: "product-agent" }], [], "2026-08-19T18:22:00.000Z"), /Great Hall cannot expose normal specialist agents/i);
  assert.throws(() => normalizeIosBuzzEvent(value, mobile, { eventId: "hall-job", type: "job_requested", communityId: "great-hall", roomId: "great-hall", actorId: value.avatar.avatarId, actorKind: "human", content: "Request", createdAt: "2026-08-19T18:23:00.000Z", signatureVerified: true, capabilityId: "bounded-action" }, "2026-08-19T18:23:00.000Z"), /does not support remote job or agent-control/i);
});

test("agent requests require an unlocked agent and explicit allowlisted host capability", () => {
  const value = account();
  const mobile = session(value);
  const directory = createIosAgentDirectory(value, mobile, profiles, [], "2026-08-19T18:24:00.000Z");
  const request = createIosAgentRequest(value, mobile, directory, { agentId: "sage-brinewick", capabilityId: "story-guidance", eventId: "agent-request-001", requestId: "request-001", content: "Help with this lesson.", createdAt: "2026-08-19T18:24:00.000Z" }, "2026-08-19T18:24:00.000Z");
  assert.equal(request.type, "agent_request");
  assert.equal(request.permissionGrant, false);
  assert.throws(() => createIosAgentRequest(value, mobile, directory, { agentId: "marquee-director", capabilityId: "key-art-discussion", eventId: "agent-request-locked", requestId: "request-locked", content: "Discuss key art.", createdAt: "2026-08-19T18:24:00.000Z" }, "2026-08-19T18:24:00.000Z"), /locked by curriculum progression/i);
  assert.throws(() => createIosAgentRequest(value, mobile, directory, { agentId: "sage-brinewick", capabilityId: "unlisted-action", eventId: "agent-request-other", requestId: "request-other", content: "Request action.", createdAt: "2026-08-19T18:24:00.000Z" }, "2026-08-19T18:24:00.000Z"), /not allowlisted/i);
});

test("BUZZ events require verified signatures and session revocation blocks both product areas", () => {
  const value = account();
  const mobile = session(value);
  assert.throws(() => normalizeIosBuzzEvent(value, mobile, { eventId: "unsigned-001", type: "message", communityId: "scriptorium", roomId: "lore-library", actorId: "avatar-friend", actorKind: "human", content: "Unsigned", createdAt: "2026-08-19T18:25:00.000Z", signatureVerified: false }, "2026-08-19T18:25:00.000Z"), /signature-verified/i);
  const revoked = revokeIosCompanionSession(mobile, "2026-08-19T18:30:00.000Z");
  assert.throws(() => assertIosCompanionSessionActive(value, revoked, "2026-08-19T18:30:01.000Z"), /revoked/i);
  assert.throws(() => createIosCommunityCatalog(value, revoked, "2026-08-19T18:30:01.000Z"), /revoked/i);
});
