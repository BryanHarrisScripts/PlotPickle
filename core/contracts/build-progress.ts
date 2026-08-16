export interface BuildProgressState {
  readonly foundations: {
    readonly acceptedVisualArtifactIds: readonly string[];
  };
}

export function createEmptyBuildProgressState(): BuildProgressState {
  return {
    foundations: {
      acceptedVisualArtifactIds: [],
    },
  };
}
