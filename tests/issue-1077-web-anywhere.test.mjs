import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeNode,
  claimOrAdoptAvatar,
  createAccountSyncState,
  createPortableLearnState,
  reconcileForAuthorizedNode,
} from "../core/identity/account-learn-sync-core.mjs";
import {
  advertiseOwnedComputeNode,
  createComputeNodeAdvertisement,
  createComputeNodeDirectory,
  registerDiscoveredComputeNode,
} from "../core/identity/remote-node-compute-core.mjs";
import {
  applyAuthoritativeReconciliationReceipt,
  assertWebSessionActive,
  createAuthenticatedWebSession,
  createWebProjectReviewExport,
  createWebRemoteBuildDispatch,
  discoverWebComputeNodes,
  projectWebCommunity,
  projectWebIdentity,
  projectWebLearnState,
  receiveWebRemoteCandidate,
  requestWebCandidateReconciliation,
  revokeWebSession,
} from "../core/identity/web-anywhere-core.mjs";

const KEY_HOME = "-----BEGIN PUBLIC KEY-----\nHOME-NODE\n-----END PUBLIC KEY-----";
const KEY_OWN = "-----BEGIN PUBLIC KEY-----\nOWN-COMPUTE\n-----END PUBLIC KEY-----";
const SESSION_START = "2026-08-19T18:20:00.000Z";

function accountWithAvatar() {
  let account = createAccountSyncState("person_bryan");
  account = authorizeNode(account, {
    nodeId: "node-home",
    publicKeyPem: KEY_HOME,
    authorizedAt: "2026-08-19T18:00:00.000Z",
  });
  account = claimOrAdoptAvatar(account, "node-home", {
    draftId: "draft-home",
    displayName: "Bryan of the Brine",
  }, {
    avatarId: "avatar_bryan",
    now: "2026-08-19T18:01:00.000Z",
  }).account;
  account = authorizeNode(account, {
    nodeId: "node-own-compute",
    publicKeyPem: KEY_OWN,
    authorizedAt: "2026-08-19T18:02:00.000Z",
  });
  return account;
}

function webSession(account, overrides = {}) {
  return createAuthenticatedWebSession(account, {
    sessionId: "web-session-001",
    personId: account.personId,
    avatarId: account.avatar.avatarId,
    authenticationEvidenceId: "auth-evidence-001",
    authenticatedAt: SESSION_START,
    reauthenticatedAt: SESSION_START,
    expiresAt: "2026-08-19T20:00:00.000Z",
    clientTrust: "public-computer",
    ...overrides,
  });
}

function remoteAdvertisement(overrides = {}) {
  return createComputeNodeAdvertisement({
    nodeId: "node-public-image",
    ownerPersonId: "person_remote",
    sharingEnabled: true,
    sharingScope: "public",
    availability: "available",
    capabilities: ["image"],
    modelClasses: ["sdxl-class"],
    workflowClasses: ["world-frame"],
    memoryTier: "large",
    currentLoadPercent: 25,
    protocolVersion: "remote-v1",
    cost: { kind: "free" },
    advertisedAt: "2026-08-19T18:00:00.000Z",
    expiresAt: "2026-08-19T19:30:00.000Z",
    ...overrides,
  });
}

function computeDirectory(account) {
  let directory = createComputeNodeDirectory(account.personId);
  directory = advertiseOwnedComputeNode(account, directory, "node-own-compute", {
    sharingEnabled: true,
    sharingScope: "private",
    availability: "available",
    capabilities: ["text"],
    modelClasses: ["local-writer"],
    workflowClasses: ["story-pass"],
    memoryTier: "medium",
    currentLoadPercent: 5,
    protocolVersion: "remote-v1",
    cost: { kind: "free" },
    advertisedAt: "2026-08-19T18:00:00.000Z",
    expiresAt: "2026-08-19T19:30:00.000Z",
  });
  directory = registerDiscoveredComputeNode(directory, {
    relationship: "trusted",
    userApproved: true,
    verifiedAt: "2026-08-19T18:05:00.000Z",
    advertisement: remoteAdvertisement({
      nodeId: "node-trusted-image",
      ownerPersonId: "person_friend",
      sharingScope: "trusted",
      currentLoadPercent: 10,
    }),
  });
  directory = registerDiscoveredComputeNode(directory, {
    relationship: "public",
    userApproved: false,
    verifiedAt: "2026-08-19T18:06:00.000Z",
    advertisement: remoteAdvertisement(),
  });
  return directory;
}

function projectExport(account, session, overrides = {}) {
  return createWebProjectReviewExport(account, session, {
    projectId: "project-afterglow",
    projectRevision: 42,
    title: "Afterglow",
    frontier: "World BUILD is ready for one approved harbour frame.",
    acceptedArtifacts: [
      {
        artifactId: "artifact-lighthouse-ref",
        kind: "image",
        contentHashSha256: "a".repeat(64),
        mediaType: "image/png",
        byteLength: 145_000,
        acceptedAt: "2026-08-19T18:10:00.000Z",
      },
    ],
    remoteContextItems: [
      {
        contextId: "ctx-world-harbour",
        kind: "world",
        text: "Rain-dark harbour at blue hour with the accepted lighthouse silhouette.",
      },
      {
        contextId: "ctx-visual-palette",
        kind: "visual",
        text: "Keep the accepted teal-black palette and low-angle composition.",
      },
    ],
    exportedAt: "2026-08-19T18:21:00.000Z",
    ...overrides,
  }, "2026-08-19T18:21:00.000Z");
}

function dispatchInput(targetNodeId = "node-public-image", overrides = {}) {
  return {
    dispatchId: "dispatch-world-001",
    selectedNodeId: targetNodeId,
    authoritativeProjectNodeId: "node-home",
    jobId: "job-world-001",
    capability: "image",
    contextIds: ["ctx-world-harbour", "ctx-visual-palette"],
    referenceAssetIds: ["artifact-lighthouse-ref"],
    modelClass: "sdxl-class",
    workflowClass: "world-frame",
    constraints: { maxRuntimeSeconds: 300, maxOutputBytes: 8_000_000 },
    grant: {
      grantId: "grant-world-001",
      issuedAt: "2026-08-19T18:22:00.000Z",
      expiresAt: "2026-08-19T18:32:00.000Z",
      targetNodeId,
      capability: "image",
      maxUses: 1,
    },
    returnRouteId: "return-world-001",
    requestedAt: "2026-08-19T18:23:00.000Z",
    ...overrides,
  };
}

function resultInput(nodeId = "node-public-image") {
  return {
    resultId: "result-world-001",
    nodeId,
    completedAt: "2026-08-19T18:28:00.000Z",
    artifact: {
      artifactId: "artifact-world-generated",
      contentHashSha256: "b".repeat(64),
      mediaType: "image/png",
      byteLength: 2_000_000,
      remoteArtifactRef: "remote-artifact-world-001",
    },
    providerClass: "remote-local-image",
    modelClass: "sdxl-class",
    workflowClass: "world-frame",
    signedReceiptId: "compute-receipt-001",
  };
}

test("an authenticated public-computer session projects the same Person and canonical Avatar without storing credentials", () => {
  const account = accountWithAvatar();
  const session = webSession(account);
  const identity = projectWebIdentity(account, session, "2026-08-19T18:25:00.000Z");

  assert.equal(identity.personId, account.personId);
  assert.equal(identity.avatar.avatarId, account.avatar.avatarId);
  assert.equal(identity.avatar.displayName, "Bryan of the Brine");
  assert.equal(identity.session.storagePolicy, "memory-only");
  assert.equal(identity.session.cachePolicy, "no-store");

  const serialized = JSON.stringify({ session, identity });
  assert.equal(serialized.includes("PUBLIC KEY"), false);
  assert.equal(serialized.includes("privateKey"), false);
  assert.equal(serialized.includes("providerCredential"), false);
  assert.throws(
    () => webSession(account, { authToken: "do-not-store-this" }),
    /outside the allowlist: authToken/i,
  );
  assert.throws(
    () => webSession(account, { expiresAt: "2026-08-19T21:00:00.000Z" }),
    /2-hour limit/i,
  );
});

test("revoking a shared-computer session immediately blocks subsequent web access", () => {
  const account = accountWithAvatar();
  const session = webSession(account);
  const revoked = revokeWebSession(session, "2026-08-19T18:30:00.000Z");
  assert.throws(
    () => assertWebSessionActive(account, revoked, "2026-08-19T18:30:01.000Z"),
    /revoked/i,
  );
  assert.throws(
    () => projectWebIdentity(account, revoked, "2026-08-19T18:31:00.000Z"),
    /revoked/i,
  );
});

test("web LEARN uses the exact portable #1073 state and reconciles back to desktop without expanding the sync boundary", () => {
  const account = accountWithAvatar();
  const session = webSession(account);
  const desktop = createPortableLearnState({
    activeLessonId: "world-02",
    activeLessonUpdatedAt: "2026-08-19T18:10:00.000Z",
    completedLessonIds: ["world-01"],
  });
  const webProgress = createPortableLearnState({
    activeLessonId: "world-03",
    activeLessonUpdatedAt: "2026-08-19T18:30:00.000Z",
    completedLessonIds: ["world-01", "world-02", "world-03"],
    bookmarks: [{ lessonId: "world-03", savedAt: "2026-08-19T18:29:00.000Z" }],
  });
  const projection = projectWebLearnState(account, session, webProgress, "2026-08-19T18:31:00.000Z");
  const resumedDesktop = reconcileForAuthorizedNode(account, "node-home", desktop, projection.state).state;

  assert.equal(projection.authority, "portable-learn-sync");
  assert.deepEqual(resumedDesktop.completedLessonIds, ["world-01", "world-02", "world-03"]);
  assert.equal(resumedDesktop.activeLessonId, "world-03");
  assert.throws(
    () => projectWebLearnState(account, session, { ...webProgress, providerCredentials: { key: "secret" } }, "2026-08-19T18:31:00.000Z"),
    /outside the portable LEARN sync allowlist/i,
  );
});

test("web Community is only a projection of signature-verified BUZZ history and never creates a second chat store", () => {
  const account = accountWithAvatar();
  const session = webSession(account);
  const input = {
    authority: "buzz",
    roomId: "great-hall",
    roomName: "The Great Hall",
    projectedAt: "2026-08-19T18:32:00.000Z",
    events: [
      {
        eventId: "buzz-event-001",
        roomId: "great-hall",
        avatarId: "avatar_bryan",
        nodeId: "node-home",
        content: "Checking in from the web client.",
        createdAt: "2026-08-19T18:31:30.000Z",
        signatureVerified: true,
      },
    ],
  };
  const projection = projectWebCommunity(account, session, input, "2026-08-19T18:32:00.000Z");
  assert.equal(projection.authority, "buzz");
  assert.equal(projection.webMessageStore, false);
  assert.equal(projection.events[0].eventId, "buzz-event-001");
  assert.throws(
    () => projectWebCommunity(account, session, { ...input, authority: "web" }, "2026-08-19T18:32:00.000Z"),
    /must come from BUZZ/i,
  );
  assert.throws(
    () => projectWebCommunity(account, session, { ...input, events: [{ ...input.events[0], signatureVerified: false }] }, "2026-08-19T18:32:00.000Z"),
    /signature-verified/i,
  );
});

test("web project review exports only allowlisted summary, accepted artifact and explicit remote context data", () => {
  const account = accountWithAvatar();
  const session = webSession(account);
  const exported = projectExport(account, session);
  assert.equal(exported.unrestrictedProjectIncluded, false);
  assert.equal(exported.providerCredentialsIncluded, false);
  assert.equal(exported.localPathsIncluded, false);
  assert.equal(exported.remoteContextItems.length, 2);

  assert.throws(
    () => projectExport(account, session, { ppf: { unrestricted: true } }),
    /outside the allowlist: ppf/i,
  );
  assert.throws(
    () => projectExport(account, session, { providerCredentials: { key: "secret" } }),
    /outside the allowlist: providerCredentials/i,
  );
  assert.throws(
    () => projectExport(account, session, {
      remoteContextItems: [{ contextId: "ctx-path", kind: "world", text: "Harbour", localPath: "C:\\Projects\\Afterglow.ppf" }],
    }),
    /outside the allowlist: localPath/i,
  );
});

test("web Node discovery groups only authorized #1075 views and strips owner identity/secrets", () => {
  const account = accountWithAvatar();
  const session = webSession(account);
  const directory = computeDirectory(account);
  const discovery = discoverWebComputeNodes(account, session, directory, {
    now: "2026-08-19T18:30:00.000Z",
  });

  assert.deepEqual(discovery.yourNodes.map((item) => item.nodeId), ["node-own-compute"]);
  assert.deepEqual(discovery.trustedNodes.map((item) => item.nodeId), ["node-trusted-image"]);
  assert.deepEqual(discovery.publicNodes.map((item) => item.nodeId), ["node-public-image"]);
  assert.equal(discovery.publicNodes[0].availability, "available");
  assert.equal(discovery.publicNodes[0].requiresBillingConsent, false);
  const serialized = JSON.stringify(discovery);
  assert.equal(serialized.includes("ownerPersonId"), false);
  assert.equal(serialized.includes("privateKey"), false);
  assert.equal(serialized.includes("PUBLIC KEY"), false);
});

test("one web BUILD job dispatches only explicitly exported context to the exact selected Node", () => {
  const account = accountWithAvatar();
  const session = webSession(account);
  let directory = computeDirectory(account);
  const exported = projectExport(account, session);
  const dispatch = createWebRemoteBuildDispatch(account, session, directory, exported, dispatchInput());

  assert.equal(dispatch.selectedNodeId, "node-public-image");
  assert.equal(dispatch.authoritativeProjectNodeId, "node-home");
  assert.equal(dispatch.savedToProject, false);
  assert.deepEqual(dispatch.workPackage.contextItems.map((item) => item.contextId), ["ctx-world-harbour", "ctx-visual-palette"]);
  assert.deepEqual(dispatch.workPackage.referenceAssets.map((item) => item.assetId), ["artifact-lighthouse-ref"]);
  assert.equal("ppf" in dispatch.workPackage, false);
  assert.equal("providerCredentials" in dispatch.workPackage, false);

  assert.throws(
    () => createWebRemoteBuildDispatch(account, session, directory, exported, dispatchInput("node-public-image", { contextIds: ["ctx-not-exported"] })),
    /not part of the explicit web project export/i,
  );

  directory = registerDiscoveredComputeNode(directory, {
    relationship: "public",
    userApproved: false,
    verifiedAt: "2026-08-19T18:20:00.000Z",
    advertisement: remoteAdvertisement({
      nodeId: "node-public-busy",
      ownerPersonId: "person_busy",
      availability: "busy",
    }),
  });
  assert.throws(
    () => createWebRemoteBuildDispatch(account, session, directory, exported, dispatchInput("node-public-busy", {
      grant: { ...dispatchInput("node-public-busy").grant, targetNodeId: "node-public-busy" },
    })),
    /will not silently fall back/i,
  );
});

test("paid web compute requires both explicit billing consent and fresh reauthentication", () => {
  const account = accountWithAvatar();
  const staleSession = webSession(account, {
    reauthenticatedAt: "2026-08-19T18:20:00.000Z",
    expiresAt: "2026-08-19T20:00:00.000Z",
  });
  let directory = createComputeNodeDirectory(account.personId);
  directory = registerDiscoveredComputeNode(directory, {
    relationship: "public",
    userApproved: false,
    verifiedAt: "2026-08-19T18:25:00.000Z",
    advertisement: remoteAdvertisement({
      nodeId: "node-paid-image",
      ownerPersonId: "person_paid",
      cost: { kind: "paid", currency: "CAD", amountMinor: 50, unit: "job" },
      expiresAt: "2026-08-19T20:00:00.000Z",
    }),
  });
  const exported = projectExport(account, staleSession);
  const lateRequest = dispatchInput("node-paid-image", {
    requestedAt: "2026-08-19T18:40:00.000Z",
    grant: {
      ...dispatchInput("node-paid-image").grant,
      issuedAt: "2026-08-19T18:39:00.000Z",
      expiresAt: "2026-08-19T18:49:00.000Z",
      targetNodeId: "node-paid-image",
    },
  });
  assert.throws(
    () => createWebRemoteBuildDispatch(account, staleSession, directory, exported, lateRequest),
    /billing consent/i,
  );
  assert.throws(
    () => createWebRemoteBuildDispatch(account, staleSession, directory, exported, { ...lateRequest, billingConsentId: "billing-consent-001" }),
    /re-authentication within the last 10 minutes/i,
  );

  const freshSession = webSession(account, {
    sessionId: "web-session-fresh",
    reauthenticatedAt: "2026-08-19T18:35:00.000Z",
  });
  const freshExport = projectExport(account, freshSession);
  const paid = createWebRemoteBuildDispatch(account, freshSession, directory, freshExport, {
    ...lateRequest,
    billingConsentId: "billing-consent-001",
  });
  assert.equal(paid.workPackage.billingConsentId, "billing-consent-001");
});

test("remote result remains a preserved candidate until the authoritative project confirms reconciliation", () => {
  const account = accountWithAvatar();
  const session = webSession(account);
  const directory = computeDirectory(account);
  const exported = projectExport(account, session);
  const dispatch = createWebRemoteBuildDispatch(account, session, directory, exported, dispatchInput());
  const envelope = receiveWebRemoteCandidate(account, session, dispatch, resultInput(), "2026-08-19T18:29:00.000Z");

  assert.equal(envelope.candidate.candidateStatus, "candidate");
  assert.equal(envelope.candidate.canonStatus, "not-canon");
  assert.equal(envelope.candidate.accepted, false);
  assert.equal(envelope.savedToProject, false);
  assert.equal(envelope.candidate.provenance.signedReceiptId, "compute-receipt-001");

  const pending = requestWebCandidateReconciliation(account, session, envelope, {
    reconciliationId: "reconcile-world-001",
    authoritativeProjectNodeId: "node-home",
    requestedAt: "2026-08-19T18:30:00.000Z",
  });
  assert.equal(pending.reconciliationStatus, "pending-authoritative-project");
  assert.equal(pending.savedToProject, false);
  assert.equal(pending.candidate.resultId, envelope.candidate.resultId);

  const applied = applyAuthoritativeReconciliationReceipt(account, session, pending, {
    receiptId: "project-receipt-001",
    authoritativeProjectNodeId: "node-home",
    status: "applied",
    projectRevision: 43,
    reconciledAt: "2026-08-19T18:31:00.000Z",
  });
  assert.equal(applied.reconciliationStatus, "applied-by-authoritative-project");
  assert.equal(applied.savedToProject, true);
  assert.equal(applied.reconciliation.projectRevision, 43);
});

test("a candidate stays recoverable when the authoritative project is unavailable and a revoked web session cannot fake reconciliation", () => {
  const account = accountWithAvatar();
  const session = webSession(account);
  const directory = computeDirectory(account);
  const exported = projectExport(account, session);
  const dispatch = createWebRemoteBuildDispatch(account, session, directory, exported, dispatchInput());
  const envelope = receiveWebRemoteCandidate(account, session, dispatch, resultInput(), "2026-08-19T18:29:00.000Z");
  const pending = requestWebCandidateReconciliation(account, session, envelope, {
    reconciliationId: "reconcile-world-offline",
    authoritativeProjectNodeId: "node-home",
    requestedAt: "2026-08-19T18:30:00.000Z",
  });
  const revoked = revokeWebSession(session, "2026-08-19T18:30:30.000Z");

  assert.equal(pending.savedToProject, false);
  assert.equal(pending.candidate.artifact.artifactId, "artifact-world-generated");
  assert.throws(
    () => applyAuthoritativeReconciliationReceipt(account, revoked, pending, {
      receiptId: "fake-after-revoke",
      authoritativeProjectNodeId: "node-home",
      status: "applied",
      projectRevision: 43,
      reconciledAt: "2026-08-19T18:31:00.000Z",
    }),
    /revoked/i,
  );
});
