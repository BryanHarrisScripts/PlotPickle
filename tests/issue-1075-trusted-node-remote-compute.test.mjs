import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeNode,
  createAccountSyncState,
  revokeNode,
} from "../core/identity/account-learn-sync-core.mjs";
import {
  advertiseOwnedComputeNode,
  assertRemoteWorkPackageUsable,
  createCandidateRemoteResult,
  createComputeNodeAdvertisement,
  createComputeNodeDirectory,
  createScopedRemoteWorkPackage,
  disableComputeNode,
  discoverComputeNodes,
  registerDiscoveredComputeNode,
  requireSelectedComputeNode,
} from "../core/identity/remote-node-compute-core.mjs";

const PUBLIC_KEY_REQUESTER = "-----BEGIN PUBLIC KEY-----\nREQUESTER\n-----END PUBLIC KEY-----";
const PUBLIC_KEY_OWN = "-----BEGIN PUBLIC KEY-----\nOWN-COMPUTE\n-----END PUBLIC KEY-----";
const NOW = "2026-08-19T18:10:00.000Z";

function makeAccount() {
  let account = createAccountSyncState("person-bryan");
  account = authorizeNode(account, {
    nodeId: "node-requester",
    publicKeyPem: PUBLIC_KEY_REQUESTER,
    authorizedAt: "2026-08-19T18:00:00.000Z",
  });
  account = authorizeNode(account, {
    nodeId: "node-own",
    publicKeyPem: PUBLIC_KEY_OWN,
    authorizedAt: "2026-08-19T18:01:00.000Z",
  });
  return account;
}

function advertisementInput(overrides = {}) {
  return {
    nodeId: "node-remote-image",
    ownerPersonId: "person-remote",
    sharingEnabled: true,
    sharingScope: "public",
    availability: "available",
    capabilities: ["image"],
    modelClasses: ["sdxl-class"],
    workflowClasses: ["world-frame"],
    memoryTier: "large",
    currentLoadPercent: 20,
    protocolVersion: "remote-v1",
    cost: { kind: "free" },
    advertisedAt: "2026-08-19T18:00:00.000Z",
    expiresAt: "2026-08-19T19:00:00.000Z",
    ...overrides,
  };
}

function registerPublic(directory, overrides = {}) {
  const advertisement = createComputeNodeAdvertisement(advertisementInput(overrides));
  return registerDiscoveredComputeNode(directory, {
    relationship: "public",
    advertisement,
    verifiedAt: "2026-08-19T18:02:00.000Z",
    userApproved: false,
  });
}

function validWorkInput(targetNodeId, overrides = {}) {
  return {
    jobId: "job-world-frame-01",
    requesterPersonId: "person-bryan",
    requesterNodeId: "node-requester",
    capability: "image",
    contextItems: [
      { contextId: "ctx-world-01", kind: "world", text: "A rain-dark harbour at blue hour with the accepted lighthouse silhouette." },
      { contextId: "ctx-visual-01", kind: "visual", text: "Preserve the accepted teal-black palette and low-angle composition." },
    ],
    referenceAssets: [
      { assetId: "asset-lighthouse", contentHashSha256: "a".repeat(64), mediaType: "image/png", byteLength: 128_000 },
    ],
    modelClass: "sdxl-class",
    workflowClass: "world-frame",
    constraints: { maxRuntimeSeconds: 300, maxOutputBytes: 8_000_000 },
    grant: {
      grantId: "grant-world-frame-01",
      issuedAt: "2026-08-19T18:10:00.000Z",
      expiresAt: "2026-08-19T18:20:00.000Z",
      targetNodeId,
      capability: "image",
      maxUses: 1,
    },
    returnRouteId: "route-world-frame-01",
    requestedAt: "2026-08-19T18:11:00.000Z",
    ...overrides,
  };
}

test("Compute sharing is opt-in and safe advertisements reject endpoint/path/secret expansion", () => {
  assert.throws(
    () => createComputeNodeAdvertisement(advertisementInput({ sharingEnabled: false })),
    /explicitly opts in/i,
  );
  assert.throws(
    () => createComputeNodeAdvertisement(advertisementInput({ endpoint: "http://192.168.1.10:8188" })),
    /outside the allowlist: endpoint/i,
  );
  assert.throws(
    () => createComputeNodeAdvertisement(advertisementInput({ localPath: "C:\\Users\\writer\\ComfyUI" })),
    /outside the allowlist: localPath/i,
  );

  const directory = createComputeNodeDirectory("person-bryan");
  assert.deepEqual(directory.nodes, {});
});

test("an authorized own Node can advertise compute, opt out, and disappears immediately after account revocation", () => {
  let account = makeAccount();
  let directory = createComputeNodeDirectory(account.personId);
  directory = advertiseOwnedComputeNode(account, directory, "node-own", {
    sharingEnabled: true,
    sharingScope: "private",
    availability: "available",
    capabilities: ["text", "image"],
    modelClasses: ["local-creative"],
    workflowClasses: ["world-frame"],
    memoryTier: "medium",
    currentLoadPercent: 5,
    protocolVersion: "remote-v1",
    cost: { kind: "free" },
    advertisedAt: "2026-08-19T18:00:00.000Z",
    expiresAt: "2026-08-19T19:00:00.000Z",
  });

  assert.deepEqual(discoverComputeNodes(account, directory, { now: NOW, availableOnly: true }).map((entry) => entry.advertisement.nodeId), ["node-own"]);
  directory = disableComputeNode(directory, "node-own");
  assert.equal(discoverComputeNodes(account, directory, { now: NOW }).length, 0);

  directory = advertiseOwnedComputeNode(account, directory, "node-own", {
    sharingEnabled: true,
    sharingScope: "private",
    availability: "available",
    capabilities: ["image"],
    modelClasses: [],
    workflowClasses: [],
    memoryTier: "medium",
    currentLoadPercent: 5,
    protocolVersion: "remote-v1",
    advertisedAt: "2026-08-19T18:00:00.000Z",
    expiresAt: "2026-08-19T19:00:00.000Z",
  });
  account = revokeNode(account, "node-own", "2026-08-19T18:12:00.000Z");
  assert.equal(discoverComputeNodes(account, directory, { now: "2026-08-19T18:13:00.000Z" }).length, 0);
});

test("trusted/studio relationships require explicit user approval and advertised sharing scope is authoritative", () => {
  let directory = createComputeNodeDirectory("person-bryan");
  const trusted = createComputeNodeAdvertisement(advertisementInput({
    nodeId: "node-trusted",
    ownerPersonId: "person-friend",
    sharingScope: "trusted",
  }));
  assert.throws(
    () => registerDiscoveredComputeNode(directory, { relationship: "trusted", advertisement: trusted, verifiedAt: NOW, userApproved: false }),
    /explicit user approval/i,
  );
  directory = registerDiscoveredComputeNode(directory, {
    relationship: "trusted",
    advertisement: trusted,
    verifiedAt: NOW,
    userApproved: true,
  });

  const publicNode = createComputeNodeAdvertisement(advertisementInput({ nodeId: "node-public", ownerPersonId: "person-public", sharingScope: "public" }));
  directory = registerDiscoveredComputeNode(directory, {
    relationship: "public",
    advertisement: publicNode,
    verifiedAt: NOW,
    userApproved: false,
  });

  const privateNode = createComputeNodeAdvertisement(advertisementInput({ nodeId: "node-private", ownerPersonId: "person-private", sharingScope: "private" }));
  assert.throws(
    () => registerDiscoveredComputeNode(directory, { relationship: "trusted", advertisement: privateNode, verifiedAt: NOW, userApproved: true }),
    /does not permit trusted discovery/i,
  );

  assert.deepEqual(Object.values(directory.nodes).map((entry) => entry.relationship).sort(), ["public", "trusted"]);
});

test("discovery reports capability/load truth and an explicitly selected busy Node never falls back to another Node", () => {
  const account = makeAccount();
  let directory = createComputeNodeDirectory(account.personId);
  directory = registerPublic(directory, {
    nodeId: "node-text-ready",
    capabilities: ["text"],
    modelClasses: ["writer-class"],
    workflowClasses: ["story-pass"],
    currentLoadPercent: 10,
  });
  directory = registerPublic(directory, {
    nodeId: "node-text-busy",
    capabilities: ["text"],
    modelClasses: ["writer-class"],
    workflowClasses: ["story-pass"],
    availability: "busy",
    currentLoadPercent: 95,
  });

  const visible = discoverComputeNodes(account, directory, { now: NOW, capability: "text" });
  assert.deepEqual(visible.map((entry) => [entry.advertisement.nodeId, entry.advertisement.availability]), [
    ["node-text-ready", "available"],
    ["node-text-busy", "busy"],
  ]);
  assert.throws(
    () => requireSelectedComputeNode(account, directory, "node-text-busy", { now: NOW, capability: "text" }),
    /will not silently fall back/i,
  );
  assert.throws(
    () => requireSelectedComputeNode(account, directory, "node-does-not-exist", { now: NOW, capability: "text" }),
    /will not silently choose another Node/i,
  );
});

test("remote work packages are least-privilege, exact-target, single-use and short-lived", () => {
  const account = makeAccount();
  let directory = createComputeNodeDirectory(account.personId);
  directory = registerPublic(directory);
  const selected = requireSelectedComputeNode(account, directory, "node-remote-image", { now: NOW, capability: "image" });
  const workPackage = createScopedRemoteWorkPackage(account, selected, validWorkInput("node-remote-image"));

  assert.equal(workPackage.targetNodeId, "node-remote-image");
  assert.equal(workPackage.grant.maxUses, 1);
  assert.equal(workPackage.billingConsentId, null);
  assert.equal("ppf" in workPackage, false);
  assert.equal("providerCredentials" in workPackage, false);
  assert.doesNotThrow(() => assertRemoteWorkPackageUsable(workPackage, "node-remote-image", "2026-08-19T18:15:00.000Z"));
  assert.throws(() => assertRemoteWorkPackageUsable(workPackage, "node-other", "2026-08-19T18:15:00.000Z"), /different Compute Node/i);
  assert.throws(() => assertRemoteWorkPackageUsable(workPackage, "node-remote-image", "2026-08-19T18:21:00.000Z"), /expired/i);

  assert.throws(
    () => createScopedRemoteWorkPackage(account, selected, { ...validWorkInput("node-remote-image"), providerCredentials: { token: "secret" } }),
    /outside the allowlist: providerCredentials/i,
  );
  assert.throws(
    () => createScopedRemoteWorkPackage(account, selected, { ...validWorkInput("node-remote-image"), ppf: { unrestricted: true } }),
    /outside the allowlist: ppf/i,
  );
  assert.throws(
    () => createScopedRemoteWorkPackage(account, selected, {
      ...validWorkInput("node-remote-image"),
      contextItems: [{ contextId: "ctx-bad", kind: "world", text: "A harbour", localPath: "C:\\private\\project.ppf" }],
    }),
    /outside the allowlist: localPath/i,
  );
  assert.throws(
    () => createScopedRemoteWorkPackage(account, selected, {
      ...validWorkInput("node-remote-image"),
      contextItems: [{ contextId: "ctx-secret", kind: "world", text: "-----BEGIN PRIVATE KEY----- secret" }],
    }),
    /private key material/i,
  );
  assert.throws(
    () => createScopedRemoteWorkPackage(account, selected, {
      ...validWorkInput("node-remote-image"),
      grant: { ...validWorkInput("node-remote-image").grant, expiresAt: "2026-08-19T19:00:00.000Z" },
    }),
    /expire within 30 minutes/i,
  );
});

test("paid remote compute cannot dispatch without explicit billing consent", () => {
  const account = makeAccount();
  let directory = createComputeNodeDirectory(account.personId);
  directory = registerPublic(directory, {
    nodeId: "node-paid-image",
    cost: { kind: "paid", currency: "CAD", amountMinor: 25, unit: "job" },
  });
  const selected = requireSelectedComputeNode(account, directory, "node-paid-image", { now: NOW, capability: "image" });
  assert.throws(
    () => createScopedRemoteWorkPackage(account, selected, validWorkInput("node-paid-image")),
    /billing consent/i,
  );
  const paid = createScopedRemoteWorkPackage(account, selected, validWorkInput("node-paid-image", { billingConsentId: "billing-consent-001" }));
  assert.equal(paid.billingConsentId, "billing-consent-001");
});

test("remote output returns with provenance as a candidate and cannot self-promote to accepted canon", () => {
  const account = makeAccount();
  let directory = createComputeNodeDirectory(account.personId);
  directory = registerPublic(directory);
  const selected = requireSelectedComputeNode(account, directory, "node-remote-image", { now: NOW, capability: "image" });
  const workPackage = createScopedRemoteWorkPackage(account, selected, validWorkInput("node-remote-image"));
  const resultInput = {
    resultId: "result-world-frame-01",
    nodeId: "node-remote-image",
    completedAt: "2026-08-19T18:18:00.000Z",
    artifact: {
      artifactId: "artifact-world-frame-01",
      contentHashSha256: "b".repeat(64),
      mediaType: "image/png",
      byteLength: 2_000_000,
      remoteArtifactRef: "remote-artifact-001",
    },
    providerClass: "local-node-provider",
    modelClass: "sdxl-class",
    workflowClass: "world-frame",
    signedReceiptId: "receipt-signed-001",
  };
  const result = createCandidateRemoteResult(workPackage, resultInput);
  assert.equal(result.jobId, workPackage.jobId);
  assert.equal(result.candidateStatus, "candidate");
  assert.equal(result.canonStatus, "not-canon");
  assert.equal(result.accepted, false);
  assert.equal(result.provenance.nodeId, "node-remote-image");
  assert.equal(result.provenance.signedReceiptId, "receipt-signed-001");

  assert.throws(
    () => createCandidateRemoteResult(workPackage, { ...resultInput, accepted: true }),
    /outside the allowlist: accepted/i,
  );
  assert.throws(
    () => createCandidateRemoteResult(workPackage, { ...resultInput, nodeId: "node-impostor" }),
    /selected for the job/i,
  );
});
