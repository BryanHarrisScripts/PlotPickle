import path from "node:path";
import { ASSET_PATH, assetsDirectory, projectImageAssetFilePath } from "./media-storage-common";
import {
  createPlotPickleTimelineRangeMediaRequest,
  type PlotPickleMediaEngineEvidence,
} from "../core/media/media-engine-contract";
import { FFramesLocalMediaEngine } from "../core/media/fframes-local-media-engine";

export type TimelineLockedStoryboardFrame = Readonly<{
  position: number;
  assetId: string;
  assetUrl: string;
  authoritative: true;
  durationMs: number;
  sourceRefs: readonly string[];
  caption?: string;
  narration?: string;
}>;

export type TimelineRangeMediaHandoffInput = Readonly<{
  requestId: string;
  projectId: string;
  blockNumber: number;
  miniBlockNumber: number;
  frames: readonly TimelineLockedStoryboardFrame[];
}>;

export type TimelineRangeMediaHandoffResult = Readonly<{
  mode: "fframes" | "fallback";
  message: string;
  evidence: PlotPickleMediaEngineEvidence | null;
}>;

export async function renderTimelineRangeWithOptionalFFrames(input: TimelineRangeMediaHandoffInput): Promise<TimelineRangeMediaHandoffResult> {
  const frames = input.frames
    .filter((frame) => frame.authoritative === true)
    .map((frame) => ({ ...frame, localFilePath: projectImageAssetFilePath(frame.assetUrl) }));

  const request = createPlotPickleTimelineRangeMediaRequest({
    requestId: input.requestId,
    projectId: input.projectId,
    blockNumber: input.blockNumber,
    miniBlockNumber: input.miniBlockNumber,
    frames,
  });
  const engine = new FFramesLocalMediaEngine();
  const capability = await engine.capabilities();
  if (capability.state !== "ready") {
    return {
      mode: "fallback",
      message: "FFrames is unavailable. Timeline keeps the saved assembly and does not report an MP4 export.",
      evidence: null,
    };
  }

  const evidence = await engine.renderTimelineRange(request, {
    evidenceDirectory: assetsDirectory(),
    timeoutMs: 10 * 60_000,
  });
  const playbackEvidence = evidence.artifacts.videoPath ? {
    ...evidence,
    artifacts: {
      ...evidence.artifacts,
      videoPath: `${ASSET_PATH}${path.basename(evidence.artifacts.videoPath)}`,
    },
  } : evidence;
  return {
    mode: evidence.state === "succeeded" ? "fframes" : "fallback",
    message: evidence.state === "succeeded"
      ? "FFrames rendered the selected Timeline opening range."
      : "Timeline range rendering did not complete; the saved assembly remains unchanged.",
    evidence: playbackEvidence,
  };
}
