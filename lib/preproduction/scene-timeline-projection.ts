import { RENDER_MINI_BLOCK_SECONDS } from "../../core/contracts/previs";
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
  readonly startSecond: number;
  readonly endSecond: number;
  readonly shots: readonly SceneTimelineShotProjection[];
  readonly unassignedFrames: readonly VisualStoryFrameProjection[];
};

export type SceneTimelineProjection = {
  readonly projectionOnly: true;
  readonly sceneId: string | null;
  readonly sceneTitle: string;
  readonly anchorSeconds: number;
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

function projectAnchor(
  anchor: VisualStoryProjection["anchors"][number],
  firstAddressIndex: number,
): SceneTimelineAnchorProjection {
  const anchorStartSecond = (addressIndex(anchor.blockNumber, anchor.miniBlockNumber) - firstAddressIndex)
    * RENDER_MINI_BLOCK_SECONDS;
  let cursor = anchorStartSecond;
  let positionKnown = true;

  const shots = anchor.shots.map((shot) => {
    const durationSeconds = shot.durationSeconds;
    let positionState: SceneTimelinePositionState = "untimed";
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

  return {
    anchorRef: anchor.anchorRef,
    blockNumber: anchor.blockNumber,
    miniBlockNumber: anchor.miniBlockNumber,
    startSecond: anchorStartSecond,
    endSecond: anchorStartSecond + RENDER_MINI_BLOCK_SECONDS,
    shots,
    unassignedFrames: anchor.unassignedFrames,
  };
}

/**
 * Temporal projection over the existing Visual Story / Previs authorities.
 * Shot order + Human-authored ProductionShotIntent duration determine placement.
 * If an earlier Shot is untimed, later Shots keep their authored duration but do
 * not receive an invented start timestamp. The technical RenderClip grid is not
 * projected into this creator-facing timeline.
 */
export function projectSceneTimeline(visualStory: VisualStoryProjection): SceneTimelineProjection {
  if (!visualStory.selectedScene || !visualStory.anchors.length) {
    return {
      projectionOnly: true,
      sceneId: visualStory.selectedScene?.id ?? null,
      sceneTitle: visualStory.selectedScene?.title ?? "",
      anchorSeconds: RENDER_MINI_BLOCK_SECONDS,
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
  const firstAddressIndex = addressIndex(orderedAnchors[0].blockNumber, orderedAnchors[0].miniBlockNumber);
  const lastAddressIndex = addressIndex(
    orderedAnchors[orderedAnchors.length - 1].blockNumber,
    orderedAnchors[orderedAnchors.length - 1].miniBlockNumber,
  );
  const anchors = orderedAnchors.map((anchor) => projectAnchor(anchor, firstAddressIndex));
  const shots = anchors.flatMap((anchor) => anchor.shots);

  return {
    projectionOnly: true,
    sceneId: visualStory.selectedScene.id,
    sceneTitle: visualStory.selectedScene.title,
    anchorSeconds: RENDER_MINI_BLOCK_SECONDS,
    totalSeconds: ((lastAddressIndex - firstAddressIndex) + 1) * RENDER_MINI_BLOCK_SECONDS,
    anchors,
    shots,
    untimedShots: shots.filter((shot) => shot.positionState !== "timed"),
    untimedFrames: anchors.flatMap((anchor) => anchor.unassignedFrames),
    timedShotCount: shots.filter((shot) => shot.positionState === "timed").length,
  };
}
