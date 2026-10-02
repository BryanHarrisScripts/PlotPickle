import type { VerificationRequest } from "./contract";

export type DsddRequirementState = "PASS" | "FAIL" | "UNPROVEN";

export type DsddHeadlessRequirement = Readonly<{
  id: string;
  text: string;
  status: DsddRequirementState;
  requiredEvidence: readonly string[];
  evidenceRefs: readonly string[];
}>;

export type DsddHeadlessContract = Readonly<{
  schemaVersion: 1;
  intentId: string;
  humanIntent: string;
  developerBrief: string;
  affectedSurfaces: readonly string[];
  requirements: readonly DsddHeadlessRequirement[];
  checkpoints: Readonly<{
    prHeadSha: string;
    exactHeadVerified: boolean;
    mergedSha: string;
    postMergeVerified: boolean;
  }>;
  repositoryMutationAuthority: "unchanged";
  piAuthority: "advisory-read-only";
}>;

export type DsddConvergence = Readonly<{
  state: "blocked" | "unproven" | "converged";
  missingEvidence: readonly Readonly<{ requirementId: string; evidenceClass: string }>[];
  failedRequirements: readonly string[];
}>;

function clean(value: unknown, maximum = 4000) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function uniqueStrings(value: unknown, maximum = 64) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => clean(item, 512)).filter(Boolean))].slice(0, maximum);
}

export function normalizeDsddHeadlessContract(input: {
  intentId: string;
  humanIntent: string;
  developerBrief: string;
  affectedSurfaces?: readonly string[];
  requirements: readonly {
    id: string;
    text: string;
    status?: DsddRequirementState;
    requiredEvidence?: readonly string[];
    evidenceRefs?: readonly string[];
  }[];
  prHeadSha?: string;
  exactHeadVerified?: boolean;
  mergedSha?: string;
  postMergeVerified?: boolean;
}): DsddHeadlessContract {
  const intentId = clean(input.intentId, 180);
  const humanIntent = clean(input.humanIntent, 12000);
  const developerBrief = clean(input.developerBrief, 24000);
  if (!intentId || !humanIntent || !developerBrief) throw new Error("Headless DSDD requires locked Human intent and a developer brief.");
  if (!Array.isArray(input.requirements) || input.requirements.length === 0) throw new Error("Headless DSDD requires deterministic acceptance requirements.");

  const requirements = input.requirements.map((requirement, index) => {
    const id = clean(requirement.id, 180) || `requirement-${index + 1}`;
    const text = clean(requirement.text, 4000);
    if (!text) throw new Error(`DSDD requirement ${id} is missing acceptance text.`);
    const status: DsddRequirementState = ["PASS", "FAIL", "UNPROVEN"].includes(requirement.status ?? "")
      ? requirement.status!
      : "UNPROVEN";
    return Object.freeze({
      id,
      text,
      status,
      requiredEvidence: Object.freeze(uniqueStrings(requirement.requiredEvidence)),
      evidenceRefs: Object.freeze(uniqueStrings(requirement.evidenceRefs)),
    });
  });

  return Object.freeze({
    schemaVersion: 1 as const,
    intentId,
    humanIntent,
    developerBrief,
    affectedSurfaces: Object.freeze(uniqueStrings(input.affectedSurfaces)),
    requirements: Object.freeze(requirements),
    checkpoints: Object.freeze({
      prHeadSha: clean(input.prHeadSha, 160),
      exactHeadVerified: input.exactHeadVerified === true,
      mergedSha: clean(input.mergedSha, 160),
      postMergeVerified: input.postMergeVerified === true,
    }),
    repositoryMutationAuthority: "unchanged" as const,
    piAuthority: "advisory-read-only" as const,
  });
}

export function evaluateDsddConvergence(contract: DsddHeadlessContract): DsddConvergence {
  const failedRequirements = contract.requirements.filter((item) => item.status === "FAIL").map((item) => item.id);
  const missingEvidence = contract.requirements.flatMap((item) => (
    item.status === "PASS"
      ? item.requiredEvidence.filter((required) => !item.evidenceRefs.includes(required)).map((evidenceClass) => ({ requirementId: item.id, evidenceClass }))
      : item.requiredEvidence.map((evidenceClass) => ({ requirementId: item.id, evidenceClass }))
  ));

  if (failedRequirements.length) return Object.freeze({ state: "blocked", missingEvidence, failedRequirements });
  const allPass = contract.requirements.every((item) => item.status === "PASS");
  const checkpointsGreen = contract.checkpoints.exactHeadVerified && (!contract.checkpoints.mergedSha || contract.checkpoints.postMergeVerified);
  return Object.freeze({
    state: allPass && missingEvidence.length === 0 && checkpointsGreen ? "converged" : "unproven",
    missingEvidence,
    failedRequirements,
  });
}

export function applyDsddRequirementEvidence(
  contract: DsddHeadlessContract,
  requirementId: string,
  update: { status: DsddRequirementState; evidenceRefs?: readonly string[]; source: "deterministic" | "pi" },
): DsddHeadlessContract {
  if (update.source === "pi") throw new Error("Pi is advisory and cannot decide DSDD convergence.");
  const requirements = contract.requirements.map((item) => {
    if (item.id !== requirementId) return item;
    if (item.status === "FAIL" && update.status === "PASS") {
      throw new Error("A failed deterministic requirement cannot be marked green without a new deterministic requirement evaluation.");
    }
    return Object.freeze({ ...item, status: update.status, evidenceRefs: Object.freeze(uniqueStrings(update.evidenceRefs)) });
  });
  if (!requirements.some((item) => item.id === requirementId)) throw new Error("Unknown DSDD requirement.");
  return Object.freeze({ ...contract, requirements: Object.freeze(requirements) });
}

export function requestDsddVerificationJourney(contract: DsddHeadlessContract, journey: string): VerificationRequest {
  const target = clean(journey, 512);
  if (!target) throw new Error("DSDD verification journey name is required.");
  return Object.freeze({
    requestId: `dsdd:${contract.intentId}:${target}`,
    operation: "rendered-acceptance" as const,
    target,
  });
}
