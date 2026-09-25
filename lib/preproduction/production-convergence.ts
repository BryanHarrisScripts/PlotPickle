import type { StoryboardEditorialShot } from "../../core/contracts/storyboard/editorial-shot";
import type {
  PrevisProductionState,
  ProductionShotIntent,
  ProductionSoundCue,
  ProductionTake,
  RoughCutPlacement,
  RoughCutRevision,
  ScreeningObservation,
} from "../../core/contracts/previs";
import type {
  BeatSemanticProjection,
  CanonicalPreproductionProject,
  FrameSemanticProjection,
  PreproductionSemanticProjection,
} from "./semantic-projection";
import {
  assemblePreproductionProductionIntent,
  type PreproductionProductionIntent,
} from "./production-intent-handoff";
import {
  inspectPreproductionSceneDirectorSpecReadiness,
  type PreproductionSceneDirectorSpecReadiness,
} from "./director-spec-readiness";
import {
  compileDirectorSpecification,
  type DirectorSpecification,
  type DirectorSpecificationDirectionLevel,
} from "./director-specification";
import {
  assessProviderCapabilities,
  type DirectorSpecificationRequirement,
  type ProviderCapabilityAssessment,
  type ProviderCompilationStrategy,
} from "./provider-capability-contract";
import {
  compileProviderInstructions,
  type ProviderInstructionBundle,
} from "./provider-instruction-compiler";
import type { ConcreteProviderInstructionIntegration } from "./provider-instruction-adapters";

export type ProductionConvergenceState = "ready" | "not-ready";

export type ProductionConvergenceResult = {
  readonly version: 1;
  readonly projectId: string;
  readonly canonicalRevision: number;
  readonly sceneId: string;
  readonly providerNeutral: true;
  readonly canonical: false;
  readonly state: ProductionConvergenceState;
  readonly productionIntent: PreproductionProductionIntent | null;
  readonly readiness: PreproductionSceneDirectorSpecReadiness | null;
  readonly specification: DirectorSpecification | null;
  readonly blockingReasons: readonly string[];
  readonly sourceRefs: readonly string[];
};

export type InspectProductionConvergenceInput = {
  readonly project: CanonicalPreproductionProject;
  readonly semantics: PreproductionSemanticProjection;
  readonly sceneId: string;
  readonly approvedEditorialShots: readonly StoryboardEditorialShot[];
  readonly beats?: readonly BeatSemanticProjection[];
  readonly frames?: readonly FrameSemanticProjection[];
  readonly directionLevel?: DirectorSpecificationDirectionLevel;
};

export type CompileSelectedProductionInstructionsInput = {
  readonly convergence: ProductionConvergenceResult;
  /** Provider/runtime integration already selected by Story Mode / capability routing. */
  readonly integration: ConcreteProviderInstructionIntegration;
  readonly strategy: ProviderCompilationStrategy;
};

export type SelectedProductionInstructionCompilation = {
  readonly assessment: ProviderCapabilityAssessment;
  readonly bundle: ProviderInstructionBundle;
};

function stableStrings(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))].sort();
}

function notReady(input: {
  projectId: string;
  canonicalRevision: number;
  sceneId: string;
  productionIntent?: PreproductionProductionIntent | null;
  readiness?: PreproductionSceneDirectorSpecReadiness | null;
  blockingReasons: readonly string[];
  sourceRefs?: readonly string[];
}): ProductionConvergenceResult {
  return {
    version: 1,
    projectId: input.projectId,
    canonicalRevision: input.canonicalRevision,
    sceneId: input.sceneId,
    providerNeutral: true,
    canonical: false,
    state: "not-ready",
    productionIntent: input.productionIntent ?? null,
    readiness: input.readiness ?? null,
    specification: null,
    blockingReasons: stableStrings(input.blockingReasons),
    sourceRefs: stableStrings(input.sourceRefs ?? []),
  };
}

/**
 * #2173 convergence boundary.
 *
 * Compose the existing approved Storyboard/Previs/Scene semantic authorities into
 * the existing #2064 Director Specification without creating another production
 * store. Missing or incomplete approved intent remains a truthful not-ready
 * result rather than being filled with generated defaults.
 */
export function inspectProductionConvergence(
  input: InspectProductionConvergenceInput,
): ProductionConvergenceResult {
  const { project, semantics } = input;
  if (semantics.story.projectId !== project.id) {
    throw new Error("Production convergence semantics belong to a different project.");
  }
  if (semantics.story.canonicalRevision !== project.revision) {
    throw new Error("Production convergence semantics are stale relative to the current PPF revision.");
  }

  const approvedPrevisShots = project.production.shots.filter((shot) => shot.reviewState === "approved");
  if (!approvedPrevisShots.length) {
    return notReady({
      projectId: project.id,
      canonicalRevision: project.revision,
      sceneId: input.sceneId,
      blockingReasons: ["approved Previs Production Shot"],
      sourceRefs: [semantics.story.id],
    });
  }
  if (!input.approvedEditorialShots.length) {
    return notReady({
      projectId: project.id,
      canonicalRevision: project.revision,
      sceneId: input.sceneId,
      blockingReasons: ["approved Storyboard Shot"],
      sourceRefs: [semantics.story.id, ...approvedPrevisShots.map((shot) => shot.id)],
    });
  }

  let productionIntent: PreproductionProductionIntent;
  try {
    productionIntent = assemblePreproductionProductionIntent({
      project,
      semantics,
      approvedEditorialShots: input.approvedEditorialShots,
      beats: input.beats,
      frames: input.frames,
    });
  } catch (cause) {
    return notReady({
      projectId: project.id,
      canonicalRevision: project.revision,
      sceneId: input.sceneId,
      blockingReasons: [cause instanceof Error ? cause.message : "approved pre-production intent is incomplete"],
      sourceRefs: [
        semantics.story.id,
        ...approvedPrevisShots.map((shot) => shot.id),
        ...input.approvedEditorialShots.map((shot) => shot.shotId),
      ],
    });
  }

  let readiness: PreproductionSceneDirectorSpecReadiness;
  try {
    readiness = inspectPreproductionSceneDirectorSpecReadiness({
      productionIntent,
      semantics,
      sceneId: input.sceneId,
    });
  } catch (cause) {
    return notReady({
      projectId: project.id,
      canonicalRevision: project.revision,
      sceneId: input.sceneId,
      productionIntent,
      blockingReasons: [cause instanceof Error ? cause.message : "Scene readiness could not be inspected"],
      sourceRefs: productionIntent.sourceRefs,
    });
  }

  if (!readiness.readyForDirectorSpec) {
    return notReady({
      projectId: project.id,
      canonicalRevision: project.revision,
      sceneId: input.sceneId,
      productionIntent,
      readiness,
      blockingReasons: readiness.missingRequired,
      sourceRefs: readiness.sourceRefs,
    });
  }

  const specification = compileDirectorSpecification({
    readiness,
    directionLevel: input.directionLevel,
  });

  return {
    version: 1,
    projectId: project.id,
    canonicalRevision: project.revision,
    sceneId: input.sceneId,
    providerNeutral: true,
    canonical: false,
    state: "ready",
    productionIntent,
    readiness,
    specification,
    blockingReasons: [],
    sourceRefs: [...specification.sourceRefs],
  };
}

/**
 * Derive capability questions from the provider-neutral Director Specification.
 * Core sequencing/timing is required; richer filmmaking intent is preferred so
 * unsupported provider features remain visible without making local workflows
 * impossible when they can be handled best-effort or in finishing.
 */
export function productionRequirementsForDirectorSpecification(
  specification: DirectorSpecification,
): readonly DirectorSpecificationRequirement[] {
  const shots = specification.shots;
  const firstShotRef = shots[0]?.editorialShotId;
  const requirements: DirectorSpecificationRequirement[] = [
    { property: "scene.intent", strength: "required", sourceRef: specification.scene.sceneId },
    { property: "sequence.duration", strength: "required", sourceRef: specification.scene.sceneId },
    { property: "shot.order", strength: "required", sourceRef: firstShotRef },
    { property: "shot.duration", strength: "required", sourceRef: firstShotRef },
  ];

  const preferred: Array<[DirectorSpecificationRequirement["property"], boolean]> = [
    ["camera.framing", shots.some((shot) => Boolean(shot.camera.shotSize || shot.camera.angle))],
    ["camera.lens", shots.some((shot) => Boolean(shot.camera.lensIntent))],
    ["camera.movement", shots.some((shot) => Boolean(shot.camera.movement))],
    ["blocking", shots.some((shot) => shot.blocking.length > 0)],
    ["lighting", shots.some((shot) => Boolean(shot.camera.lightingIntent))],
    ["references", shots.some((shot) => shot.frameRefs.length > 0 || shot.assetRefs.length > 0) || specification.scene.assetRefs.length > 0],
    ["continuity", shots.some((shot) => shot.continuityLockReferences.length > 0)],
    ["information-boundary", shots.some((shot) => shot.informationDirectives.length > 0)],
    ["audio", shots.some((shot) => shot.audioIntents.length > 0)],
    ["transitions", shots.some((shot) => Boolean(shot.transitionIn || shot.transitionOut))],
  ];

  for (const [property, present] of preferred) {
    if (present) requirements.push({ property, strength: "preferred", sourceRef: firstShotRef });
  }
  return requirements;
}

/**
 * Compile disposable provider instructions only after Story Mode / capability
 * routing has supplied the selected integration. This function never chooses a
 * provider or runtime and never promotes generated prose into PPF/canon.
 */
export function compileSelectedProductionInstructions(
  input: CompileSelectedProductionInstructionsInput,
): SelectedProductionInstructionCompilation {
  const specification = input.convergence.specification;
  if (input.convergence.state !== "ready" || !specification) {
    throw new Error(`Production convergence is not ready: ${input.convergence.blockingReasons.join(", ") || "missing approved production intent"}.`);
  }

  const assessment = assessProviderCapabilities(
    input.integration.capabilityContract,
    productionRequirementsForDirectorSpecification(specification),
  );
  const bundle = compileProviderInstructions({
    specification,
    assessment,
    strategy: input.strategy,
    adapter: input.integration.instructionAdapter,
  });

  return { assessment, bundle };
}

export type ProductionPacketTakeProjection = {
  readonly take: ProductionTake;
  readonly stale: boolean;
  readonly staleBecause: readonly string[];
};

export type PlotPickleProductionPacket = {
  readonly projectionOnly: true;
  readonly providerNeutral: true;
  readonly productionShotId: string;
  readonly anchorRef: string;
  readonly storyboardArtifactId: string;
  readonly storyboardDependencyKey: string;
  readonly intendedDurationSeconds: number | null;
  readonly soundCues: readonly ProductionSoundCue[];
  readonly takes: readonly ProductionPacketTakeProjection[];
  readonly approvedTakeId: string | null;
  readonly activeCutIds: readonly string[];
  readonly screeningObservations: readonly ScreeningObservation[];
  readonly sourceRefs: readonly string[];
};

export type RoughCutAnchorProjection = {
  readonly projectionOnly: true;
  readonly anchorRef: string;
  readonly shots: readonly Readonly<{
    shot: ProductionShotIntent;
    packet: PlotPickleProductionPacket;
    placement: RoughCutPlacement | null;
  }>[];
  readonly cuts: readonly RoughCutRevision[];
};

export type ScreeningProjection = {
  readonly projectionOnly: true;
  readonly cut: RoughCutRevision | null;
  readonly observations: readonly ScreeningObservation[];
  readonly unresolved: readonly ScreeningObservation[];
};

function newestByCreatedAt<T extends { readonly createdAt: string }>(values: readonly T[]) {
  return [...values].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function downstreamProductionState(state: PrevisProductionState) {
  return {
    soundCues: state.soundCues ?? [],
    takes: state.takes ?? [],
    roughCuts: state.roughCuts ?? [],
    screeningObservations: state.screeningObservations ?? [],
  } as const;
}

/**
 * Read-only Production Packet projection for #2458.
 * This is assembled from existing authorities and never becomes a second canon store.
 */
export function projectPlotPickleProductionPacket(input: {
  readonly production: PrevisProductionState;
  readonly productionShotId: string;
  readonly currentRevision: number;
}): PlotPickleProductionPacket | null {
  const shot = input.production.shots.find((candidate) => candidate.id === input.productionShotId);
  if (!shot) return null;
  const { soundCues, takes, roughCuts, screeningObservations } = downstreamProductionState(input.production);
  const shotTakes = newestByCreatedAt(takes.filter((take) => take.productionShotId === shot.id));
  const projectedTakes = shotTakes.map((take): ProductionPacketTakeProjection => {
    const staleBecause = [
      ...(take.sourceRevision > input.currentRevision ? [`take source revision ${take.sourceRevision} is newer than current revision ${input.currentRevision}`] : []),
      ...(take.storyboardDependencyKey !== shot.storyboardDependencyKey ? ["Storyboard dependency changed"] : []),
    ];
    return { take, stale: staleBecause.length > 0, staleBecause };
  });
  const validApprovedTake = projectedTakes.find((item) => item.take.reviewState === "approved" && !item.stale) ?? null;
  const shotCues = soundCues.filter((cue) => cue.productionShotId === shot.id || (!cue.productionShotId && cue.anchorRef === shot.anchorRef));
  const activeCuts = newestByCreatedAt(roughCuts.filter((cut) => cut.placements.some((placement) => placement.productionShotId === shot.id)));
  const activeCutIds = activeCuts.map((cut) => cut.id);
  const activeCutSet = new Set(activeCutIds);
  const observations = screeningObservations.filter((item) => item.productionShotId === shot.id || activeCutSet.has(item.roughCutId));

  return {
    projectionOnly: true,
    providerNeutral: true,
    productionShotId: shot.id,
    anchorRef: shot.anchorRef,
    storyboardArtifactId: shot.storyboardArtifactId,
    storyboardDependencyKey: shot.storyboardDependencyKey,
    intendedDurationSeconds: shot.durationSeconds,
    soundCues: shotCues,
    takes: projectedTakes,
    approvedTakeId: validApprovedTake?.take.id ?? null,
    activeCutIds,
    screeningObservations: observations,
    sourceRefs: stableStrings([
      shot.id,
      shot.storyboardArtifactId,
      shot.storyboardDependencyKey,
      ...(shot.roughMotionEvidenceRefs ?? []),
      ...shotCues.flatMap((cue) => [cue.id, ...cue.sourceRefs]),
      ...shotTakes.flatMap((take) => [take.id, take.mediaRef, ...take.provenanceRefs]),
      ...activeCutIds,
      ...observations.map((item) => item.id),
    ]),
  };
}

export function projectRoughCutAnchor(input: {
  readonly production: PrevisProductionState;
  readonly anchorRef: string;
  readonly currentRevision: number;
}): RoughCutAnchorProjection {
  const cuts = newestByCreatedAt((input.production.roughCuts ?? []).filter((cut) => (
    cut.placements.some((placement) => input.production.shots.some((shot) => (
      shot.id === placement.productionShotId && shot.anchorRef === input.anchorRef
    )))
  )));
  const currentCut = cuts[0] ?? null;
  const placementByShot = new Map((currentCut?.placements ?? []).map((placement) => [placement.productionShotId, placement] as const));
  const shots = input.production.shots
    .filter((shot) => shot.anchorRef === input.anchorRef)
    .sort((left, right) => left.order - right.order)
    .flatMap((shot) => {
      const packet = projectPlotPickleProductionPacket({
        production: input.production,
        productionShotId: shot.id,
        currentRevision: input.currentRevision,
      });
      return packet ? [{ shot, packet, placement: placementByShot.get(shot.id) ?? null }] : [];
    });
  return { projectionOnly: true, anchorRef: input.anchorRef, shots, cuts };
}

export function projectScreening(input: {
  readonly production: PrevisProductionState;
  readonly roughCutId?: string;
}): ScreeningProjection {
  const cuts = newestByCreatedAt(input.production.roughCuts ?? []);
  const cut = input.roughCutId
    ? cuts.find((candidate) => candidate.id === input.roughCutId) ?? null
    : cuts[0] ?? null;
  const observations = cut
    ? newestByCreatedAt((input.production.screeningObservations ?? []).filter((item) => item.roughCutId === cut.id))
    : [];
  return {
    projectionOnly: true,
    cut,
    observations,
    unresolved: observations.filter((item) => item.state === "observed"),
  };
}
