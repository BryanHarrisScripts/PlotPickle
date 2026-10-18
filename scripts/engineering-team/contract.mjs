import { createHash } from "node:crypto";

// A source-of-truth/authority contract, not an agent runtime. Actual callers
// must use the existing Responsibility Runs, autonomous QA and developer workers.
export const ENGINEERING_ROLES = Object.freeze([
  "scout", "tester", "performance", "challenger", "maintainer", "reporter", "repairer",
]);
export const COMMUNICATION_MODES = Object.freeze(["structured", "lossy"]);
export const OBSERVATION_STATES = Object.freeze(["candidate", "reproduced", "disproved", "blocked"]);
const SHA = /^[a-f0-9]{40}$/i;
const REF = /^[a-z0-9][a-z0-9._:/-]{0,199}$/i;
const MAX_SOURCES = 16;
const REDACT = [
  /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/gi,
  /\b(?:sk-[A-Za-z0-9_-]{16,}|xai-[A-Za-z0-9_-]{16,})\b/gi,
  /\bnsec1[a-z0-9]{20,}\b/gi,
  /\bBearer\s+\S+/gi,
];

function text(value, maximum = 300) {
  let result = String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  for (const pattern of REDACT) result = result.replace(pattern, "[redacted]");
  return result.slice(0, maximum);
}
function ref(value, label) {
  const clean = String(value ?? "").trim();
  if (!REF.test(clean)) throw new Error("Engineering Team " + label + " must be a bounded safe reference.");
  return clean;
}
function refs(values, label, limit = MAX_SOURCES) {
  if (!Array.isArray(values)) throw new Error("Engineering Team " + label + " must be an array.");
  const result = [...new Set(values.map((value) => ref(value, label)))];
  if (result.length > limit) throw new Error("Engineering Team " + label + " exceeds the evidence limit.");
  return Object.freeze(result);
}
function sha(value) {
  if (!SHA.test(String(value || ""))) throw new Error("Engineering Team requires an exact commit SHA.");
  return String(value).toLowerCase();
}
function positiveInt(value, label, max) {
  if (!Number.isInteger(value) || value < 1 || value > max) throw new Error("Engineering Team " + label + " is out of bounds.");
  return value;
}
function budget(value) {
  if (!value || typeof value !== "object") throw new Error("Engineering Team requires a bounded campaign budget.");
  const cloud = Number(value.maxCloudCostUsd);
  if (!Number.isFinite(cloud) || cloud < 0 || cloud > 100) throw new Error("Engineering Team cloud cost budget invalid.");
  return Object.freeze({
    maxRoleRuns: positiveInt(value.maxRoleRuns, "role-run budget", 40),
    maxMessages: positiveInt(value.maxMessages, "message budget", 100),
    maxSummaryChars: positiveInt(value.maxSummaryChars, "summary budget", 1000),
    maxDurationMs: positiveInt(value.maxDurationMs, "duration budget", 4 * 60 * 60 * 1000),
    maxCloudCostUsd: cloud,
  });
}
function digest(value) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

export function admitEngineeringCampaign(input) {
  if (!input || typeof input !== "object") throw new Error("Engineering Team campaign input required.");
  const roles = refs(input.roles, "roles", ENGINEERING_ROLES.length);
  if (roles.some((role) => !ENGINEERING_ROLES.includes(role))) throw new Error("Engineering Team unknown role.");
  if (!roles.includes("challenger") || !roles.includes("tester")) throw new Error("Engineering Team requires independent test and challenge roles.");
  if (!COMMUNICATION_MODES.includes(input.mode)) throw new Error("Engineering Team communication mode invalid.");
  const limits = budget(input.budget);
  if (limits.maxCloudCostUsd !== 0 && input.paidDispatchApproved !== true) throw new Error("Engineering Team paid dispatch requires explicit approval.");
  if (input.sourceMutationAllowed || input.mergeAllowed || input.humanCredentialAccessAllowed || input.publicBuzzPostingAllowed) {
    throw new Error("Engineering Team campaign cannot grant write, merge, Human credential or public BUZZ authority.");
  }
  const campaign = {
    schemaVersion: 1,
    campaignId: ref(input.campaignId, "campaign ID"),
    taskRef: ref(input.taskRef, "task reference"),
    exactSha: sha(input.exactSha),
    repository: ref(input.repository, "repository"),
    mode: input.mode,
    roles,
    budget: limits,
    paidDispatchApproved: input.paidDispatchApproved === true,
    sourceMutationAllowed: false,
    mergeAllowed: false,
    humanCredentialAccessAllowed: false,
    publicBuzzPostingAllowed: false,
  };
  return Object.freeze({ ...campaign, scopeHash: digest(campaign) });
}

export function engineeringObservation(campaign, input) {
  if (!campaign || campaign.schemaVersion !== 1) throw new Error("Engineering Team admitted campaign required.");
  if (sha(input.exactSha) !== campaign.exactSha) throw new Error("Engineering Team observation belongs to another commit.");
  const role = ref(input.role, "role");
  if (!campaign.roles.includes(role)) throw new Error("Engineering Team role not admitted.");
  if (!OBSERVATION_STATES.includes(input.state)) throw new Error("Engineering Team observation state invalid.");
  const summary = text(input.summary, campaign.budget.maxSummaryChars);
  if (!summary) throw new Error("Engineering Team requires a meaningful bounded observation.");
  const observation = {
    schemaVersion: 1,
    campaignId: campaign.campaignId,
    scopeHash: campaign.scopeHash,
    exactSha: campaign.exactSha,
    observationId: ref(input.observationId, "observation ID"),
    executorId: ref(input.executorId, "executor ID"),
    role,
    state: input.state,
    findingRef: ref(input.findingRef, "finding reference"),
    summary,
    evidenceRefs: refs(input.evidenceRefs, "evidence references"),
    verified: false,
  };
  if (observation.state === "reproduced" && observation.evidenceRefs.length === 0) {
    throw new Error("Engineering Team reproduction requires actual evidence references.");
  }
  return Object.freeze(observation);
}

export function engineeringHandoff(campaign, observation, recipientRole) {
  if (observation.campaignId !== campaign.campaignId || observation.scopeHash !== campaign.scopeHash || observation.exactSha !== campaign.exactSha) {
    throw new Error("Engineering Team handoff source is outside its admitted scope.");
  }
  if (!campaign.roles.includes(recipientRole)) throw new Error("Engineering Team handoff target is not admitted.");
  const base = {
    schemaVersion: 1,
    campaignId: campaign.campaignId,
    scopeHash: campaign.scopeHash,
    exactSha: campaign.exactSha,
    fromRole: observation.role,
    toRole: recipientRole,
    sourceObservationId: observation.observationId,
    communicationMode: campaign.mode,
    summary: observation.summary,
    evidenceReceiptCount: observation.evidenceRefs.length,
    trust: "untrusted-suggestion",
    grantsAuthority: false,
  };
  // Both modes preserve the external observation ledger. The lossy message
  // deliberately withholds source references, never source-of-truth itself.
  return Object.freeze(campaign.mode === "structured"
    ? { ...base, evidenceRefs: observation.evidenceRefs }
    : { ...base, evidenceRefs: Object.freeze([]) });
}

export function adjudicateEngineeringFinding(campaign, { findingRef, observations, verifier }) {
  const target = ref(findingRef, "finding reference");
  if (!Array.isArray(observations)) throw new Error("Engineering Team observations required.");
  const relevant = observations.filter((item) => {
    if (item.campaignId !== campaign.campaignId || item.scopeHash !== campaign.scopeHash || item.exactSha !== campaign.exactSha) {
      throw new Error("Engineering Team observation is stale or cross-campaign.");
    }
    return item.findingRef === target;
  });
  const tester = relevant.find((item) => item.role === "tester" && item.state === "reproduced" && item.evidenceRefs.length);
  const challenger = relevant.find((item) => item.role === "challenger" && item.state === "reproduced"
    && item.evidenceRefs.length && item.executorId !== tester?.executorId);
  const independent = !!(tester && challenger && tester.observationId !== challenger.observationId);
  const verifiedGate = !!(verifier
    && verifier.exactSha === campaign.exactSha
    && verifier.scopeHash === campaign.scopeHash
    && verifier.findingRef === target
    && verifier.passed === true
    && verifier.executorId
    && verifier.executorId !== tester?.executorId
    && verifier.executorId !== challenger?.executorId
    && Array.isArray(verifier.evidenceRefs)
    && verifier.evidenceRefs.length > 0
    && verifier.evidenceRefs.every((item) => REF.test(item)));
  const disputed = relevant.some((item) => item.state === "disproved");
  const status = disputed ? "disputed" : independent && verifiedGate ? "verified" : "unverified";
  return Object.freeze({
    campaignId: campaign.campaignId,
    exactSha: campaign.exactSha,
    findingRef: target,
    status,
    independentReview: independent,
    deterministicCorroboration: verifiedGate,
    publishable: status === "verified",
    // A verified finding is not a green PR nor authority to commit or merge.
    mergeEligible: false,
  });
}

export function compareEngineeringArms(structured, lossy, measured) {
  if (structured.mode !== "structured" || lossy.mode !== "lossy") throw new Error("Engineering Team comparison requires both communication arms.");
  if (structured.exactSha !== lossy.exactSha || structured.repository !== lossy.repository || structured.taskRef !== lossy.taskRef) {
    throw new Error("Engineering Team experimental arms must share exact work and commit.");
  }
  if (JSON.stringify(structured.roles) !== JSON.stringify(lossy.roles) || JSON.stringify(structured.budget) !== JSON.stringify(lossy.budget)) {
    throw new Error("Engineering Team arms must match role roster and budgets.");
  }
  if (!measured || !["structured", "lossy"].every((arm) =>
    measured[arm] && Number.isInteger(measured[arm].messageBytes) && measured[arm].messageBytes >= 0
      && Number.isInteger(measured[arm].verifiedFindings) && measured[arm].verifiedFindings >= 0
      && Number.isInteger(measured[arm].falsePositives) && measured[arm].falsePositives >= 0)) {
    throw new Error("Engineering Team comparison requires independently measured metrics.");
  }
  return Object.freeze({
    exactSha: structured.exactSha,
    taskRef: structured.taskRef,
    eligibleForComparison: true,
    structured: Object.freeze({ ...measured.structured }),
    lossy: Object.freeze({ ...measured.lossy }),
    authority: "observational-experiment-only",
    superiorityProven: false,
  });
}
