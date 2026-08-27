export type ProductionShotReviewState = "planned" | "approved" | "omitted";

export interface ProductionShotIntent {
  readonly id: string;
  /** Stable Storyboard Mini-Block anchor, for example storyboard-anchor:block:block-17:mini-3. */
  readonly anchorRef: string;
  /** Human-kept Storyboard visual that seeded this shot. */
  readonly storyboardArtifactId: string;
  /** Snapshot of the owning Storyboard dependency key when this shot was last reviewed. */
  readonly storyboardDependencyKey: string;
  /** Variable shot order inside the owning anchor. Zero/one/many shots may share an anchor. */
  readonly order: number;
  readonly shotSize: string;
  readonly angle: string;
  readonly movement: string;
  readonly lens: string;
  /** Human-authored production/composition intent only; story canon stays upstream. */
  readonly visualIntent: string;
  /** Null until the Human authors timing. Previs never infers duration from the 24/96 scaffold. */
  readonly durationSeconds: number | null;
  readonly transitionIn: string;
  readonly transitionOut: string;
  readonly reviewState: ProductionShotReviewState;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PrevisProductionState {
  readonly shots: readonly ProductionShotIntent[];
}

export function createEmptyPrevisProductionState(): PrevisProductionState {
  return { shots: [] };
}
