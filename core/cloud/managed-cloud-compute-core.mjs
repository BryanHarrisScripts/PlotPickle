import { assertAuthorizedNode } from "../identity/account-learn-sync-core.mjs";
import {
  assertAllowedContractFields,
  normalizeContractId,
  normalizeIsoDateTime,
} from "../contracts/identity-contract-validation.mjs";

const PRIVATE_KEY_PATTERN = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

export const CLOUD_COMPUTE_CAPABILITIES = Object.freeze(["text", "image", "video"]);
export const CLOUD_COMPUTE_AVAILABILITY = Object.freeze(["available", "busy", "offline"]);

const SERVICE_FIELDS = Object.freeze([
  "version", "serviceId", "serviceType", "enabled", "availability", "capabilities",
  "modelClasses", "workflowClasses", "protocolVersion", "cost", "verifiedAt", "expiresAt",
]);
const WORK_FIELDS = Object.freeze([
  "jobId", "requesterPersonId", "requesterNodeId", "capability", "contextItems",
  "referenceAssets", "modelClass", "workflowClass", "constraints", "grant",
  "returnRouteId", "billingConsentId", "requestedAt",
]);
const RESULT_FIELDS = Object.freeze([
  "resultId", "serviceId", "completedAt", "artifact", "providerClass", "modelClass",
  "workflowClass", "signedReceiptId",
]);

function enumValue(value, allowed, label) {
  const text = String(value ?? "").trim();
  if (!allowed.includes(text)) throw new Error(`${label} must be one of: ${allowed.join(", ")}.`);
  return text;
}

function integer(value, label, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${label} must be an integer between ${min} and ${max}.`);
  return value;
}

function cleanText(value, label, max) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) throw new Error(`${label} is required.`);
  if (text.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  if (PRIVATE_KEY_PATTERN.test(text)) throw new Error(`${label} cannot contain private key material.`);
  if (/[\u0000-\u001F\u007F]/.test(text)) throw new Error(`${label} contains unsupported control characters.`);
  return text;
}

function idList(values, label, max = 32) {
  if (!Array.isArray(values)) throw new Error(`${label} must be an array.`);
  if (values.length > max) throw new Error(`${label} may contain at most ${max} entries.`);
  return [...new Set(values.map((value) => normalizeContractId(value, label)))].sort();
}

function capabilityList(values) {
  if (!Array.isArray(values) || values.length === 0) throw new Error("Cloud compute capabilities must contain at least one capability.");
  return [...new Set(values.map((value) => enumValue(value, CLOUD_COMPUTE_CAPABILITIES, "Cloud compute capability")))].sort();
}

function sanitizeCost(value) {
  const input = value || { kind: "free" };
  assertAllowedContractFields(input, ["kind", "currency", "amountMinor", "unit"], "Cloud compute cost");
  const kind = enumValue(input.kind || "free", ["free", "paid"], "Cloud compute cost kind");
  if (kind === "free") return { kind: "free" };
  const currency = String(input.currency || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Paid cloud compute currency must be a three-letter currency code.");
  return {
    kind,
    currency,
    amountMinor: integer(input.amountMinor, "Paid cloud compute amountMinor", 1, 100_000_000),
    unit: enumValue(input.unit || "job", ["job"], "Paid cloud compute unit"),
  };
}

export function createCloudServiceRegistry(personId) {
  return { version: 1, personId: normalizeContractId(personId, "Person id"), services: {} };
}

export function createManagedCloudService(input) {
  assertAllowedContractFields(input, SERVICE_FIELDS, "Managed cloud service");
  if (input?.version !== undefined && input.version !== 1) throw new Error("Unsupported managed cloud service version.");
  if (input?.serviceType !== "managed-cloud") throw new Error("Remote compute services must use serviceType managed-cloud; Community Nodes are never compute services.");
  if (input?.enabled !== true) throw new Error("Managed cloud compute must be explicitly enabled before it can be selected.");
  const verifiedAt = normalizeIsoDateTime(input.verifiedAt, "Managed cloud verification time");
  const expiresAt = normalizeIsoDateTime(input.expiresAt, "Managed cloud freshness expiry");
  const lifetime = Date.parse(expiresAt) - Date.parse(verifiedAt);
  if (lifetime <= 0 || lifetime > 24 * 60 * 60 * 1000) throw new Error("Managed cloud readiness must be re-verified within 24 hours.");
  return {
    version: 1,
    serviceId: normalizeContractId(input.serviceId, "Managed cloud service id"),
    serviceType: "managed-cloud",
    enabled: true,
    availability: enumValue(input.availability, CLOUD_COMPUTE_AVAILABILITY, "Managed cloud availability"),
    capabilities: capabilityList(input.capabilities),
    modelClasses: idList(input.modelClasses || [], "Cloud model class"),
    workflowClasses: idList(input.workflowClasses || [], "Cloud workflow class"),
    protocolVersion: normalizeContractId(input.protocolVersion, "Managed cloud protocol version"),
    cost: sanitizeCost(input.cost),
    verifiedAt,
    expiresAt,
  };
}

export function registerManagedCloudService(registry, input) {
  const service = createManagedCloudService(input);
  return { ...registry, services: { ...registry.services, [service.serviceId]: service } };
}

export function disableManagedCloudService(registry, serviceId) {
  const id = normalizeContractId(serviceId, "Managed cloud service id");
  if (!registry.services[id]) return registry;
  const services = { ...registry.services };
  delete services[id];
  return { ...registry, services };
}

export function listManagedCloudServices(registry, options = {}) {
  const now = normalizeIsoDateTime(options.now || new Date().toISOString(), "Managed cloud discovery time");
  const capability = options.capability ? enumValue(options.capability, CLOUD_COMPUTE_CAPABILITIES, "Requested cloud capability") : null;
  return Object.values(registry.services)
    .filter((service) => service.enabled === true)
    .filter((service) => Date.parse(service.expiresAt) > Date.parse(now))
    .filter((service) => !capability || service.capabilities.includes(capability))
    .filter((service) => options.availableOnly !== true || service.availability === "available")
    .sort((a, b) => a.serviceId.localeCompare(b.serviceId));
}

export function requireSelectedCloudService(registry, serviceId, options = {}) {
  const id = normalizeContractId(serviceId, "Selected managed cloud service id");
  const selected = listManagedCloudServices(registry, { ...options, availableOnly: false })
    .find((service) => service.serviceId === id);
  if (!selected) throw new Error("The explicitly selected managed cloud service is not configured, fresh, or authorized; PlotPickle will not silently choose another service.");
  if (selected.availability !== "available") throw new Error(`The explicitly selected managed cloud service is ${selected.availability}; PlotPickle will not silently fall back.`);
  return selected;
}

function contextItems(values) {
  if (!Array.isArray(values) || values.length === 0 || values.length > 16) throw new Error("Cloud work requires 1-16 narrowly scoped context items.");
  return values.map((item) => {
    assertAllowedContractFields(item, ["contextId", "kind", "text"], "Cloud context item");
    return {
      contextId: normalizeContractId(item.contextId, "Cloud context id"),
      kind: enumValue(item.kind, ["story", "character", "world", "visual", "instruction"], "Cloud context kind"),
      text: cleanText(item.text, "Cloud context text", 20_000),
    };
  });
}

function referenceAssets(values) {
  if (!Array.isArray(values) || values.length > 16) throw new Error("Cloud reference assets must contain at most 16 entries.");
  return values.map((item) => {
    assertAllowedContractFields(item, ["assetId", "contentHashSha256", "mediaType", "byteLength"], "Cloud reference asset");
    const hash = String(item.contentHashSha256 || "").trim().toLowerCase();
    if (!SHA256_PATTERN.test(hash)) throw new Error("Cloud reference asset hash must be a SHA-256 hex digest.");
    return {
      assetId: normalizeContractId(item.assetId, "Cloud reference asset id"),
      contentHashSha256: hash,
      mediaType: cleanText(item.mediaType, "Cloud reference asset media type", 120),
      byteLength: integer(item.byteLength, "Cloud reference asset byte length", 1, 250_000_000),
    };
  });
}

function constraints(input) {
  assertAllowedContractFields(input, ["maxRuntimeSeconds", "maxOutputBytes"], "Cloud work constraints");
  return {
    maxRuntimeSeconds: integer(input?.maxRuntimeSeconds, "Cloud max runtime seconds", 1, 1_800),
    maxOutputBytes: integer(input?.maxOutputBytes, "Cloud max output bytes", 1, 250_000_000),
  };
}

function taskGrant(input, targetServiceId, capability) {
  assertAllowedContractFields(input, ["grantId", "issuedAt", "expiresAt", "targetServiceId", "capability", "maxUses"], "Cloud task grant");
  const issuedAt = normalizeIsoDateTime(input?.issuedAt, "Cloud task grant issue time");
  const expiresAt = normalizeIsoDateTime(input?.expiresAt, "Cloud task grant expiry");
  if (normalizeContractId(input?.targetServiceId, "Cloud task grant target service id") !== targetServiceId) throw new Error("Cloud task grant target must match the selected managed cloud service.");
  if (enumValue(input?.capability, CLOUD_COMPUTE_CAPABILITIES, "Cloud task grant capability") !== capability) throw new Error("Cloud task grant capability must match the job.");
  if (input?.maxUses !== 1) throw new Error("Cloud task grants are single-use only.");
  const lifetime = Date.parse(expiresAt) - Date.parse(issuedAt);
  if (lifetime <= 0 || lifetime > 30 * 60 * 1000) throw new Error("Cloud task grants must expire within 30 minutes.");
  return { grantId: normalizeContractId(input.grantId, "Cloud task grant id"), issuedAt, expiresAt, targetServiceId, capability, maxUses: 1 };
}

export function createScopedCloudWorkPackage(account, selectedService, input) {
  assertAllowedContractFields(input, WORK_FIELDS, "Cloud work package");
  const requesterPersonId = normalizeContractId(input.requesterPersonId, "Requester person id");
  if (requesterPersonId !== account.personId) throw new Error("Cloud work requester must match the authenticated PlotPickle account.");
  const requesterNode = assertAuthorizedNode(account, input.requesterNodeId);
  if (!selectedService || selectedService.serviceType !== "managed-cloud") throw new Error("Cloud work requires one explicitly selected managed cloud service; a Community Node cannot be used.");
  const capability = enumValue(input.capability, CLOUD_COMPUTE_CAPABILITIES, "Requested cloud capability");
  const requestedAt = normalizeIsoDateTime(input.requestedAt, "Cloud work request time");
  if (!selectedService.capabilities.includes(capability)) throw new Error("Selected managed cloud service does not advertise the requested capability.");
  if (selectedService.availability !== "available") throw new Error("Selected managed cloud service is not currently available.");
  if (Date.parse(selectedService.expiresAt) <= Date.parse(requestedAt)) throw new Error("Selected managed cloud service readiness has expired.");
  const modelClass = input.modelClass ? normalizeContractId(input.modelClass, "Requested model class") : null;
  const workflowClass = input.workflowClass ? normalizeContractId(input.workflowClass, "Requested workflow class") : null;
  if (modelClass && !selectedService.modelClasses.includes(modelClass)) throw new Error("Selected managed cloud service does not advertise the requested model class.");
  if (workflowClass && !selectedService.workflowClasses.includes(workflowClass)) throw new Error("Selected managed cloud service does not advertise the requested workflow class.");
  let billingConsentId = null;
  if (selectedService.cost.kind === "paid") {
    if (!input.billingConsentId) throw new Error("Paid cloud compute requires explicit billing consent before dispatch.");
    billingConsentId = normalizeContractId(input.billingConsentId, "Billing consent id");
  }
  return {
    version: 1,
    jobId: normalizeContractId(input.jobId, "Cloud job id"),
    requesterPersonId,
    requesterNodeId: requesterNode.nodeId,
    targetServiceId: selectedService.serviceId,
    capability,
    contextItems: contextItems(input.contextItems),
    referenceAssets: referenceAssets(input.referenceAssets || []),
    modelClass,
    workflowClass,
    constraints: constraints(input.constraints),
    grant: taskGrant(input.grant, selectedService.serviceId, capability),
    returnRouteId: normalizeContractId(input.returnRouteId, "Cloud return route id"),
    billingConsentId,
    requestedAt,
  };
}

export function assertCloudWorkPackageUsable(workPackage, serviceId, now = new Date().toISOString()) {
  const targetServiceId = normalizeContractId(serviceId, "Executing managed cloud service id");
  if (workPackage.targetServiceId !== targetServiceId || workPackage.grant.targetServiceId !== targetServiceId) throw new Error("Cloud work package is bound to a different managed cloud service.");
  if (workPackage.grant.capability !== workPackage.capability) throw new Error("Cloud task grant capability does not match the work package.");
  if (workPackage.grant.maxUses !== 1) throw new Error("Cloud task grant is not single-use.");
  if (Date.parse(workPackage.grant.expiresAt) <= Date.parse(normalizeIsoDateTime(now, "Cloud work execution time"))) throw new Error("Cloud task grant has expired.");
  return workPackage;
}

function artifact(input) {
  assertAllowedContractFields(input, ["artifactId", "contentHashSha256", "mediaType", "byteLength", "remoteArtifactRef"], "Cloud result artifact");
  const hash = String(input?.contentHashSha256 || "").trim().toLowerCase();
  if (!SHA256_PATTERN.test(hash)) throw new Error("Cloud result artifact hash must be a SHA-256 hex digest.");
  return {
    artifactId: normalizeContractId(input.artifactId, "Cloud artifact id"),
    contentHashSha256: hash,
    mediaType: cleanText(input.mediaType, "Cloud artifact media type", 120),
    byteLength: integer(input.byteLength, "Cloud artifact byte length", 1, 500_000_000),
    remoteArtifactRef: normalizeContractId(input.remoteArtifactRef, "Cloud artifact reference"),
  };
}

export function createCandidateCloudResult(workPackage, input) {
  assertAllowedContractFields(input, RESULT_FIELDS, "Cloud result");
  const serviceId = normalizeContractId(input.serviceId, "Result managed cloud service id");
  if (serviceId !== workPackage.targetServiceId) throw new Error("Cloud result must come from the managed cloud service selected for the job.");
  const completedAt = normalizeIsoDateTime(input.completedAt, "Cloud result completion time");
  if (Date.parse(completedAt) < Date.parse(workPackage.requestedAt)) throw new Error("Cloud result cannot complete before the job was requested.");
  return {
    version: 1,
    resultId: normalizeContractId(input.resultId, "Cloud result id"),
    jobId: workPackage.jobId,
    candidateStatus: "candidate",
    canonStatus: "not-canon",
    accepted: false,
    artifact: artifact(input.artifact),
    provenance: {
      serviceId,
      signedReceiptId: normalizeContractId(input.signedReceiptId, "Signed cloud receipt id"),
      completedAt,
      providerClass: input.providerClass ? normalizeContractId(input.providerClass, "Provider class") : null,
      modelClass: input.modelClass ? normalizeContractId(input.modelClass, "Result model class") : workPackage.modelClass,
      workflowClass: input.workflowClass ? normalizeContractId(input.workflowClass, "Result workflow class") : workPackage.workflowClass,
    },
  };
}

export const CLOUD_SERVICE_ALLOWLIST = SERVICE_FIELDS;
export const CLOUD_WORK_PACKAGE_ALLOWLIST = WORK_FIELDS;
export const CLOUD_RESULT_ALLOWLIST = RESULT_FIELDS;
