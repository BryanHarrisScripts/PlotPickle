import { assertAuthorizedNode } from "./account-learn-sync-core.mjs";

const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{1,127}$/i;
const PRIVATE_KEY_PATTERN = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

export const COMPUTE_RELATIONSHIPS = Object.freeze(["own", "trusted", "studio", "public"]);
export const COMPUTE_SHARING_SCOPES = Object.freeze(["private", "trusted", "studio", "public"]);
export const COMPUTE_CAPABILITIES = Object.freeze(["text", "image", "video"]);
export const COMPUTE_AVAILABILITY = Object.freeze(["available", "busy", "offline"]);

const AD_FIELDS = Object.freeze([
  "version", "nodeId", "ownerPersonId", "sharingEnabled", "sharingScope", "availability",
  "capabilities", "modelClasses", "workflowClasses", "memoryTier", "currentLoadPercent",
  "protocolVersion", "cost", "advertisedAt", "expiresAt",
]);
const WORK_FIELDS = Object.freeze([
  "jobId", "requesterPersonId", "requesterNodeId", "capability", "contextItems",
  "referenceAssets", "modelClass", "workflowClass", "constraints", "grant",
  "returnRouteId", "billingConsentId", "requestedAt",
]);
const RESULT_FIELDS = Object.freeze([
  "resultId", "nodeId", "completedAt", "artifact", "providerClass", "modelClass",
  "workflowClass", "signedReceiptId",
]);

function stableId(value, label) {
  const text = String(value || "").trim();
  if (!ID_PATTERN.test(text)) throw new Error(`${label} must be a stable 2-128 character identifier.`);
  return text;
}

function validIso(value, label) {
  const text = String(value || "");
  if (!text || Number.isNaN(Date.parse(text))) throw new Error(`${label} must be an ISO date-time.`);
  return text;
}

function enumValue(value, allowed, label) {
  const text = String(value || "").trim();
  if (!allowed.includes(text)) throw new Error(`${label} must be one of: ${allowed.join(", ")}.`);
  return text;
}

function integer(value, label, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${label} must be an integer between ${min} and ${max}.`);
  return value;
}

function cleanText(value, label, max) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) throw new Error(`${label} is required.`);
  if (text.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  if (PRIVATE_KEY_PATTERN.test(text)) throw new Error(`${label} cannot contain private key material.`);
  if (/[\u0000-\u001F\u007F]/.test(text)) throw new Error(`${label} contains unsupported control characters.`);
  return text;
}

function allowedFields(input, allowed, label) {
  for (const key of Object.keys(input || {})) {
    if (!allowed.includes(key)) throw new Error(`${label} field is outside the allowlist: ${key}`);
  }
}

function idList(values, label, max = 32) {
  if (!Array.isArray(values)) throw new Error(`${label} must be an array.`);
  if (values.length > max) throw new Error(`${label} may contain at most ${max} entries.`);
  return [...new Set(values.map((value) => stableId(value, label)))].sort();
}

function capabilityList(values) {
  if (!Array.isArray(values) || values.length === 0) throw new Error("Compute capabilities must contain at least one capability.");
  return [...new Set(values.map((value) => enumValue(value, COMPUTE_CAPABILITIES, "Compute capability")))].sort();
}

function sanitizeCost(value) {
  const input = value || { kind: "free" };
  allowedFields(input, ["kind", "currency", "amountMinor", "unit"], "Compute cost");
  const kind = enumValue(input.kind || "free", ["free", "paid"], "Compute cost kind");
  if (kind === "free") return { kind: "free" };
  const currency = String(input.currency || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Paid compute currency must be a three-letter currency code.");
  return {
    kind,
    currency,
    amountMinor: integer(input.amountMinor, "Paid compute amountMinor", 1, 100_000_000),
    unit: enumValue(input.unit || "job", ["job"], "Paid compute unit"),
  };
}

function minimumScope(relationship) {
  return relationship === "public" ? "public" : relationship === "studio" ? "studio" : relationship === "trusted" ? "trusted" : "private";
}

function accountOwnsDirectory(account, directory) {
  if (account.personId !== directory.personId) throw new Error("Compute directory must belong to the authenticated PlotPickle account.");
}

export function createComputeNodeDirectory(personId) {
  return { version: 1, personId: stableId(personId, "Person id"), nodes: {} };
}

export function createComputeNodeAdvertisement(input) {
  allowedFields(input, AD_FIELDS, "Compute advertisement");
  if (input?.version !== undefined && input.version !== 1) throw new Error("Unsupported compute advertisement version.");
  if (input?.sharingEnabled !== true) throw new Error("Compute sharing is disabled until the Node owner explicitly opts in.");
  const advertisedAt = validIso(input.advertisedAt, "Compute advertisement time");
  const expiresAt = validIso(input.expiresAt, "Compute advertisement expiry");
  const lifetime = Date.parse(expiresAt) - Date.parse(advertisedAt);
  if (lifetime <= 0 || lifetime > 24 * 60 * 60 * 1000) throw new Error("Compute advertisements must expire within 24 hours.");
  return {
    version: 1,
    nodeId: stableId(input.nodeId, "Compute Node id"),
    ownerPersonId: stableId(input.ownerPersonId, "Compute Node owner person id"),
    sharingEnabled: true,
    sharingScope: enumValue(input.sharingScope, COMPUTE_SHARING_SCOPES, "Compute sharing scope"),
    availability: enumValue(input.availability, COMPUTE_AVAILABILITY, "Compute availability"),
    capabilities: capabilityList(input.capabilities),
    modelClasses: idList(input.modelClasses || [], "Model class"),
    workflowClasses: idList(input.workflowClasses || [], "Workflow class"),
    memoryTier: enumValue(input.memoryTier, ["small", "medium", "large", "xlarge"], "Memory tier"),
    currentLoadPercent: integer(input.currentLoadPercent, "Current load percent", 0, 100),
    protocolVersion: stableId(input.protocolVersion, "Remote compute protocol version"),
    cost: sanitizeCost(input.cost),
    advertisedAt,
    expiresAt,
  };
}

export function advertiseOwnedComputeNode(account, directory, nodeId, input) {
  accountOwnsDirectory(account, directory);
  const node = assertAuthorizedNode(account, nodeId);
  const advertisement = createComputeNodeAdvertisement({ ...input, nodeId: node.nodeId, ownerPersonId: account.personId });
  return {
    ...directory,
    nodes: {
      ...directory.nodes,
      [node.nodeId]: { relationship: "own", userApproved: true, verifiedAt: advertisement.advertisedAt, advertisement },
    },
  };
}

export function registerDiscoveredComputeNode(directory, input) {
  allowedFields(input, ["relationship", "advertisement", "verifiedAt", "userApproved"], "Discovered compute Node");
  const relationship = enumValue(input.relationship, ["trusted", "studio", "public"], "Compute relationship");
  const advertisement = createComputeNodeAdvertisement(input.advertisement);
  if (
    COMPUTE_SHARING_SCOPES.indexOf(advertisement.sharingScope)
    < COMPUTE_SHARING_SCOPES.indexOf(minimumScope(relationship))
  ) {
    throw new Error(`Node sharing scope ${advertisement.sharingScope} does not permit ${relationship} discovery.`);
  }
  if ((relationship === "trusted" || relationship === "studio") && input.userApproved !== true) {
    throw new Error(`${relationship} compute relationships require explicit user approval.`);
  }
  if (advertisement.ownerPersonId === directory.personId) throw new Error("Own Nodes must use the authorized own-Node registration path.");
  return {
    ...directory,
    nodes: {
      ...directory.nodes,
      [advertisement.nodeId]: {
        relationship,
        userApproved: input.userApproved === true,
        verifiedAt: validIso(input.verifiedAt, "Compute Node verification time"),
        advertisement,
      },
    },
  };
}

export function disableComputeNode(directory, nodeId) {
  const id = stableId(nodeId, "Compute Node id");
  if (!directory.nodes[id]) return directory;
  const nodes = { ...directory.nodes };
  delete nodes[id];
  return { ...directory, nodes };
}

export function discoverComputeNodes(account, directory, options = {}) {
  accountOwnsDirectory(account, directory);
  const now = validIso(options.now || new Date().toISOString(), "Compute discovery time");
  const relationships = options.relationships
    ? options.relationships.map((value) => enumValue(value, COMPUTE_RELATIONSHIPS, "Compute relationship"))
    : [...COMPUTE_RELATIONSHIPS];
  const capability = options.capability ? enumValue(options.capability, COMPUTE_CAPABILITIES, "Requested compute capability") : null;
  const order = new Map(COMPUTE_RELATIONSHIPS.map((value, index) => [value, index]));
  return Object.values(directory.nodes)
    .filter((entry) => relationships.includes(entry.relationship))
    .filter((entry) => entry.relationship !== "own" || Boolean(account.nodes?.[entry.advertisement.nodeId] && !account.nodes[entry.advertisement.nodeId].revokedAt))
    .filter((entry) => Date.parse(entry.advertisement.expiresAt) > Date.parse(now))
    .filter((entry) => !capability || entry.advertisement.capabilities.includes(capability))
    .filter((entry) => options.availableOnly !== true || entry.advertisement.availability === "available")
    .sort((a, b) => order.get(a.relationship) - order.get(b.relationship) || a.advertisement.currentLoadPercent - b.advertisement.currentLoadPercent || a.advertisement.nodeId.localeCompare(b.advertisement.nodeId));
}

export function requireSelectedComputeNode(account, directory, nodeId, options = {}) {
  const id = stableId(nodeId, "Selected Compute Node id");
  const selected = discoverComputeNodes(account, directory, { ...options, availableOnly: false })
    .find((entry) => entry.advertisement.nodeId === id);
  if (!selected) throw new Error("The explicitly selected Compute Node is not discoverable or authorized; PlotPickle will not silently choose another Node.");
  if (selected.advertisement.availability !== "available") {
    throw new Error(`The explicitly selected Compute Node is ${selected.advertisement.availability}; PlotPickle will not silently fall back to another Node.`);
  }
  return selected;
}

function contextItems(values) {
  if (!Array.isArray(values) || values.length === 0 || values.length > 16) throw new Error("Remote work requires 1-16 narrowly scoped context items.");
  return values.map((item) => {
    allowedFields(item, ["contextId", "kind", "text"], "Remote context item");
    return {
      contextId: stableId(item.contextId, "Remote context id"),
      kind: enumValue(item.kind, ["story", "character", "world", "visual", "instruction"], "Remote context kind"),
      text: cleanText(item.text, "Remote context text", 20_000),
    };
  });
}

function referenceAssets(values) {
  if (!Array.isArray(values) || values.length > 16) throw new Error("Remote reference assets must contain at most 16 entries.");
  return values.map((item) => {
    allowedFields(item, ["assetId", "contentHashSha256", "mediaType", "byteLength"], "Remote reference asset");
    const hash = String(item.contentHashSha256 || "").trim().toLowerCase();
    if (!SHA256_PATTERN.test(hash)) throw new Error("Remote reference asset hash must be a SHA-256 hex digest.");
    return {
      assetId: stableId(item.assetId, "Remote reference asset id"),
      contentHashSha256: hash,
      mediaType: cleanText(item.mediaType, "Remote reference asset media type", 120),
      byteLength: integer(item.byteLength, "Remote reference asset byte length", 1, 250_000_000),
    };
  });
}

function constraints(input) {
  allowedFields(input, ["maxRuntimeSeconds", "maxOutputBytes"], "Remote work constraints");
  return {
    maxRuntimeSeconds: integer(input?.maxRuntimeSeconds, "Remote max runtime seconds", 1, 1_800),
    maxOutputBytes: integer(input?.maxOutputBytes, "Remote max output bytes", 1, 250_000_000),
  };
}

function taskGrant(input, targetNodeId, capability) {
  allowedFields(input, ["grantId", "issuedAt", "expiresAt", "targetNodeId", "capability", "maxUses"], "Remote task grant");
  const issuedAt = validIso(input?.issuedAt, "Remote task grant issue time");
  const expiresAt = validIso(input?.expiresAt, "Remote task grant expiry");
  if (stableId(input?.targetNodeId, "Remote task grant target Node id") !== targetNodeId) throw new Error("Remote task grant target must match the selected Compute Node.");
  if (enumValue(input?.capability, COMPUTE_CAPABILITIES, "Remote task grant capability") !== capability) throw new Error("Remote task grant capability must match the job.");
  if (input?.maxUses !== 1) throw new Error("Remote task grants are single-use only.");
  const lifetime = Date.parse(expiresAt) - Date.parse(issuedAt);
  if (lifetime <= 0 || lifetime > 30 * 60 * 1000) throw new Error("Remote task grants must expire within 30 minutes.");
  return { grantId: stableId(input.grantId, "Remote task grant id"), issuedAt, expiresAt, targetNodeId, capability, maxUses: 1 };
}

export function createScopedRemoteWorkPackage(account, selectedEntry, input) {
  allowedFields(input, WORK_FIELDS, "Remote work package");
  const requesterPersonId = stableId(input.requesterPersonId, "Requester person id");
  if (requesterPersonId !== account.personId) throw new Error("Remote work requester must match the authenticated PlotPickle account.");
  const requesterNode = assertAuthorizedNode(account, input.requesterNodeId);
  const advertisement = selectedEntry?.advertisement;
  if (!advertisement) throw new Error("Remote work requires one explicitly selected Compute Node.");
  const capability = enumValue(input.capability, COMPUTE_CAPABILITIES, "Requested compute capability");
  const requestedAt = validIso(input.requestedAt, "Remote work request time");
  if (!advertisement.capabilities.includes(capability)) throw new Error("Selected Compute Node does not advertise the requested capability.");
  if (advertisement.availability !== "available") throw new Error("Selected Compute Node is not currently available.");
  if (Date.parse(advertisement.expiresAt) <= Date.parse(requestedAt)) throw new Error("Selected Compute Node advertisement has expired.");
  const modelClass = input.modelClass ? stableId(input.modelClass, "Requested model class") : null;
  const workflowClass = input.workflowClass ? stableId(input.workflowClass, "Requested workflow class") : null;
  if (modelClass && !advertisement.modelClasses.includes(modelClass)) throw new Error("Selected Compute Node does not advertise the requested model class.");
  if (workflowClass && !advertisement.workflowClasses.includes(workflowClass)) throw new Error("Selected Compute Node does not advertise the requested workflow class.");
  let billingConsentId = null;
  if (advertisement.cost.kind === "paid") {
    if (!input.billingConsentId) throw new Error("Paid remote compute requires explicit billing consent before dispatch.");
    billingConsentId = stableId(input.billingConsentId, "Billing consent id");
  }
  return {
    version: 1,
    jobId: stableId(input.jobId, "Remote job id"),
    requesterPersonId,
    requesterNodeId: requesterNode.nodeId,
    targetNodeId: advertisement.nodeId,
    capability,
    contextItems: contextItems(input.contextItems),
    referenceAssets: referenceAssets(input.referenceAssets || []),
    modelClass,
    workflowClass,
    constraints: constraints(input.constraints),
    grant: taskGrant(input.grant, advertisement.nodeId, capability),
    returnRouteId: stableId(input.returnRouteId, "Remote return route id"),
    billingConsentId,
    requestedAt,
  };
}

export function assertRemoteWorkPackageUsable(workPackage, nodeId, now = new Date().toISOString()) {
  const targetNodeId = stableId(nodeId, "Executing Compute Node id");
  if (workPackage.targetNodeId !== targetNodeId || workPackage.grant.targetNodeId !== targetNodeId) throw new Error("Remote work package is bound to a different Compute Node.");
  if (workPackage.grant.capability !== workPackage.capability) throw new Error("Remote task grant capability does not match the work package.");
  if (workPackage.grant.maxUses !== 1) throw new Error("Remote task grant is not single-use.");
  if (Date.parse(workPackage.grant.expiresAt) <= Date.parse(validIso(now, "Remote work execution time"))) throw new Error("Remote task grant has expired.");
  return workPackage;
}

function artifact(input) {
  allowedFields(input, ["artifactId", "contentHashSha256", "mediaType", "byteLength", "remoteArtifactRef"], "Remote result artifact");
  const hash = String(input?.contentHashSha256 || "").trim().toLowerCase();
  if (!SHA256_PATTERN.test(hash)) throw new Error("Remote result artifact hash must be a SHA-256 hex digest.");
  return {
    artifactId: stableId(input.artifactId, "Remote artifact id"),
    contentHashSha256: hash,
    mediaType: cleanText(input.mediaType, "Remote artifact media type", 120),
    byteLength: integer(input.byteLength, "Remote artifact byte length", 1, 500_000_000),
    remoteArtifactRef: stableId(input.remoteArtifactRef, "Remote artifact reference"),
  };
}

export function createCandidateRemoteResult(workPackage, input) {
  allowedFields(input, RESULT_FIELDS, "Remote result");
  const nodeId = stableId(input.nodeId, "Result Compute Node id");
  if (nodeId !== workPackage.targetNodeId) throw new Error("Remote result must come from the Compute Node selected for the job.");
  const completedAt = validIso(input.completedAt, "Remote result completion time");
  if (Date.parse(completedAt) < Date.parse(workPackage.requestedAt)) throw new Error("Remote result cannot complete before the job was requested.");
  return {
    version: 1,
    resultId: stableId(input.resultId, "Remote result id"),
    jobId: workPackage.jobId,
    candidateStatus: "candidate",
    canonStatus: "not-canon",
    accepted: false,
    artifact: artifact(input.artifact),
    provenance: {
      nodeId,
      signedReceiptId: stableId(input.signedReceiptId, "Signed compute receipt id"),
      completedAt,
      providerClass: input.providerClass ? stableId(input.providerClass, "Provider class") : null,
      modelClass: input.modelClass ? stableId(input.modelClass, "Result model class") : workPackage.modelClass,
      workflowClass: input.workflowClass ? stableId(input.workflowClass, "Result workflow class") : workPackage.workflowClass,
    },
  };
}

export const REMOTE_COMPUTE_ADVERTISEMENT_ALLOWLIST = AD_FIELDS;
export const REMOTE_WORK_PACKAGE_ALLOWLIST = WORK_FIELDS;
export const REMOTE_RESULT_ALLOWLIST = RESULT_FIELDS;
