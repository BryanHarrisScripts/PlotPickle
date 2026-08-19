import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeNode,
  claimOrAdoptAvatar,
  createAccountSyncState,
  createPortableLearnState,
} from "../core/identity/account-learn-sync-core.mjs";
import {
  IOS_COMPANION_COMMUNITIES,
  IOS_COMPANION_TOP_LEVEL,
  assertIosCompanionSessionActive,
  createIosAgentDirectory,
  createIosAgentRequest,
  createIosCommunityCatalog,
  createIosCompanionSession,
  normalizeIosBuzzEvent,
  projectIosLearnState,
  revokeIosCompanionSession,
} from "../core/identity/ios-companion-core.mjs";

const KEY = "-----BEGIN PUBLIC KEY-----\nIOS-HOME\n-----END PUBLIC KEY-----";

function account() {
  let value = createAccountSyncState("person_bryan");
  value = authorizeNode(value, {
    nodeId: "node-home",
    publicKeyPem: KEY,
    authorizedAt: "2026-08-19T18:00:00.000Z",
  });
  return claimOrAdoptAvatar(value, "node-home", {
    draftId: "draft-home",
    displayName: "Bryan of the Brine",
  }, {
    avatarId: "avatar_bryan",
    now: "2026-08-19T18:01:00.000Z",
  }).account;
}

function session(value, overrides = {}) {
  return createIosCompanionSession(value, {
    sessionId: "ios-session-001",
    personId: value.personId,
    avatarId: value.avatar.avatarId,
    deviceId: "ios-device-001",
    authenticatedAt: "2026-08-19T18:10:00.000Z",
    expiresAt: "2026-09-01T18:10:00.000Z",
    ...overrides,
  });
}

const profiles = [
  {
    agentId: "sage-brinewick",
    displayName: "Sage Brinewick",
    communityId: "scriptorium",
    roomId: "lore-library",
    requiredMilestones: [],
    capabilityIds: ["story-guidance"],
    visibleOnMobile: true,
    kind: "product-agent",
  },
  {
    agentId: "marquee-director",
    displayName: "The Marquee Director",
    communityId: "atelier",
    roomId: "marquee",
    requiredMilestones: ["foundations-complete"],
    capabilityIds: ["key-art-discussion"],
    visibleOnMobile: true,
    kind: "product-agent",
  },
  {
    agentId: "ben",
    displayName: "BEN",
    communityId: "engine-room",
    roomId: "gatehouse",
    requiredMilestones: [],
    capabilityIds: ["verification-status"],
    visibleOnMobile: true,
    kind: "support-agent",
  },
  {
    agentId: "merrin-bellwarden",
    displayName: "Merrin Bellwarden",
    communityId: "great-hall",
    roomId: "great-hall",
    requiredMilestones: [],
    capabilityIds: [],
    visibleOnMobile: true,
    kind: "moderator",
  },
];

test("iOS Companion exposes only LEARN and COMMUNITY and exactly five communities", () => {
  const value = account();
  const mobile = session(value);
  const catalog = createIosCommunityCatalog(value, mobile, "2026-08-19T18:20:00.000Z");

  assert.deepEqual(IOS_COMPANION_TOP_LEVEL, ["learn", "community"]);
  assert.deepEqual(mobile.topLevelAreas, ["learn", "community"]);
  assert.equal(catalog.communities.length, 5);
  assert.deepEqual(IOS_COMPANION_COMMUNITIES.map((item) => item.id), [
    "scriptorium",
    "atelier",
    "workshop",
    "engine-room",
    "great-hall",
  ]);
  assert.equal(mobile.buildUi, false);
  assert.equal(mobile.directPpfAccess, false);
  assert.equal(mobile.providerConfiguration, false);
  assert.equal(mobile.nodeManagement, false);
  assert.equal(mobile.shellExecution, false);
});

test("iOS uses the canonical account Avatar and rejects mobile-only identity or secrets", () => {
  const value = account();
  const mobile = session(value);
  assert.equal(mobile.personId, value.personId);
  assert.equal(mobile.avatarId, value.avatar.avatarId);
  assert.throws(
    () => session(value, { avatarId: "avatar_mobile_only" }),
    /canonical PlotPickle Avatar/i,
  );
  assert.throws(
    () => createIosCompanionSession(value, {
      sessionId: "ios-session-secret",
      personId: value.personId,
      avatarId: value.avatar.avatarId,
      deviceId: "ios-device-secret",
      authenticatedAt: "2026-08-19T18:10:00.000Z",
      expiresAt: "2026-08-20T18:10:00.000Z",
      privateKey: "do-not-copy",
    }),
    /outside the allowlist: privateKey/i,
  );
});

test("mobile LEARN is the portable #1073 state and excludes PPF/provider state", () => {
  const value = account();
  const mobile = session(value);
  const learn = createPortableLearnState({
    activeLessonId: "world-03",
    activeLessonUpdatedAt: "2026-08-19T18:20:00.000Z",
    completedLessonIds: ["world-01", "world-02"],
    bookmarks: [{ lessonId: "world-03", savedAt: "2026-08-19T18:19:00.000Z" }],
  });
  const projection = projectIosLearnState(value, mobile, learn, "2026-08-19T18:21:00.000Z");
  assert.equal(projection.authority, "portable-learn-sync");
  assert.equal(projection.ppfIncluded, false);
  assert.equal(projection.providerStateIncluded, false);
  assert.equal(projection.state.activeLessonId, "world-03");
});

test("curriculum progression gates specialist agents without requiring different mobile UIs", () => {
  const value = account();
  const mobile = session(value);
  const before = createIosAgentDirectory(value, mobile, profiles, [], "2026-08-19T18:22:00.000Z");
  const after = createIosAgentDirectory(value, mobile, profiles, ["foundations-complete"], "2026-08-19T18:22:00.000Z");

  assert.equal(before.agents.find((item) => item.agentId === "sage-brinewick").unlocked, true);
  assert.equal(before.agents.find((item) => item.agentId === "marquee-director").unlocked, false);
  assert.equal(after.agents.find((item) => item.agentId === "marquee-director").unlocked, true);
  assert.equal(after.agents.find((item) => item.agentId === "ben").communityId, "engine-room");
});

test("Great Hall is human-only except Merrin moderation and cannot carry remote-control event types", () => {
  const value = account();
  const mobile = session(value);
  assert.doesNotThrow(() => createIosAgentDirectory(value, mobile, profiles, [], "2026-08-19T18:22:00.000Z"));

  assert.throws(
    () => createIosAgentDirectory(value, mobile, [...profiles, {
      agentId: "sage-in-great-hall",
      displayName: "Sage",
      communityId: "great-hall",
      roomId: "great-hall",
      requiredMilestones: [],
      capabilityIds: ["story-guidance"],
      visibleOnMobile: true,
      kind: "product-agent",
    }], [], "2026-08-19T18:22:00.000Z"),
    /Great Hall cannot expose normal specialist agents/i,
  );

  assert.doesNotThrow(() => normalizeIosBuzzEvent(value, mobile, {
    eventId: "great-hall-message-001",
    type: "message",
    communityId: "great-hall",
    roomId: "great-hall",
    actorId: "avatar_other_human",
    actorKind: "human",
    content: "Hello from the Great Hall.",
    createdAt: "2026-08-19T18:23:00.000Z",
    signatureVerified: true,
  }, "2026-08-19T18:23:00.000Z"));

  assert.doesNotThrow(() => normalizeIosBuzzEvent(value, mobile, {
    eventId: "merrin-message-001",
    type: "message",
    communityId: "great-hall",
    roomId: "great-hall",
    actorId: "merrin-bellwarden",
    actorKind: "moderator",
    content: "Welcome to the Great Hall.",
    createdAt: "2026-08-19T18:23:00.000Z",
    signatureVerified: true,
  }, "2026-08-19T18:23:00.000Z"));

  assert.throws(
    () => normalizeIosBuzzEvent(value, mobile, {
      eventId: "great-hall-job-001",
      type: "job_requested",
      communityId: "great-hall",
      roomId: "great-hall",
      actorId: value.avatar.avatarId,
      actorKind: "human",
      content: "Run something.",
      createdAt: "2026-08-19T18:23:00.000Z",
      signatureVerified: true,
      capabilityId: "shell",
    }, "2026-08-19T18:23:00.000Z"),
    /does not support remote job or agent-control/i,
  );
});

test("signed BUZZ agent requests require one unlocked agent and one explicit host capability", () => {
  const value = account();
  const mobile = session(value);
  const directory = createIosAgentDirectory(value, mobile, profiles, [], "2026-08-19T18:24:00.000Z");
  const request = createIosAgentRequest(value, mobile, directory, {
    agentId: "sage-brinewick",
    capabilityId: "story-guidance",
    eventId: "agent-request-001",
    requestId: "request-001",
    content: "Help me understand the current lesson.",
    createdAt: "2026-08-19T18:24:00.000Z",
  }, "2026-08-19T18:24:00.000Z");

  assert.equal(request.type, "agent_request");
  assert.equal(request.capabilityId, "story-guidance");
  assert.equal(request.permissionGrant, false);
  assert.throws(
    () => createIosAgentRequest(value, mobile, directory, {
      agentId: "marquee-director",
      capabilityId: "key-art-discussion",
      eventId: "agent-request-locked",
      requestId: "request-locked",
      content: "Make key art.",
      createdAt: "2026-08-19T18:24:00.000Z",
    }, "2026-08-19T18:24:00.000Z"),
    /still locked by curriculum progression/i,
  );
  assert.throws(
    () => createIosAgentRequest(value, mobile, directory, {
      agentId: "sage-brinewick",
      capabilityId: "arbitrary-shell",
      eventId: "agent-request-shell",
      requestId: "request-shell",
      content: "Run a shell command.",
      createdAt: "2026-08-19T18:24:00.000Z",
    }, "2026-08-19T18:24:00.000Z"),
    /not allowlisted/i,
  );
});

test("BUZZ events must be signature-verified and cannot smuggle credentials/private keys", () => {
  const value = account();
  const mobile = session(value);
  assert.throws(
    () => normalizeIosBuzzEvent(value, mobile, {
      eventId: "unsigned-001",
      type: "message",
      communityId: "scriptorium",
      roomId: "lore-library",
      actorId: "avatar_other_human",
      actorKind: "human",
      content: "Unsigned",
      createdAt: "2026-08-19T18:25:00.000Z",
      signatureVerified: false,
    }, "2026-08-19T18:25:00.000Z"),
    /signature-verified/i,
  );
  assert.throws(
    () => normalizeIosBuzzEvent(value, mobile, {
      eventId: "secret-001",
      type: "message",
      communityId: "scriptorium",
      roomId: "lore-library",
      actorId: "avatar_other_human",
      actorKind: "human",
      content: "-----BEGIN PRIVATE KEY----- secret",
      createdAt: "2026-08-19T18:25:00.000Z",
      signatureVerified: true,
    }, "2026-08-19T18:25:00.000Z"),
    /private key material/i,
  );
});

test("revoking the mobile session blocks LEARN and Community immediately", () => {
  const value = account();
  const mobile = session(value);
  const revoked = revokeIosCompanionSession(mobile, "2026-08-19T18:30:00.000Z");
  assert.throws(
    () => assertIosCompanionSessionActive(value, revoked, "2026-08-19T18:30:01.000Z"),
    /revoked/i,
  );
  assert.throws(
    () => createIosCommunityCatalog(value, revoked, "2026-08-19T18:30:01.000Z"),
    /revoked/i,
  );
});
