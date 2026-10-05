import path from "node:path";
import { ASSET_PATH, assetsDirectory, localImageAssetFilePath } from "./media-storage-common";
import {
  createPlotPickleMiniBlockMediaRequest,
  type PlotPickleMediaEngineEvidence,
} from "../core/media/media-engine-contract";
import { FFramesLocalMediaEngine } from "../core/media/fframes-local-media-engine";

export type PrevisLockedStoryboardFrame = Readonly<{
  position: number;
  assetId: string;
  assetUrl: string;
  authoritative: true;
  durationMs: number;
  sourceRefs: readonly string[];
  caption?: string;
  narration?: string;
}>;

export type PrevisMediaHandoffInput = Readonly<{
  requestId: string;
  projectId: string;
  blockNumber: number;
  miniBlockNumber: number;
  frames: readonly PrevisLockedStoryboardFrame[];
}>;

export type PrevisMediaHandoffResult = Readonly<{
  mode: "fframes" | "fallback";
  message: string;
  evidence: PlotPickleMediaEngineEvidence | null;
}>;

export async function renderPrevisMiniBlockWithOptionalFFrames(input: PrevisMediaHandoffInput): Promise<PrevisMediaHandoffResult> {
  const frames = input.frames
    .filter((frame) => frame.authoritative === true)
    .map((frame) => ({ ...frame, localFilePath: localImageAssetFilePath(frame.assetUrl) }));

  if (!frames.length) {
    return { mode: "fallback", message: "Keep / Lock at least one Storyboard frame before using the optional media engine.", evidence: null };
  }

  const request = createPlotPickleMiniBlockMediaRequest({
    requestId: input.requestId,
    projectId: input.projectId,
    blockNumber: input.blockNumber,
    miniBlockNumber: input.miniBlockNumber,
    frames,
  });
  const engine = new FFramesLocalMediaEngine();
  const capability = await engine.capabilities();
  if (capability.state !== "ready") {
    return { mode: "fallback", message: "FFrames is unavailable. Flip Book, Graphic Novel, and WebP remain available.", evidence: null };
  }
  const evidence = await engine.renderMiniBlock(request, { evidenceDirectory: assetsDirectory() });
  const playbackEvidence = evidence.artifacts.videoPath ? {
    ...evidence,
    artifacts: { ...evidence.artifacts, videoPath: `${ASSET_PATH}${path.basename(evidence.artifacts.videoPath)}` },
  } : evidence;
  return {
    mode: evidence.state === "succeeded" ? "fframes" : "fallback",
    message: evidence.state === "succeeded" ? "FFrames rendered the selected locked Storyboard sequence." : "FFrames did not complete. Existing Previs modes remain available.",
    evidence: playbackEvidence,
  };
}
