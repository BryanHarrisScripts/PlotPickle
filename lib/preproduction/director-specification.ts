import type { ShotInformationDirective, StoryboardEditorialBlocking } from "../../core/contracts/storyboard/editorial-shot";
import type { PreproductionAssetReference } from "./semantic-projection";
import type { PreproductionSceneDirectorSpecReadiness } from "./director-spec-readiness";

export type DirectorSpecificationDirectionLevel = "automatic" | "directed" | "production";

export type DirectorSpecificationShot = {
  readonly editorialShotId: string;
  readonly productionShotId: string;
  readonly anchorRef: string;
  readonly order: number;
  readonly narrativePurpose: string;
  readonly durationSeconds: number;
  readonly camera: {
    readonly shotSize: string;
    readonly angle: string;
    readonly movement: string;
    readonly lensIntent: string;
    readonly lightingIntent: string;
  };
  readonly blocking: readonly StoryboardEditorialBlocking[];
  readonly continuityLockReferences: readonly string[];
  readonly informationDirectives: readonly ShotInformationDirective[];
  readonly audioIntents: readonly string[];
  readonly frameRefs: readonly string[];
  readonly assetRefs: readonly PreproductionAssetReference[];
  readonly transitionIn: string;
  readonly transitionOut: string;
  readonly sourceRefs: readonly string[];
};

/**
 * Provider-neutral production direction compiled from approved PlotPickle state.
 *
 * This specification is an execution input, not creative canon. It contains no
 * provider choice and no generated provider prompt/instruction prose. Provider
 * capability classification and provider-specific instruction compilation are
 * downstream #2064 phases.
 */
export type DirectorSpecification = {
  readonly version: 1;
  readonly providerNeutral: true;
  readonly projectId: string;
  readonly canonicalRevision: number;
  readonly directionLevel: DirectorSpecificationDirectionLevel;
  readonly scene: {
    readonly sceneId: string;
    readonly title: string;
    readonly purpose: string;
    readonly objective: string;
    readonly opposition: string;
    readonly action: string;
    readonly turn: string;
    readonly outcome: string;
    readonly assetRefs: readonly PreproductionAssetReference[];
  };
  readonly sequenceDurationSeconds: number;
  readonly shots: readonly DirectorSpecificationShot[];
  readonly sourceRefs: readonly string[];
};

export type CompileDirectorSpecificationInput = {
  readonly readiness: PreproductionSceneDirectorSpecReadiness;
  readonly directionLevel?: DirectorSpecificationDirectionLevel;
};

function stableStrings(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))].sort();
}

function assertReady(readiness: PreproductionSceneDirectorSpecReadiness) {
  if (!readiness.providerNeutral || !readiness.projectionOnly) {
    throw new Error("Director Specification requires the provider-neutral PRE-PRODUCTION readiness boundary.");
  }
  if (!readiness.readyForDirectorSpec) {
    const missing = readiness.missingRequired.length ? readiness.missingRequired.join(", ") : "unknown readiness";
    throw new Error(`Director Specification input is not ready: ${missing}.`);
  }
  if (!readiness.shots.length) {
    throw new Error("Director Specification requires at least one approved Shot.");
  }
  if (
    readiness.sequenceDurationSeconds === null
    || !Number.isFinite(readiness.sequenceDurationSeconds)
    || readiness.sequenceDurationSeconds <= 0
  ) {
    throw new Error("Director Specification requires authored positive Scene timing.");
  }
}

/**
 * Compile approved, inspectable PRE-PRODUCTION state into the first #2064
 * provider-neutral Director Specification boundary.
 *
 * The function is deterministic and read-only. It does not select a provider,
 * consult #2106 routing, compile prompt prose, call a model, or persist state.
 */
export function compileDirectorSpecification(
  input: CompileDirectorSpecificationInput,
): DirectorSpecification {
  const { readiness } = input;
  assertReady(readiness);

  const directionLevel = input.directionLevel ?? "directed";
  const shots = readiness.shots.map((shot): DirectorSpecificationShot => {
    const durationSeconds = shot.execution.durationSeconds;
    if (durationSeconds === null || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new Error(`Approved Shot ${shot.editorialShotId} is missing authored positive timing.`);
    }

    return {
      editorialShotId: shot.editorialShotId,
      productionShotId: shot.execution.productionShotId,
      anchorRef: shot.anchorRef,
      order: shot.order,
      narrativePurpose: shot.narrativePurpose,
      durationSeconds,
      camera: { ...shot.camera },
      blocking: [...shot.blocking],
      continuityLockReferences: [...shot.continuityLockReferences],
      informationDirectives: [...shot.informationDirectives],
      audioIntents: [...shot.audioIntents],
      frameRefs: [...shot.frameRefs],
      assetRefs: [...shot.assetRefs],
      transitionIn: shot.execution.transitionIn,
      transitionOut: shot.execution.transitionOut,
      sourceRefs: [...shot.sourceRefs],
    };
  });

  return {
    version: 1,
    providerNeutral: true,
    projectId: readiness.projectId,
    canonicalRevision: readiness.canonicalRevision,
    directionLevel,
    scene: {
      sceneId: readiness.scene.sceneId,
      title: readiness.scene.title,
      purpose: readiness.scene.purpose,
      objective: readiness.scene.objective,
      opposition: readiness.scene.opposition,
      action: readiness.scene.action,
      turn: readiness.scene.turn,
      outcome: readiness.scene.outcome,
      assetRefs: [...readiness.scene.assetRefs],
    },
    sequenceDurationSeconds: readiness.sequenceDurationSeconds!,
    shots,
    sourceRefs: stableStrings([
      ...readiness.sourceRefs,
      readiness.scene.sceneId,
      readiness.scene.sourceRef,
      ...shots.flatMap((shot) => shot.sourceRefs),
    ]),
  };
}
