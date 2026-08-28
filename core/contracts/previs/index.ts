export const RENDER_CLIP_SECONDS = 3 as const;
export const RENDER_CLIPS_PER_MINI_BLOCK = 25 as const;
export const RENDER_MINI_BLOCK_SECONDS = RENDER_CLIP_SECONDS * RENDER_CLIPS_PER_MINI_BLOCK;
export const RENDER_MINI_BLOCKS_PER_BLOCK = 4 as const;
export const RENDER_BLOCKS_PER_FEATURE = 24 as const;
export const RENDER_CLIPS_PER_BLOCK = RENDER_CLIPS_PER_MINI_BLOCK * RENDER_MINI_BLOCKS_PER_BLOCK;
export const RENDER_CLIPS_PER_FEATURE = RENDER_CLIPS_PER_BLOCK * RENDER_BLOCKS_PER_FEATURE;
export const RENDER_KEYFRAMES_PER_FEATURE = RENDER_CLIPS_PER_FEATURE + 1;

export interface RenderClipSlot {
  readonly id: string;
  readonly anchorRef: string;
  readonly blockNumber: number;
  readonly miniBlockNumber: number;
  readonly clipNumber: number;
  readonly globalClipNumber: number;
  readonly startSecond: number;
  readonly endSecond: number;
  readonly startKeyframeNumber: number;
  readonly endKeyframeNumber: number;
}

function renderAnchorRef(blockNumber: number, miniBlockNumber: number) {
  return `storyboard-anchor:block:block-${String(blockNumber).padStart(2, "0")}:mini-${miniBlockNumber}`;
}

export function renderClipSlotsForAnchor(blockNumber: number, miniBlockNumber: number): readonly RenderClipSlot[] {
  if (!Number.isInteger(blockNumber) || blockNumber < 1 || blockNumber > RENDER_BLOCKS_PER_FEATURE) return [];
  if (!Number.isInteger(miniBlockNumber) || miniBlockNumber < 1 || miniBlockNumber > RENDER_MINI_BLOCKS_PER_BLOCK) return [];
  const miniBlockIndex = ((blockNumber - 1) * RENDER_MINI_BLOCKS_PER_BLOCK) + (miniBlockNumber - 1);
  const firstGlobalClipNumber = (miniBlockIndex * RENDER_CLIPS_PER_MINI_BLOCK) + 1;
  const anchorRef = renderAnchorRef(blockNumber, miniBlockNumber);

  return Array.from({ length: RENDER_CLIPS_PER_MINI_BLOCK }, (_, index) => {
    const clipNumber = index + 1;
    const globalClipNumber = firstGlobalClipNumber + index;
    return {
      id: `render-clip:block-${String(blockNumber).padStart(2, "0")}:mini-${miniBlockNumber}:clip-${String(clipNumber).padStart(2, "0")}`,
      anchorRef,
      blockNumber,
      miniBlockNumber,
      clipNumber,
      globalClipNumber,
      startSecond: (globalClipNumber - 1) * RENDER_CLIP_SECONDS,
      endSecond: globalClipNumber * RENDER_CLIP_SECONDS,
      startKeyframeNumber: globalClipNumber - 1,
      endKeyframeNumber: globalClipNumber,
    };
  });
}

export function renderGridSummary() {
  return {
    clipSeconds: RENDER_CLIP_SECONDS,
    clipsPerMiniBlock: RENDER_CLIPS_PER_MINI_BLOCK,
    miniBlockSeconds: RENDER_MINI_BLOCK_SECONDS,
    clipsPerBlock: RENDER_CLIPS_PER_BLOCK,
    clipsPerFeature: RENDER_CLIPS_PER_FEATURE,
    keyframesPerFeature: RENDER_KEYFRAMES_PER_FEATURE,
  } as const;
}

export type ProductionShotReviewState = "planned" | "approved" | "omitted";

export interface ProductionShotIntent {
  readonly id: string;
  /** Stable Storyboard Mini-Block anchor, for example storyboard-anchor:block:block-17:mini-3. */
  readonly anchorRef: string;
  /** Human-kept Storyboard visual that seeded this shot. */
  readonly storyboardArtifactId: string;
  /** Snapshot of the owning Storyboard dependency key when this shot was last reviewed. */
  readonly storyboardDependencyKey: string;
  /** Variable creative shot order inside the owning anchor. Zero/one/many creative shots may share an anchor. */
  readonly order: number;
  readonly shotSize: string;
  readonly angle: string;
  readonly movement: string;
  readonly lens: string;
  /** Human-authored production/composition intent only; story canon stays upstream. */
  readonly visualIntent: string;
  /** Null until the Human authors timing. Creative shots may span one or more fixed 3-second render clips. */
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
