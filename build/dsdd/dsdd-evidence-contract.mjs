import { assessObligationProof } from "../../lib/verification/development/proof-routing.mjs";

const PROOF_TYPES = new Set(["test", "ci", "runtime", "artifact"]);
const FINDINGS = new Set(["supports", "contradicts", "blocked", "insufficient"]);
const COMMIT_SHA = /^[0-9a-f]{40}$/iu;

function clean(value, maximum) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function normalizeEvidence(expected, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const ref = clean(value.ref, 1000);
  const summary = clean(value.summary, 2000);
  const proofType = clean(value.proofType, 40);
  const finding = clean(value.finding, 40);
  const intentVersion = Number(value.intentVersion);
  const intentDigest = clean(value.intentDigest, 128);
  const testedSource = clean(value.testedSource, 300);
  const testedCommit = clean(value.testedCommit, 80).toLowerCase();
  const observedResult = clean(value.observedResult, 3000);

  if (!ref || !summary || !PROOF_TYPES.has(proofType) || !FINDINGS.has(finding)) return null;
  if (intentVersion !== expected.intentVersion || intentDigest !== expected.intentDigest) return null;
  if (!testedSource || !COMMIT_SHA.test(testedCommit) || !observedResult) return null;

  return {
    ref,
    summary,
    proofType,
    finding,
    intentVersion,
    intentDigest,
    testedSource,
    testedCommit,
    observedResult,
    requirementId: clean(value.requirementId, 40),
    promise: clean(value.promise, 3000),
    action: clean(value.action, 3000),
    environment: clean(value.environment, 300),
    configuration: clean(value.configuration, 300),
    source: clean(value.source, 300),
    scope: clean(value.scope, 80),
    independent: value.independent === true,
    simulated: value.simulated !== false,
    blocker: clean(value.blocker, 1000),
  };
}

export function evaluateEvidenceUpdate({ intentVersion, intentDigest, requirementId, promise, testedCommit, environment, configuration, verifierSource, verifiedArtifactRefs = [], evidence }) {
  const candidates = Array.isArray(evidence) ? evidence : [];
  const applicable = candidates
    .map((entry) => normalizeEvidence({ intentVersion, intentDigest }, entry))
    .filter(Boolean);
  const priority = (entry) => entry.finding === "contradicts" ? 0 : entry.finding === "blocked" ? 1 : 2;
  const accepted = [...applicable].sort((left, right) => priority(left) - priority(right)).slice(0, 12);

  const result = assessObligationProof({
    obligation: { contractId: `dsdd:${intentDigest}`, contractVersion: String(intentVersion), obligationId: requirementId,
      promise, scope: "real-product-observation", verifierSource },
    evidence: applicable.filter((entry) => entry.proofType === "runtime" || entry.proofType === "artifact").map((entry) => ({
      ...entry, contractId: `dsdd:${entry.intentDigest}`, contractVersion: String(entry.intentVersion), obligationId: entry.requirementId,
    })),
    testedCommit, environment, configuration, verifiedArtifactRefs,
  });

  return {
    status: result.status,
    claimScope: "locked-requirement-product-observation",
    missing: result.missing,
    evidence: accepted,
    rejectedEvidenceCount: Math.max(0, candidates.length - accepted.length),
  };
}
