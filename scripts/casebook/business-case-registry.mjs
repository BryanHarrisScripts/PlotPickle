const BUSINESS_CASE_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function freezeList(values = []) {
  return Object.freeze([...(Array.isArray(values) ? values : [])]);
}

export function validateBusinessCaseContribution(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, errors: ["Business Case contribution must be an object."] };
  }
  if (!nonEmpty(value.businessCaseId) || !BUSINESS_CASE_ID_PATTERN.test(value.businessCaseId)) errors.push("businessCaseId must be a stable lowercase identifier.");
  if (!nonEmpty(value.version) || !VERSION_PATTERN.test(value.version)) errors.push("version must use semantic versioning.");
  if (!nonEmpty(value.title)) errors.push("title is required.");
  if (!nonEmpty(value.ownerId)) errors.push("ownerId is required.");
  if (!nonEmpty(value.capability)) errors.push("capability is required.");
  if (!value.caseDefinition || typeof value.caseDefinition !== "object" || Array.isArray(value.caseDefinition)) errors.push("caseDefinition is required.");
  else if (value.caseDefinition.id !== value.businessCaseId) errors.push("caseDefinition.id must match businessCaseId.");
  if (!nonEmpty(value.productionFulfillmentRef)) errors.push("productionFulfillmentRef is required.");
  if (!nonEmpty(value.uatAdapterRef)) errors.push("uatAdapterRef is required.");
  if (value.setupRef != null && !nonEmpty(value.setupRef)) errors.push("setupRef must be a non-empty string when supplied.");
  if (value.cleanupRef != null && !nonEmpty(value.cleanupRef)) errors.push("cleanupRef must be a non-empty string when supplied.");
  for (const field of ["prerequisiteCapabilities", "semanticActions", "humanGates"]) {
    if (value[field] != null && !Array.isArray(value[field])) errors.push(`${field} must be an array when supplied.`);
  }
  return { valid: errors.length === 0, errors };
}

export function defineBusinessCaseContribution(value) {
  const validation = validateBusinessCaseContribution(value);
  if (!validation.valid) throw new Error(`Invalid Business Case contribution: ${validation.errors.join(" ")}`);
  return Object.freeze({
    ...value,
    prerequisiteCapabilities: freezeList(value.prerequisiteCapabilities),
    semanticActions: freezeList(value.semanticActions),
    humanGates: freezeList(value.humanGates),
    migrationState: value.migrationState === "legacy" ? "legacy" : "contract",
  });
}

export class BusinessCaseRegistry {
  #contributions = new Map();

  constructor(contributions = []) {
    this.registerMany(contributions);
  }

  register(value, { replace = false } = {}) {
    const contribution = defineBusinessCaseContribution(value);
    if (!replace && this.#contributions.has(contribution.businessCaseId)) {
      throw new Error(`Business Case ${contribution.businessCaseId} is already registered.`);
    }
    this.#contributions.set(contribution.businessCaseId, contribution);
    return contribution;
  }

  registerMany(values = [], options) {
    for (const value of values) this.register(value, options);
    return this;
  }

  get(businessCaseId) {
    return this.#contributions.get(businessCaseId) ?? null;
  }

  list({ businessCaseId = "", ownerId = "", capability = "" } = {}) {
    return [...this.#contributions.values()].filter((item) => {
      if (businessCaseId && item.businessCaseId !== businessCaseId) return false;
      if (ownerId && item.ownerId !== ownerId) return false;
      if (capability && item.capability !== capability && !item.prerequisiteCapabilities.includes(capability)) return false;
      return true;
    });
  }

  claimedCapabilities() {
    return [...new Set([...this.#contributions.values()].map((item) => item.capability))].sort();
  }
}

export function createBusinessCaseRegistry(contributions = []) {
  return new BusinessCaseRegistry(contributions);
}

export async function executeBusinessCaseContributions({ registry, selector = {}, execute }) {
  if (!(registry instanceof BusinessCaseRegistry)) throw new Error("A BusinessCaseRegistry is required.");
  if (typeof execute !== "function") throw new Error("execute must be a function.");
  const selected = registry.list(selector);
  const results = [];
  for (const contribution of selected) {
    try {
      const result = await execute(contribution);
      results.push({ businessCaseId: contribution.businessCaseId, status: result?.status || "uncertain", result });
    } catch (error) {
      results.push({
        businessCaseId: contribution.businessCaseId,
        status: "fail",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}
