import {
  validateStructuredObject,
  type StructuredObjectSchema,
} from "../agents/responsibility/responsibility-graph";

export const PORTABILITY_EVAL_REVISION = "2026-08-18.1" as const;
export const PORTABILITY_EVAL_CASE_IDS = [
  "sage-grounding",
  "plan-proposal",
  "graph-structured-output",
  "verifier-known-bad",
] as const;

export type PortabilityEvalCaseId = (typeof PORTABILITY_EVAL_CASE_IDS)[number];
export type SkillTrustState = "packaged" | "approved" | "quarantined" | "rejected" | "none";

export type PortabilityVariant = {
  id: string;
  profileId: string;
  capabilityRole: string;
  runtime: string;
  provider: string;
  model: string;
  routeClass: "local" | "cloud-byok";
  skillId: string;
  skillTrustState: SkillTrustState;
  skillSourceRevision: string;
  skillSourceHash: string;
};

export type EvalCandidate = {
  text?: string;
  sourceIdsUsed?: string[];
  structured?: Record<string, unknown>;
  verifierDecision?: "accept" | "reject" | "revise";
  failedRule?: string;
  evidenceRef?: string;
  triggerSelectedSkillId?: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  contextCharacters?: number;
  loopCount?: number;
  retryCount?: number;
  reconstructionSynchronized?: boolean;
};

export type PortabilityEvalResult = {
  caseId: PortabilityEvalCaseId;
  passed: boolean;
  score: number;
  reasons: string[];
};

export type PortabilityEvalReport = {
  revision: typeof PORTABILITY_EVAL_REVISION;
  variant: PortabilityVariant;
  results: PortabilityEvalResult[];
  passed: boolean;
  score: number;
  tokenOverhead: number | null;
  contextCharacters: number;
  createdAt: string;
};

const PLAN_SCHEMA: StructuredObjectSchema = {
  type: "object",
  required: ["values"],
  allowed: ["values"],
  maxBytes: 24 * 1024,
};

const GRAPH_SCHEMA: StructuredObjectSchema = {
  type: "object",
  required: ["findings"],
  allowed: ["findings"],
  maxBytes: 24 * 1024,
};

function text(value: unknown, max = 16_384) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function strings(value: unknown, max = 128) {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string" && Boolean(text(item, 240))).map((item) => text(item, 240)))].slice(0, max) : [];
}

function boundedScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function result(caseId: PortabilityEvalCaseId, passed: boolean, score: number, reasons: string[]): PortabilityEvalResult {
  return { caseId, passed, score: boundedScore(score), reasons: reasons.map((reason) => text(reason, 500)).filter(Boolean) };
}

export function evaluateSageGrounding(candidate: EvalCandidate, fixture: { requiredSourceIds: string[]; forbiddenClaims?: string[] }): PortabilityEvalResult {
  const answer = text(candidate.text);
  const used = new Set(strings(candidate.sourceIdsUsed));
  const required = strings(fixture.requiredSourceIds);
  const missingSources = required.filter((sourceId) => !used.has(sourceId));
  const forbiddenClaims = strings(fixture.forbiddenClaims).filter((claim) => answer.toLowerCase().includes(claim.toLowerCase()));
  const reasons: string[] = [];
  if (!answer) reasons.push("Sage returned no answer text.");
  if (missingSources.length) reasons.push(`Missing required curriculum source IDs: ${missingSources.join(", ")}.`);
  if (forbiddenClaims.length) reasons.push(`Answer contains fixture claims not grounded in supplied curriculum: ${forbiddenClaims.join(", ")}.`);
  const passed = Boolean(answer) && missingSources.length === 0 && forbiddenClaims.length === 0;
  return result("sage-grounding", passed, passed ? 100 : Math.max(0, 100 - missingSources.length * 30 - forbiddenClaims.length * 30 - (answer ? 0 : 40)), reasons);
}

export function evaluatePlanProposal(candidate: EvalCandidate, fixture: { requiredFieldIds: string[] }): PortabilityEvalResult {
  const checked = validateStructuredObject(PLAN_SCHEMA, candidate.structured);
  const values = candidate.structured && typeof candidate.structured.values === "object" && candidate.structured.values !== null && !Array.isArray(candidate.structured.values)
    ? candidate.structured.values as Record<string, unknown>
    : {};
  const required = strings(fixture.requiredFieldIds);
  const missing = required.filter((fieldId) => typeof values[fieldId] !== "string" || !text(values[fieldId]).length);
  const copiedQuestions = Object.values(values).filter((value) => typeof value === "string" && /^(?:what|who|why|how|describe|define)\b/i.test(text(value))).length;
  const reasons: string[] = [];
  if (!checked.ok) reasons.push(checked.error);
  if (missing.length) reasons.push(`Missing PLAN fields: ${missing.join(", ")}.`);
  if (copiedQuestions) reasons.push(`${copiedQuestions} PLAN field value(s) look like copied prompts rather than proposals.`);
  const passed = checked.ok && missing.length === 0 && copiedQuestions === 0;
  return result("plan-proposal", passed, passed ? 100 : Math.max(0, 100 - missing.length * 20 - copiedQuestions * 15 - (checked.ok ? 0 : 35)), reasons);
}

export function evaluateGraphStructuredOutput(candidate: EvalCandidate): PortabilityEvalResult {
  const checked = validateStructuredObject(GRAPH_SCHEMA, candidate.structured);
  const findings = checked.ok && Array.isArray(candidate.structured?.findings) ? candidate.structured.findings : [];
  const reasons: string[] = [];
  if (!checked.ok) reasons.push(checked.error);
  if (!Array.isArray(candidate.structured?.findings)) reasons.push("Graph output must contain a structured findings array.");
  const passed = checked.ok && Array.isArray(candidate.structured?.findings);
  return result("graph-structured-output", passed, passed ? 100 : 35, reasons.length ? reasons : [`Structured graph output accepted with ${findings.length} finding(s).`]);
}

export function evaluateVerifierKnownBad(candidate: EvalCandidate, fixture: { expectedFailedRule: string }): PortabilityEvalResult {
  const expectedRule = text(fixture.expectedFailedRule, 240);
  const reasons: string[] = [];
  if (candidate.verifierDecision !== "reject") reasons.push("Verifier failed to reject the known-bad finding.");
  if (text(candidate.failedRule, 240) !== expectedRule) reasons.push(`Verifier failed to name expected rule ${expectedRule}.`);
  if (!text(candidate.evidenceRef, 500)) reasons.push("Verifier rejection lacks an evidence reference.");
  const passed = reasons.length === 0;
  return result("verifier-known-bad", passed, passed ? 100 : Math.max(0, 100 - reasons.length * 34), reasons);
}

export function evaluateIntegritySignals(candidate: EvalCandidate) {
  const reasons: string[] = [];
  if (candidate.reconstructionSynchronized === false) reasons.push("context/request reconstruction desynchronized from the outbound request.");
  if ((candidate.loopCount || 0) >= 8) reasons.push("equivalent tool-call loop reached the highest reminder threshold.");
  if ((candidate.retryCount || 0) > 4) reasons.push("retry count exceeded the portability-eval tolerance.");
  return { passed: reasons.length === 0, reasons };
}

export function evaluatePortabilityVariant(input: {
  variant: PortabilityVariant;
  candidates: Partial<Record<PortabilityEvalCaseId, EvalCandidate>>;
  fixtures: {
    sage: { requiredSourceIds: string[]; forbiddenClaims?: string[] };
    plan: { requiredFieldIds: string[] };
    verifier: { expectedFailedRule: string };
  };
  createdAt?: string;
}): PortabilityEvalReport {
  const candidates = input.candidates;
  const results = [
    evaluateSageGrounding(candidates["sage-grounding"] || {}, input.fixtures.sage),
    evaluatePlanProposal(candidates["plan-proposal"] || {}, input.fixtures.plan),
    evaluateGraphStructuredOutput(candidates["graph-structured-output"] || {}),
    evaluateVerifierKnownBad(candidates["verifier-known-bad"] || {}, input.fixtures.verifier),
  ].map((entry) => {
    const integrity = evaluateIntegritySignals(candidates[entry.caseId] || {});
    if (integrity.passed) return entry;
    return { ...entry, passed: false, score: Math.min(entry.score, 60), reasons: [...entry.reasons, ...integrity.reasons] };
  });
  const allCandidates = Object.values(candidates);
  const exactTokenValues = allCandidates.flatMap((candidate) => {
    const inputTokens = Number(candidate?.inputTokens);
    const outputTokens = Number(candidate?.outputTokens);
    return Number.isFinite(inputTokens) && inputTokens >= 0 && Number.isFinite(outputTokens) && outputTokens >= 0 ? [inputTokens + outputTokens] : [];
  });
  const contextCharacters = allCandidates.reduce((total, candidate) => total + Math.max(0, Math.floor(Number(candidate?.contextCharacters) || 0)), 0);
  const passed = results.every((entry) => entry.passed);
  const score = Math.round(results.reduce((sum, entry) => sum + entry.score, 0) / results.length);
  return {
    revision: PORTABILITY_EVAL_REVISION,
    variant: {
      ...input.variant,
      id: text(input.variant.id, 180),
      profileId: text(input.variant.profileId, 180),
      capabilityRole: text(input.variant.capabilityRole, 80),
      runtime: text(input.variant.runtime, 120),
      provider: text(input.variant.provider, 120),
      model: text(input.variant.model, 180),
      skillId: text(input.variant.skillId, 240),
      skillSourceRevision: text(input.variant.skillSourceRevision, 240),
      skillSourceHash: text(input.variant.skillSourceHash, 240),
    },
    results,
    passed,
    score,
    tokenOverhead: exactTokenValues.length === allCandidates.length ? exactTokenValues.reduce((sum, value) => sum + value, 0) : null,
    contextCharacters,
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

export function comparePortabilityReports(reports: readonly PortabilityEvalReport[]) {
  return [...reports].sort((left, right) => {
    if (left.passed !== right.passed) return left.passed ? -1 : 1;
    if (left.score !== right.score) return right.score - left.score;
    const leftTokens = left.tokenOverhead ?? Number.MAX_SAFE_INTEGER;
    const rightTokens = right.tokenOverhead ?? Number.MAX_SAFE_INTEGER;
    return leftTokens - rightTokens;
  });
}

export function compareSkillVariants(withSkill: PortabilityEvalReport, withoutSkill: PortabilityEvalReport) {
  if (withSkill.variant.profileId !== withoutSkill.variant.profileId) throw new Error("Skill delta requires the same Agent Profile.");
  if (withSkill.variant.capabilityRole !== withoutSkill.variant.capabilityRole) throw new Error("Skill delta requires the same capability role.");
  return {
    profileId: withSkill.variant.profileId,
    skillId: withSkill.variant.skillId,
    qualityDelta: withSkill.score - withoutSkill.score,
    tokenDelta: withSkill.tokenOverhead === null || withoutSkill.tokenOverhead === null ? null : withSkill.tokenOverhead - withoutSkill.tokenOverhead,
    contextCharacterDelta: withSkill.contextCharacters - withoutSkill.contextCharacters,
    promotionEligible: withSkill.variant.skillTrustState !== "quarantined" || (withSkill.passed && withSkill.score > withoutSkill.score),
  };
}

export function skillTriggerReliability(input: { expectedSkillId: string; candidates: readonly EvalCandidate[] }) {
  const expected = text(input.expectedSkillId, 240);
  const total = input.candidates.length;
  const selected = input.candidates.filter((candidate) => text(candidate.triggerSelectedSkillId, 240) === expected).length;
  return { expectedSkillId: expected, selected, total, rate: total ? selected / total : 0 };
}

export function portabilityEvalAuthorityBoundary() {
  return {
    mutatesPpf: false,
    changesProductionRouting: false,
    letsAgentSelfGradeAsSoleAuthority: false,
    usesPopularityAsAcceptanceMetric: false,
  } as const;
}
