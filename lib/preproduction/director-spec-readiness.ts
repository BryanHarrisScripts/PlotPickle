import type {
  PreproductionProductionIntent,
  PreproductionProductionIntentShot,
} from "./production-intent-handoff";
import type {
  PreproductionAssetReference,
  PreproductionSemanticProjection,
  SceneSemanticProjection,
} from "./semantic-projection";

export type PreproductionSceneDirectorSpecCoverage = {
  readonly sceneIntent: boolean;
  readonly approvedShotPlan: boolean;
  readonly authoredTiming: boolean;
  readonly cameraDirection: boolean;
  readonly blocking: boolean;
  readonly continuity: boolean;
  readonly references: boolean;
  readonly audioIntent: boolean;
  readonly transitions: boolean;
  readonly informationBoundary: boolean;
  readonly provenance: boolean;
};

export type PreproductionSceneDirectorSpecReadiness = {
  readonly version: 1;
  readonly projectId: string;
  readonly canonicalRevision: number;
  readonly providerNeutral: true;
  readonly projectionOnly: true;
  readonly scene: {
    readonly sceneId: string;
    readonly sourceRef: string;
    readonly blockId: string;
    readonly blockNumber: number;
    readonly title: string;
    readonly purpose: string;
    readonly objective: string;
    readonly opposition: string;
    readonly action: string;
    readonly turn: string;
    readonly outcome: string;
    readonly relatedMiniBlockIds: readonly string[];
    readonly assetRefs: readonly PreproductionAssetReference[];
  };
  readonly shots: readonly PreproductionProductionIntentShot[];
  readonly sequenceDurationSeconds: number | null;
  readonly coverage: PreproductionSceneDirectorSpecCoverage;
  readonly readyForDirectorSpec: boolean;
  readonly missingRequired: readonly string[];
  readonly sourceRefs: readonly string[];
};

export type InspectPreproductionSceneDirectorSpecReadinessInput = {
  readonly productionIntent: PreproductionProductionIntent;
  readonly semantics: PreproductionSemanticProjection;
  readonly sceneId: string;
};

function unique(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))].sort();
}

function hasText(value: string) {
  return Boolean(value.trim());
}

function sceneSnapshot(scene: SceneSemanticProjection): PreproductionSceneDirectorSpecReadiness["scene"] {
  return {
    sceneId: scene.id,
    sourceRef: scene.sourceRef,
    blockId: scene.blockId,
    blockNumber: scene.blockNumber,
    title: scene.title,
    purpose: scene.purpose,
    objective: scene.objective,
    opposition: scene.opposition,
    action: scene.action,
    turn: scene.turn,
    outcome: scene.outcome,
    relatedMiniBlockIds: [...scene.relatedMiniBlockIds],
    assetRefs: [...scene.assetRefs],
  };
}

/**
 * #2125 Slice 7 readiness gate for #2064.
 *
 * This is a read-only inspection of the already-approved provider-neutral
 * PRE-PRODUCTION handoff plus the same semantic Scene projection used to build
 * it. It does not create a Director Specification, select a provider, compile
 * prompts/instructions, infer approval, or persist state.
 */
export function inspectPreproductionSceneDirectorSpecReadiness(
  input: InspectPreproductionSceneDirectorSpecReadinessInput,
): PreproductionSceneDirectorSpecReadiness {
  const { productionIntent, semantics, sceneId } = input;

  if (productionIntent.projectId !== semantics.story.projectId) {
    throw new Error("Director Spec readiness inputs belong to different projects.");
  }
  if (productionIntent.canonicalRevision !== semantics.story.canonicalRevision) {
    throw new Error("Director Spec readiness semantics are stale relative to the approved production intent.");
  }
  if (!productionIntent.providerNeutral || !productionIntent.projectionOnly) {
    throw new Error("Director Spec readiness requires the provider-neutral PRE-PRODUCTION projection boundary.");
  }

  const scene = semantics.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) throw new Error(`Scene ${sceneId} is not present in the current PRE-PRODUCTION semantic projection.`);

  const shots = productionIntent.shots
    .filter((shot) => shot.sceneRefs.includes(sceneId))
    .sort((left, right) => left.order - right.order || left.editorialShotId.localeCompare(right.editorialShotId));
  if (!shots.length) {
    throw new Error(`Scene ${sceneId} has no approved Shot in the current PRE-PRODUCTION production intent.`);
  }

  const authoredTiming = shots.every((shot) => (
    shot.execution.durationSeconds !== null
    && Number.isFinite(shot.execution.durationSeconds)
    && shot.execution.durationSeconds > 0
  ));
  const sequenceDurationSeconds = authoredTiming
    ? shots.reduce((total, shot) => total + (shot.execution.durationSeconds ?? 0), 0)
    : null;

  const coverage: PreproductionSceneDirectorSpecCoverage = {
    sceneIntent: [scene.purpose, scene.objective, scene.action, scene.outcome].every(hasText),
    approvedShotPlan: shots.every((shot) => hasText(shot.narrativePurpose)),
    authoredTiming,
    cameraDirection: shots.every((shot) => (
      hasText(shot.camera.shotSize)
      && hasText(shot.camera.angle)
      && hasText(shot.camera.movement)
      && hasText(shot.camera.lensIntent)
      && hasText(shot.camera.lightingIntent)
    )),
    blocking: shots.every((shot) => shot.blocking.length > 0),
    continuity: shots.every((shot) => shot.continuityLockReferences.length > 0),
    references: scene.assetRefs.length > 0 && shots.every((shot) => shot.frameRefs.length > 0 || shot.assetRefs.length > 0),
    audioIntent: shots.some((shot) => shot.audioIntents.some(hasText)),
    transitions: shots.every((shot) => hasText(shot.execution.transitionIn) && hasText(shot.execution.transitionOut)),
    informationBoundary: shots.some((shot) => shot.informationDirectives.length > 0),
    provenance: shots.every((shot) => shot.sourceRefs.length > 0)
      && productionIntent.sourceRefs.length > 0
      && hasText(scene.sourceRef),
  };

  const requiredCoverage: ReadonlyArray<keyof PreproductionSceneDirectorSpecCoverage> = [
    "sceneIntent",
    "approvedShotPlan",
    "authoredTiming",
    "cameraDirection",
    "references",
    "provenance",
  ];
  const missingRequired = requiredCoverage.filter((key) => !coverage[key]);

  return {
    version: 1,
    projectId: productionIntent.projectId,
    canonicalRevision: productionIntent.canonicalRevision,
    providerNeutral: true,
    projectionOnly: true,
    scene: sceneSnapshot(scene),
    shots,
    sequenceDurationSeconds,
    coverage,
    readyForDirectorSpec: missingRequired.length === 0,
    missingRequired,
    sourceRefs: unique([
      ...productionIntent.sourceRefs,
      scene.id,
      scene.sourceRef,
      ...scene.relatedMiniBlockIds,
      ...scene.assetRefs.map((asset) => asset.id),
      ...shots.flatMap((shot) => shot.sourceRefs),
    ]),
  };
}
