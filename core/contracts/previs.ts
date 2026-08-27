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

function cleanText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function normalizeReviewState(value: unknown): ProductionShotReviewState {
  return value === "approved" || value === "omitted" ? value : "planned";
}

export function normalizeProductionShotIntent(value: unknown): ProductionShotIntent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<ProductionShotIntent>;
  const id = cleanText(item.id, 160);
  const anchorRef = cleanText(item.anchorRef, 240);
  const storyboardArtifactId = cleanText(item.storyboardArtifactId, 200);
  const storyboardDependencyKey = cleanText(item.storyboardDependencyKey, 320);
  if (!id || !/^storyboard-anchor:block:block-\d{2}:mini-[1-4]$/.test(anchorRef)) return null;
  if (!storyboardArtifactId || !storyboardDependencyKey.startsWith("storyboard-upstream:")) return null;
  const order = typeof item.order === "number" && Number.isInteger(item.order) && item.order > 0
    ? Math.min(item.order, 999)
    : 1;
  const durationSeconds = typeof item.durationSeconds === "number" && Number.isFinite(item.durationSeconds) && item.durationSeconds > 0
    ? Math.min(Math.round(item.durationSeconds * 100) / 100, 3600)
    : null;
  const createdAt = cleanText(item.createdAt, 80) || new Date().toISOString();
  return {
    id,
    anchorRef,
    storyboardArtifactId,
    storyboardDependencyKey,
    order,
    shotSize: cleanText(item.shotSize, 80),
    angle: cleanText(item.angle, 80),
    movement: cleanText(item.movement, 120),
    lens: cleanText(item.lens, 120),
    visualIntent: cleanText(item.visualIntent, 2_000),
    durationSeconds,
    transitionIn: cleanText(item.transitionIn, 120),
    transitionOut: cleanText(item.transitionOut, 120),
    reviewState: normalizeReviewState(item.reviewState),
    createdAt,
    updatedAt: cleanText(item.updatedAt, 80) || createdAt,
  };
}

export function normalizePrevisProductionState(value: unknown): PrevisProductionState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return createEmptyPrevisProductionState();
  const source = value as { readonly shots?: unknown };
  const shots = Array.isArray(source.shots)
    ? source.shots
      .map(normalizeProductionShotIntent)
      .filter((shot): shot is ProductionShotIntent => Boolean(shot))
      .filter((shot, index, all) => all.findIndex((candidate) => candidate.id === shot.id) === index)
      .slice(0, 500)
    : [];
  return { shots };
}
