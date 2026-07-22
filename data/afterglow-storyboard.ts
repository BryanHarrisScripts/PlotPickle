import type { VisualFrame } from "@/lib/project";

const bundledStoryboardBlocks = 21;

export function createAfterglowStoryboardFrames(blockNumber: number): VisualFrame[] {
  if (blockNumber < 1 || blockNumber > bundledStoryboardBlocks) return [];

  return [1, 2, 3, 4].map((miniBlockNumber) => ({
    id: `afterglow-block-${blockNumber}-mini-${miniBlockNumber}`,
    miniBlockNumber,
    src: `/afterglow/storyboard/block-${String(blockNumber).padStart(2, "0")}-mini-${miniBlockNumber}.webp`,
    alt: `Afterglow: Reflections of Sentience — Block ${blockNumber}, mini-block ${miniBlockNumber}`,
    caption: `Original Afterglow storyboard frame for Block ${blockNumber}.${miniBlockNumber}, optimized and bundled as WebP.`,
    prompt: "",
    shot: "Use the original storyboard composition as the approved visual reference for this mini-block.",
    continuity: "Preserve the established Afterglow character designs, vehicles, AI companions, coastal geography, lighting direction, wardrobe, and emotional state shown in the approved source frame.",
  }));
}

export const afterglowStoryboardCoverage = {
  sourceBlocks: bundledStoryboardBlocks,
  images: bundledStoryboardBlocks * 4,
  format: "WebP",
  width: 1280,
  source: "BryanHarrisScripts/Afterglow-Echoes-of-Sentience",
  license: "CC BY-SA 4.0",
  unresolvedBlocks: [22, 23, 24],
} as const;
