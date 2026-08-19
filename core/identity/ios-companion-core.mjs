import { createPortableLearnState } from "./account-learn-sync-core.mjs";

const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{1,127}$/i;
const PRIVATE_KEY_PATTERN = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/;

export const IOS_COMPANION_TOP_LEVEL = Object.freeze(["learn", "community"]);
export const IOS_COMPANION_EVENT_TYPES = Object.freeze([
  "message",
  "agent_request",
  "agent_response",
  "job_requested",
  "job_started",
  "job_completed",
  "artifact_ready",
  "approval_required",
]);
export const IOS_COMPANION_COMMUNITIES = Object.freeze([
  Object.freeze({
    id: "scriptorium",
    name: "The Scriptorium",
    purpose: "Writing, structure, character, world and story craft.",
    interaction: "specialist",
    remoteExecution: "bounded-host-capabilities",
    moderatorActorId: "merrin-bellwarden",
  }),
  Object.freeze({
    id: "atelier",
    name: "The Atelier",
    purpose: "Visual development, continuity, storyboards, graphic-novel thinking and key art.",
    interaction: "specialist",
    remoteExecution: "bounded-host-capabilities",
    moderatorActorId: "merrin-bellwarden",
  }),
  Object.freeze({
    id: "workshop",
    name: "The Workshop",
    purpose: "Screenplay execution, editing, production planning, sound, film and animation discussion.",
    interaction: "specialist",
    remoteExecution: "bounded-host-capabilities",
    moderatorActorId: "merrin-bellwarden",
  }),
  Object.freeze({
    id: "engine-room",
    name: "The Engine Room",
    purpose: "PlotPickle technical support, BEN evidence, health, provider readiness and bounded diagnostics.",
    interaction: "specialist",
    remoteExecution: "bounded-host-capabilities",
    moderatorActorId: "merrin-bellwarden",
  }),
  Object.freeze({
    id: "great-hall",
    name: "The Great Hall",
    purpose: "Human-to-human PlotPickle Community conversation.",
    interaction: "human-only",
    remoteExecution: "none",
    moderatorActorId: "merrin-bellwarden",
  }),
]);

const SESSION_FIELDS = Object.freeze([
  "sessionId",
  "personId",
  "avatarId",
  "authenticatedAt",
  "expiresAt",
  "deviceId",
]);
const AGENT_FIELDS = Object.freeze([
  "agentId",
  "displayName",
  "communityId",
  "roomId",
  "requiredMilestones",
  "capabilityIds",
  "visibleOnMobile",
  "kind",
]);
const EVENT_FIELDS = Object.freeze([
  "eventId",
  "type",
  "communityId",
  "roomId",
  "actorId",
  "actorKind",
  "content",
  "createdAt",
  "signatureVerified",
  "capabilityId",
  "requestId",
  "artifactRef",
]);

function allowedFields(input, allowed, label) {
  for (const key of Object.keys(input || {})) {
    if (!allowed.includes(key)) throw new Error(`${label} field is outside the allowlist: ${key}`);
  }
}

function stableId(value, label) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${label} is required.`);
  if (!ID_PATTERN.test(text)) throw new Error(`${label} must be a stable 2-128 character identifier.`);
  return text;
}

function iso(value, label) {
  const text = String(value || "").trim();
  if (!text || Number.isNaN(Date.parse(text))) throw new Error(`${label} must be an ISO date-time.`);
  return text;
}

function cleanText(value, label, max, allowEmpty = false) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text && !allowEmpty) throw new Error(`${label} is required.`);
  if (text.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  if (PRIVATE_KEY_PATTERN.test(text)) throw new Error(`${label} cannot contain private key material.`);
  if (/[\u0000-\u001F\u007F]/.test(text)) throw new Error(`${label} contains unsupported control characters.`);
  return text;
}

function canonicalAvatar(account) {
  if (!account?.avatar?.avatarId) throw new Error("iOS Companion requires the same claimed canonical PlotPickle Avatar.");
  return account.avatar;
}

function communityById(communityId) {
  const id = stableId(communityId, "Companion community id");
  const community = IOS_COMPANION_COMMUNITIES.find((item) => item.id === id);
  if (!community) throw new Error(`Unknown PlotPickle Companion community: ${id}.`);
  return community;
}

export function createIosCompanionSession(account, input) {
  allowedFields(input, SESSION_FIELDS, "iOS Companion session");
  const avatar = canonicalAvatar(account);
  const personId = stableId(input.personId, "Companion person id");
  const avatarId = stableId(input.avatarId, "Companion Avatar id");
  if (personId !== account.personId) throw new Error("Companion session must use the authenticated PlotPickle Person.");
  if (avatarId !== avatar.avatarId) throw new Error("Companion session must use the canonical PlotPickle Avatar.");
  const authenticatedAt = iso(input.authenticatedAt, "Companion authentication time");
  const expiresAt = iso(input.expiresAt, "Companion session expiry");
  const lifetime = Date.parse(expiresAt) - Date.parse(authenticatedAt);
  if (lifetime <= 0 || lifetime > 30 * 24 * 60 * 60 * 1000) throw new Error("Companion session must expire within 30 days.");
  return {
    version: 1,
    sessionId: stableId(input.sessionId, "Companion session id"),
    personId,
    avatarId,
    deviceId: stableId(input.deviceId, "Companion device id"),
    authenticatedAt,
    expiresAt,
    revokedAt: null,
    topLevelAreas: [...IOS_COMPANION_TOP_LEVEL],
    directPpfAccess: false,
    buildUi: false,
    providerConfiguration: false,
    nodeManagement: false,
    shellExecution: false,
  };
}

export function revokeIosCompanionSession(session, revokedAt) {
  const timestamp = iso(revokedAt, "Companion revocation time");
  if (Date.parse(timestamp) < Date.parse(session.authenticatedAt)) throw new Error("Companion session cannot be revoked before authentication.");
  return { ...session, revokedAt: timestamp };
}

export function assertIosCompanionSessionActive(account, session, now = new Date().toISOString()) {
  const avatar = canonicalAvatar(account);
  if (session.personId !== account.personId || session.avatarId !== avatar.avatarId) throw new Error("Companion session no longer matches the PlotPickle account/Avatar.");
  const timestamp = iso(now, "Companion session check time");
  if (session.revokedAt && Date.parse(session.revokedAt) <= Date.parse(timestamp)) throw new Error("Companion session has been revoked.");
  if (Date.parse(session.expiresAt) <= Date.parse(timestamp)) throw new Error("Companion session has expired.");
  return session;
}

export function projectIosLearnState(account, session, portableLearnState, now = new Date().toISOString()) {
  assertIosCompanionSessionActive(account, session, now);
  const portableInput = Object.fromEntries(
    Object.entries(portableLearnState || {}).filter(([key]) => key !== "version"),
  );
  return {
    version: 1,
    authority: "portable-learn-sync",
    personId: account.personId,
    avatarId: session.avatarId,
    state: createPortableLearnState(portableInput),
    ppfIncluded: false,
    providerStateIncluded: false,
  };
}

export function createIosCommunityCatalog(account, session, now = new Date().toISOString()) {
  assertIosCompanionSessionActive(account, session, now);
  return {
    version: 1,
    authority: "plotpickle-community-contract",
    communities: IOS_COMPANION_COMMUNITIES.map((community) => ({ ...community })),
  };
}

function normalizeMilestones(values) {
  if (!Array.isArray(values)) throw new Error("Agent requiredMilestones must be an array.");
  if (values.length > 32) throw new Error("Agent requiredMilestones may contain at most 32 entries.");
  return [...new Set(values.map((value) => stableId(value, "Curriculum milestone")))].sort();
}

function normalizeCapabilities(values) {
  if (!Array.isArray(values)) throw new Error("Agent capabilityIds must be an array.");
  if (values.length > 32) throw new Error("Agent capabilityIds may contain at most 32 entries.");
  return [...new Set(values.map((value) => stableId(value, "Agent capability")))].sort();
}

export function createIosAgentDirectory(account, session, agentProfiles, completedMilestones, now = new Date().toISOString()) {
  assertIosCompanionSessionActive(account, session, now);
  if (!Array.isArray(agentProfiles) || agentProfiles.length > 100) throw new Error("Companion agent directory supports at most 100 agent profiles.");
  const completed = new Set(normalizeMilestones(completedMilestones));
  const agents = agentProfiles.flatMap((input) => {
    allowedFields(input, AGENT_FIELDS, "Companion agent profile");
    if (input.visibleOnMobile !== true) return [];
    const community = communityById(input.communityId);
    const kind = String(input.kind || "").trim();
    if (!["product-agent", "support-agent", "moderator"].includes(kind)) {
      throw new Error("Companion agent kind must be product-agent, support-agent or moderator.");
    }
    const agentId = stableId(input.agentId, "Companion agent id");
    if (community.id === "great-hall" && agentId !== community.moderatorActorId) {
      throw new Error("The Great Hall cannot expose normal specialist agents.");
    }
    if (community.id !== "great-hall" && kind === "moderator" && agentId !== "merrin-bellwarden") {
      throw new Error("Merrin Bellwarden is the Companion moderation identity.");
    }
    const requiredMilestones = normalizeMilestones(input.requiredMilestones || []);
    const unlocked = requiredMilestones.every((milestone) => completed.has(milestone));
    return [{
      agentId,
      displayName: cleanText(input.displayName, "Companion agent display name", 120),
      communityId: community.id,
      roomId: stableId(input.roomId, "Companion room id"),
      kind,
      requiredMilestones,
      capabilityIds: normalizeCapabilities(input.capabilityIds || []),
      unlocked,
    }];
  });
  return {
    version: 1,
    authority: "plotpickle-agent-profiles",
    agents,
  };
}

export function normalizeIosBuzzEvent(account, session, input, now = new Date().toISOString()) {
  assertIosCompanionSessionActive(account, session, now);
  allowedFields(input, EVENT_FIELDS, "Companion BUZZ event");
  const community = communityById(input.communityId);
  if (input.signatureVerified !== true) throw new Error("Companion Community accepts only signature-verified BUZZ events.");
  const type = String(input.type || "").trim();
  if (!IOS_COMPANION_EVENT_TYPES.includes(type)) throw new Error(`Unsupported Companion BUZZ event type: ${type}.`);
  const actorKind = String(input.actorKind || "").trim();
  if (!["human", "agent", "moderator", "system"].includes(actorKind)) throw new Error("Companion BUZZ actorKind is invalid.");
  if (community.id === "great-hall") {
    const actorId = stableId(input.actorId, "Companion BUZZ actor id");
    if (actorKind === "agent" || actorKind === "system") throw new Error("The Great Hall is human-to-human; normal specialist/system agents are not allowed.");
    if (actorKind === "moderator" && actorId !== community.moderatorActorId) throw new Error("Only Merrin Bellwarden may appear as Great Hall moderation infrastructure.");
    if (type !== "message") throw new Error("The Great Hall does not support remote job or agent-control event types.");
  }
  const capabilityId = input.capabilityId ? stableId(input.capabilityId, "Companion event capability id") : null;
  if (["agent_request", "job_requested"].includes(type) && !capabilityId) throw new Error(`${type} requires one explicit host-owned capability id.`);
  return {
    version: 1,
    eventId: stableId(input.eventId, "Companion BUZZ event id"),
    type,
    communityId: community.id,
    roomId: stableId(input.roomId, "Companion BUZZ room id"),
    actorId: stableId(input.actorId, "Companion BUZZ actor id"),
    actorKind,
    content: cleanText(input.content, "Companion BUZZ event content", 4_000, true),
    createdAt: iso(input.createdAt, "Companion BUZZ event time"),
    signatureVerified: true,
    capabilityId,
    requestId: input.requestId ? stableId(input.requestId, "Companion request id") : null,
    artifactRef: input.artifactRef ? stableId(input.artifactRef, "Companion artifact reference") : null,
    permissionGrant: false,
  };
}

export function createIosAgentRequest(account, session, agentDirectory, input, now = new Date().toISOString()) {
  assertIosCompanionSessionActive(account, session, now);
  const agentId = stableId(input?.agentId, "Requested Companion agent id");
  const agent = agentDirectory.agents.find((candidate) => candidate.agentId === agentId);
  if (!agent) throw new Error("Requested Companion agent is not in the mobile agent directory.");
  if (!agent.unlocked) throw new Error("Requested Companion agent is still locked by curriculum progression.");
  if (!agent.capabilityIds.includes(input.capabilityId)) throw new Error("Requested capability is not allowlisted for this Companion agent.");
  if (agent.communityId === "great-hall") throw new Error("The Great Hall cannot dispatch specialist agent capabilities.");
  return normalizeIosBuzzEvent(account, session, {
    eventId: input.eventId,
    type: "agent_request",
    communityId: agent.communityId,
    roomId: agent.roomId,
    actorId: session.avatarId,
    actorKind: "human",
    content: input.content,
    createdAt: input.createdAt,
    signatureVerified: true,
    capabilityId: input.capabilityId,
    requestId: input.requestId,
  }, now);
}

export const IOS_COMPANION_SESSION_ALLOWLIST = SESSION_FIELDS;
export const IOS_COMPANION_AGENT_ALLOWLIST = AGENT_FIELDS;
export const IOS_COMPANION_EVENT_ALLOWLIST = EVENT_FIELDS;
