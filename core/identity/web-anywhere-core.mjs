import {
  assertAuthorizedNode,
  createPortableLearnState,
} from "./account-learn-sync-core.mjs";
import {
  createCandidateRemoteResult,
  createScopedRemoteWorkPackage,
  discoverComputeNodes,
  requireSelectedComputeNode,
} from "./remote-node-compute-core.mjs";

const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{1,127}$/i;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const PRIVATE_KEY_PATTERN = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/;
const MAX_PUBLIC_SESSION_MS = 2 * 60 * 60 * 1000;
const MAX_PRIVATE_SESSION_MS = 8 * 60 * 60 * 1000;
const MAX_REAUTH_AGE_MS = 10 * 60 * 1000;

const SESSION_FIELDS = Object.freeze([
  "sessionId",
  "personId",
  "avatarId",
  "authenticationEvidenceId",
  "authenticatedAt",
  "reauthenticatedAt",
  "expiresAt",
  "clientTrust",
]);
const COMMUNITY_FIELDS = Object.freeze(["authority", "roomId", "roomName", "events", "projectedAt"]);
const COMMUNITY_EVENT_FIELDS = Object.freeze([
  "eventId",
  "roomId",
  "avatarId",
  "nodeId",
  "content",
  "createdAt",
  "signatureVerified",
]);
const PROJECT_EXPORT_FIELDS = Object.freeze([
  "projectId",
  "projectRevision",
  "title",
  "frontier",
  "acceptedArtifacts",
  "remoteContextItems",
  "exportedAt",
]);
const ARTIFACT_FIELDS = Object.freeze([
  "artifactId",
  "kind",
  "contentHashSha256",
  "mediaType",
  "byteLength",
  "acceptedAt",
]);
const CONTEXT_FIELDS = Object.freeze(["contextId", "kind", "text"]);
const DISPATCH_FIELDS = Object.freeze([
  "dispatchId",
  "selectedNodeId",
  "authoritativeProjectNodeId",
  "jobId",
  "capability",
  "contextIds",
  "referenceAssetIds",
  "modelClass",
  "workflowClass",
  "constraints",
  "grant",
  "returnRouteId",
  "billingConsentId",
  "requestedAt",
]);
const RECONCILIATION_FIELDS = Object.freeze([
  "reconciliationId",
  "authoritativeProjectNodeId",
  "requestedAt",
]);
const RECONCILIATION_RECEIPT_FIELDS = Object.freeze([
  "receiptId",
  "authoritativeProjectNodeId",
  "status",
  "projectRevision",
  "reconciledAt",
]);

function allowedFields(input, allowlist, label) {
  for (const key of Object.keys(input || {})) {
    if (!allowlist.includes(key)) throw new Error(`${label} field is outside the allowlist: ${key}`);
  }
}

function stableId(value, label) {
  const raw = value ?? "";
  const text = String(raw).trim();
  if (!ID_PATTERN.test(text)) throw new Error(`${label} must be a stable 2-128 character identifier.`);
  return text;
}

function iso(value, label) {
  const text = String(value || "").trim();
  if (!text || Number.isNaN(Date.parse(text))) throw new Error(`${label} must be an ISO date-time.`);
  return text;
}

function cleanText(value, label, maximum, { allowEmpty = false } = {}) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text && !allowEmpty) throw new Error(`${label} is required.`);
  if (text.length > maximum) throw new Error(`${label} must be ${maximum} characters or fewer.`);
  if (PRIVATE_KEY_PATTERN.test(text)) throw new Error(`${label} cannot contain private key material.`);
  if (/[\u0000-\u001F\u007F]/.test(text)) throw new Error(`${label} contains unsupported control characters.`);
  return text;
}

function integer(value, label, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

function enumValue(value, allowed, label) {
  const text = String(value || "").trim();
  if (!allowed.includes(text)) throw new Error(`${label} must be one of: ${allowed.join(", ")}.`);
  return text;
}

function canonicalAvatar(account) {
  if (!account?.avatar?.avatarId) throw new Error("Web Anywhere requires the PlotPickle account to have one claimed canonical Avatar.");
  return account.avatar;
}

export function createAuthenticatedWebSession(account, input) {
  allowedFields(input, SESSION_FIELDS, "Web session");
  const avatar = canonicalAvatar(account);
  const personId = stableId(input.personId, "Web session person id");
  const avatarId = stableId(input.avatarId, "Web session Avatar id");
  if (personId !== account.personId) throw new Error("Web session person must match the authenticated PlotPickle account.");
  if (avatarId !== avatar.avatarId) throw new Error("Web session must use the account's canonical Avatar.");
  const authenticatedAt = iso(input.authenticatedAt, "Web session authentication time");
  const reauthenticatedAt = iso(input.reauthenticatedAt || authenticatedAt, "Web session reauthentication time");
  const expiresAt = iso(input.expiresAt, "Web session expiry");
  const clientTrust = enumValue(input.clientTrust, ["public-computer", "private-browser"], "Web client trust");
  const lifetime = Date.parse(expiresAt) - Date.parse(authenticatedAt);
  const maximumLifetime = clientTrust === "public-computer" ? MAX_PUBLIC_SESSION_MS : MAX_PRIVATE_SESSION_MS;
  if (lifetime <= 0 || lifetime > maximumLifetime) {
    throw new Error(`Web session lifetime exceeds the ${clientTrust === "public-computer" ? "2-hour" : "8-hour"} limit.`);
  }
  if (Date.parse(reauthenticatedAt) < Date.parse(authenticatedAt) || Date.parse(reauthenticatedAt) > Date.parse(expiresAt)) {
    throw new Error("Web session reauthentication time must fall inside the session lifetime.");
  }
  return {
    version: 1,
    sessionId: stableId(input.sessionId, "Web session id"),
    personId,
    avatarId,
    authenticationEvidenceId: stableId(input.authenticationEvidenceId, "Authentication evidence id"),
    authenticatedAt,
    reauthenticatedAt,
    expiresAt,
    clientTrust,
    storagePolicy: "memory-only",
    cachePolicy: "no-store",
    revokedAt: null,
  };
}

export function revokeWebSession(session, revokedAt) {
  const timestamp = iso(revokedAt, "Web session revocation time");
  if (Date.parse(timestamp) < Date.parse(session.authenticatedAt)) throw new Error("Web session cannot be revoked before authentication.");
  return { ...session, revokedAt: timestamp };
}

export function assertWebSessionActive(account, session, now = new Date().toISOString()) {
  const avatar = canonicalAvatar(account);
  if (session.personId !== account.personId || session.avatarId !== avatar.avatarId) {
    throw new Error("Web session no longer matches the account and canonical Avatar.");
  }
  const timestamp = iso(now, "Web session check time");
  if (session.revokedAt && Date.parse(session.revokedAt) <= Date.parse(timestamp)) throw new Error("Web session has been revoked.");
  if (Date.parse(session.expiresAt) <= Date.parse(timestamp)) throw new Error("Web session has expired.");
  return session;
}

export function assertFreshWebReauthentication(account, session, now = new Date().toISOString()) {
  assertWebSessionActive(account, session, now);
  const timestamp = iso(now, "Sensitive action time");
  const age = Date.parse(timestamp) - Date.parse(session.reauthenticatedAt);
  if (age < 0 || age > MAX_REAUTH_AGE_MS) throw new Error("Sensitive web actions require re-authentication within the last 10 minutes.");
  return session;
}

export function projectWebIdentity(account, session, now = new Date().toISOString()) {
  assertWebSessionActive(account, session, now);
  const avatar = canonicalAvatar(account);
  return {
    version: 1,
    personId: account.personId,
    avatar: {
      avatarId: avatar.avatarId,
      displayName: avatar.displayName,
      claimedAt: avatar.claimedAt,
    },
    session: {
      sessionId: session.sessionId,
      clientTrust: session.clientTrust,
      expiresAt: session.expiresAt,
      storagePolicy: session.storagePolicy,
      cachePolicy: session.cachePolicy,
    },
  };
}

export function projectWebLearnState(account, session, portableLearnState, now = new Date().toISOString()) {
  assertWebSessionActive(account, session, now);
  const portableInput = Object.fromEntries(
    Object.entries(portableLearnState || {}).filter(([key]) => key !== "version"),
  );
  const sanitized = createPortableLearnState(portableInput);
  return {
    version: 1,
    authority: "portable-learn-sync",
    personId: account.personId,
    avatarId: session.avatarId,
    state: sanitized,
  };
}

function sanitizeCommunityEvent(event, expectedRoomId) {
  allowedFields(event, COMMUNITY_EVENT_FIELDS, "Web Community event");
  const roomId = stableId(event.roomId, "BUZZ room id");
  if (roomId !== expectedRoomId) throw new Error("BUZZ event room does not match the projected Community room.");
  if (event.signatureVerified !== true) throw new Error("Web Community may project only signature-verified BUZZ events.");
  return {
    eventId: stableId(event.eventId, "BUZZ event id"),
    roomId,
    avatarId: stableId(event.avatarId, "BUZZ event Avatar id"),
    nodeId: stableId(event.nodeId, "BUZZ signing Node id"),
    content: cleanText(event.content, "BUZZ event content", 4_000),
    createdAt: iso(event.createdAt, "BUZZ event time"),
    signatureVerified: true,
  };
}

export function projectWebCommunity(account, session, input, now = new Date().toISOString()) {
  assertWebSessionActive(account, session, now);
  allowedFields(input, COMMUNITY_FIELDS, "Web Community projection");
  if (input.authority !== "buzz") throw new Error("Web Community history must come from BUZZ; a web-only chat authority is not allowed.");
  const roomId = stableId(input.roomId, "BUZZ room id");
  const projectedAt = iso(input.projectedAt, "Community projection time");
  if (!Array.isArray(input.events) || input.events.length > 100) throw new Error("Web Community projection supports at most 100 BUZZ events.");
  return {
    version: 1,
    authority: "buzz",
    roomId,
    roomName: cleanText(input.roomName, "BUZZ room name", 120),
    events: input.events.map((event) => sanitizeCommunityEvent(event, roomId)),
    projectedAt,
    webMessageStore: false,
  };
}

function sanitizeAcceptedArtifact(item) {
  allowedFields(item, ARTIFACT_FIELDS, "Web review artifact");
  const hash = String(item.contentHashSha256 || "").trim().toLowerCase();
  if (!SHA256_PATTERN.test(hash)) throw new Error("Web review artifact hash must be a SHA-256 hex digest.");
  return {
    artifactId: stableId(item.artifactId, "Web review artifact id"),
    kind: enumValue(item.kind, ["image", "video", "audio", "document", "story"], "Web review artifact kind"),
    contentHashSha256: hash,
    mediaType: cleanText(item.mediaType, "Web review artifact media type", 120),
    byteLength: integer(item.byteLength, "Web review artifact byte length", 1, 500_000_000),
    acceptedAt: iso(item.acceptedAt, "Web review artifact acceptance time"),
  };
}

function sanitizeRemoteContext(item) {
  allowedFields(item, CONTEXT_FIELDS, "Web remote context item");
  return {
    contextId: stableId(item.contextId, "Web remote context id"),
    kind: enumValue(item.kind, ["story", "character", "world", "visual", "instruction"], "Web remote context kind"),
    text: cleanText(item.text, "Web remote context text", 20_000),
  };
}

export function createWebProjectReviewExport(account, session, input, now = new Date().toISOString()) {
  assertWebSessionActive(account, session, now);
  allowedFields(input, PROJECT_EXPORT_FIELDS, "Web project review export");
  if (!Array.isArray(input.acceptedArtifacts) || input.acceptedArtifacts.length > 24) {
    throw new Error("Web project review export supports at most 24 accepted artifact descriptors.");
  }
  if (!Array.isArray(input.remoteContextItems) || input.remoteContextItems.length > 16) {
    throw new Error("Web project review export supports at most 16 explicitly approved remote context items.");
  }
  const remoteContextItems = input.remoteContextItems.map(sanitizeRemoteContext);
  if (new Set(remoteContextItems.map((item) => item.contextId)).size !== remoteContextItems.length) {
    throw new Error("Web remote context IDs must be unique.");
  }
  return {
    version: 1,
    sessionId: session.sessionId,
    projectId: stableId(input.projectId, "Web review project id"),
    projectRevision: integer(input.projectRevision, "Web review project revision", 0, Number.MAX_SAFE_INTEGER),
    title: cleanText(input.title, "Web review project title", 240),
    frontier: cleanText(input.frontier, "Web review project frontier", 1_000),
    acceptedArtifacts: input.acceptedArtifacts.map(sanitizeAcceptedArtifact),
    remoteContextItems,
    exportedAt: iso(input.exportedAt, "Web project export time"),
    unrestrictedProjectIncluded: false,
    providerCredentialsIncluded: false,
    localPathsIncluded: false,
  };
}

function webNodeView(entry) {
  const advertisement = entry.advertisement;
  return {
    nodeId: advertisement.nodeId,
    relationship: entry.relationship,
    availability: advertisement.availability,
    capabilities: [...advertisement.capabilities],
    modelClasses: [...advertisement.modelClasses],
    workflowClasses: [...advertisement.workflowClasses],
    memoryTier: advertisement.memoryTier,
    currentLoadPercent: advertisement.currentLoadPercent,
    protocolVersion: advertisement.protocolVersion,
    cost: { ...advertisement.cost },
    requiresBillingConsent: advertisement.cost.kind === "paid",
    advertisementExpiresAt: advertisement.expiresAt,
  };
}

export function discoverWebComputeNodes(account, session, directory, options = {}) {
  assertWebSessionActive(account, session, options.now || new Date().toISOString());
  const visible = discoverComputeNodes(account, directory, options);
  const views = visible.map(webNodeView);
  return {
    version: 1,
    yourNodes: views.filter((entry) => entry.relationship === "own"),
    trustedNodes: views.filter((entry) => entry.relationship === "trusted" || entry.relationship === "studio"),
    publicNodes: views.filter((entry) => entry.relationship === "public"),
  };
}

function selectedById(values, ids, label) {
  if (!Array.isArray(ids)) throw new Error(`${label} IDs must be an array.`);
  const normalizedIds = ids.map((value) => stableId(value, `${label} id`));
  if (new Set(normalizedIds).size !== normalizedIds.length) throw new Error(`${label} IDs must be unique.`);
  const byId = new Map(values.map((value) => [value.contextId || value.artifactId, value]));
  return normalizedIds.map((id) => {
    const match = byId.get(id);
    if (!match) throw new Error(`${label} ${id} is not part of the explicit web project export.`);
    return match;
  });
}

export function createWebRemoteBuildDispatch(account, session, directory, projectExport, input) {
  allowedFields(input, DISPATCH_FIELDS, "Web remote BUILD dispatch");
  const requestedAt = iso(input.requestedAt, "Web remote BUILD request time");
  assertWebSessionActive(account, session, requestedAt);
  if (projectExport.sessionId !== session.sessionId) throw new Error("Web project export belongs to a different session.");
  const authoritativeProjectNode = assertAuthorizedNode(account, input.authoritativeProjectNodeId);
  const selected = requireSelectedComputeNode(account, directory, input.selectedNodeId, {
    now: requestedAt,
    capability: input.capability,
  });
  if (selected.advertisement.cost.kind === "paid") {
    if (!input.billingConsentId) throw new Error("Paid remote compute requires explicit billing consent before web dispatch.");
    assertFreshWebReauthentication(account, session, requestedAt);
  }
  const contextItems = selectedById(projectExport.remoteContextItems, input.contextIds, "Remote context");
  if (contextItems.length === 0) throw new Error("Web remote BUILD dispatch requires at least one explicitly exported context item.");
  const artifacts = selectedById(projectExport.acceptedArtifacts, input.referenceAssetIds || [], "Reference artifact");
  const referenceAssets = artifacts.map((item) => ({
    assetId: item.artifactId,
    contentHashSha256: item.contentHashSha256,
    mediaType: item.mediaType,
    byteLength: item.byteLength,
  }));
  const workPackage = createScopedRemoteWorkPackage(account, selected, {
    jobId: input.jobId,
    requesterPersonId: account.personId,
    requesterNodeId: authoritativeProjectNode.nodeId,
    capability: input.capability,
    contextItems,
    referenceAssets,
    modelClass: input.modelClass,
    workflowClass: input.workflowClass,
    constraints: input.constraints,
    grant: input.grant,
    returnRouteId: input.returnRouteId,
    billingConsentId: input.billingConsentId,
    requestedAt,
  });
  return {
    version: 1,
    dispatchId: stableId(input.dispatchId, "Web dispatch id"),
    sessionId: session.sessionId,
    projectId: projectExport.projectId,
    projectRevision: projectExport.projectRevision,
    authoritativeProjectNodeId: authoritativeProjectNode.nodeId,
    selectedNodeId: selected.advertisement.nodeId,
    selectedRelationship: selected.relationship,
    status: "dispatched",
    savedToProject: false,
    requestedAt,
    workPackage,
  };
}

export function receiveWebRemoteCandidate(account, session, dispatch, resultInput, now = new Date().toISOString()) {
  assertWebSessionActive(account, session, now);
  if (dispatch.sessionId !== session.sessionId) throw new Error("Remote dispatch belongs to a different web session.");
  const candidate = createCandidateRemoteResult(dispatch.workPackage, resultInput);
  return {
    version: 1,
    dispatchId: dispatch.dispatchId,
    projectId: dispatch.projectId,
    authoritativeProjectNodeId: dispatch.authoritativeProjectNodeId,
    candidate,
    reviewStatus: "awaiting-user-review",
    reconciliationStatus: "not-requested",
    savedToProject: false,
  };
}

export function requestWebCandidateReconciliation(account, session, candidateEnvelope, input) {
  allowedFields(input, RECONCILIATION_FIELDS, "Web candidate reconciliation request");
  const requestedAt = iso(input.requestedAt, "Web reconciliation request time");
  assertWebSessionActive(account, session, requestedAt);
  const authoritativeNode = assertAuthorizedNode(account, input.authoritativeProjectNodeId);
  if (authoritativeNode.nodeId !== candidateEnvelope.authoritativeProjectNodeId) {
    throw new Error("Web candidate must reconcile through the same authoritative project Node that created the dispatch.");
  }
  if (candidateEnvelope.candidate.accepted !== false || candidateEnvelope.candidate.canonStatus !== "not-canon") {
    throw new Error("Remote candidate authority was mutated before project reconciliation.");
  }
  return {
    version: 1,
    reconciliationId: stableId(input.reconciliationId, "Web reconciliation id"),
    sessionId: session.sessionId,
    projectId: candidateEnvelope.projectId,
    authoritativeProjectNodeId: authoritativeNode.nodeId,
    candidate: candidateEnvelope.candidate,
    reviewStatus: "accepted-for-project-reconciliation",
    reconciliationStatus: "pending-authoritative-project",
    savedToProject: false,
    requestedAt,
  };
}

export function applyAuthoritativeReconciliationReceipt(account, session, pending, input) {
  allowedFields(input, RECONCILIATION_RECEIPT_FIELDS, "Authoritative reconciliation receipt");
  const reconciledAt = iso(input.reconciledAt, "Authoritative reconciliation time");
  assertWebSessionActive(account, session, reconciledAt);
  const authoritativeNode = assertAuthorizedNode(account, input.authoritativeProjectNodeId);
  if (authoritativeNode.nodeId !== pending.authoritativeProjectNodeId) {
    throw new Error("Authoritative reconciliation receipt came from a different Node.");
  }
  const status = enumValue(input.status, ["applied", "rejected"], "Authoritative reconciliation status");
  return {
    ...pending,
    reconciliation: {
      receiptId: stableId(input.receiptId, "Authoritative reconciliation receipt id"),
      authoritativeProjectNodeId: authoritativeNode.nodeId,
      status,
      projectRevision: integer(input.projectRevision, "Reconciled project revision", 0, Number.MAX_SAFE_INTEGER),
      reconciledAt,
    },
    reconciliationStatus: status === "applied" ? "applied-by-authoritative-project" : "rejected-by-authoritative-project",
    savedToProject: status === "applied",
  };
}

export const WEB_SESSION_ALLOWLIST = SESSION_FIELDS;
export const WEB_COMMUNITY_ALLOWLIST = COMMUNITY_FIELDS;
export const WEB_PROJECT_EXPORT_ALLOWLIST = PROJECT_EXPORT_FIELDS;
export const WEB_REMOTE_DISPATCH_ALLOWLIST = DISPATCH_FIELDS;
