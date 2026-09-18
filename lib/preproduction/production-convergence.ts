import type { StoryboardEditorialShot } from "../../core/contracts/storyboard/editorial-shot";
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
