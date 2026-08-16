export interface FoundationsVisualArtifact {
  readonly id: string;
  readonly assetUrl: string;
  readonly prompt: string;
  readonly createdAt: string;
  readonly provider: string;
  readonly model: string;
}

export interface BuildProgressState {
  readonly foundations: {
    readonly visualArtifacts: readonly FoundationsVisualArtifact[];
    readonly acceptedVisualArtifactIds: readonly string[];
  };
}

export function createEmptyBuildProgressState(): BuildProgressState {
  return {
    foundations: {
      visualArtifacts: [],
      acceptedVisualArtifactIds: [],
    },
  };
}
