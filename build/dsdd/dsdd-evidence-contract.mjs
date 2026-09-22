const PROOF_TYPES = new Set(["test", "ci", "runtime", "artifact"]);
const FINDINGS = new Set(["supports", "contradicts", "insufficient"]);
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
  };
}

export function evaluateEvidenceUpdate({ intentVersion, intentDigest, status, evidence }) {
  const candidates = Array.isArray(evidence) ? evidence : [];
  const accepted = candidates
    .map((entry) => normalizeEvidence({ intentVersion, intentDigest }, entry))
    .filter(Boolean)
    .slice(0, 12);

  const hasSupportingEvidence = accepted.some((entry) => entry.finding === "supports");
  const hasContradictingEvidence = accepted.some((entry) => entry.finding === "contradicts");

  let resolvedStatus = "UNPROVEN";
  if (status === "PASS" && hasSupportingEvidence && !hasContradictingEvidence) resolvedStatus = "PASS";
  if (status === "FAIL" && hasContradictingEvidence) resolvedStatus = "FAIL";

  return {
    status: resolvedStatus,
    evidence: accepted,
    rejectedEvidenceCount: Math.max(0, candidates.length - accepted.length),
  };
}
