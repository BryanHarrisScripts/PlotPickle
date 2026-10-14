export type RuntimeInterval = Readonly<{
  startFrame: number;
  endFrame: number;
  durationFrames: number;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
}>;
export type SelectedPpfRuntimeGrid =
  | Readonly<{
      status: "runtime-unset" | "runtime-invalid";
      projectId: string;
      revision: number;
      structuralCounts: Readonly<{ acts: 4; sequences: 12; blocks: 24; miniBlocks: 96 }>;
      reason: string;
    }>
  | Readonly<{
      status: "runtime-configured";
      projectId: string;
      revision: number;
      structuralCounts: Readonly<{ acts: 4; sequences: 12; blocks: 24; miniBlocks: 96 }>;
      format: "Short Film" | "Feature";
      targetMinutes: number;
      fps: 24;
      totalFrames: number;
      blocks: readonly (Readonly<{number:number;actNumber:number;sequenceNumber:number}> & RuntimeInterval)[];
      miniBlocks: readonly (Readonly<{blockNumber:number;ordinal:number;globalNumber:number}> & RuntimeInterval)[];
      shotPlanningSlotsPerMiniBlock: 25;
      shotPlanningSlotSeconds: number;
      defaultThreeSecondPresetFits: boolean;
      requiresTimingReview: boolean;
      mediaGenerated: false;
      canonicalStoryChanged: false;
    }>;
export function projectRuntimeGrid(
  project: import("../../../core/storage/library-project").LibraryPPFProject & {
    readonly storyIntent?: unknown;
  },
): SelectedPpfRuntimeGrid;
