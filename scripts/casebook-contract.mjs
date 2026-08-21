import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSemanticExecution } from "./semantic-execution.mjs";

export const CASEBOOK_SCHEMA_VERSION = 1;
export const CASEBOOK_RUN_STATUSES = Object.freeze(["pass", "fail", "blocked", "uncertain"]);
export const CASEBOOK_P0_IDS = Object.freeze([
  "profile-isolation",
  "buzz-connect-existing-identity",
  "buzz-great-hall-signed-conversation",
  "sage-local-text-usable-response",
  "comfyui-local-image-visible",
]);

const REQUIRED_STRING_FIELDS = ["id", "domain", "priority", "title", "situation", "businessReason", "expectedOutcome"];
const REQUIRED_ARRAY_FIELDS = ["humanJourney", "preconditions", "requiredEvidence", "knownRisks", "injectedFailureModes", "allowedSkills", "authorityBoundaries", "successCriteria", "retrievalTags", "relatedComponents"];
const SECRET_KEY_PATTERN = /(password|passphrase|secret|token|cookie|authorization|api[_-]?key|private[_-]?key|nsec)/i;
const HIDDEN_REASONING_KEYS = new Set(["chainofthought", "chain_of_thought", "reasoning", "internalreasoning", "internal_reasoning", "prompt", "messages", "scratchpad"]);

export const CASEBOOK_VERIFICATION_PHASE_PROFILE = Object.freeze({
  id: "casebook-business-verification-v1",
  initialPhase: "UNDERSTAND",
  phases: {
    UNDERSTAND: {
      purpose: "Retrieve the Business Case, authority boundaries and prior verified context before acting.",
      allowedActionClasses: [],
      transitions: ["ACT", "BLOCKED"],
      requiresEvaluation: true,
    },
    ACT: {
      purpose: "Perform only bounded Skills permitted by the Business Case.",
      allowedActionClasses: ["casebook.skill"],
      transitions: ["VERIFY", "BLOCKED"],
      requiresObservationBefore: true,
      requiresObservationAfter: true,
      requiresEvaluation: true,
    },
    VERIFY: {
      purpose: "Compare independently observed outcome evidence with the Business Case success criteria.",
      allowedActionClasses: [],
      transitions: ["COMPLETE", "REPAIR", "BLOCKED"],
      requiresEvaluation: true,
    },
    REPAIR: {
      purpose: "Repair only a verified mismatch and return to independent verification.",
      allowedActionClasses: ["developer.repair"],
      transitions: ["VERIFY", "BLOCKED"],
      requiresObservationBefore: true,
      requiresObservationAfter: true,
      requiresEvaluation: true,
    },
    COMPLETE: {
      purpose: "Record the final disposition and safe structured experience.",
      allowedActionClasses: [],
      transitions: [],
      requiresEvaluation: false,
      terminal: true,
    },
    BLOCKED: {
      purpose: "Stop because required authority, environment, or evidence is unavailable.",
      allowedActionClasses: [],
      transitions: [],
      requiresEvaluation: false,
      terminal: true,
    },
  },
});

function cleanText(value, limit = 2400) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\bnsec1[a-z0-9]{8,}\b/gi, "[REDACTED_NOSTR_PRIVATE_KEY]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}\b/gi, "Bearer [REDACTED]")
    .replace(/\b(?:sk|pk)-[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_PROVIDER_KEY]")
    .replace(/\b(api[_-]?key|password|passphrase|secret|token|cookie|private[_-]?key)\b\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function safeValue(value, key = "") {
  const normalizedKey = String(key || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (HIDDEN_REASONING_KEYS.has(normalizedKey)) return undefined;
  if (SECRET_KEY_PATTERN.test(String(key || ""))) return "[REDACTED]";
  if (typeof value === "string") return cleanText(value);
  if (typeof value === "number" || typeof value === "boolean" || value == null) return value;
  if (Array.isArray(value)) return value.map((item) => safeValue(item)).filter((item) => item !== undefined);
  if (typeof value === "object") {
    const output = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      const safe = safeValue(childValue, childKey);
      if (safe !== undefined) output[childKey] = safe;
    }
    return output;
  }
  return cleanText(value);
}

function hasUniqueIds(items) {
  const ids = items.map((item) => item?.id).filter(Boolean);
  return ids.length === new Set(ids).size;
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

export function validateCaseDefinition(caseDefinition) {
  const errors = [];
  if (!caseDefinition || typeof caseDefinition !== "object" || Array.isArray(caseDefinition)) return { valid: false, errors: ["Case definition must be an object."] };
  for (const field of REQUIRED_STRING_FIELDS) {
    if (!String(caseDefinition[field] ?? "").trim()) errors.push(`${field} is required.`);
  }
  for (const field of REQUIRED_ARRAY_FIELDS) {
    if (!Array.isArray(caseDefinition[field]) || !caseDefinition[field].length) errors.push(`${field} must be a non-empty array.`);
  }
  if (!caseDefinition.independentVerification || typeof caseDefinition.independentVerification !== "object") {
    errors.push("independentVerification is required.");
  } else {
    if (!String(caseDefinition.independentVerification.source ?? "").trim()) errors.push("independentVerification.source is required.");
    if (!String(caseDefinition.independentVerification.proves ?? "").trim()) errors.push("independentVerification.proves is required.");
  }
  if (!caseDefinition.quantitativeMeasurements || !Array.isArray(caseDefinition.quantitativeMeasurements) || !caseDefinition.quantitativeMeasurements.length) {
    errors.push("quantitativeMeasurements must be a non-empty array.");
  }
  if (Array.isArray(caseDefinition.humanJourney) && !hasUniqueIds(caseDefinition.humanJourney)) errors.push("humanJourney step ids must be unique.");
  if (Array.isArray(caseDefinition.requiredEvidence) && !hasUniqueIds(caseDefinition.requiredEvidence)) errors.push("requiredEvidence ids must be unique.");
  return { valid: errors.length === 0, errors };
}

export function validateCasebook(casebook) {
  const errors = [];
  if (Number(casebook?.schemaVersion) !== CASEBOOK_SCHEMA_VERSION) errors.push(`schemaVersion must equal ${CASEBOOK_SCHEMA_VERSION}.`);
  if (!Array.isArray(casebook?.cases) || !casebook.cases.length) errors.push("cases must be a non-empty array.");
  if (!errors.length && !hasUniqueIds(casebook.cases)) errors.push("Case ids must be unique.");
  for (const item of casebook?.cases || []) {
    const result = validateCaseDefinition(item);
    for (const error of result.errors) errors.push(`${item?.id || "<unknown>"}: ${error}`);
  }
  const presentP0 = new Set((casebook?.cases || []).filter((item) => item.priority === "P0").map((item) => item.id));
  for (const id of CASEBOOK_P0_IDS) if (!presentP0.has(id)) errors.push(`Missing required P0 Case: ${id}.`);
  return { valid: errors.length === 0, errors };
}

export async function loadCasebook(file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "config", "casebook", "p0-cases.json")) {
  const document = JSON.parse(await readFile(file, "utf8"));
  const validation = validateCasebook(document);
  if (!validation.valid) throw new Error(`Invalid PlotPickle Casebook:\n${validation.errors.map((item) => `- ${item}`).join("\n")}`);
  return document;
}

export function createCaseSemanticExecution(caseDefinition, input = {}) {
  const validation = validateCaseDefinition(caseDefinition);
  if (!validation.valid) throw new Error(`Cannot create Casebook execution for invalid Case: ${validation.errors.join(" ")}`);
  const allowedTargets = [...new Set([...(input.allowedTargets || []), ...(caseDefinition.relatedComponents || [])])];
  return createSemanticExecution({
    taskId: input.taskId || `casebook:${caseDefinition.id}`,
    agentId: input.agentId || "casebook-runner",
    domain: `casebook:${caseDefinition.domain}`,
    scope: input.scope || { nodeId: input.nodeId || "casebook-node" },
    intent: {
      objective: caseDefinition.expectedOutcome,
      constraints: [...(caseDefinition.authorityBoundaries || []), ...(input.constraints || [])],
      success: caseDefinition.successCriteria.join(" "),
      allowedActionClasses: ["casebook.skill", "developer.repair"],
      allowedTargets,
      exclusions: input.exclusions || [],
    },
    phaseProfile: CASEBOOK_VERIFICATION_PHASE_PROFILE,
    maxRepairAttempts: input.maxRepairAttempts ?? 2,
  });
}

export function evaluateCaseRun(caseDefinition, run = {}) {
  const validation = validateCaseDefinition(caseDefinition);
  if (!validation.valid) throw new Error(`Cannot evaluate invalid Case: ${validation.errors.join(" ")}`);
  const evidence = Array.isArray(run.evidence) ? run.evidence : [];
  const stepResults = Array.isArray(run.steps) ? run.steps : [];
  const blockers = Array.isArray(run.blockers) ? run.blockers.filter(Boolean) : [];
  const requiredEvidenceIds = caseDefinition.requiredEvidence.map((item) => item.id);
  const verifiedEvidenceIds = new Set(evidence.filter((item) => item?.status === "verified").map((item) => item.id));
  const requiredEvidenceVerified = requiredEvidenceIds.filter((id) => verifiedEvidenceIds.has(id)).length;
  const missingEvidence = requiredEvidenceIds.filter((id) => !verifiedEvidenceIds.has(id));
  const requiredStepIds = caseDefinition.humanJourney.map((item) => item.id);
  const passedStepIds = new Set(stepResults.filter((item) => item?.status === "pass").map((item) => item.id));
  const missingJourneySteps = requiredStepIds.filter((id) => !passedStepIds.has(id));
  const explicitFailure = stepResults.some((item) => item?.status === "fail") || evidence.some((item) => item?.status === "contradicted") || run.outcomeContradicted === true;
  const verifierSource = caseDefinition.independentVerification.source;
  const independentEvidence = evidence.filter((item) => item?.status === "verified" && item?.independent === true && item?.source === verifierSource);
  const independentVerified = independentEvidence.length > 0;
  let status = "uncertain";
  if (blockers.length) status = "blocked";
  else if (explicitFailure) status = "fail";
  else if (!missingEvidence.length && !missingJourneySteps.length && independentVerified) status = "pass";
  return {
    schemaVersion: CASEBOOK_SCHEMA_VERSION,
    caseId: caseDefinition.id,
    domain: caseDefinition.domain,
    priority: caseDefinition.priority,
    runId: cleanText(run.runId || `${caseDefinition.id}:unidentified`, 240),
    status,
    expectedOutcome: caseDefinition.expectedOutcome,
    missingEvidence,
    missingJourneySteps,
    independentVerified,
    independentEvidenceCount: independentEvidence.length,
    evidenceVerified: requiredEvidenceVerified,
    evidenceRequired: requiredEvidenceIds.length,
    journeyStepsPassed: passedStepIds.size,
    journeyStepsRequired: requiredStepIds.length,
    visualEvidencePresent: evidence.some((item) => ["screenshot", "trace", "video"].includes(item?.kind) && item?.status === "verified"),
    realIntegrationVerified: run.realIntegrationVerified === true && status === "pass",
    criticalInteractionsUnreached: Math.max(0, Number(run.criticalInteractionsUnreached || 0)),
    faultResults: (Array.isArray(run.faultResults) ? run.faultResults : []).map((item) => ({
      id: cleanText(item?.id, 160),
      injected: item?.injected === true,
      detected: item?.detected === true,
    })),
    blockers: blockers.map((item) => cleanText(item, 700)),
  };
}

export function buildAdequacyReport(casebook, results = [], options = {}) {
  const validation = validateCasebook(casebook);
  if (!validation.valid) throw new Error(`Cannot report invalid Casebook: ${validation.errors.join(" ")}`);
  const p0Cases = casebook.cases.filter((item) => item.priority === "P0");
  const latestByCase = new Map();
  for (const result of results || []) if (result?.caseId) latestByCase.set(result.caseId, result);
  const p0Results = p0Cases.map((item) => latestByCase.get(item.id)).filter(Boolean);
  const statusCounts = Object.fromEntries(CASEBOOK_RUN_STATUSES.map((status) => [status, p0Results.filter((item) => item.status === status).length]));
  const totalEvidenceRequired = p0Results.reduce((sum, item) => sum + Number(item.evidenceRequired || 0), 0);
  const totalEvidenceVerified = p0Results.reduce((sum, item) => sum + Number(item.evidenceVerified || 0), 0);
  const injectedFaults = p0Results.flatMap((item) => item.faultResults || []).filter((item) => item.injected);
  const detectedFaults = injectedFaults.filter((item) => item.detected);
  const repeatedRuns = Array.isArray(options.repeatedRuns) ? options.repeatedRuns : [];
  const escapedDefects = Array.isArray(options.escapedDefects) ? options.escapedDefects : [];
  return {
    schemaVersion: CASEBOOK_SCHEMA_VERSION,
    generatedAt: options.generatedAt || new Date().toISOString(),
    totals: {
      p0CasesDefined: p0Cases.length,
      p0CasesExpected: CASEBOOK_P0_IDS.length,
      p0CasesWithResult: p0Results.length,
      ...statusCounts,
    },
    metrics: {
      criticalBusinessCaseCoverage: ratio(p0Cases.length, CASEBOOK_P0_IDS.length),
      journeyCompletionRate: ratio(statusCounts.pass, p0Cases.length),
      requiredOutcomeProofCoverage: ratio(totalEvidenceVerified, totalEvidenceRequired),
      independentVerificationCoverage: ratio(p0Results.filter((item) => item.independentVerified).length, p0Cases.length),
      injectedFailureDetectionRate: ratio(detectedFaults.length, injectedFaults.length),
      unreachedCriticalInteractions: p0Results.reduce((sum, item) => sum + Number(item.criticalInteractionsUnreached || 0), 0),
      visualEvidenceCoverage: ratio(p0Results.filter((item) => item.visualEvidencePresent).length, p0Cases.length),
      realIntegrationCoverage: ratio(p0Results.filter((item) => item.realIntegrationVerified).length, p0Cases.length),
      flakeRate: repeatedRuns.length ? ratio(repeatedRuns.filter((item) => item.flaky === true).length, repeatedRuns.length) : null,
      escapedDefectRate: escapedDefects.length ? ratio(escapedDefects.filter((item) => item.escaped === true).length, escapedDefects.length) : null,
    },
    domains: Object.fromEntries([...new Set(p0Cases.map((item) => item.domain))].sort().map((domain) => {
      const domainResults = p0Results.filter((item) => item.domain === domain);
      return [domain, Object.fromEntries(CASEBOOK_RUN_STATUSES.map((status) => [status, domainResults.filter((item) => item.status === status).length]))];
    })),
    notes: [
      "A Case PASS requires every named proof, every Human journey step and an independent verifier observation.",
      "BLOCKED and UNCERTAIN are not counted as verified green.",
      ...(repeatedRuns.length ? [] : ["Flake rate is null until repeated-run observations are supplied."]),
      ...(escapedDefects.length ? [] : ["Escaped-defect rate is null until Human-UAT escape observations are supplied."]),
    ],
  };
}

export function createExperienceRecord(input = {}) {
  const raw = {
    schemaVersion: CASEBOOK_SCHEMA_VERSION,
    caseId: input.caseId,
    domain: input.domain,
    situation: input.situation,
    expectedResult: input.expectedResult,
    verifiedMismatch: input.verifiedMismatch,
    rootCause: input.rootCause,
    repair: input.repair,
    regressionEvidence: input.regressionEvidence,
    failureSignature: input.failureSignature,
    retrievalTags: input.retrievalTags,
    relatedComponents: input.relatedComponents,
    finalDisposition: CASEBOOK_RUN_STATUSES.includes(input.finalDisposition) ? input.finalDisposition : "uncertain",
    confidence: input.confidence,
    evidence: input.evidence,
    recordedAt: input.recordedAt || new Date().toISOString(),
    reasoning: input.reasoning,
    chainOfThought: input.chainOfThought,
    privateKey: input.privateKey,
    apiKey: input.apiKey,
  };
  return safeValue(raw);
}
