import type { SequenceDirectorDraft } from "../../core/contracts/sequence-director";
import type { PPFProject } from "../../core/project/project";
import type { StoryStructureV2 } from "../../core/project/story-structure-v2";
import type { PlotPickleProject, StoryScene } from "../projects/project";

export type CanonicalPreproductionProject = PPFProject & {
  readonly structure: StoryStructureV2;
};

export type PreproductionAssetReference = {
  readonly kind: "character" | "location";
  readonly id: string;
};

export type StorySemanticProjection = {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly canonicalRevision: number;
  readonly premise: string;
  readonly logline: string;
  readonly theme: string;
};

export type StructureBlockProjection = {
  readonly id: string;
  readonly number: number;
  readonly actNumber: number;
  readonly sequenceNumber: number;
  readonly miniBlockIds: readonly string[];
};

export type SceneSemanticProjection = {
  readonly id: string;
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

export type MiniBlockSceneRelation = {
  readonly miniBlockId: string;
  readonly blockId: string;
  readonly blockNumber: number;
  readonly ordinal: number;
  readonly sceneIds: readonly string[];
  readonly sourceMiniBlockIds: readonly string[];
};

export type BeatSemanticProjection = {
  readonly id: string;
  readonly anchorRef: string;
  readonly order: number;
  readonly label: string;
  readonly purpose: string;
  readonly visualAction: string;
  readonly cameraIntent: string;
  readonly continuityIn: string;
  readonly continuityOut: string;
  readonly soundIntent: string;
  readonly startSecond: number | null;
  readonly endSecond: number | null;
};

export type FrameSemanticProjection = {
  readonly frameId: string;
  readonly anchorRef: string;
  readonly storyboardArtifactId: string;
  readonly storyboardDependencyKey: string;
  readonly narrativePurpose: string;
};

export type TimingSemanticProjection = {
  readonly productionShotId: string;
  readonly anchorRef: string;
  readonly order: number;
  readonly durationSeconds: number | null;
  readonly transitionIn: string;
  readonly transitionOut: string;
  readonly reviewState: string;
};

export type ProductionInstructionProjection = {
  readonly projectId: string;
  readonly canonicalRevision: number;
  readonly providerNeutral: true;
  readonly storyboardFrameRefs: readonly string[];
  readonly productionShotRefs: readonly string[];
  readonly approvedProductionShotRefs: readonly string[];
};

export type PreproductionSemanticProjection = {
  readonly story: StorySemanticProjection;
  readonly blocks: readonly StructureBlockProjection[];
  readonly scenes: readonly SceneSemanticProjection[];
  readonly miniBlockSceneRelations: readonly MiniBlockSceneRelation[];
  readonly legacyDetailStatus: "matched" | "absent" | "project-id-mismatch";
};

function unique(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))];
}

function legacyMatches(canonical: CanonicalPreproductionProject, legacy: PlotPickleProject | null) {
  return Boolean(legacy && legacy.id === canonical.id);
}

function canonicalMiniForLegacy(
  structure: StoryStructureV2,
  blockNumber: number,
  localMiniNumber: number,
) {
  return structure.blocks
    .find((block) => block.number === blockNumber)
    ?.miniBlocks.find((mini) => mini.ordinal === localMiniNumber) ?? null;
}

function projectScene(
  canonical: CanonicalPreproductionProject,
  blockNumber: number,
  scene: StoryScene,
): SceneSemanticProjection {
  const block = canonical.structure.blocks.find((candidate) => candidate.number === blockNumber);
  const relatedMiniBlockIds = unique(scene.miniBlocks.flatMap((mini) => {
    const canonicalMini = canonicalMiniForLegacy(canonical.structure, blockNumber, mini.number);
    return canonicalMini ? [canonicalMini.id] : [];
  }));
  const assetRefs: PreproductionAssetReference[] = [
    ...scene.characterIds.map((id) => ({ kind: "character" as const, id })),
    ...scene.locationIds.map((id) => ({ kind: "location" as const, id })),
  ];
  return {
    id: scene.id,
    sourceRef: `legacy-scene:${scene.id}`,
    blockId: block?.id ?? `block-${String(blockNumber).padStart(2, "0")}`,
    blockNumber,
    title: scene.title,
    purpose: scene.purpose,
    objective: scene.objective,
    opposition: scene.opposition || scene.conflict,
    action: scene.action,
    turn: scene.turn || scene.reversal,
    outcome: scene.outcome || scene.resolution,
    relatedMiniBlockIds,
    assetRefs,
  };
}

/**
 * Read-only adapter between the current revisioned PPF structure and optional
 * richer legacy authored Scene detail. It never rewrites either storage model.
 */
export function projectPreproductionSemantics(
  canonical: CanonicalPreproductionProject,
  legacy: PlotPickleProject | null = null,
): PreproductionSemanticProjection {
  const matched = legacyMatches(canonical, legacy);
  const scenes = matched
    ? legacy!.blocks.flatMap((block) => block.scenes.map((scene) => projectScene(canonical, block.number, scene)))
    : [];
  const scenesByMini = new Map<string, { sceneIds: string[]; sourceMiniBlockIds: string[] }>();

  if (matched) {
    for (const block of legacy!.blocks) {
      for (const scene of block.scenes) {
        for (const mini of scene.miniBlocks) {
          const canonicalMini = canonicalMiniForLegacy(canonical.structure, block.number, mini.number);
          if (!canonicalMini) continue;
          const entry = scenesByMini.get(canonicalMini.id) ?? { sceneIds: [], sourceMiniBlockIds: [] };
          entry.sceneIds.push(scene.id);
          entry.sourceMiniBlockIds.push(mini.id);
          scenesByMini.set(canonicalMini.id, entry);
        }
      }
    }
  }

  const miniBlockSceneRelations = canonical.structure.blocks.flatMap((block) => block.miniBlocks.map((mini) => {
    const relation = scenesByMini.get(mini.id);
    return {
      miniBlockId: mini.id,
      blockId: block.id,
      blockNumber: block.number,
      ordinal: mini.ordinal,
      sceneIds: unique(relation?.sceneIds ?? []),
      sourceMiniBlockIds: unique(relation?.sourceMiniBlockIds ?? []),
    } satisfies MiniBlockSceneRelation;
  }));

  return {
    story: {
      id: `${canonical.id}:story`,
      projectId: canonical.id,
      title: canonical.title,
      canonicalRevision: canonical.revision,
      premise: matched ? legacy!.story.premise : "",
      logline: matched ? legacy!.story.logline : "",
      theme: matched ? legacy!.story.theme : "",
    },
    blocks: canonical.structure.blocks.map((block) => ({
      id: block.id,
      number: block.number,
      actNumber: block.actNumber,
      sequenceNumber: block.sequenceNumber,
      miniBlockIds: block.miniBlocks.map((mini) => mini.id),
    })),
    scenes,
    miniBlockSceneRelations,
    legacyDetailStatus: matched ? "matched" : legacy ? "project-id-mismatch" : "absent",
  };
}

/** Reuse SequenceDirectorBeat as Beat semantics; no Beat store is introduced. */
export function projectSequenceDirectorBeats(draft: SequenceDirectorDraft): readonly BeatSemanticProjection[] {
  return draft.beats.map((beat) => ({
    id: beat.id,
    anchorRef: draft.anchorRef,
    order: beat.order,
    label: beat.label,
    purpose: beat.purpose,
    visualAction: beat.visualAction,
    cameraIntent: beat.cameraIntent,
    continuityIn: beat.continuityIn,
    continuityOut: beat.continuityOut,
    soundIntent: beat.soundIntent,
    startSecond: beat.startSecond,
    endSecond: beat.endSecond,
  }));
}

/** Frame semantics are a projection over the accepted Storyboard artifact/anchor. */
export function projectStoryboardFrame(input: FrameSemanticProjection): FrameSemanticProjection {
  return { ...input };
}

/** Timing stays owned by current PPF ProductionShotIntent. */
export function projectPrevisTiming(project: PPFProject): readonly TimingSemanticProjection[] {
  return project.production.shots.map((shot) => ({
    productionShotId: shot.id,
    anchorRef: shot.anchorRef,
    order: shot.order,
    durationSeconds: shot.durationSeconds,
    transitionIn: shot.transitionIn,
    transitionOut: shot.transitionOut,
    reviewState: shot.reviewState,
  }));
}

/**
 * Production Instruction remains a provider-neutral handoff view. It does not
 * persist provider prompt prose or create a second production-plan authority.
 */
export function projectProductionInstruction(
  project: PPFProject,
  storyboardFrameRefs: readonly string[] = [],
): ProductionInstructionProjection {
  return {
    projectId: project.id,
    canonicalRevision: project.revision,
    providerNeutral: true,
    storyboardFrameRefs: unique(storyboardFrameRefs),
    productionShotRefs: project.production.shots.map((shot) => shot.id),
    approvedProductionShotRefs: project.production.shots
      .filter((shot) => shot.reviewState === "approved")
      .map((shot) => shot.id),
  };
}
