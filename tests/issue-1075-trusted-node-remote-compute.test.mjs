import assert from "node:assert/strict";
import test from "node:test";
import { authorizeNode, createAccountSyncState } from "../core/identity/account-learn-sync-core.mjs";
import {
  PEER_NODE_COMPUTE_ENABLED,
  createComputeNodeAdvertisement,
  createComputeNodeDirectory,
  discoverComputeNodes,
  requireSelectedComputeNode,
} from "../core/identity/remote-node-compute-core.mjs";
import {
  assertCloudWorkPackageUsable,
  createCandidateCloudResult,
  createCloudServiceRegistry,
  createScopedCloudWorkPackage,
  registerManagedCloudService,
  requireSelectedCloudService,
} from "../core/cloud/managed-cloud-compute-core.mjs";

const NOW = "2026-08-20T07:00:00.000Z";

function makeAccount() {
  let account = createAccountSyncState("person-bryan");
  account = authorizeNode(account, { nodeId: "node-requester", publicKeyPem: "-----BEGIN PUBLIC KEY-----\nREQUESTER\n-----END PUBLIC KEY-----", authorizedAt: "2026-08-20T06:50:00.000Z" });
  return account;
}

function serviceInput(overrides = {}) {
  return { serviceId: "cloud-image-primary", serviceType: "managed-cloud", enabled: true, availability: "available", capabilities: ["image"], modelClasses: ["sdxl-class"], workflowClasses: ["world-frame"], protocolVersion: "cloud-v1", cost: { kind: "free" }, verifiedAt: "2026-08-20T06:55:00.000Z", expiresAt: "2026-08-20T08:00:00.000Z", ...overrides };
}

function workInput(serviceId, overrides = {}) {
  return { jobId: "job-world-frame-01", requesterPersonId: "person-bryan", requesterNodeId: "node-requester", capability: "image", contextItems: [{ contextId: "ctx-world-01", kind: "world", text: "A rain-dark harbour at blue hour with the accepted lighthouse silhouette." }], referenceAssets: [{ assetId: "asset-lighthouse", contentHashSha256: "a".repeat(64), mediaType: "image/png", byteLength: 128000 }], modelClass: "sdxl-class", workflowClass: "world-frame", constraints: { maxRuntimeSeconds: 300, maxOutputBytes: 8000000 }, grant: { grantId: "grant-world-frame-01", issuedAt: "2026-08-20T07:00:00.000Z", expiresAt: "2026-08-20T07:20:00.000Z", targetServiceId: serviceId, capability: "image", maxUses: 1 }, returnRouteId: "route-world-frame-01", requestedAt: "2026-08-20T07:01:00.000Z", ...overrides };
}

test("ordinary PlotPickle Nodes cannot advertise or be selected for peer compute", () => {
  assert.equal(PEER_NODE_COMPUTE_ENABLED, false);
  const directory = createComputeNodeDirectory("person-bryan");
  assert.equal(directory.peerComputeEnabled, false);
  assert.deepEqual(discoverComputeNodes(makeAccount(), directory), []);
  assert.throws(() => createComputeNodeAdvertisement({ nodeId: "peer-node" }), /retired by #1135/i);
  assert.throws(() => requireSelectedComputeNode(makeAccount(), directory, "peer-node"), /retired by #1135/i);
});

test("managed cloud registry rejects Community/Node identity fields and requires explicit managed-cloud service type", () => {
  let registry = createCloudServiceRegistry("person-bryan");
  assert.throws(() => registerManagedCloudService(registry, { ...serviceInput(), nodeId: "community-node" }), /outside the allowlist: nodeId/i);
  assert.throws(() => registerManagedCloudService(registry, { ...serviceInput(), communityId: "writers-guild" }), /outside the allowlist: communityId/i);
  assert.throws(() => registerManagedCloudService(registry, { ...serviceInput(), serviceType: "community-node" }), /Community Nodes are never compute services/i);
  registry = registerManagedCloudService(registry, serviceInput());
  assert.equal(requireSelectedCloudService(registry, "cloud-image-primary", { now: NOW, capability: "image" }).serviceType, "managed-cloud");
});

test("cloud work remains least-privilege, exact-target, single-use, and candidate-only", () => {
  const account = makeAccount();
  let registry = createCloudServiceRegistry(account.personId);
  registry = registerManagedCloudService(registry, serviceInput());
  const selected = requireSelectedCloudService(registry, "cloud-image-primary", { now: NOW, capability: "image" });
  const workPackage = createScopedCloudWorkPackage(account, selected, workInput(selected.serviceId));
  assert.equal(workPackage.targetServiceId, "cloud-image-primary");
  assert.equal("targetNodeId" in workPackage, false);
  assert.equal("ppf" in workPackage, false);
  assert.doesNotThrow(() => assertCloudWorkPackageUsable(workPackage, selected.serviceId, "2026-08-20T07:10:00.000Z"));
  assert.throws(() => assertCloudWorkPackageUsable(workPackage, "cloud-other", "2026-08-20T07:10:00.000Z"), /different managed cloud service/i);
  assert.throws(() => createScopedCloudWorkPackage(account, selected, { ...workInput(selected.serviceId), providerCredentials: { token: "secret" } }), /outside the allowlist: providerCredentials/i);
  const result = createCandidateCloudResult(workPackage, { resultId: "result-world-frame-01", serviceId: selected.serviceId, completedAt: "2026-08-20T07:15:00.000Z", artifact: { artifactId: "artifact-world-frame-01", contentHashSha256: "b".repeat(64), mediaType: "image/png", byteLength: 2000000, remoteArtifactRef: "cloud-artifact-001" }, providerClass: "managed-provider", modelClass: "sdxl-class", workflowClass: "world-frame", signedReceiptId: "receipt-signed-001" });
  assert.equal(result.candidateStatus, "candidate");
  assert.equal(result.canonStatus, "not-canon");
  assert.equal(result.accepted, false);
  assert.equal(result.provenance.serviceId, selected.serviceId);
});

test("paid cloud compute requires explicit billing consent and never silently falls back", () => {
  const account = makeAccount();
  let registry = createCloudServiceRegistry(account.personId);
  registry = registerManagedCloudService(registry, serviceInput({ serviceId: "cloud-paid", cost: { kind: "paid", currency: "CAD", amountMinor: 25, unit: "job" } }));
  const selected = requireSelectedCloudService(registry, "cloud-paid", { now: NOW, capability: "image" });
  assert.throws(() => createScopedCloudWorkPackage(account, selected, workInput(selected.serviceId)), /billing consent/i);
  const paid = createScopedCloudWorkPackage(account, selected, workInput(selected.serviceId, { billingConsentId: "billing-consent-001" }));
  assert.equal(paid.billingConsentId, "billing-consent-001");
});
