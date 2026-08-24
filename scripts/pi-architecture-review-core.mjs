import path from "node:path";

export const PI_ARCHITECTURE_REVIEW_TOOLS = Object.freeze(["read", "grep", "find", "ls"]);
export const PI_CI_CLASSIFICATIONS = Object.freeze([
  "real-behavioral-regression",
  "stale-contract-after-canonical-change",
  "packaging-release-regression",
  "architecture-ownership-violation",
  "unrelated-pre-existing-failure",
  "insufficient-evidence",
]);

const AXIS_VERDICTS = Object.freeze({
  architecture: new Set(["PASS", "FINDINGS"]),
  standards: new Set(["PASS", "FINDINGS"]),
  spec: new Set(["PASS", "FINDINGS", "NO SPEC"]),
});

function cleanText(value, limit = 1600) {
  return String(value ?? "").replace(/\u0000/g, "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function cleanList(value, limit = 40) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanText(item, 500)).filter(Boolean))].slice(0, limit);
}

function cleanFinding(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const finding = {
    severity: cleanText(value.severity || "medium", 32).toLowerCase(),
    file: cleanText(value.file, 300),
    evidence: cleanText(value.evidence, 1200),
    recommendation: cleanText(value.recommendation, 1200),
  };
  return finding.evidence || finding.recommendation ? finding : null;
}

export function parsePiJsonResponse(output, label = "Pi review") {
  const text = String(output ?? "").trim();
  if (!text) throw new Error(`${label} returned empty output.`);
  const withoutFence = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error(`${label} did not return a JSON object.`);
  try {
    return JSON.parse(withoutFence.slice(start, end + 1));
  } catch (error) {
    throw new Error(`${label} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function normalizePiImpactMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Pi architecture impact map must be a JSON object.");
  const verdict = cleanText(value.verdict || "GAPS", 20).toUpperCase();
  if (!new Set(["READY", "GAPS"]).has(verdict)) throw new Error(`Unsupported impact-map verdict: ${verdict}`);
  return Object.freeze({
    verdict,
    summary: cleanText(value.summary, 1600),
    owningDomain: cleanText(value.owningDomain, 300),
    implementationFiles: cleanList(value.implementationFiles),
    upstreamCallers: cleanList(value.upstreamCallers),
    downstreamConsumers: cleanList(value.downstreamConsumers),
    contracts: cleanList(value.contracts),
    runtimeTrustBoundaries: cleanList(value.runtimeTrustBoundaries),
    persistenceStorage: cleanList(value.persistenceStorage),
    uiJourneys: cleanList(value.uiJourneys),
    packagingStartup: cleanList(value.packagingStartup),
    testsUat: cleanList(value.testsUat),
    compatibilityPaths: cleanList(value.compatibilityPaths),
    doNotTouch: cleanList(value.doNotTouch),
    smallestPlan: cleanList(value.smallestPlan),
    unresolvedQuestions: cleanList(value.unresolvedQuestions, 12),
  });
}

export function normalizePiReviewAxis(axis, value) {
  const allowed = AXIS_VERDICTS[axis];
  if (!allowed) throw new Error(`Unknown Pi review axis: ${axis}`);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Pi ${axis} review must be a JSON object.`);
  const verdict = cleanText(value.verdict, 20).toUpperCase();
  if (!allowed.has(verdict)) throw new Error(`Unsupported ${axis} verdict: ${verdict || "<empty>"}`);
  const findings = Array.isArray(value.findings)
    ? value.findings.map(cleanFinding).filter(Boolean).slice(0, 20)
    : [];
  return Object.freeze({
    verdict,
    summary: cleanText(value.summary, 1600),
    findings,
  });
}

export function normalizePiCiClassification(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Pi CI classification must be a JSON object.");
  const classification = cleanText(value.classification, 80).toLowerCase();
  if (!PI_CI_CLASSIFICATIONS.includes(classification)) throw new Error(`Unsupported CI classification: ${classification || "<empty>"}`);
  return Object.freeze({
    classification,
    summary: cleanText(value.summary, 1600),
    evidence: cleanList(value.evidence, 20),
    recommendedNextStep: cleanText(value.recommendedNextStep, 1200),
  });
}

export async function resolvePiReviewTarget({ baseRef = "main", headRef = "HEAD", runGit }) {
  if (typeof runGit !== "function") throw new Error("resolvePiReviewTarget requires a host-owned git runner.");
  const head = await runGit(["rev-parse", headRef]);
  const reviewedHead = cleanText(head.stdout, 100);
  if (!reviewedHead) throw new Error(`Could not resolve reviewed head ${headRef}.`);
  const mergeBase = await runGit(["merge-base", baseRef, reviewedHead]);
  const fixedPoint = cleanText(mergeBase.stdout, 100);
  if (!fixedPoint) throw new Error(`Could not resolve fixed point between ${baseRef} and ${reviewedHead}.`);
  const changed = await runGit(["diff", "--name-only", `${fixedPoint}..${reviewedHead}`]);
  const changedFiles = String(changed.stdout || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  return Object.freeze({ baseRef, headRef, fixedPoint, reviewedHead, changedFiles });
}

export function resolvePiSpecDescriptor(specPath = "") {
  const source = cleanText(specPath, 500);
  if (!source) return Object.freeze({ status: "missing", source: "", verdict: "NO SPEC" });
  return Object.freeze({ status: "present", source: source.replaceAll("\\", "/"), verdict: null });
}

function sharedPromptHeader({ targetFile, specFile, impactMapFile }) {
  return [
    "You are Pi in a read-only PlotPickle engineering review. Do not edit, write, delete, run shell commands, commit, push, change GitHub state, or claim merge authority.",
    "The host restricts you to read, grep, find, and ls. Deterministic tests, BEN, UAT, build, Full Verification, and GitHub CI remain authoritative.",
    "Use progressive disclosure: start from AGENTS.md, relevant canonical architecture docs, the supplied target/spec evidence, and registered Skills; then inspect only repository paths needed for this task.",
    `Read exact target metadata from ${targetFile}.`,
    specFile ? `Read the authoritative task/spec copy from ${specFile}.` : "No authoritative spec was supplied by the host; do not invent one.",
    impactMapFile ? `Read the pre-change impact map from ${impactMapFile}.` : "No pre-change impact map was supplied; report that as missing evidence rather than fabricating it.",
  ];
}

export function buildPiImpactMapPrompt({ targetFile, specFile = "" }) {
  return [
    ...sharedPromptHeader({ targetFile, specFile, impactMapFile: "" }),
    "Read .agents/skills/plotpickle-architecture-review/SKILL.md and .agents/skills/diagnosis/SKILL.md.",
    "Before proposing implementation, determine whether the symptom is an existing path being bypassed, duplicate/legacy path, ownership violation, stale compatibility contract, state/persistence mismatch, provider/runtime break, lower-level failure surfaced in UI, or genuinely missing capability.",
    "Produce the smallest architecture impact map. The map is diagnostic context, not permission to widen scope.",
    "Return JSON only with this exact shape:",
    JSON.stringify({
      verdict: "READY|GAPS",
      summary: "concise summary",
      owningDomain: "canonical owner",
      implementationFiles: [],
      upstreamCallers: [],
      downstreamConsumers: [],
      contracts: [],
      runtimeTrustBoundaries: [],
      persistenceStorage: [],
      uiJourneys: [],
      packagingStartup: [],
      testsUat: [],
      compatibilityPaths: [],
      doNotTouch: [],
      smallestPlan: [],
      unresolvedQuestions: [],
    }),
  ].join("\n");
}

export function buildPiArchitectureReviewPrompt({ targetFile, diffFile, specFile = "", impactMapFile = "" }) {
  return [
    ...sharedPromptHeader({ targetFile, specFile, impactMapFile }),
    `Read the exact host-prepared diff from ${diffFile}.`,
    "Read .agents/skills/plotpickle-architecture-review/SKILL.md.",
    "Review only Architecture: ownership/dependency direction, duplicate or stale paths, provider/runtime/product-agent/developer-tool boundaries, Human/Agent identity and trust, PPF/canon/provenance, persistence, packaging/startup, weakened tests, unnecessary complexity, and predicted blast-radius misses.",
    "Do not decide whether the feature satisfies the product spec and do not substitute generic style preferences for architecture findings.",
    "Return JSON only: {\"verdict\":\"PASS|FINDINGS\",\"summary\":\"...\",\"findings\":[{\"severity\":\"high|medium|low\",\"file\":\"path or symbol\",\"evidence\":\"concise evidence\",\"recommendation\":\"smallest safe correction\"}]}.",
  ].join("\n");
}

export function buildPiStandardsReviewPrompt({ targetFile, diffFile, impactMapFile = "", benEvidenceFile = "" }) {
  return [
    ...sharedPromptHeader({ targetFile, specFile: "", impactMapFile }),
    `Read the exact host-prepared diff from ${diffFile}.`,
    "Read AGENTS.md and .agents/skills/ben-code-quality/SKILL.md.",
    benEvidenceFile ? `Read deterministic BEN evidence from ${benEvidenceFile}.` : "No BEN evidence file was supplied; do not invent BEN results.",
    "Review only Standards: does this exact diff meet explicit PlotPickle engineering rules, discoverability/type/error/orchestration standards, trust/privacy/provider boundaries, and deterministic-test discipline?",
    "Do not decide whether the product requirements are complete; that belongs to the independent Spec axis.",
    "Return JSON only: {\"verdict\":\"PASS|FINDINGS\",\"summary\":\"...\",\"findings\":[{\"severity\":\"high|medium|low\",\"file\":\"path or symbol\",\"evidence\":\"concise evidence\",\"recommendation\":\"smallest safe correction\"}]}.",
  ].join("\n");
}

export function buildPiSpecReviewPrompt({ targetFile, diffFile, specFile }) {
  if (!specFile) throw new Error("Spec review prompt requires an authoritative spec file; otherwise report NO SPEC without invoking Pi.");
  return [
    ...sharedPromptHeader({ targetFile, specFile, impactMapFile: "" }),
    `Read the exact host-prepared diff from ${diffFile}.`,
    "Review only Spec fidelity: missing/partial requirements, scope creep, behavior contradicting the supplied brief, and acceptance criteria lacking evidence/regression coverage.",
    "Do not add architecture preferences or generic best practices unless the supplied spec explicitly requires them.",
    "Return JSON only: {\"verdict\":\"PASS|FINDINGS\",\"summary\":\"...\",\"findings\":[{\"severity\":\"high|medium|low\",\"file\":\"path or symbol\",\"evidence\":\"concise evidence\",\"recommendation\":\"smallest spec-faithful correction\"}]}.",
  ].join("\n");
}

export function buildPiCiClassificationPrompt({ targetFile, diffFile, ciEvidenceFile, impactMapFile = "" }) {
  return [
    ...sharedPromptHeader({ targetFile, specFile: "", impactMapFile }),
    `Read the exact host-prepared diff from ${diffFile}.`,
    `Read the exact failing CI evidence from ${ciEvidenceFile}.`,
    "Correlate the failure with the reviewed head and original impact map. Do not automatically weaken a red test because it appears stale.",
    `Choose exactly one classification: ${PI_CI_CLASSIFICATIONS.join(", ")}.`,
    "Return JSON only: {\"classification\":\"one allowed value\",\"summary\":\"...\",\"evidence\":[\"...\"],\"recommendedNextStep\":\"...\"}.",
  ].join("\n");
}

export function createPiArchitectureReviewEvidence({
  generatedAt,
  target,
  spec,
  impactMap = null,
  architecture = null,
  standards = null,
  specReview = null,
  ci = null,
  runtime = null,
}) {
  const resolvedSpec = spec?.status === "present"
    ? (specReview || normalizePiReviewAxis("spec", { verdict: "FINDINGS", summary: "Spec review was not completed.", findings: [] }))
    : normalizePiReviewAxis("spec", { verdict: "NO SPEC", summary: "No authoritative spec was supplied by the host.", findings: [] });
  return Object.freeze({
    schemaVersion: 1,
    generatedAt: generatedAt || new Date().toISOString(),
    authoritative: false,
    writesAllowed: false,
    tools: [...PI_ARCHITECTURE_REVIEW_TOOLS],
    specSource: spec?.source || "",
    fixedPoint: target.fixedPoint,
    reviewedHead: target.reviewedHead,
    changedFiles: [...target.changedFiles],
    impactMap,
    architecture,
    standards,
    spec: resolvedSpec,
    ci,
    runtime: runtime ? {
      reviewer: "pi",
      model: cleanText(runtime.model, 200),
      label: cleanText(runtime.label, 200),
      piVersion: cleanText(runtime.piVersion, 100),
    } : null,
    note: "Pi review is advisory. Deterministic tests, BEN, UAT, build, Full Verification, GitHub CI, and Human merge authority remain authoritative.",
  });
}

function findingLines(axis) {
  if (!axis) return ["Not run."];
  if (!axis.findings?.length) return [axis.summary || "No findings."];
  return axis.findings.map((finding) => `- ${finding.severity.toUpperCase()} ${finding.file ? `· ${finding.file} · ` : "· "}${finding.evidence}${finding.recommendation ? ` — ${finding.recommendation}` : ""}`);
}

export function renderPiArchitectureReviewMarkdown(evidence) {
  const lines = [
    "# Pi Architecture-Aware Engineering Review",
    "",
    `Fixed point: \`${evidence.fixedPoint}\``,
    `Reviewed head: \`${evidence.reviewedHead}\``,
    `Spec source: ${evidence.specSource ? `\`${evidence.specSource}\`` : "NO SPEC"}`,
    "",
    "## Impact map",
    evidence.impactMap ? `${evidence.impactMap.verdict} — ${evidence.impactMap.summary || evidence.impactMap.owningDomain}` : "Not run.",
    "",
    "## Architecture",
    evidence.architecture ? evidence.architecture.verdict : "Not run.",
    ...findingLines(evidence.architecture),
    "",
    "## Standards",
    evidence.standards ? evidence.standards.verdict : "Not run.",
    ...findingLines(evidence.standards),
    "",
    "## Spec",
    evidence.spec.verdict,
    ...findingLines(evidence.spec),
  ];
  if (evidence.ci) {
    lines.push("", "## CI classification", evidence.ci.classification, evidence.ci.summary, ...evidence.ci.evidence.map((item) => `- ${item}`));
  }
  lines.push("", evidence.note, "");
  return lines.join("\n");
}

export function repositoryRelativeEvidencePath(repoRoot, value) {
  const resolved = path.resolve(value);
  const relative = path.relative(repoRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return resolved;
  return relative.replaceAll("\\", "/");
}
