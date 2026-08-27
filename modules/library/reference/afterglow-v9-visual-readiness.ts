import { createAfterglowStoryboardFrames } from "../../../data/afterglow-storyboard";
import type { LegacyVisualIdentityEvidence } from "../../build/visual-readiness";

export const AFTERGLOW_V9_VISUAL_READINESS_BLOCK_NUMBER = 17 as const;

export function createAfterglowV9VisualReadinessEvidence(): readonly LegacyVisualIdentityEvidence[] {
  const [frame] = createAfterglowStoryboardFrames(AFTERGLOW_V9_VISUAL_READINESS_BLOCK_NUMBER);

  return [
    {
      id: "ren",
      kind: "character",
      label: "Ren",
      approved: false,
      sourceRef: "character:ren",
    },
    {
      id: "venice-beach",
      kind: "location",
      label: "Venice Beach",
      approved: false,
      sourceRef: "location:venice-beach",
    },
    {
      id: frame.id,
      kind: "reference",
      label: frame.alt,
      approved: false,
      sourceRef: frame.src,
    },
  ] as const;
}
