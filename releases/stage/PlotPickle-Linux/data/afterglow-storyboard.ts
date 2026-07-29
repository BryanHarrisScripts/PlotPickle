import type { VisualFrame } from "@/lib/project";

const sourceStoryboardBlocks = 21;
const bundledStoryboardBlocks = 24;
const replacementBlocks = [22, 23, 24] as const;

export function createAfterglowStoryboardFrames(blockNumber: number): VisualFrame[] {
  if (blockNumber < 1 || blockNumber > bundledStoryboardBlocks) return [];
  const replacement = blockNumber > sourceStoryboardBlocks;
  const extension = replacement ? "svg" : "webp";
  return [1, 2, 3, 4].map((miniBlockNumber) => ({
    id: `afterglow-block-${blockNumber}-mini-${miniBlockNumber}`,
    miniBlockNumber,
    src: `/afterglow/storyboard/block-${String(blockNumber).padStart(2, "0")}-mini-${miniBlockNumber}.${extension}`,
    alt: `Afterglow: Reflections of Sentience — Block ${blockNumber}, mini-block ${miniBlockNumber}`,
    caption: replacement
      ? `New PlotPickle replacement concept keyframe for the complete Afterglow ending, Block ${blockNumber}.${miniBlockNumber}.`
      : `Original Afterglow storyboard frame for Block ${blockNumber}.${miniBlockNumber}, optimized and bundled as WebP.`,
    prompt: "",
    shot: replacement
      ? "Use this approved replacement concept as the visual anchor and refine final camera coverage in Shot Designer."
      : "Use the original storyboard composition as the approved visual reference for this mini-block.",
    continuity: "Preserve the established Afterglow character designs, sentient vehicles and companions, coastal geography, lighting direction, wardrobe, chosen-family relationships, and emotional state shown across the complete screenplay.",
  }));
}

export const afterglowStoryboardCoverage = {
  sourceBlocks: sourceStoryboardBlocks,
  replacementBlocks,
  images: bundledStoryboardBlocks * 4,
  sourceImages: sourceStoryboardBlocks * 4,
  replacementImages: replacementBlocks.length * 4,
  formats: ["WebP", "SVG"],
  width: 1280,
  source: "BryanHarrisScripts/Afterglow-Echoes-of-Sentience plus PlotPickle replacement concepts",
  license: "CC BY-SA 4.0",
  unresolvedBlocks: [],
} as const;
