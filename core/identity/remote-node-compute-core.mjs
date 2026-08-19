import { assertAuthorizedNode } from "./account-learn-sync-core.mjs";

const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{1,127}$/i;
const PRIVATE_KEY_MATERIAL_PATTERN = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

const ADVERTISEMENT_FIELDS = Object.freeze([
  "nodeId",
  "ownerPersonId",
  "sharingEnabled",
  "sharingScope",
  "availability",
  "capabilities",
  "modelClasses",
  "workflowClasses",
  "memoryTier",
  "currentLoadPercent",
  "protocolVersion",
  "cost",
  "advertisedAt",
  "expiresAt",
]);
const WORK_PACKAGE_FIELDS = Object.freeze([
  "jobId",
  "requesterPersonId",
  "requesterNodeId",
  "capability",
  "contextItems",
  "referenceAssets",
  "modelClass",
  "workflowClass",
  "constraints",
  "grant",
  "returnRouteId",
  "billingConsentId",
  "requestedAt",
]);
const RESULT_FIELDS = Object.freeze([
  "resultId",
  "nodeId",
  "completedAt",
  "artifact",
  "providerClass",
  "modelClass",
  "workflowClass",
  "signedReceiptId",
]);

export const COMPUTE_RELATIONSHIPS = Object.freeze(["own", "trusted", "studio", "public"]);
export const COMPUTE_SHARING_SCOPES = Object.freeze(["private", "trusted", "studio", "public"]);
export const COMPUTE_CAPABILITIES = Object.freeze(["text", "image", "video"]);
export const COMPUTE_AVAILABILITY = Object.freeze(["available", "busy", "offline"]);

function stableId(value, label) {
  const normalized = String(value || "").trim();
  if (!ID_PATTERN.test(normalized)) throw new Error(`${label} must be a stable 2-128 character identifier.`);
  return normalized;
}

function cleanText(value, label, maximum) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) throw new Error(`${label} is required.`);
  if (normalized.length > maximum) throw new Error(`${label} must be ${maximum} characters or fewer.`);
  if (/[\u0000-\u001F\u007F]/.test(normalized)) throw new Error(`${label} contains unsupported control characters.`);
  if (PRIVATE_KEY_MATERIAL_PATTERN.test(normalized)) throw new Error(`${label} cannot contain private key material.`);
  return normalized;
}

function validIso(value, label) {
  const normalized = String(value || "");
  if (!normalized || Number.isNaN(Date.parse(normalized))) throw new Error(`${label} must be an ISO date-time.`);
  return normalized;
}

function enumValue(value, allowed, label) {
  const normalized = String(value || "").trim();
  if (!allowed.includes(normalized)) throw new Error(`${label} must be one of: ${allowed.join(", ")}.`);
  return normalized;
}

function finiteInteger(value, label, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

function assertAllowedFields(input, allowed, label) {
  for (const key of Object.keys(input || {})) {
    if (!allowed.includes(key)) throw new Error(`${label} field is outside the allowlist: ${key}`);
  }
}

function uniqueStableIds(values, label, maximum = 32) {
  if (!Array.isArray(values)) throw new Error(`${label} must be an array.`);
  if (values.length > maximum) throw new Error(`${label} may contain at most ${maximum} entries.`);
  return [...new Set(values.map((value) => stableId(value, label)))].sort((left, right) => left.localeCompare(right));
}

function capabilityList(values) {
  if (!Array.isArray(values) || values.length === 0) throw new Error("Compute capabilities must contain at least one capability.");
  return [...new Set(values.map((value) => enumValue(value, COMPUTE_CAPABILITIES, "Compute capability")))].sort();
}

function sanitizeCost(input) {
  const cost = input || { kind: "free" };
  assertAllowedFields(cost, ["kind", "currency", "amountMinor", "unit"], "Compute cost");
  const kind = enumValue(cost.kind || "free", ["free", "paid"], "Compute cost kind");
  if (kind === "free") return { kind: "free" };
  const currency = String(cost.currency || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Paid compute currency must be a three-letter currency code.");
  const amountMinor = finiteInteger(cost.amountMinor, "Paid compute amountMinor", 1, 100_000_000);
  const unit = enumValue(cost.unit || "job", ["job"], "Paid compute unit");
  return { kind, currency, amountMinor, unit };
}

function sharingRank(scope) {
  return COMPUTE_SHARING_SCOPES.indexOf(scope);
}

function relationshipMinimumScope(relationship) {
  if (relationship === "trusted") return "trusted";
  if (relationship === "studio") return "studio";
  if (relationship === "public") return "public";
  return "private";
}

function accountMatchesDirectory(account, directory) {
  if (account.personId !== directory.personId) throw new Error("Compute directory must belong to the authenticated PlotPickle account.");
}

export function createComputeNodeDirectory(personId) {
  return { version: 1, personId: stableId(personId, "Person id"), nodes: {} };
}

export function createComputeNodeAdvertisement(input) {
  assertAllowedFields(input, ADVERTISEMENT_FIELDS, "Compute advertisement");
  if (input?.sharingEnabled !== true) {
    throw new Error("Compute sharing is disabled until the Node owner explicitly opts in.");
  }
  const advertisedAt = validIso(input.advertisedAt, "Compute advertisement time");
  const expiresAt = validIso(input.expiresAt, "Compute advertisement expiry");
  if (Date.parse(expiresAt) <= Date.parse(advertisedAt)) throw new Error("Compute advertisement expiry must be after its advertisement time.");
  if (Date.parse(expiresAt) - Date.parse(advertisedAt) > 24 * 60 * 60 * 1000) {
    throw new Error("Compute advertisements must expire within 24 hours and be refreshed explicitly.");
  }
  return {
    version: 1,
    nodeId: stableId(input.nodeId, "Compute Node id"),
    ownerPersonId: stableId(input.ownerPersonId, "Compute Node owner person id"),
    sharingScope: enumValue(input.sharingScope, COMPUTE_SHARING_SCOPES, "Compute sharing scope"),
    availability: enumValue(input.availability, COMPUTE_AVAILABILITY, "Compute availability"),
    capabilities: capabilityList(input.capabilities),
    modelClasses: uniqueStableIds(input.modelClasses || [], "Model class"),
    workflowClasses: uniqueStableIds(input.workflowClasses || [], "Workflow class"),
    memoryTier: enumValue(input.memoryTier, ["small", "medium", "large", "xlarge"], "Memory tier"),
    currentLoadPercent: finiteInteger(input.currentLoadPercent, "Current load percent", 0, 100),
    protocolVersion: stableId(input.protocolVersion, "Remote compute protocol version"),
    cost: sanitizeCost(input.cost),
    advertisedAt,
    expiresAt,
  };
}

export function advertiseOwnedComputeNode(account, directory, nodeId, input) {
  accountMatchesDirectory(account, directory);
  const node = assertAuthorizedNode(account, nodeId);
  const advertisement = createComputeNodeAdvertisement({ ...input, nodeId: node.nodeId, ownerPersonId: account.personId });
  return {
    ...directory,
    nodes: {
      ...directory.nodes,
      [node.nodeId]: {
        relationship: "own",
        userApproved: true,
        verifiedAt: advertisement.advertisedAt,
        advertisement,
      },
    },
  };
}

export function registerDiscoveredComputeNode(directory, input) {
  assertAllowedFields(input, ["relationship", "advertisement", "verifiedAt", "userApproved"], "Discovered compute Node");
  const relationship = enumValue(input.relationship, ["trusted", "studio", "public"], "Compute relationship");
  const advertisement = createComputeNodeAdvertisement({ ...input.advertisement, sharingEnabled: true });
  const requiredScope = relationshipMinimumScope(relationship);
  if (sharingRank(advertisement.sharingScope) < sharingRank(requiredScope)) {
    throw new Error(`Node sharing scope ${advertisement.sharingScope} does not permit ${relationship} discovery.`);
  }
  if ((relationship === "trusted" || relationship === "studio") && input.userApproved !== true) {
    throw new Error(`${relationship} compute relationships require explicit user approval.`);
  }
  if (advertisement.ownerPersonId === directory.personId) {
    throw new Error("A Node owned by this account must be registered through the authorized own-Node path.");
  }
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

function isActiveOwnNode(account, entry) {
  if (entry.relationship !== "own") return true;
  const authorized = account.nodes?.[entry.advertisement.nodeId];
  return Boolean(authorized && !authorized.revokedAt);
}

export function discoverComputeNodes(account, directory, options = {}) {
  accountMatchesDirectory(account, directory);
  const now = validIso(options.now || new Date().toISOString(), "Compute discovery time");
  const relationships = options.relationships
    ? options.relationships.map((value) => enumValue(value, COMPUTE_RELATIONSHIPS, "Compute relationship"))
    : [...COMPUTE_RELATIONSHIPS];
  const capability = options.capability ? enumValue(options.capability, COMPUTE_CAPABILITIES, "Requested compute capability") : null;
  const availableOnly = options.availableOnly === true;
  const order = new Map(COMPUTE_RELATIONSHIPS.map((value, index) => [value, index]));
  return Object.values(directory.nodes)
    .filter((entry) => relationships.includes(entry.relationship))
    .filter((entry) => isActiveOwnNode(account, entry))
    .filter((entry) => Date.parse(entry.advertisement.expiresAt) > Date.parse(now))
    .filter((entry) => !capability || entry.advertisement.capabilities.includes(capability))
    .filter((entry) => !availableOnly || entry.advertisement.availability === "available")
    .sort((left, right) => {
      const relationshipOrder = order.get(left.relationship) - order.get(right.relationship);
      if (relationshipOrder !== 0) return relationshipOrder;
      const loadOrder = left.advertisement.currentLoadPercent - right.advertisement.currentLoadPercent;
      if (loadOrder !== 0) return loadOrder;
      return left.advertisement.nodeId.localeCompare(right.advertisement.nodeId);
    });
}

export function requireSelectedComputeNode(account, directory, nodeId, options = {}) {
  const id = stableId(nodeId, "Selected Compute Node id");
  const nodes = discoverComputeNodes(account, directory, { ...options, availableOnly: false });
  const selected = nodes.find((entry) => entry.advertisement.nodeId === id);
  if (!selected) throw new Error("The explicitly selected Compute Node is not discoverable or authorized; PlotPickle will not silently choose another Node.");
  if (selected.advertisement.availability !== "available") {
    throw new Error(`The explicitly selected Compute Node is ${selected.advertisement.availability}; PlotPickle will not silently fall back to another Node.`);
  }
  return selected;
}

function sanitizeContextItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw new Error("A remote work package requires at least one narrowly scoped context item.");
  if (items.length > 16) throw new Error("A remote work package may contain at most 16 context items.");
  return items.map((item) => {
    assertAllowedFields(item, ["contextId", "kind", "text"], "Remote context item");
    return {
      contextId: stableId(item.contextId, "Remote context id"),
      kind: enumValue(item.kind, ["story", "character", "world", "visual", "instruction"], "Remote context kind"),
      text: cleanText(item.text, "Remote context text", 20_000),
    };
  });
}

function sanitizeReferenceAssets(items) {
  if (!Array.isArray(items)) throw new Error("Remote reference assets must be an array.");
  if (items.length > 16) throw new Error("A remote work package may contain at most 16 reference assets.");
  return items.map((item) => {
    assertAllowedFields(item, ["assetId", "contentHashSha256", "mediaType", "byteLength"], "Remote reference asset");
    const hash = String(item.contentHashSha256 || "").trim().toLowerCase();
    if (!SHA256_PATTERN.test(hash)) throw new Error("Remote reference asset hash must be a SHA-256 hex digest.");
    return {
      assetId: stableId(item.assetId, "Remote reference asset id"),
      contentHashSha256: hash,
      mediaType: cleanText(item.mediaType, "Remote reference asset media type", 120),
      byteLength: finiteInteger(item.byteLength, "Remote reference asset byte length", 1, 250_000_000),
    };
  });
}

function sanitizeConstraints(input) {
  assertAllowedFields(input, ["maxRuntimeSeconds", "maxOutputBytes"], "Remote work constraints");
  return {
    maxRuntimeSeconds: finiteInteger(input?.maxRuntimeSeconds, "Remote max runtime seconds", 1, 1_800),
    maxOutputBytes: finiteInteger(input?.maxOutputBytes, "Remote max output bytes", 1, 250_000_000),
  };
}

function sanitizeGrant(input, targetNodeId, capability) {
  assertAllowedFields(input, ["grantId", "issuedAt", "expiresAt", "targetNodeId", "capability", "maxUses"], "Remote task grant");
  const issuedAt = validIso(input?.issuedAt, "Remote task grant issue time");
  const expiresAt = validIso(input?.expiresAt, "Remote task grant expiry");
  if (stableId(input?.targetNodeId, "Remote task grant target Node id") !== targetNodeId) {
    throw new Error("Remote task grant target must match the explicitly selected Compute Node.");
  }
  if (enumValue(input?.capability, COMPUTE_CAPABILITIES, "Remote task grant capability") !== capability) {
    throw new Error("Remote task grant capability must match the requested capability.");
  }
  if (input?.maxUses !== 1) throw new Error("Remote task grants are single-use only.");
  const lifetime = Date.parse(expiresAt) - Date.parse(issuedAt);
  if (lifetime <= 0 || lifetime > 30 * 60 * 1000) throw new Error("Remote task grants must expire within 30 minutes.");
  return {
    grantId: stableId(input?.grantId, "Remote task grant id"),
    issuedAt,
    expiresAt,
    targetNodeId,
    capability,
    maxUses: 1,
  };
}

export function createScopedRemoteWorkPackage(account, selectedEntry, input) {
  assertAllowedFields(input, WORK_PACKAGE_FIELDS, "Remote work package");
  const requesterPersonId = stableId(input.requesterPersonId, "Requester person id");
  if (requesterPersonId !== account.personId) throw new Error("Remote work requester must match the authenticated PlotPickle account.");
  const requesterNode = assertAuthorizedNode(account, input.requesterNodeId);
  const advertisement = selectedEntry?.advertisement;
  if (!advertisement) throw new Error("Remote work requires one explicitly selected Compute Node.");
  const capability = enumValue(input.capability, COMPUTE_CAPABILITIES, "Requested compute capability");
  if (!advertisement.capabilities.includes(capability)) throw new Error("Selected Compute Node does not advertise the requested capability.");
  if (advertisement.availability !== "available") throw new Error("Selected Compute Node is not currently available.");
  const requestedAt = validIso(input.requestedAt, "Remote work request time");
  if (Date.parse(advertisement.expiresAt) <= Date.parse(requestedAt)) throw new Error("Selected Compute Node advertisement has expired.");

  const modelClass = input.modelClass ? stableId(input.modelClass, "Requested model class") : null;
  if (modelClass && !advertisement.modelClasses.includes(modelClass)) throw new Error("Selected Compute Node does not advertise the requested model class.");
  const workflowClass = input.workflowClass ? stableId(input.workflowClass, "Requested workflow class") : null;
  if (workflowClass && !advertisement.workflowClasses.includes(workflowClass)) throw new Error("Selected Compute Node does not advertise the requested workflow class.");

  let billingConsentId = null;
  if (advertisement.cost.kind === "paid") {
    if (!input.billingConsentId) throw new Error("Paid remote compute requires explicit billing consent before dispatch.");
    billingConsentId = stableId(input.billingConsentId, "Billing consent id");
  }

  const targetNodeId = advertisement.nodeId;
  return {
    version: 1,
    jobId: stableId(input.jobId, "Remote job id"),
    requesterPersonId,
    requesterNodeId: requesterNode.nodeId,
    targetNodeId,
    capability,
    contextItems: sanitizeContextItems(input.contextItems),
    referenceAssets: sanitizeReferenceAssets(input.referenceAssets || []),
    modelClass,
    workflowClass,
    constraints: sanitizeConstraints(input.constraints),
    grant: sanitizeGrant(input.grant, targetNodeId, capability),
    returnRouteId: stableId(input.returnRouteId, "Remote return route id"),
    billingConsentId,
    requestedAt,
  };
}

export function assertRemoteWorkPackageUsable(workPackage, nodeId, now = new Date().toISOString()) {
  const targetNodeId = stableId(nodeId, "Executing Compute Node id");
  if (workPackage.targetNodeId !== targetNodeId) throw new Error("Remote work package is bound to a different Compute Node.");
  const executionTime = validIso(now, "Remote work execution time");
  if (Date.parse(workPackage.grant.expiresAt) <= Date.parse(executionTime)) throw new Error("Remote task grant has expired.");
  if (workPackage.grant.maxUses !== 1) throw new Error("Remote task grant is not single-use.");
  if (workPackage.grant.targetNodeId !== targetNodeId) throw new Error("Remote task grant target does not match the executing Compute Node.");
  if (workPackage.grant.capability !== workPackage.capability) throw new Error("Remote task grant capability does not match the work package.");
  return workPackage;
}

function sanitizeArtifact(input) {
  assertAllowedFields(input, ["artifactId", "contentHashSha256", "mediaType", "byteLength", "remoteArtifactRef"], "Remote result artifact");
  const hash = String(input?.contentHashSha256 || "").trim().toLowerCase();
  if (!SHA256_PATTERN.test(hash)) throw new Error("Remote result artifact hash must be a SHA-256 hex digest.");
  return {
    artifactId: stableId(input?.artifactId, "Remote artifact id"),
    contentHashSha256: hash,
    mediaType: cleanText(input?.mediaType, "Remote artifact media type", 120),
    byteLength: finiteInteger(input?.byteLength, "Remote artifact byte length", 1, 500_000_000),
    remoteArtifactRef: stableId(input?.remoteArtifactRef, "Remote artifact reference"),
  };
}

export function createCandidateRemoteResult(workPackage, input) {
  assertAllowedFields(input, RESULT_FIELDS, "Remote result");
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
    artifact: sanitizeArtifact(input.artifact),
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

export const REMOTE_COMPUTE_ADVERTISEMENT_ALLOWLIST = ADVERTISEMENT_FIELDS;
export const REMOTE_WORK_PACKAGE_ALLOWLIST = WORK_PACKAGE_FIELDS;
export const REMOTE_RESULT_ALLOWLIST = RESULT_FIELDS;
