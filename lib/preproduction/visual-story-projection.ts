import type { SequenceDirectorDraft } from "../../core/contracts/sequence-director";
import { sequenceDirectorAnchorRef } from "../../core/contracts/sequence-director";
import type { StoryboardEditorialShot, ShotInformationDirective } from "../../core/contracts/storyboard/editorial-shot";
import type { ProductionShotIntent } from "../../core/contracts/previs";
import type { FoundationsVisualArtifact, WorldVisualArtifact } from "../../core/contracts/build-progress";
import type { LibraryPPFProject } from "../../core/storage/project-library-browser";
import type { PlotPickleProject } from "../projects/project";
import {
  projectPreproductionSemantics,
  projectSequenceDirectorBeats,
  type BeatSemanticProjection,
  type SceneSemanticProjection,
} from "./semantic-projection";

export type VisualStoryFrameProjection = {
  readonly id: string;
  readonly anchorRef: string;
  readonly assetUrl: string;
  readonly narrativePurpose: string;
  readonly reviewState: string;
  readonly accepted: boolean;
  readonly source: "foundations" | "world";
  /** Shot-scoped reveal/withhold constraints inherited only when this Frame is linked to that Shot. */
  readonly informationDirectives: readonly ShotInformationDirective[];
};

export type VisualStoryShotProjection = {
  readonly id: string;
  readonly anchorRef: string;
  readonly order: number;
  readonly source: "previs" | "editorial" | "previs+editorial";
  readonly productionShotId: string | null;
  readonly editorialShotId: string | null;
  readonly narrativePurpose: string;
  readonly visualIntent: string;
  readonly shotSize: string;
  readonly angle: string;
  readonly movement: string;
  readonly lens: string;
  readonly lightingIntent: string;
  readonly durationSeconds: number | null;
  readonly transitionIn: string;
  readonly transitionOut: string;
  readonly reviewState: string;
  readonly informationDirectives: readonly ShotInformationDirective[];
  readonly frames: readonly VisualStoryFrameProjection[];
};

export type VisualStoryAnchorProjection = {
  readonly anchorRef: string;
  readonly blockNumber: number;
  readonly miniBlockNumber: number;
  readonly beats: readonly BeatSemanticProjection[];
  readonly shots: readonly VisualStoryShotProjection[];
  readonly frames: readonly VisualStoryFrameProjection[];
  readonly unassignedFrames: readonly VisualStoryFrameProjection[];
};

export type VisualStoryProjection = {
  readonly projectionOnly: true;
  readonly legacyDetailStatus: "matched" | "absent" | "project-id-mismatch";
  readonly scenes: readonly SceneSemanticProjection[];
  readonly selectedScene: SceneSemanticProjection | null;
  readonly anchors: readonly VisualStoryAnchorProjection[];
  readonly counts: {
    readonly beats: number;
    readonly shots: number;
    readonly frames: number;
  };
};

type VisualArtifact = FoundationsVisualArtifact | WorldVisualArtifact;

function artifactTargetsAnchor(artifact: VisualArtifact, anchorRef: string) {
  return (artifact.sourceDecisionKeys ?? []).includes(anchorRef);
}

function projectFrames(project: LibraryPPFProject, anchorRef: string): readonly VisualStoryFrameProjection[] {
  const foundationAccepted = new Set(project.build.foundations.acceptedVisualArtifactIds);
  const worldAccepted = new Set(project.build.world.acceptedVisualArtifactIds);
  const foundationFrames = project.build.foundations.visualArtifacts
    .filter((artifact) => artifactTargetsAnchor(artifact, anchorRef))
    .map((artifact) => ({
      id: artifact.id,
      anchorRef,
      assetUrl: artifact.assetUrl,
      narrativePurpose: artifact.narrativeIntention || "",
      reviewState: artifact.reviewState ?? "draft",
      accepted: artifact.reviewState === "accepted" && foundationAccepted.has(artifact.id),
      source: "foundations" as const,
      informationDirectives: [],
    }));
  const worldFrames = project.build.world.visualArtifacts
    .filter((artifact) => artifactTargetsAnchor(artifact, anchorRef))
    .map((artifact) => ({
      id: artifact.id,
      anchorRef,
      assetUrl: artifact.assetUrl,
      narrativePurpose: artifact.narrativeIntention || "",
      reviewState: artifact.reviewState,
      accepted: artifact.reviewState === "accepted" && worldAccepted.has(artifact.id),
      source: "world" as const,
      informationDirectives: [],
    }));
  return [...foundationFrames, ...worldFrames].sort((left, right) => {
    if (left.accepted !== right.accepted) return left.accepted ? -1 : 1;
    return left.id.localeCompare(right.id);
  });
}

function editorialKey(shot: StoryboardEditorialShot) {
  return `${shot.anchorRef}:${shot.order}`;
}

function productionKey(shot: ProductionShotIntent) {
  return `${shot.anchorRef}:${shot.order}`;
}

function pairedShot(
  production: ProductionShotIntent | null,
  editorial: StoryboardEditorialShot | null,
  frames: readonly VisualStoryFrameProjection[],
): VisualStoryShotProjection {
  const anchorRef = production?.anchorRef ?? editorial?.anchorRef ?? "";
  const order = production?.order ?? editorial?.order ?? 1;
  const seededFrameId = production?.storyboardArtifactId ?? "";
  const informationDirectives = editorial?.informationDirectives ?? [];
  const linkedFrames = seededFrameId
    ? frames
      .filter((frame) => frame.id === seededFrameId)
      .map((frame) => ({ ...frame, informationDirectives }))
    : [];
  return {
    id: editorial?.shotId ?? production?.id ?? `${anchorRef}:shot-${order}`,
    anchorRef,
    order,
    source: production && editorial ? "previs+editorial" : production ? "previs" : "editorial",
    productionShotId: production?.id ?? null,
    editorialShotId: editorial?.shotId ?? null,
    narrativePurpose: editorial?.narrativePurpose ?? "",
    visualIntent: production?.visualIntent ?? "",
    shotSize: editorial?.shotSize || production?.shotSize || "",
    angle: editorial?.cameraAngle || production?.angle || "",
    movement: editorial?.cameraMovement || production?.movement || "",
    lens: editorial?.lensIntent || production?.lens || "",
    lightingIntent: editorial?.lightingIntent ?? "",
    durationSeconds: production?.durationSeconds ?? null,
    transitionIn: production?.transitionIn ?? "",
    transitionOut: production?.transitionOut ?? "",
    reviewState: production?.reviewState ?? "editorial",
    informationDirectives,
    frames: linkedFrames,
  };
}

function projectShots(
  project: LibraryPPFProject,
  anchorRef: string,
  frames: readonly VisualStoryFrameProjection[],
  editorialShots: readonly StoryboardEditorialShot[],
) {
  const production = project.production.shots.filter((shot) => shot.anchorRef === anchorRef);
  const editorial = editorialShots.filter((shot) => shot.anchorRef === anchorRef);
  const editorialByKey = new Map(editorial.map((shot) => [editorialKey(shot), shot]));
  const usedEditorial = new Set<string>();
  const paired = production.map((shot) => {
    const key = productionKey(shot);
    const match = editorialByKey.get(key) ?? null;
    if (match) usedEditorial.add(match.shotId);
    return pairedShot(shot, match, frames);
  });
  const editorialOnly = editorial
    .filter((shot) => !usedEditorial.has(shot.shotId))
    .map((shot) => pairedShot(null, shot, frames));
  return [...paired, ...editorialOnly].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
}

export function projectVisualStory(input: {
  readonly project: LibraryPPFProject;
  readonly legacyProject?: PlotPickleProject | null;
  readonly blockNumber: number;
  readonly miniBlockNumber: number;
  readonly requestedSceneId?: string;
  readonly sequenceDirectorDrafts?: readonly SequenceDirectorDraft[];
  readonly editorialShots?: readonly StoryboardEditorialShot[];
}): VisualStoryProjection {
  const semantics = projectPreproductionSemantics(input.project, input.legacyProject ?? null);
  const selectedRelation = semantics.miniBlockSceneRelations.find((relation) => (
    relation.blockNumber === input.blockNumber && relation.ordinal === input.miniBlockNumber
  ));
  const relatedSceneIds = new Set(selectedRelation?.sceneIds ?? []);
  const scenes = semantics.scenes.filter((scene) => relatedSceneIds.has(scene.id));
  const selectedScene = scenes.find((scene) => scene.id === input.requestedSceneId) ?? scenes[0] ?? null;

  if (!selectedScene) {
    const anchorRef = sequenceDirectorAnchorRef(input.blockNumber, input.miniBlockNumber);
    const drafts = input.sequenceDirectorDrafts ?? [];
    const editorialShots = input.editorialShots ?? [];
    const beats = drafts
      .filter((draft) => draft.anchorRef === anchorRef)
      .flatMap((draft) => projectSequenceDirectorBeats(draft))
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
    const frames = projectFrames(input.project, anchorRef);
    const shots = projectShots(input.project, anchorRef, frames, editorialShots);
    const assignedFrameIds = new Set(shots.flatMap((shot) => shot.frames.map((frame) => frame.id)));
    const anchor: VisualStoryAnchorProjection = {
      anchorRef,
      blockNumber: input.blockNumber,
      miniBlockNumber: input.miniBlockNumber,
      beats,
      shots,
      frames,
      unassignedFrames: frames.filter((frame) => !assignedFrameIds.has(frame.id)),
    };
    return {
      projectionOnly: true,
      legacyDetailStatus: semantics.legacyDetailStatus,
      scenes,
      selectedScene: null,
      anchors: [anchor],
      counts: { beats: beats.length, shots: shots.length, frames: frames.length },
    };
  }

  const sceneRelations = semantics.miniBlockSceneRelations.filter((relation) => relation.sceneIds.includes(selectedScene.id));
  const drafts = input.sequenceDirectorDrafts ?? [];
  const editorialShots = input.editorialShots ?? [];
  const anchors = sceneRelations.map((relation) => {
    const anchorRef = sequenceDirectorAnchorRef(relation.blockNumber, relation.ordinal);
    const beats = drafts
      .filter((draft) => draft.anchorRef === anchorRef)
      .flatMap((draft) => projectSequenceDirectorBeats(draft))
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
    const frames = projectFrames(input.project, anchorRef);
    const shots = projectShots(input.project, anchorRef, frames, editorialShots);
    const assignedFrameIds = new Set(shots.flatMap((shot) => shot.frames.map((frame) => frame.id)));
    return {
      anchorRef,
      blockNumber: relation.blockNumber,
      miniBlockNumber: relation.ordinal,
      beats,
      shots,
      frames,
      unassignedFrames: frames.filter((frame) => !assignedFrameIds.has(frame.id)),
    } satisfies VisualStoryAnchorProjection;
  }).sort((left, right) => left.blockNumber - right.blockNumber || left.miniBlockNumber - right.miniBlockNumber);

  return {
    projectionOnly: true,
    legacyDetailStatus: semantics.legacyDetailStatus,
    scenes,
    selectedScene,
    anchors,
    counts: {
      beats: anchors.reduce((total, anchor) => total + anchor.beats.length, 0),
      shots: anchors.reduce((total, anchor) => total + anchor.shots.length, 0),
      frames: anchors.reduce((total, anchor) => total + anchor.frames.length, 0),
    },
  };
}
