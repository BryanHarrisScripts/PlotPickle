import type { PlotPickleProject } from "../projects/project";
import { projectSceneTimeline } from "./scene-timeline-projection";
import type { VisualStoryProjection } from "./visual-story-projection";

export type ProgressiveLaneTimingState = "timed" | "unplaced";

export type DialogueLaneItem = {
  readonly id: string;
  readonly speaker: string;
  readonly text: string;
  readonly elementType: "dialogue" | "dual-dialogue";
  readonly blockNumber: number;
  readonly miniBlockNumber: number;
  readonly timingState: "unplaced";
};

export type SoundLaneItem = {
  readonly id: string;
  readonly source: "sequence-director" | "sonic-cue";
  readonly label: string;
  readonly detail: string;
  readonly category: string;
  readonly cueIn: string;
  readonly cueOut: string;
  readonly durationSeconds: number | null;
  readonly startSecond: number | null;
  readonly endSecond: number | null;
  readonly timingState: ProgressiveLaneTimingState;
};

export type CameraLaneItem = {
  readonly id: string;
  readonly shotId: string;
  readonly detail: string;
  readonly startSecond: number | null;
  readonly endSecond: number | null;
  readonly timingState: ProgressiveLaneTimingState;
};

export type TransitionLaneItem = {
  readonly id: string;
  readonly shotId: string;
  readonly detail: string;
  readonly startSecond: number | null;
  readonly endSecond: number | null;
  readonly timingState: ProgressiveLaneTimingState;
};

export type ProgressiveProductionLaneProjection = {
  readonly projectionOnly: true;
  readonly sceneId: string | null;
  readonly totalSeconds: number;
  readonly dialogue: readonly DialogueLaneItem[];
  readonly sound: readonly SoundLaneItem[];
  readonly camera: readonly CameraLaneItem[];
  readonly transitions: readonly TransitionLaneItem[];
};

function legacySceneIsCurrent(visualStory: VisualStoryProjection, legacyProject: PlotPickleProject | null) {
  return Boolean(
    visualStory.selectedScene
    && visualStory.legacyDetailStatus === "matched"
    && legacyProject,
  );
}

function dialogueItems(visualStory: VisualStoryProjection, legacyProject: PlotPickleProject | null): readonly DialogueLaneItem[] {
  if (!legacySceneIsCurrent(visualStory, legacyProject) || !visualStory.selectedScene || !legacyProject) return [];
  const sceneElements = legacyProject.screenplay.draftElements.filter((element) => (
    !element.omitted && element.sceneId === visualStory.selectedScene?.id
  ));
  let speaker = "";
  const dialogue: DialogueLaneItem[] = [];
  for (const element of sceneElements) {
    if (element.type === "character") {
      speaker = element.text.trim();
      continue;
    }
    if (element.type !== "dialogue" && element.type !== "dual-dialogue") continue;
    dialogue.push({
      id: element.id,
      speaker,
      text: element.text,
      elementType: element.type,
      blockNumber: element.blockNumber,
      miniBlockNumber: element.miniBlockNumber,
      timingState: "unplaced",
    });
  }
  return dialogue;
}

function soundItems(
  visualStory: VisualStoryProjection,
  legacyProject: PlotPickleProject | null,
): readonly SoundLaneItem[] {
  const timeline = projectSceneTimeline(visualStory);
  const anchorByRef = new Map(timeline.anchors.map((anchor) => [anchor.anchorRef, anchor]));
  const beatSound = visualStory.anchors.flatMap((anchor) => {
    const timelineAnchor = anchorByRef.get(anchor.anchorRef);
    if (!timelineAnchor) return [];
    return anchor.beats.flatMap((beat) => {
      const detail = beat.soundIntent.trim();
      if (!detail) return [];
      const timed = (
        beat.startSecond !== null
        && beat.endSecond !== null
        && timelineAnchor.startSecond !== null
      );
      const startSecond = timed ? timelineAnchor.startSecond! + beat.startSecond! : null;
      const endSecond = timed ? timelineAnchor.startSecond! + beat.endSecond! : null;
      return [{
        id: beat.id,
        source: "sequence-director" as const,
        label: beat.label || `Beat ${beat.order}`,
        detail,
        category: "sound-intent",
        cueIn: "",
        cueOut: "",
        durationSeconds: timed ? beat.endSecond! - beat.startSecond! : null,
        startSecond,
        endSecond,
        timingState: timed ? "timed" as const : "unplaced" as const,
      }];
    });
  });

  const sonicCues = legacySceneIsCurrent(visualStory, legacyProject) && visualStory.selectedScene && legacyProject
    ? legacyProject.production.cues
      .filter((cue) => cue.sceneId === visualStory.selectedScene?.id)
      .map((cue) => ({
        id: cue.id,
        source: "sonic-cue" as const,
        label: cue.title || cue.cueNumber || cue.id,
        detail: cue.purpose || cue.motif || cue.notes,
        category: cue.type,
        cueIn: cue.cueIn,
        cueOut: cue.cueOut,
        durationSeconds: cue.durationSeconds > 0 ? cue.durationSeconds : null,
        startSecond: null,
        endSecond: null,
        timingState: "unplaced" as const,
      }))
    : [];

  return [...beatSound, ...sonicCues];
}

function cameraItems(visualStory: VisualStoryProjection): readonly CameraLaneItem[] {
  const timeline = projectSceneTimeline(visualStory);
  const timelineById = new Map(timeline.shots.map((shot) => [shot.id, shot]));
  return visualStory.anchors.flatMap((anchor) => anchor.shots.flatMap((shot) => {
    const detail = [shot.shotSize, shot.angle, shot.movement, shot.lens, shot.lightingIntent]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(" · ");
    if (!detail) return [];
    const timedShot = timelineById.get(shot.id);
    const timed = Boolean(timedShot && timedShot.startSecond !== null && timedShot.endSecond !== null);
    return [{
      id: `${shot.id}:camera`,
      shotId: shot.id,
      detail,
      startSecond: timed ? timedShot!.startSecond : null,
      endSecond: timed ? timedShot!.endSecond : null,
      timingState: timed ? "timed" as const : "unplaced" as const,
    }];
  }));
}

function transitionItems(visualStory: VisualStoryProjection): readonly TransitionLaneItem[] {
  const timeline = projectSceneTimeline(visualStory);
  const timelineById = new Map(timeline.shots.map((shot) => [shot.id, shot]));
  return visualStory.anchors.flatMap((anchor) => anchor.shots.flatMap((shot) => {
    const parts = [
      shot.transitionIn.trim() ? `IN: ${shot.transitionIn.trim()}` : "",
      shot.transitionOut.trim() ? `OUT: ${shot.transitionOut.trim()}` : "",
    ].filter(Boolean);
    if (!parts.length) return [];
    const timedShot = timelineById.get(shot.id);
    const timed = Boolean(timedShot && timedShot.startSecond !== null && timedShot.endSecond !== null);
    return [{
      id: `${shot.id}:transition`,
      shotId: shot.id,
      detail: parts.join(" · "),
      startSecond: timed ? timedShot!.startSecond : null,
      endSecond: timed ? timedShot!.endSecond : null,
      timingState: timed ? "timed" as const : "unplaced" as const,
    }];
  }));
}

/**
 * Read-only progressive production context for #2125 Slice 4.
 * Existing owners remain authoritative: screenplay elements, Sequence Director
 * Beats / Sonic Cues, editorial/Previs camera fields and Previs transitions.
 * Missing timing stays unplaced; this projection never manufactures timestamps.
 */
export function projectProgressiveProductionLanes(input: {
  readonly visualStory: VisualStoryProjection;
  readonly legacyProject: PlotPickleProject | null;
}): ProgressiveProductionLaneProjection {
  const timeline = projectSceneTimeline(input.visualStory);
  return {
    projectionOnly: true,
    sceneId: input.visualStory.selectedScene?.id ?? null,
    totalSeconds: timeline.totalSeconds,
    dialogue: dialogueItems(input.visualStory, input.legacyProject),
    sound: soundItems(input.visualStory, input.legacyProject),
    camera: cameraItems(input.visualStory),
    transitions: transitionItems(input.visualStory),
  };
}
