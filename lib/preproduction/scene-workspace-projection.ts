import {
  normalizeProjectSourceEvidence,
  type ImportedScreenplayPassage,
} from "../../core/contracts/imported-screenplay-evidence";
import type { LibraryPPFProject } from "../../core/storage/project-library-browser";
import type { PlotPickleProject } from "../projects/project";
import { projectProgressiveProductionLanes } from "./progressive-production-lanes";
import {
  projectSceneTimeline,
  type SceneTimelineProjection,
} from "./scene-timeline-projection";
import type { VisualStoryProjection } from "./visual-story-projection";

export type SceneWorkspaceLane = "dialogue" | "action" | "shot" | "audio";
export type SceneWorkspaceTimingState = "timed" | "unplaced" | "blocked";

export type SceneWorkspaceSourcePassage = {
  readonly id: string;
  readonly sourceRef: string;
  readonly type: string;
  readonly text: string;
  readonly sceneNumber: number;
  readonly blockNumber: number;
  readonly miniBlockNumber: number;
};

export type SceneWorkspaceCue = {
  readonly id: string;
  readonly lane: SceneWorkspaceLane;
  readonly owner: "screenplay" | "previs" | "sequence-director" | "sonic-cue";
  readonly sourceRef: string;
  readonly blockNumber: number;
  readonly miniBlockNumber: number;
  readonly anchorRef: string | null;
  readonly label: string;
  readonly detail: string;
  readonly timingState: SceneWorkspaceTimingState;
  readonly startSecond: number | null;
  readonly endSecond: number | null;
  readonly shotId: string | null;
};

export type SceneWorkspaceProjection = {
  readonly projectionOnly: true;
  readonly sceneId: string | null;
  readonly sceneTitle: string;
  readonly sourceFileName: string;
  readonly sourcePassages: readonly SceneWorkspaceSourcePassage[];
  readonly timeline: SceneTimelineProjection;
  readonly totalSeconds: number;
  readonly cues: readonly SceneWorkspaceCue[];
  readonly dialogue: readonly SceneWorkspaceCue[];
  readonly action: readonly SceneWorkspaceCue[];
  readonly shot: readonly SceneWorkspaceCue[];
  readonly audio: readonly SceneWorkspaceCue[];
};

function sourceSceneNumber(sceneId: string | null) {
  if (!sceneId) return 0;
  const match = /^source-scene:(\d+)$/u.exec(sceneId);
  return match ? Number(match[1]) : 0;
}

function passageBelongsToScene(
  passage: ImportedScreenplayPassage,
  sceneId: string | null,
) {
  if (!sceneId) return false;
  if (passage.sceneId && passage.sceneId === sceneId) return true;
  const sceneNumber = sourceSceneNumber(sceneId);
  return sceneNumber > 0 && passage.sceneNumber === sceneNumber;
}

function sourcePassages(
  project: LibraryPPFProject,
  visualStory: VisualStoryProjection,
): readonly SceneWorkspaceSourcePassage[] {
  const screenplay = normalizeProjectSourceEvidence(project.sourceEvidence).screenplay;
  const sceneId = visualStory.selectedScene?.id ?? null;
  if (!screenplay || !sceneId) return [];

  return screenplay.passages
    .filter((passage) => passageBelongsToScene(passage, sceneId))
    .map((passage) => ({
      id: passage.id,
      sourceRef: `screenplay-passage:${screenplay.sourceFileName}:${passage.id}`,
      type: passage.type,
      text: passage.text,
      sceneNumber: passage.sceneNumber,
      blockNumber: passage.blockNumber,
      miniBlockNumber: passage.miniBlockNumber,
    }));
}

function dialogueCues(passages: readonly SceneWorkspaceSourcePassage[]): SceneWorkspaceCue[] {
  let speaker = "";
  const cues: SceneWorkspaceCue[] = [];
  for (const passage of passages) {
    if (/^character$/iu.test(passage.type)) {
      speaker = passage.text.trim();
      continue;
    }
    if (!/dialogue/iu.test(passage.type)) continue;
    cues.push({
      id: `scene-cue:dialogue:${passage.id}`,
      lane: "dialogue",
      owner: "screenplay",
      sourceRef: passage.sourceRef,
      blockNumber: passage.blockNumber,
      miniBlockNumber: passage.miniBlockNumber,
      anchorRef: null,
      label: speaker || "Dialogue",
      detail: passage.text,
      timingState: "unplaced",
      startSecond: null,
      endSecond: null,
      shotId: null,
    });
  }
  return cues;
}

function actionCues(passages: readonly SceneWorkspaceSourcePassage[]): SceneWorkspaceCue[] {
  return passages
    .filter((passage) => /^(?:action|description)$/iu.test(passage.type))
    .map((passage) => ({
      id: `scene-cue:action:${passage.id}`,
      lane: "action" as const,
      owner: "screenplay" as const,
      sourceRef: passage.sourceRef,
      blockNumber: passage.blockNumber,
      miniBlockNumber: passage.miniBlockNumber,
      anchorRef: null,
      label: "Action",
      detail: passage.text,
      timingState: "unplaced" as const,
      startSecond: null,
      endSecond: null,
      shotId: null,
    }));
}

function shotCues(timeline: SceneTimelineProjection): SceneWorkspaceCue[] {
  return timeline.shots.map((shot) => ({
    id: `scene-cue:shot:${shot.id}`,
    lane: "shot",
    owner: "previs",
    sourceRef: shot.productionShotId
      ? `production-shot:${shot.productionShotId}`
      : `visual-shot:${shot.id}`,
    blockNumber: shot.blockNumber,
    miniBlockNumber: shot.miniBlockNumber,
    anchorRef: shot.anchorRef,
    label: `Shot ${String(shot.order).padStart(2, "0")}`,
    detail: shot.action,
    timingState: shot.positionState === "timed"
      ? "timed"
      : shot.positionState === "blocked-by-untimed-predecessor"
        ? "blocked"
        : "unplaced",
    startSecond: shot.startSecond,
    endSecond: shot.endSecond,
    shotId: shot.id,
  }));
}

function audioCues(
  project: LibraryPPFProject,
  visualStory: VisualStoryProjection,
  legacyProject: PlotPickleProject | null,
): SceneWorkspaceCue[] {
  const lanes = projectProgressiveProductionLanes({ visualStory, legacyProject });
  const selected = visualStory.selectedScene;
  const projectedLegacy = lanes.sound.map((item): SceneWorkspaceCue => {
    const anchor = visualStory.anchors.find((candidate) => (
      candidate.beats.some((beat) => beat.id === item.id)
    )) ?? visualStory.anchors[0] ?? null;
    return {
      id: `scene-cue:audio:${item.id}`,
      lane: "audio",
      owner: item.source,
      sourceRef: `${item.source}:${item.id}`,
      blockNumber: anchor?.blockNumber ?? selected?.blockNumber ?? 1,
      miniBlockNumber: anchor?.miniBlockNumber ?? 1,
      anchorRef: anchor?.anchorRef ?? null,
      label: item.label || "Audio",
      detail: item.detail,
      timingState: item.timingState === "timed" ? "timed" : "unplaced",
      startSecond: item.startSecond,
      endSecond: item.endSecond,
      shotId: null,
    };
  });
  const projectedModern = (project.production.soundCues ?? []).flatMap((cue): SceneWorkspaceCue[] => {
    const anchor = visualStory.anchors.find((candidate) => candidate.anchorRef === cue.anchorRef);
    if (!anchor) return [];
    const timed = cue.startSecond !== null && cue.endSecond !== null;
    return [{
      id: `scene-cue:audio:${cue.id}`,
      lane: "audio",
      owner: "sonic-cue",
      sourceRef: `production-sound:${cue.id}`,
      blockNumber: anchor.blockNumber,
      miniBlockNumber: anchor.miniBlockNumber,
      anchorRef: cue.anchorRef,
      label: cue.kind === "narration" ? "Narration" : cue.kind === "music" ? "Music" : "Foley",
      detail: cue.intent,
      timingState: timed ? "timed" : "unplaced",
      startSecond: timed ? cue.startSecond : null,
      endSecond: timed ? cue.endSecond : null,
      shotId: cue.productionShotId ?? null,
    }];
  });
  const byId = new Map([...projectedModern, ...projectedLegacy].map((cue) => [cue.id, cue] as const));
  return [...byId.values()];
}

/**
 * One read-only synchronization projection over existing screenplay, Storyboard,
 * Previs, Sequence Director and Sonic Cue authorities. Cue layout is not canon.
 * Only edits explicitly routed to an owning authority may persist.
 */
export function projectSceneWorkspace(input: {
  readonly project: LibraryPPFProject;
  readonly visualStory: VisualStoryProjection;
  readonly legacyProject: PlotPickleProject | null;
}): SceneWorkspaceProjection {
  const passages = sourcePassages(input.project, input.visualStory);
  const timeline = projectSceneTimeline(input.visualStory);
  const dialogue = dialogueCues(passages);
  const action = actionCues(passages);
  const shot = shotCues(timeline);
  const audio = audioCues(input.project, input.visualStory, input.legacyProject);
  const cues = [...dialogue, ...action, ...shot, ...audio];
  const timedEnds = cues
    .map((cue) => cue.endSecond)
    .filter((value): value is number => value !== null);
  const totalSeconds = timedEnds.length ? Math.max(...timedEnds) : timeline.totalSeconds;

  return {
    projectionOnly: true,
    sceneId: input.visualStory.selectedScene?.id ?? null,
    sceneTitle: input.visualStory.selectedScene?.title ?? "",
    sourceFileName: normalizeProjectSourceEvidence(input.project.sourceEvidence).screenplay?.sourceFileName ?? "",
    sourcePassages: passages,
    timeline,
    totalSeconds,
    cues,
    dialogue,
    action,
    shot,
    audio,
  };
}