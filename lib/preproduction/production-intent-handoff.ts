import { productionReadyShotInformationErrors } from "../../core/contracts/storyboard/editorial-shot";
import type { ProductionShotIntent } from "../../core/contracts/previs";
import type { StoryboardEditorialShot, ShotInformationDirective, StoryboardEditorialBlocking } from "../../core/contracts/storyboard/editorial-shot";
import type {
  BeatSemanticProjection,
  CanonicalPreproductionProject,
  FrameSemanticProjection,
  PreproductionAssetReference,
  PreproductionSemanticProjection,
  SceneSemanticProjection,
} from "./semantic-projection";

export type PreproductionProductionIntentCamera = {
  readonly shotSize: string;
  readonly angle: string;
  readonly movement: string;
  readonly lensIntent: string;
  readonly lightingIntent: string;
};

export type PreproductionProductionIntentExecution = {
  readonly productionShotId: string;
  readonly storyboardArtifactId: string;
  readonly storyboardDependencyKey: string;
  readonly visualIntent: string;
  readonly durationSeconds: number | null;
  readonly transitionIn: string;
  readonly transitionOut: string;
};

export type PreproductionProductionIntentShot = {
  readonly editorialShotId: string;
  readonly anchorRef: string;
  readonly order: number;
  readonly narrativePurpose: string;
  readonly camera: PreproductionProductionIntentCamera;
  readonly blocking: readonly StoryboardEditorialBlocking[];
  readonly continuityLockReferences: readonly string[];
  readonly informationDirectives: readonly ShotInformationDirective[];
  readonly beatRefs: readonly string[];
  readonly audioIntents: readonly string[];
  readonly frameRefs: readonly string[];
  readonly sceneRefs: readonly string[];
  readonly assetRefs: readonly PreproductionAssetReference[];
  readonly execution: PreproductionProductionIntentExecution;
  readonly sourceRefs: readonly string[];
};

/**
 * Read-only, provider-neutral production intent handed from #2092 to #2064.
 * It is assembled from existing Human-approved authorities and is never a new
 * canon store or provider-instruction/prompt authority.
 */
export type PreproductionProductionIntent = {
  readonly version: 1;
  readonly projectId: string;
  readonly canonicalRevision: number;
  readonly providerNeutral: true;
  readonly projectionOnly: true;
  readonly story: {
    readonly storyRef: string;
    readonly title: string;
    readonly premise: string;
    readonly logline: string;
    readonly theme: string;
  };
  readonly shots: readonly PreproductionProductionIntentShot[];
  readonly sourceRefs: readonly string[];
};

export type AssemblePreproductionProductionIntentInput = {
  readonly project: CanonicalPreproductionProject;
  readonly semantics: PreproductionSemanticProjection;
  /** Caller supplies Storyboard Shots already kept/approved by the current Storyboard authority. */
  readonly approvedEditorialShots: readonly StoryboardEditorialShot[];
  readonly beats?: readonly BeatSemanticProjection[];
  readonly frames?: readonly FrameSemanticProjection[];
};

type AnchorAddress = {
  readonly blockId: string;
  readonly miniOrdinal: number;
  readonly miniBlockId: string;
};

function stableStrings(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))].sort();
}

function stableAssetRefs(values: readonly PreproductionAssetReference[]) {
  const keyed = new Map<string, PreproductionAssetReference>();
  for (const value of values) {
    if (!value.id) continue;
    keyed.set(`${value.kind}:${value.id}`, value);
  }
  return [...keyed.values()].sort((left, right) => `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`));
}

function stableKey(anchorRef: string, order: number) {
  return `${anchorRef}::${order}`;
}

function anchorAddress(project: CanonicalPreproductionProject, anchorRef: string): AnchorAddress | null {
  const match = /^storyboard-anchor:block:(block-\d{2}):mini-([1-4])$/.exec(anchorRef);
  if (!match) return null;
  const block = project.structure.blocks.find((candidate) => candidate.id === match[1]);
  const miniOrdinal = Number(match[2]);
  const mini = block?.miniBlocks.find((candidate) => candidate.ordinal === miniOrdinal);
  return block && mini ? { blockId: block.id, miniOrdinal, miniBlockId: mini.id } : null;
}

function scenesForAnchor(
  project: CanonicalPreproductionProject,
  semantics: PreproductionSemanticProjection,
  anchorRef: string,
): readonly SceneSemanticProjection[] {
  const address = anchorAddress(project, anchorRef);
  if (!address) return [];
  const relation = semantics.miniBlockSceneRelations.find((candidate) => candidate.miniBlockId === address.miniBlockId);
  if (!relation) return [];
  const ids = new Set(relation.sceneIds);
  return semantics.scenes.filter((scene) => ids.has(scene.id));
}

function assertUniqueByAnchorAndOrder<T extends { readonly anchorRef: string; readonly order: number }>(
  values: readonly T[],
  label: string,
) {
  const seen = new Set<string>();
  for (const value of values) {
    const key = stableKey(value.anchorRef, value.order);
    if (seen.has(key)) throw new Error(`${label} contains an ambiguous duplicate at ${key}.`);
    seen.add(key);
  }
}

function shotSources(input: {
  editorial: StoryboardEditorialShot;
  execution: ProductionShotIntent;
  beats: readonly BeatSemanticProjection[];
  frames: readonly FrameSemanticProjection[];
  scenes: readonly SceneSemanticProjection[];
  assets: readonly PreproductionAssetReference[];
}) {
  return stableStrings([
    input.editorial.shotId,
    input.execution.id,
    input.execution.anchorRef,
    input.execution.storyboardArtifactId,
    ...input.editorial.continuityLockReferences,
    ...input.editorial.informationDirectives.map((directive) => directive.sourceRef),
    ...input.beats.map((beat) => beat.id),
    ...input.frames.map((frame) => frame.frameId),
    ...input.scenes.map((scene) => scene.id),
    ...input.assets.map((asset) => asset.id),
  ]);
}

/**
 * Assemble only execution-ready pre-production state. The function does not
 * infer Human approval, select a provider, compile provider instructions, or
 * persist anything. Storyboard Shot ↔ Previs Shot pairing is deterministic by
 * the existing shared anchor + variable shot order and fails closed on ambiguity.
 */
export function assemblePreproductionProductionIntent(
  input: AssemblePreproductionProductionIntentInput,
): PreproductionProductionIntent {
  const { project, semantics } = input;
  if (semantics.story.projectId !== project.id) {
    throw new Error("PRE-PRODUCTION production intent semantics belong to a different project.");
  }
  if (semantics.story.canonicalRevision !== project.revision) {
    throw new Error("PRE-PRODUCTION production intent semantics are stale relative to the current PPF revision.");
  }

  const editorialShots = [...input.approvedEditorialShots];
  const approvedProductionShots = project.production.shots.filter((shot) => shot.reviewState === "approved");
  assertUniqueByAnchorAndOrder(editorialShots, "Approved Storyboard Shots");
  assertUniqueByAnchorAndOrder(approvedProductionShots, "Approved Previs Production Shots");
  if (!approvedProductionShots.length) {
    throw new Error("PRE-PRODUCTION production intent requires at least one approved Previs Production Shot.");
  }

  const editorialByKey = new Map(editorialShots.map((shot) => [stableKey(shot.anchorRef, shot.order), shot] as const));
  const beats = input.beats ?? [];
  const frames = input.frames ?? [];

  const shots = approvedProductionShots
    .map((execution): PreproductionProductionIntentShot => {
      const key = stableKey(execution.anchorRef, execution.order);
      const editorial = editorialByKey.get(key);
      if (!editorial) {
        throw new Error(`Approved Previs Production Shot ${execution.id} has no approved Storyboard Shot at ${key}.`);
      }
      const informationErrors = productionReadyShotInformationErrors(editorial);
      if (informationErrors.length) {
        throw new Error(`Storyboard Shot ${editorial.shotId} is not production-ready: ${informationErrors.join("; ")}`);
      }

      const shotBeats = beats
        .filter((beat) => beat.anchorRef === execution.anchorRef)
        .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
      const shotFrames = frames
        .filter((frame) => frame.storyboardArtifactId === execution.storyboardArtifactId)
        .sort((left, right) => left.frameId.localeCompare(right.frameId));
      const scenes = scenesForAnchor(project, semantics, execution.anchorRef);
      const assets = stableAssetRefs(scenes.flatMap((scene) => scene.assetRefs));
      const audioIntents = stableStrings(shotBeats.map((beat) => beat.soundIntent));

      return {
        editorialShotId: editorial.shotId,
        anchorRef: execution.anchorRef,
        order: execution.order,
        narrativePurpose: editorial.narrativePurpose,
        camera: {
          shotSize: editorial.shotSize || execution.shotSize,
          angle: editorial.cameraAngle || execution.angle,
          movement: editorial.cameraMovement || execution.movement,
          lensIntent: editorial.lensIntent || execution.lens,
          lightingIntent: editorial.lightingIntent,
        },
        blocking: editorial.blocking,
        continuityLockReferences: stableStrings(editorial.continuityLockReferences),
        informationDirectives: editorial.informationDirectives,
        beatRefs: shotBeats.map((beat) => beat.id),
        audioIntents,
        frameRefs: shotFrames.map((frame) => frame.frameId),
        sceneRefs: stableStrings(scenes.map((scene) => scene.id)),
        assetRefs: assets,
        execution: {
          productionShotId: execution.id,
          storyboardArtifactId: execution.storyboardArtifactId,
          storyboardDependencyKey: execution.storyboardDependencyKey,
          visualIntent: execution.visualIntent,
          durationSeconds: execution.durationSeconds,
          transitionIn: execution.transitionIn,
          transitionOut: execution.transitionOut,
        },
        sourceRefs: shotSources({ editorial, execution, beats: shotBeats, frames: shotFrames, scenes, assets }),
      };
    })
    .sort((left, right) => left.anchorRef.localeCompare(right.anchorRef) || left.order - right.order);

  return {
    version: 1,
    projectId: project.id,
    canonicalRevision: project.revision,
    providerNeutral: true,
    projectionOnly: true,
    story: {
      storyRef: semantics.story.id,
      title: semantics.story.title,
      premise: semantics.story.premise,
      logline: semantics.story.logline,
      theme: semantics.story.theme,
    },
    shots,
    sourceRefs: stableStrings([
      semantics.story.id,
      ...shots.flatMap((shot) => shot.sourceRefs),
    ]),
  };
}
