import path from "node:path";
import { ASSET_PATH, assetsDirectory } from "./media-storage-common";
import {
  createPlotPickleMiniBlockMediaRequest,
  type PlotPickleMediaEngineEvidence,
} from "../core/media/media-engine-contract";
import { liveMediaEngine } from "../core/media/live-media-runtime";

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

function localAssetFilePath(assetUrl: string) {
  if (!assetUrl.startsWith(ASSET_PATH)) throw new Error("Previs media handoff accepts saved PlotPickle local assets only.");
  const relative = assetUrl.slice(ASSET_PATH.length);
  if (!relative || relative.length > 240 || relative.includes("\\") || relative.includes("%") || relative.includes("?") || relative.includes("#") || relative.includes("\0")) {
    throw new Error("Previs media handoff received an unsafe local asset path.");
  }
  const segments = relative.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === ".." || !/^[a-z0-9][a-z0-9._-]*$/iu.test(segment))) {
    throw new Error("Previs media handoff received an unsafe local asset path.");
  }
  const fileName = segments.at(-1) ?? "";
  if (!/\.(png|jpe?g|webp)$/iu.test(fileName)) throw new Error("Previs media handoff accepts PNG, JPEG or WebP assets only.");
  const root = path.resolve(assetsDirectory());
  const filePath = path.resolve(root, ...segments);
  if (!filePath.startsWith(root + path.sep)) throw new Error("Previs media handoff received an unsafe local asset path.");
  return filePath;
}

export async function renderPrevisMiniBlockWithOptionalFFrames(input: PrevisMediaHandoffInput): Promise<PrevisMediaHandoffResult> {
  const frames = input.frames
    .filter((frame) => frame.authoritative === true)
    .map((frame) => ({ ...frame, localFilePath: localAssetFilePath(frame.assetUrl) }));

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
  const engine = liveMediaEngine();
  const capability = await engine.capabilities();
  if (capability.state !== "ready") {
    return { mode: "fallback", message: "FFrames is unavailable. Flip Book, Graphic Novel, and WebP remain available.", evidence: null };
  }
  const evidence = await engine.renderMiniBlock(request);
  return {
    mode: evidence.state === "succeeded" ? "fframes" : "fallback",
    message: evidence.state === "succeeded" ? "FFrames rendered the selected locked Storyboard sequence." : "FFrames did not complete. Existing Previs modes remain available.",
    evidence,
  };
}
