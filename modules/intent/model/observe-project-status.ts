import type { LibraryPPFProject } from "../../../core/storage/library-project";
import { projectCanonicalProjectForOutline } from "../../plan/projections/canonical-project-outline";
import { deriveOutlineReadiness } from "../../plan/outline-readiness";

/**
 * #3203: one read-only capability over the existing canonical Library project.
 * This is a derived observation, NOT an independent verification of persistence,
 * a content-quality judgment, an agent run, or an authorization to mutate canon.
 */
export const PROJECT_OBSERVATION_CONTRACT_VERSION = 1 as const;

export type ProjectObservationRequest = Readonly<{
  capability: "project-status.observe";
  profileId: string;
  projectId: string;
  projectRevision: number;
  providerPolicy: "LOCAL_READ_ONLY";
  blockNumber?: number;
}>;

export type ProjectObservationContext = Readonly<{
  activeProfileId: string | null;
  activeProject: LibraryPPFProject | null;
}>;

export type ProjectObservationResult = Readonly<{
  version: typeof PROJECT_OBSERVATION_CONTRACT_VERSION;
  capability: "project-status.observe";
  state: "OBSERVED" | "BLOCKED";
  code: string;
  authority: "READ_ONLY";
  independentVerification: false;
  canonMutated: false;
  modelCalled: false;
  paidGenerationPermitted: false;
  project: null | Readonly<{
    id: string;
    revision: number;
    canonicalProjectionVersion: number;
    blockCount: number;
    miniBlockCount: number;
    acceptedFieldCount: number;
    sourcePassageCount: number;
  }>;
  attention: readonly Readonly<{
    blockNumber: number;
    blockId: string;
    status: "needs-support" | "review";
    unsupportedMiniBlockNumbers: readonly number[];
    source: "canonical-outline-readiness";
  }>[];
  nextDecision: null | Readonly<{
    kind: "REVIEW_BLOCK_SOURCE_EVIDENCE";
    blockNumber: number;
    actionAuthority: "HUMAN";
  }>;
}>;

function blocked(code: string): ProjectObservationResult {
  return Object.freeze({
    version: PROJECT_OBSERVATION_CONTRACT_VERSION,
    capability: "project-status.observe",
    state: "BLOCKED",
    code,
    authority: "READ_ONLY",
    independentVerification: false,
    canonMutated: false,
    modelCalled: false,
    paidGenerationPermitted: false,
    project: null,
    attention: Object.freeze([]),
    nextDecision: null,
  });
}

const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{1,159}$/;

/** Strict, no-fallback identity and spending-policy gate; no browser/storage writes. */
export function observeProjectStatus(
  request: ProjectObservationRequest,
  context: ProjectObservationContext,
): ProjectObservationResult {
  if (!request || request.capability !== "project-status.observe" || request.providerPolicy !== "LOCAL_READ_ONLY") {
    return blocked("POLICY_NOT_ADMITTED");
  }
  if (!context || !ID.test(request.profileId || "") || !ID.test(request.projectId || "")
    || !context.activeProfileId || context.activeProfileId !== request.profileId) {
    return blocked("PROFILE_NOT_BOUND");
  }
  const project = context.activeProject;
  if (!project || !project.id || project.id !== request.projectId) {
    return blocked("PROJECT_NOT_BOUND");
  }
  if (!Number.isSafeInteger(request.projectRevision) || request.projectRevision < 0
    || project.revision !== request.projectRevision) {
    return blocked("STALE_PROJECT_REVISION");
  }
  if (request.blockNumber !== undefined &&
    (!Number.isInteger(request.blockNumber) || request.blockNumber < 1 || request.blockNumber > 24)) {
    return blocked("INVALID_COORDINATE");
  }

  // A screenplay is a necessary source for claiming source-linked structural
  // inspection here. No accepted passage => no projected readiness claim.
  const passages = project.sourceEvidence?.screenplay?.passages;
  if (!Array.isArray(passages) || passages.length === 0) {
    return blocked("SOURCE_EVIDENCE_MISSING");
  }

  const projection = projectCanonicalProjectForOutline(project);
  if (projection.projectId !== request.projectId || projection.projectRevision !== request.projectRevision) {
    return blocked("CANONICAL_PROJECTION_MISMATCH");
  }
  const readiness = deriveOutlineReadiness(project);
  if (readiness.length !== projection.blocks.length || projection.blocks.length !== 24
    || projection.blocks.some((block) => block.miniBlocks.length !== 4)) {
    return blocked("CANONICAL_STRUCTURE_UNPROVEN");
  }
  const selectedReadiness = request.blockNumber === undefined
    ? readiness : readiness.filter((item) => item.blockNumber === request.blockNumber);
  const attention = selectedReadiness.flatMap((item) => {
    if (item.status === "ready") return [];
    const block = projection.blocks.find((candidate) => candidate.number === item.blockNumber);
    if (!block) return [];
    return [Object.freeze({
      blockNumber: block.number,
      blockId: block.id,
      status: item.status,
      unsupportedMiniBlockNumbers: Object.freeze([...item.unsupportedMiniBlocks]),
      source: "canonical-outline-readiness" as const,
    })];
  });
  const first = attention.find((item) => item.status === "needs-support") ?? attention[0];
  return Object.freeze({
    version: PROJECT_OBSERVATION_CONTRACT_VERSION,
    capability: "project-status.observe",
    state: "OBSERVED",
    code: "CANONICAL_PROJECT_DERIVED_NOT_INDEPENDENTLY_VERIFIED",
    authority: "READ_ONLY",
    independentVerification: false,
    canonMutated: false,
    modelCalled: false,
    paidGenerationPermitted: false,
    project: Object.freeze({
      id: projection.projectId,
      revision: projection.projectRevision,
      canonicalProjectionVersion: projection.version,
      blockCount: projection.blocks.length,
      miniBlockCount: projection.blocks.reduce((sum, block) => sum + block.miniBlocks.length, 0),
      acceptedFieldCount: projection.fields.filter((field) => field.value.trim() && field.acceptedSource).length,
      sourcePassageCount: passages.length,
    }),
    attention: Object.freeze(attention),
    nextDecision: first ? Object.freeze({
      kind: "REVIEW_BLOCK_SOURCE_EVIDENCE" as const,
      blockNumber: first.blockNumber,
      actionAuthority: "HUMAN" as const,
    }) : null,
  });
}
