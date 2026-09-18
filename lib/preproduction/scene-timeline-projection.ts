import type {
  VisualStoryFrameProjection,
  VisualStoryProjection,
  VisualStoryShotProjection,
} from "./visual-story-projection";

export type SceneTimelinePositionState = "timed" | "untimed" | "blocked-by-untimed-predecessor";

export type SceneTimelineShotProjection = {
  readonly id: string;
  readonly productionShotId: string | null;
  readonly anchorRef: string;
  readonly blockNumber: number;
  readonly miniBlockNumber: number;
  readonly order: number;
  readonly action: string;
  readonly reviewState: string;
  readonly durationSeconds: number | null;
  readonly startSecond: number | null;
  readonly endSecond: number | null;
  readonly positionState: SceneTimelinePositionState;
  readonly frames: readonly VisualStoryFrameProjection[];
};

export type SceneTimelineAnchorProjection = {
  readonly anchorRef: string;
  readonly blockNumber: number;
  readonly miniBlockNumber: number;
  readonly startSecond: number | null;
  readonly endSecond: number | null;
  readonly positionState: SceneTimelinePositionState;
  readonly shots: readonly SceneTimelineShotProjection[];
  readonly unassignedFrames: readonly VisualStoryFrameProjection[];
};

export type SceneTimelineProjection = {
  readonly projectionOnly: true;
  readonly sceneId: string | null;
  readonly sceneTitle: string;
  readonly totalSeconds: number;
  readonly anchors: readonly SceneTimelineAnchorProjection[];
  readonly shots: readonly SceneTimelineShotProjection[];
  readonly untimedShots: readonly SceneTimelineShotProjection[];
  readonly untimedFrames: readonly VisualStoryFrameProjection[];
  readonly timedShotCount: number;
};

function addressIndex(blockNumber: number, miniBlockNumber: number) {
  return ((blockNumber - 1) * 4) + (miniBlockNumber - 1);
}

function actionText(shot: VisualStoryShotProjection) {
  return shot.narrativePurpose || shot.visualIntent || "Action intent not authored";
}

function uniqueFrames(frames: readonly VisualStoryFrameProjection[]) {
  return frames.filter((frame, index, all) => all.findIndex((candidate) => candidate.id === frame.id) === index);
}

function projectAnchor(
  anchor: VisualStoryProjection["anchors"][number],
  initialCursor: number,
  initialPositionKnown: boolean,
) {
  const anchorStartSecond = initialPositionKnown ? initialCursor : null;
  let cursor = initialCursor;
  let positionKnown = initialPositionKnown;

  const shots = anchor.shots.map((shot) => {
    const durationSeconds = shot.durationSeconds;
    let positionState: SceneTimelinePositionState = positionKnown ? "untimed" : "blocked-by-untimed-predecessor";
    let startSecond: number | null = null;
    let endSecond: number | null = null;

    if (durationSeconds === null) {
      positionKnown = false;
    } else if (positionKnown) {
      positionState = "timed";
      startSecond = cursor;
      endSecond = cursor + durationSeconds;
      cursor = endSecond;
    } else {
      positionState = "blocked-by-untimed-predecessor";
    }

    return {
      id: shot.id,
      productionShotId: shot.productionShotId,
      anchorRef: anchor.anchorRef,
      blockNumber: anchor.blockNumber,
      miniBlockNumber: anchor.miniBlockNumber,
      order: shot.order,
      action: actionText(shot),
      reviewState: shot.reviewState,
      durationSeconds,
      startSecond,
      endSecond,
      positionState,
      frames: shot.frames,
    } satisfies SceneTimelineShotProjection;
  });

  const anchorPositionState: SceneTimelinePositionState = !initialPositionKnown
    ? "blocked-by-untimed-predecessor"
    : shots.some((shot) => shot.positionState !== "timed")
      ? "untimed"
      : "timed";

  return {
    anchor: {
      anchorRef: anchor.anchorRef,
      blockNumber: anchor.blockNumber,
      miniBlockNumber: anchor.miniBlockNumber,
      startSecond: anchorStartSecond,
      endSecond: positionKnown ? cursor : null,
      positionState: anchorPositionState,
      shots,
      unassignedFrames: anchor.unassignedFrames,
    } satisfies SceneTimelineAnchorProjection,
    cursor,
    positionKnown,
  };
}

/**
 * Temporal projection over existing Visual Story / Previs authorities.
 * Only Human-authored ProductionShotIntent durations place material on the clock.
 * If any preceding Shot is untimed, later Shots and later anchors remain unplaced
 * rather than inheriting a synthetic Mini-Block/render-grid timestamp.
 */
export function projectSceneTimeline(visualStory: VisualStoryProjection): SceneTimelineProjection {
  if (!visualStory.selectedScene || !visualStory.anchors.length) {
    return {
      projectionOnly: true,
      sceneId: visualStory.selectedScene?.id ?? null,
      sceneTitle: visualStory.selectedScene?.title ?? "",
      totalSeconds: 0,
      anchors: [],
      shots: [],
      untimedShots: [],
      untimedFrames: [],
      timedShotCount: 0,
    };
  }

  const orderedAnchors = [...visualStory.anchors].sort((left, right) => (
    addressIndex(left.blockNumber, left.miniBlockNumber) - addressIndex(right.blockNumber, right.miniBlockNumber)
  ));
  const anchors: SceneTimelineAnchorProjection[] = [];
  let cursor = 0;
  let positionKnown = true;

  for (const anchor of orderedAnchors) {
    const projected = projectAnchor(anchor, cursor, positionKnown);
    anchors.push(projected.anchor);
    cursor = projected.cursor;
    positionKnown = projected.positionKnown;
  }

  const shots = anchors.flatMap((anchor) => anchor.shots);
  const untimedShots = shots.filter((shot) => shot.positionState !== "timed");
  const untimedFrames = uniqueFrames([
    ...anchors.flatMap((anchor) => anchor.unassignedFrames),
    ...untimedShots.flatMap((shot) => shot.frames),
  ]);
  const timedEnds = shots
    .map((shot) => shot.endSecond)
    .filter((value): value is number => value !== null);
  const totalSeconds = timedEnds.length ? Math.max(...timedEnds) : 0;

  return {
    projectionOnly: true,
    sceneId: visualStory.selectedScene.id,
    sceneTitle: visualStory.selectedScene.title,
    totalSeconds,
    anchors,
    shots,
    untimedShots,
    untimedFrames,
    timedShotCount: shots.filter((shot) => shot.positionState === "timed").length,
  };
}
