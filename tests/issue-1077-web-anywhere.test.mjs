import assert from "node:assert/strict";
import test from "node:test";
import { authorizeNode, claimOrAdoptAvatar, createAccountSyncState, createPortableLearnState, reconcileForAuthorizedNode } from "../core/identity/account-learn-sync-core.mjs";
import { advertiseOwnedComputeNode, createComputeNodeAdvertisement, createComputeNodeDirectory, registerDiscoveredComputeNode } from "../core/identity/remote-node-compute-core.mjs";
import { applyAuthoritativeReconciliationReceipt, assertWebSessionActive, createAuthenticatedWebSession, createWebProjectReviewExport, createWebRemoteBuildDispatch, discoverWebComputeNodes, projectWebCommunity, projectWebIdentity, projectWebLearnState, receiveWebRemoteCandidate, requestWebCandidateReconciliation, revokeWebSession } from "../core/identity/web-anywhere-core.mjs";

const HOME_KEY = "-----BEGIN PUBLIC KEY-----\nHOME\n-----END PUBLIC KEY-----";
const OWN_KEY = "-----BEGIN PUBLIC KEY-----\nOWN\n-----END PUBLIC KEY-----";

function account() {
  let value = createAccountSyncState("person-bryan");
  value = authorizeNode(value, { nodeId: "node-home", publicKeyPem: HOME_KEY, authorizedAt: "2026-08-19T18:00:00.000Z" });
  value = claimOrAdoptAvatar(value, "node-home", { draftId: "draft-bryan", displayName: "Bryan" }, { avatarId: "avatar-bryan", now: "2026-08-19T18:01:00.000Z" }).account;
  return authorizeNode(value, { nodeId: "node-own", publicKeyPem: OWN_KEY, authorizedAt: "2026-08-19T18:02:00.000Z" });
}

function session(value, overrides = {}) {
  return createAuthenticatedWebSession(value, { sessionId: "web-session-001", personId: value.personId, avatarId: value.avatar.avatarId, authenticationEvidenceId: "auth-evidence-001", authenticatedAt: "2026-08-19T18:20:00.000Z", reauthenticatedAt: "2026-08-19T18:20:00.000Z", expiresAt: "2026-08-19T20:00:00.000Z", clientTrust: "public-computer", ...overrides });
}

function ad(overrides = {}) {
  return createComputeNodeAdvertisement({ nodeId: "node-public", ownerPersonId: "person-remote", sharingEnabled: true, sharingScope: "public", availability: "available", capabilities: ["image"], modelClasses: ["sdxl-class"], workflowClasses: ["world-frame"], memoryTier: "large", currentLoadPercent: 20, protocolVersion: "remote-v1", cost: { kind: "free" }, advertisedAt: "2026-08-19T18:00:00.000Z", expiresAt: "2026-08-19T19:30:00.000Z", ...overrides });
}

function directory(value) {
  let result = createComputeNodeDirectory(value.personId);
  result = advertiseOwnedComputeNode(value, result, "node-own", { sharingEnabled: true, sharingScope: "private", availability: "available", capabilities: ["text"], modelClasses: ["writer"], workflowClasses: ["story-pass"], memoryTier: "medium", currentLoadPercent: 5, protocolVersion: "remote-v1", cost: { kind: "free" }, advertisedAt: "2026-08-19T18:00:00.000Z", expiresAt: "2026-08-19T19:30:00.000Z" });
  result = registerDiscoveredComputeNode(result, { relationship: "trusted", userApproved: true, verifiedAt: "2026-08-19T18:05:00.000Z", advertisement: ad({ nodeId: "node-trusted", ownerPersonId: "person-friend", sharingScope: "trusted" }) });
  return registerDiscoveredComputeNode(result, { relationship: "public", userApproved: false, verifiedAt: "2026-08-19T18:06:00.000Z", advertisement: ad() });
}

function project(value, web) {
  return createWebProjectReviewExport(value, web, { projectId: "project-afterglow", projectRevision: 42, title: "Afterglow", frontier: "Approved harbour frame.", acceptedArtifacts: [{ artifactId: "artifact-ref", kind: "image", contentHashSha256: "a".repeat(64), mediaType: "image/png", byteLength: 145000, acceptedAt: "2026-08-19T18:10:00.000Z" }], remoteContextItems: [{ contextId: "ctx-harbour", kind: "world", text: "Rain-dark harbour at blue hour." }], exportedAt: "2026-08-19T18:21:00.000Z" }, "2026-08-19T18:21:00.000Z");
}

function dispatchInput(selectedNodeId = "node-public") {
  return { dispatchId: "dispatch-001", selectedNodeId, authoritativeProjectNodeId: "node-home", jobId: "job-001", capability: "image", contextIds: ["ctx-harbour"], referenceAssetIds: ["artifact-ref"], modelClass: "sdxl-class", workflowClass: "world-frame", constraints: { maxRuntimeSeconds: 300, maxOutputBytes: 8000000 }, grant: { grantId: "grant-001", issuedAt: "2026-08-19T18:22:00.000Z", expiresAt: "2026-08-19T18:32:00.000Z", targetNodeId: selectedNodeId, capability: "image", maxUses: 1 }, returnRouteId: "route-001", requestedAt: "2026-08-19T18:23:00.000Z" };
}

test("web session projects canonical identity and revocation is immediate", () => {
  const value = account();
  const web = session(value);
  const identity = projectWebIdentity(value, web, "2026-08-19T18:25:00.000Z");
  assert.equal(identity.personId, value.personId);
  assert.equal(identity.avatar.avatarId, value.avatar.avatarId);
  assert.equal(identity.session.storagePolicy, "memory-only");
  assert.equal(identity.session.cachePolicy, "no-store");
  assert.throws(() => session(value, { expiresAt: "2026-08-19T20:30:00.000Z" }), /2-hour limit/i);
  const revoked = revokeWebSession(web, "2026-08-19T18:30:00.000Z");
  assert.throws(() => assertWebSessionActive(value, revoked, "2026-08-19T18:30:01.000Z"), /revoked/i);
});

test("web LEARN reuses the portable #1073 state", () => {
  const value = account();
  const web = session(value);
  const desktop = createPortableLearnState({ activeLessonId: "world-02", activeLessonUpdatedAt: "2026-08-19T18:10:00.000Z", completedLessonIds: ["world-01"] });
  const browser = createPortableLearnState({ activeLessonId: "world-03", activeLessonUpdatedAt: "2026-08-19T18:30:00.000Z", completedLessonIds: ["world-01", "world-02"], bookmarks: { "world-03": "2026-08-19T18:29:00.000Z" } });
  const projection = projectWebLearnState(value, web, browser, "2026-08-19T18:31:00.000Z");
  const merged = reconcileForAuthorizedNode(value, "node-home", desktop, projection.state).state;
  assert.equal(projection.authority, "portable-learn-sync");
  assert.equal(merged.activeLessonId, "world-03");
  assert.equal(merged.bookmarks["world-03"], "2026-08-19T18:29:00.000Z");
});

test("Community remains a signature-verified BUZZ projection", () => {
  const value = account();
  const web = session(value);
  const community = projectWebCommunity(value, web, { authority: "buzz", roomId: "scriptorium", roomName: "The Scriptorium", projectedAt: "2026-08-19T18:25:00.000Z", events: [{ eventId: "event-001", roomId: "scriptorium", avatarId: "avatar-friend", nodeId: "node-friend", content: "Signed message.", createdAt: "2026-08-19T18:24:00.000Z", signatureVerified: true }] }, "2026-08-19T18:25:00.000Z");
  assert.equal(community.authority, "buzz");
  assert.equal(community.webMessageStore, false);
  assert.throws(() => projectWebCommunity(value, web, { authority: "web", roomId: "scriptorium", roomName: "Bad", projectedAt: "2026-08-19T18:25:00.000Z", events: [] }), /must come from BUZZ/i);
});

test("Node discovery is grouped and selected busy Nodes never silently fall back", () => {
  const value = account();
  const web = session(value);
  let nodes = directory(value);
  const visible = discoverWebComputeNodes(value, web, nodes, { now: "2026-08-19T18:24:00.000Z" });
  assert.deepEqual(visible.yourNodes.map((item) => item.nodeId), ["node-own"]);
  assert.deepEqual(visible.trustedNodes.map((item) => item.nodeId), ["node-trusted"]);
  assert.deepEqual(visible.publicNodes.map((item) => item.nodeId), ["node-public"]);
  nodes = registerDiscoveredComputeNode(nodes, { relationship: "public", userApproved: false, verifiedAt: "2026-08-19T18:06:00.000Z", advertisement: ad({ nodeId: "node-busy", availability: "busy" }) });
  assert.throws(() => createWebRemoteBuildDispatch(value, web, nodes, project(value, web), dispatchInput("node-busy")), /will not silently fall back/i);
});

test("remote result remains candidate until authoritative reconciliation succeeds", () => {
  const value = account();
  const web = session(value);
  const dispatch = createWebRemoteBuildDispatch(value, web, directory(value), project(value, web), dispatchInput());
  assert.equal(dispatch.savedToProject, false);
  assert.equal(dispatch.workPackage.contextItems.length, 1);
  const envelope = receiveWebRemoteCandidate(value, web, dispatch, { resultId: "result-001", nodeId: "node-public", completedAt: "2026-08-19T18:28:00.000Z", artifact: { artifactId: "artifact-generated", contentHashSha256: "b".repeat(64), mediaType: "image/png", byteLength: 2000000, remoteArtifactRef: "remote-artifact-001" }, providerClass: "remote-image", modelClass: "sdxl-class", workflowClass: "world-frame", signedReceiptId: "compute-receipt-001" }, "2026-08-19T18:29:00.000Z");
  assert.equal(envelope.candidate.canonStatus, "not-canon");
  assert.equal(envelope.savedToProject, false);
  const pending = requestWebCandidateReconciliation(value, web, envelope, { reconciliationId: "reconcile-001", authoritativeProjectNodeId: "node-home", requestedAt: "2026-08-19T18:30:00.000Z" });
  assert.equal(pending.savedToProject, false);
  const applied = applyAuthoritativeReconciliationReceipt(value, web, pending, { receiptId: "project-receipt-001", authoritativeProjectNodeId: "node-home", status: "applied", projectRevision: 43, reconciledAt: "2026-08-19T18:31:00.000Z" });
  assert.equal(applied.savedToProject, true);
});
