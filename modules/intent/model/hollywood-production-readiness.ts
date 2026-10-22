import { observeProjectStatus, type ProjectObservationRequest, type ProjectObservationContext } from "./observe-project-status";

/**
 * #3203: a derived film-production evidence inventory, not film certification.
 * This uses the existing project-status capability and canonical Library PPF;
 * it never selects a project, writes a revision, calls a provider, or grants approval.
 */
export const HOLLYWOOD_READINESS_VERSION = 1 as const;

const STAGES = [
  { id: "concept-script", label: "Concept, script and greenlight", missing: "A retained screenplay passage does not establish an approved locked shooting script or greenlight.", link: "/skin-v1?workspace=write" },
  { id: "planning-budget", label: "Breakdown, budgeting and scheduling", missing: "Accepted Plan-stage metadata does not prove a line-item budget, schedule, rights or safety clearance.", link: "/skin-v1?workspace=outline" },
  { id: "casting-locations", label: "Casting and location scouting", missing: "Writer-reference character claims are not verified casting, availability, locations or permits.", link: "/skin-v1?workspace=world-map" },
  { id: "technical-prep", label: "Technical preparation and previsualization", missing: "An accepted Storyboard stage does not establish approved camera, lighting, blocking or footage.", link: "/skin-v1?workspace=storyboard" },
  { id: "principal-photography", label: "Principal photography or virtual capture", missing: "No independently verified photographed or synthetic take and ingest provenance is established here.", link: null },
  { id: "picture-editing", label: "Picture editing", missing: "No source-linked editorial conform, playable cut or Human picture-lock receipt is established here.", link: null },
  { id: "vfx-compositing", label: "VFX and compositing", missing: "No versioned plate, VFX turnover, composite or approved render QC is established here.", link: null },
  { id: "sound-music", label: "Sound and music", missing: "No independently verified dialogue, ADR, Foley, music rights or sound deliverable is established here.", link: null },
  { id: "final-mastering", label: "Final mix and mastering", missing: "No measured grade, caption, mix, checksum, master-spec or creator sign-off is established here.", link: null },
  { id: "marketing-distribution", label: "Marketing and distribution", missing: "No approved clearance, delivery package, distribution receipt or audience-response evidence is established here.", link: null },
] as const;

export type HollywoodStageId = (typeof STAGES)[number]["id"];
export type HollywoodStageEvidence = Readonly<{
  source: "sourceEvidence.screenplay.passages" | "structure.miniBlocks.plan.acceptedAt" |
    "sourceEvidence.characterTruth.claims" | "structure.miniBlocks.storyboard.acceptedAt";
  count: number;
}>;
export type HollywoodStageResult = Readonly<{
  id: HollywoodStageId;
  label: string;
  state: "OBSERVED" | "INSUFFICIENT_EVIDENCE";
  evidence: readonly HollywoodStageEvidence[];
  limitation: string;
  editorLink: string | null;
  filmStageVerified: false;
}>;
export type HollywoodReadinessResult = Readonly<{
  version: typeof HOLLYWOOD_READINESS_VERSION;
  capability: "hollywood-production-readiness.observe";
  state: "OBSERVED" | "BLOCKED";
  code: string;
  authority: "READ_ONLY";
  project: null | Readonly<{ id: string; revision: number }>;
  sourceCoverage: "RETAINED_PARTIAL_OR_UNVERIFIED" | "NO_SOURCE_EVIDENCE";
  stages: readonly HollywoodStageResult[];
  nextDecision: null | Readonly<{ kind: "REVIEW_BLOCK_SOURCE_EVIDENCE" | "REVIEW_SCREENPLAY_AND_PRODUCTION_PLAN"; blockNumber: number | null; actionAuthority: "HUMAN" }>;
  independentVerification: false;
  filmReadyVerified: false;
  canonMutated: false;
  modelCalled: false;
  paidGenerationPermitted: false;
}>;

export function observeHollywoodProductionReadiness(
  request: ProjectObservationRequest,
  context: ProjectObservationContext,
): HollywoodReadinessResult {
  const observation = observeProjectStatus(request, context);
  if (observation.state !== "OBSERVED" || !observation.project || !context.activeProject) {
    return Object.freeze({
      version: HOLLYWOOD_READINESS_VERSION,
      capability: "hollywood-production-readiness.observe" as const,
      state: "BLOCKED" as const,
      code: observation.code,
      authority: "READ_ONLY" as const,
      project: null,
      sourceCoverage: "NO_SOURCE_EVIDENCE" as const,
      stages: Object.freeze([]),
      nextDecision: null,
      independentVerification: false as const,
      filmReadyVerified: false as const,
      canonMutated: false as const,
      modelCalled: false as const,
      paidGenerationPermitted: false as const,
    });
  }

  const project = context.activeProject;
  const screenplay = project.sourceEvidence?.screenplay;
  const retained = screenplay?.passages?.length ?? 0;
  const minis = project.structure.blocks.flatMap((block) => block.miniBlocks);
  const planCount = minis.filter((mini) => Boolean(mini.stages.plan.acceptedAt)).length;
  const storyboardCount = minis.filter((mini) => Boolean(mini.stages.storyboard.acceptedAt)).length;
  const claims = project.sourceEvidence?.characterTruth?.claims ?? [];
  const characterReferences = claims.filter((claim) =>
    claim.reviewState === "human-approved" && claim.handling === "writer-reference").length;

  // Counts are limited evidence of the specific PPF metadata, never production
  // completion, readiness, actor commitment, actual footage or final delivery.
  const evidenceByStage: Partial<Record<HollywoodStageId, HollywoodStageEvidence>> = {
    "concept-script": { source: "sourceEvidence.screenplay.passages", count: retained },
    "planning-budget": { source: "structure.miniBlocks.plan.acceptedAt", count: planCount },
    "casting-locations": { source: "sourceEvidence.characterTruth.claims", count: characterReferences },
    "technical-prep": { source: "structure.miniBlocks.storyboard.acceptedAt", count: storyboardCount },
  };
  const stages: HollywoodStageResult[] = STAGES.map((spec) => {
    const found = evidenceByStage[spec.id];
    return Object.freeze({
      id: spec.id,
      label: spec.label,
      state: found && found.count > 0 ? "OBSERVED" as const : "INSUFFICIENT_EVIDENCE" as const,
      evidence: Object.freeze(found && found.count > 0 ? [Object.freeze(found)] : []),
      limitation: spec.missing,
      editorLink: found && found.count > 0 ? spec.link : null,
      filmStageVerified: false as const,
    });
  });
  return Object.freeze({
    version: HOLLYWOOD_READINESS_VERSION,
    capability: "hollywood-production-readiness.observe" as const,
    state: "OBSERVED" as const,
    code: "DERIVED_PPF_EVIDENCE_NOT_FILM_CERTIFICATION",
    authority: "READ_ONLY" as const,
    project: Object.freeze({ id: observation.project.id, revision: observation.project.revision }),
    sourceCoverage: "RETAINED_PARTIAL_OR_UNVERIFIED" as const,
    stages: Object.freeze(stages),
    nextDecision: observation.nextDecision
      ? Object.freeze({ kind: "REVIEW_BLOCK_SOURCE_EVIDENCE" as const,
        blockNumber: observation.nextDecision.blockNumber, actionAuthority: "HUMAN" as const })
      : Object.freeze({ kind: "REVIEW_SCREENPLAY_AND_PRODUCTION_PLAN" as const,
        blockNumber: null, actionAuthority: "HUMAN" as const }),
    independentVerification: false as const,
    filmReadyVerified: false as const,
    canonMutated: false as const,
    modelCalled: false as const,
    paidGenerationPermitted: false as const,
  });
}
