import { createHash } from "node:crypto";

export const VERIFICATION_FINDING_FIELDS = [
  "id",
  "source",
  "area",
  "severity",
  "confidence",
  "reproduction",
  "affectedFiles",
  "evidence",
  "suggestedFix",
  "verificationStatus",
];

export const VERIFICATION_STATUSES = ["needs-verification", "confirmed", "rejected"];
const SEVERITIES = ["low", "medium", "high", "blocker"];

function text(value, limit = 1200) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function strings(values, limit = 128, itemLimit = 260) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value, itemLimit)).filter(Boolean))].slice(0, limit);
}

function confidence(value, fallback = 0.5) {
  if (typeof value === "string") {
    const key = value.toLowerCase();
    if (key === "high") return 0.9;
    if (key === "medium") return 0.65;
    if (key === "low") return 0.35;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, Number(parsed.toFixed(3)))) : fallback;
}

function evidence(values) {
  const input = Array.isArray(values) ? values : values ? [values] : [];
  return input.slice(0, 64).map((item) => {
    if (typeof item === "string") return { kind: "note", ref: "", summary: text(item, 700) };
    return {
      kind: text(item?.kind || item?.label || "evidence", 80),
      ref: text(item?.ref || item?.evidenceRef || item?.route || "", 500),
      summary: text(item?.summary || item?.message || JSON.stringify(item || {}), 700),
    };
  });
}

function stableId(input) {
  const seed = JSON.stringify({
    source: text(input.source, 120),
    area: text(input.area, 160),
    reproduction: text(input.reproduction, 1000),
    affectedFiles: strings(input.affectedFiles, 64, 260).sort(),
  });
  return `finding-${createHash("sha256").update(seed).digest("hex").slice(0, 20)}`;
}

export function normalizeVerificationFinding(input = {}) {
  const verificationStatus = VERIFICATION_STATUSES.includes(input.verificationStatus) ? input.verificationStatus : "needs-verification";
  const severity = SEVERITIES.includes(String(input.severity).toLowerCase()) ? String(input.severity).toLowerCase() : "medium";
  const normalized = {
    id: text(input.id || input.fingerprint, 220),
    source: text(input.source || "unknown", 120),
    area: text(input.area || "unknown", 160),
    severity,
    confidence: confidence(input.confidence, verificationStatus === "confirmed" ? 0.95 : 0.55),
    reproduction: text(input.reproduction || input.message || input.summary || "", 1800),
    affectedFiles: strings(input.affectedFiles || input.files, 128, 320),
    evidence: evidence(input.evidence),
    suggestedFix: text(input.suggestedFix || input.fix || "", 1200),
    verificationStatus,
  };
  if (!normalized.id) normalized.id = stableId(normalized);
  return normalized;
}

export function validateVerificationFinding(input) {
  const finding = normalizeVerificationFinding(input);
  const missing = VERIFICATION_FINDING_FIELDS.filter((field) => !Object.hasOwn(finding, field));
  const errors = [...missing.map((field) => `Missing Finding field: ${field}`)];
  if (!finding.id || !finding.source || !finding.area || !finding.reproduction) errors.push("Finding identity, source, area and reproduction are required.");
  if (!VERIFICATION_STATUSES.includes(finding.verificationStatus)) errors.push("Finding verification status is invalid.");
  if (!SEVERITIES.includes(finding.severity)) errors.push("Finding severity is invalid.");
  if (!Array.isArray(finding.affectedFiles) || !Array.isArray(finding.evidence)) errors.push("Finding files and evidence must be arrays.");
  return { ok: errors.length === 0, errors, finding };
}

const STATUS_RANK = { "needs-verification": 1, rejected: 2, confirmed: 3 };

export function dedupeVerificationFindings(findings = []) {
  const byId = new Map();
  for (const raw of findings) {
    const finding = normalizeVerificationFinding(raw);
    const previous = byId.get(finding.id);
    if (!previous) {
      byId.set(finding.id, finding);
      continue;
    }
    const preferred = STATUS_RANK[finding.verificationStatus] > STATUS_RANK[previous.verificationStatus] ? finding : previous;
    const other = preferred === finding ? previous : finding;
    byId.set(finding.id, {
      ...preferred,
      confidence: Math.max(preferred.confidence, other.confidence),
      affectedFiles: strings([...preferred.affectedFiles, ...other.affectedFiles], 128, 320),
      evidence: [...preferred.evidence, ...other.evidence].slice(0, 64),
      suggestedFix: preferred.suggestedFix || other.suggestedFix,
    });
  }
  return [...byId.values()];
}

function stage(record, number) {
  return (record?.stages || []).find((item) => Number(item?.number) === number) || null;
}

function deterministicStageFindings(record) {
  return (record?.stages || []).flatMap((item) => {
    if (item?.status === "PASS") return [];
    return [normalizeVerificationFinding({
      source: "deterministic-full-verification",
      area: item?.category || "full-verification",
      severity: item?.status === "BLOCKED" ? "high" : "blocker",
      confidence: 1,
      reproduction: `${item?.name || "Verification stage"}: ${item?.detail || `finished ${item?.status || "without PASS"}`}`,
      affectedFiles: [],
      evidence: [{ kind: "verification-stage", ref: `${record?.runId || "verification"}#stage-${item?.number || "unknown"}`, summary: `${item?.status || "FAIL"} ${item?.name || "stage"}` }],
      suggestedFix: "Reproduce the failed deterministic stage, identify its smallest root cause, add or strengthen a focused regression, and rerun the authoritative Full Verification.",
      verificationStatus: "confirmed",
    })];
  });
}

function uatFindings(record, uat) {
  const stageEightFailed = stage(record, 8)?.status === "FAIL";
  return (Array.isArray(uat?.findings) ? uat.findings : []).flatMap((item) => {
    const reproduction = text(item?.message || item?.summary, 1800);
    if (!reproduction) return [];
    return [normalizeVerificationFinding({
      id: item?.fingerprint,
      source: "exhaustive-ui-uat",
      area: item?.area || item?.screen || "ui-ux-uat",
      severity: item?.severity || "high",
      confidence: stageEightFailed ? 0.95 : 0.7,
      reproduction,
      affectedFiles: item?.affectedFiles || item?.files || [],
      evidence: item?.evidence || [{ kind: "uat-report", ref: item?.route || "", summary: reproduction }],
      suggestedFix: item?.suggestedFix || "Verify the reproduced UI/UX behavior independently before changing product code.",
      verificationStatus: stageEightFailed ? "confirmed" : "needs-verification",
    })];
  });
}

function harnessFindings(uat) {
  return (Array.isArray(uat?.harnessFindings) ? uat.harnessFindings : []).flatMap((item) => {
    const reproduction = text(item?.message || item?.summary, 1800);
    if (!reproduction) return [];
    return [normalizeVerificationFinding({
      id: item?.fingerprint,
      source: "uat-harness",
      area: "verification-harness",
      severity: item?.severity || "medium",
      confidence: 0.65,
      reproduction,
      affectedFiles: item?.affectedFiles || item?.files || [],
      evidence: item?.evidence || [],
      suggestedFix: "Verify whether this is a harness defect before changing PlotPickle product behavior.",
      verificationStatus: "needs-verification",
    })];
  });
}

function writerFindings(writer) {
  return (Array.isArray(writer?.observations) ? writer.observations : []).flatMap((item) => {
    const reproduction = text(item?.summary, 1800);
    if (!reproduction) return [];
    return [normalizeVerificationFinding({
      source: item?.source === "rendered-visual-observer" ? "visual-observer" : "writer-in-residence",
      area: item?.area || item?.route || "writer-journey",
      severity: item?.severity || "medium",
      confidence: 0.55,
      reproduction,
      affectedFiles: item?.affectedFiles || [],
      evidence: [{ kind: "writer-observation", ref: item?.route || "", summary: reproduction }],
      suggestedFix: "Reproduce this advisory writer-perspective observation with an independent deterministic or verifier check before repair.",
      verificationStatus: "needs-verification",
    })];
  });
}

export function buildVerificationFindings(record, writer = null, uat = null) {
  return dedupeVerificationFindings([
    ...deterministicStageFindings(record),
    ...uatFindings(record, uat),
    ...harnessFindings(uat),
    ...writerFindings(writer),
  ]);
}

export function confirmedVerificationFindings(findings = []) {
  return dedupeVerificationFindings(findings).filter((finding) => finding.verificationStatus === "confirmed");
}

function overlap(left, right) {
  const rightSet = new Set(right);
  return left.some((value) => rightSet.has(value));
}

export function planRepairClusters(findings = []) {
  const confirmed = confirmedVerificationFindings(findings);
  const unknown = confirmed.filter((finding) => finding.affectedFiles.length === 0);
  const known = confirmed.filter((finding) => finding.affectedFiles.length > 0);
  const groups = [];

  for (const finding of known) {
    const touching = groups.filter((group) => overlap(group.affectedFiles, finding.affectedFiles));
    if (!touching.length) {
      groups.push({ findingIds: [finding.id], affectedFiles: [...finding.affectedFiles] });
      continue;
    }
    const merged = {
      findingIds: [finding.id, ...touching.flatMap((group) => group.findingIds)],
      affectedFiles: strings([...finding.affectedFiles, ...touching.flatMap((group) => group.affectedFiles)], 256, 320),
    };
    for (const group of touching) groups.splice(groups.indexOf(group), 1);
    groups.push(merged);
  }

  const clusters = groups.map((group, index) => ({
    id: `repair-cluster-${index + 1}`,
    findingIds: [...new Set(group.findingIds)],
    affectedFiles: group.affectedFiles,
    safeParallel: true,
    isolationRequired: "git-worktree",
  }));
  if (unknown.length) clusters.push({
    id: "repair-cluster-unknown-impact",
    findingIds: unknown.map((finding) => finding.id),
    affectedFiles: [],
    safeParallel: false,
    isolationRequired: "git-worktree",
  });
  return clusters;
}

export function buildConfirmedRepairBundle(findings = [], metadata = {}) {
  const confirmed = confirmedVerificationFindings(findings);
  if (!confirmed.length) return null;
  const clusters = planRepairClusters(confirmed);
  const fingerprint = `verification-confirmed-${createHash("sha256").update(confirmed.map((finding) => finding.id).sort().join("|")).digest("hex").slice(0, 20)}`;
  return {
    schemaVersion: 1,
    findings: [{
      fingerprint,
      title: `Confirmed Full Verification repair bundle${metadata.runId ? ` ${text(metadata.runId, 100)}` : ""}`,
      area: "full-verification",
      severity: confirmed.some((finding) => finding.severity === "blocker") ? "blocker" : "high",
      message: confirmed.map((finding) => `[${finding.id}] ${finding.reproduction}`).join(" | ").slice(0, 12_000),
      evidence: {
        verificationRunId: text(metadata.runId, 160),
        testedCommit: text(metadata.testedCommit, 80),
        confirmedFindingIds: confirmed.map((finding) => finding.id),
        repairClusters: clusters,
      },
    }],
    confirmedFindingCount: confirmed.length,
    repairClusters: clusters,
    unverifiedFindingsExcluded: true,
  };
}
