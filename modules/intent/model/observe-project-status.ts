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


/**
 * #3004 / #3203: headless Storyboard Shot observation over the SAME canonical
 * PPF held by the authenticated profile Library. No browser, image request,
 * alternate store, approval, or media-file availability claim.
 *
 * The caller MUST bind profile identity and the currently active PPF from the
 * existing authenticated profile owner; project name is never an authority.
 */
export type StoryboardShotObservationRequest = Readonly<{
  capability: "storyboard-shot.observe";
  profileId: string;
  projectId: string;
  projectRevision: number;
  providerPolicy: "LOCAL_READ_ONLY";
  actNumber: number;
  sequenceNumber: number;
  blockNumber: number;
  miniBlockNumber: number;
  shotNumber: number;
}>;

const STORYBOARD_IMAGE_WORKFLOW = "storyboard-frame-webp-v2";
const STORYBOARD_SAVE_KEY = "storyboard-local-save:v1";
const storyboardAssetRef = (value: unknown): string | null => {
  if (typeof value !== "string" || value.length > 500
      || !/^\/(?:api\/local-ai\/assets|assets\/library\/examples)\/[A-Za-z0-9_./-]+$/u.test(value)
      || value.includes("..") || value.includes("//")) return null;
  return value;
};

export function observeStoryboardShot(
  request: StoryboardShotObservationRequest,
  context: ProjectObservationContext,
) {
  const blockedShot = (code: string) => Object.freeze({
    version: 1, capability: "storyboard-shot.observe" as const,
    state: "BLOCKED" as const, code,
    authority: "READ_ONLY" as const, modelCalled: false,
    canonMutated: false, paidGenerationPermitted: false,
    independentVerification: false, mediaBytesVerified: false,
    project: null, address: null, sourceEvidence: null,
    candidateCount: 0, candidates: Object.freeze([]), nextAction: null,
  });
  if (!request || request.capability !== "storyboard-shot.observe"
      || request.providerPolicy !== "LOCAL_READ_ONLY") return blockedShot("POLICY_NOT_ADMITTED");
  if (!context || !ID.test(request.profileId || "")
      || context.activeProfileId !== request.profileId) return blockedShot("PROFILE_NOT_BOUND");
  const project = context.activeProject;
  if (!ID.test(request.projectId || "") || !project || project.id !== request.projectId)
    return blockedShot("PROJECT_NOT_BOUND");
  if (!Number.isSafeInteger(request.projectRevision) || request.projectRevision < 0
      || project.revision !== request.projectRevision)
    return blockedShot("STALE_PROJECT_REVISION");
  const {actNumber, sequenceNumber, blockNumber, miniBlockNumber, shotNumber} = request;
  if (![actNumber,sequenceNumber,blockNumber,miniBlockNumber,shotNumber].every(Number.isSafeInteger)
      || blockNumber < 1 || blockNumber > 24 || miniBlockNumber < 1 || miniBlockNumber > 4
      || shotNumber < 1 || shotNumber > 25
      || actNumber !== Math.floor((blockNumber - 1) / 6) + 1
      || sequenceNumber !== Math.floor((blockNumber - 1) / 2) + 1)
    return blockedShot("INVALID_COORDINATE");
  const block = project.structure?.blocks?.find(item => item.number === blockNumber);
  if (!block || !block.miniBlocks?.some(item => item.ordinal === miniBlockNumber))
    return blockedShot("STRUCTURE_NOT_FOUND");

  // This source belongs to the Mini-Block. Never claim an individual Shot
  // has been screenplay-mapped from its position alone.
  const passages = (project.sourceEvidence?.screenplay?.passages ?? [])
    .filter(item => item.blockNumber === blockNumber && item.miniBlockNumber === miniBlockNumber);
  const anchor = "storyboard-anchor:block:block-"
    + String(blockNumber).padStart(2,"0") + ":mini-" + miniBlockNumber;
  const target = "storyboard-target:block:block-" + String(blockNumber).padStart(2,"0");
  const savedIds = new Set(project.build.foundations.acceptedVisualArtifactIds);
  const all = project.build.foundations.visualArtifacts.filter(item =>
    item.workflow === STORYBOARD_IMAGE_WORKFLOW
    && item.frameNumber === shotNumber
    && item.reviewState !== "rejected"
    && (item.sourceDecisionKeys ?? []).includes(anchor)
    && (item.sourceDecisionKeys ?? []).includes(target));
  const candidates = all.slice().sort((a,b) =>
    b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
    .slice(0,25).map(item => {
      const keys = item.sourceDecisionKeys ?? [];
      const assetUrl = storyboardAssetRef(item.assetUrl);
      const saved = Boolean(assetUrl && keys.includes(STORYBOARD_SAVE_KEY));
      return Object.freeze({
        id: item.id,
        assetUrl,
        prompt: typeof item.prompt === "string" ? item.prompt.slice(0,8000) : "",
        provider: item.provider,
        model: item.model,
        createdAt: item.createdAt,
        reviewState: item.reviewState ?? "draft",
        savedMarkerPresent: saved,
        locked: saved && savedIds.has(item.id) && item.reviewState === "accepted",
        // A persisted URL is NOT proof that its image bytes still exist.
        mediaBytesVerified: false as const,
      });
    });
  const status = candidates.some(item => item.locked) ? "LOCKED"
    : candidates.some(item => item.savedMarkerPresent) ? "SAVED"
      : candidates.length ? "CANDIDATE" : "EMPTY";
  return Object.freeze({
    version: 1, capability: "storyboard-shot.observe" as const,
    state: "OBSERVED" as const,
    code: "PROFILE_LIBRARY_PPF_READ_NOT_MEDIA_FILE_VERIFICATION",
    authority: "READ_ONLY" as const, modelCalled: false,
    canonMutated: false, paidGenerationPermitted: false,
    independentVerification: false, mediaBytesVerified: false,
    project: Object.freeze({id: project.id, revision: project.revision}),
    address: Object.freeze({actNumber,sequenceNumber,blockNumber,miniBlockNumber,shotNumber}),
    sourceEvidence: Object.freeze({
      scope: "MINI_BLOCK" as const,
      shotSpecificMappingVerified: false,
      passageCount: passages.length,
      passageIds: Object.freeze(passages.slice(0,64).map(item => item.id)),
    }),
    candidateCount: all.length,
    candidates: Object.freeze(candidates),
    nextAction: status === "EMPTY" ? "REVIEW_SOURCE_AND_PROVIDER_BEFORE_ONE_IMAGE"
      : status === "CANDIDATE" ? "REVIEW_CANDIDATE_BEFORE_SAVE"
        : status === "SAVED" ? "HUMAN_REVIEW_BEFORE_LOCK"
          : "LOCKED_CANDIDATE_REQUIRES_MEDIA_READBACK",
    shotStatus: status,
  });
}
