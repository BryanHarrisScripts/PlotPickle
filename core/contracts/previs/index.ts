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
  /** Stable Editorial Shot provenance when this timed shot derives from a known #2107 Storyboard Shot. */
  readonly editorialShotId?: string;
  /** Variable creative shot order inside the owning anchor. Zero/one/many creative shots may share an anchor. */
  readonly order: number;
  readonly shotSize: string;
  readonly angle: string;
  readonly movement: string;
  readonly lens: string;
  /** Human-authored production/composition intent only; story canon stays upstream. */
  readonly visualIntent: string;
  /** Optional Human-authored blocking intent. No blocking is inferred from the 24/96 address. */
  readonly blockingIntent?: string;
  /** Optional Human-authored performance energy / acting direction for this production shot. */
  readonly performanceEnergy?: string;
  /** Optional Human-authored pacing/rhythm intent, separate from exact duration. */
  readonly pacingIntent?: string;
  /** Optional refs to rough/local motion or animatic evidence. Evidence never self-promotes review state. */
  readonly roughMotionEvidenceRefs?: readonly string[];
  /** Null until the Human authors timing. Creative shots may span one or more fixed 3-second render clips. */
  readonly durationSeconds: number | null;
  readonly transitionIn: string;
  readonly transitionOut: string;
  readonly reviewState: ProductionShotReviewState;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type ProductionSoundCueKind = "narration" | "music" | "foley";
export type ProductionSoundCueReviewState = "planned" | "approved" | "rejected";

export interface ProductionSoundCue {
  readonly id: string;
  readonly anchorRef: string;
  readonly productionShotId?: string;
  readonly kind: ProductionSoundCueKind;
  /** Human-authored sound intention. Empty/generated filler is never manufactured by normalization. */
  readonly intent: string;
  readonly startSecond: number | null;
  readonly endSecond: number | null;
  readonly sourceRefs: readonly string[];
  readonly reviewState: ProductionSoundCueReviewState;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type ProductionTakeReviewState = "candidate" | "approved" | "rejected";

export interface ProductionTake {
  readonly id: string;
  readonly productionShotId: string;
  readonly sourceRevision: number;
  readonly storyboardDependencyKey: string;
  /** Durable project/local media reference. This contract does not own the file bytes. */
  readonly mediaRef: string;
  readonly provider: string;
  readonly model: string;
  readonly intendedDurationSeconds: number | null;
  /** Measured duration belongs to observed media evidence and never overwrites intended timing. */
  readonly observedDurationSeconds: number | null;
  readonly provenanceRefs: readonly string[];
  readonly reviewState: ProductionTakeReviewState;
  readonly replacesTakeId?: string;
  readonly createdAt: string;
}

export interface RoughCutPlacement {
  readonly productionShotId: string;
  readonly takeId: string | null;
  readonly soundCueIds: readonly string[];
}

export interface RoughCutRevision {
  readonly id: string;
  readonly sourceRevision: number;
  readonly placements: readonly RoughCutPlacement[];
  readonly supersedesCutId?: string;
  readonly createdAt: string;
}

export interface TimelineShotImageRef {
  readonly shotNumber: number;
  readonly artifactId: string;
}

export interface TimelinePrevisPlacement {
  readonly id: string;
  readonly anchorRef: string;
  readonly blockNumber: number;
  readonly miniBlockNumber: number;
  readonly sourceRevision: number;
  readonly sourceKey: string;
  readonly sourceKind: "previs-flip-book";
  readonly shotImages: readonly TimelineShotImageRef[];
  readonly durationSeconds: number;
  readonly order: number;
  readonly createdAt: string;
}

export interface TimelineAssemblyRevision {
  readonly id: string;
  readonly sourceRevision: number;
  readonly placements: readonly TimelinePrevisPlacement[];
  readonly supersedesTimelineId?: string;
  readonly createdAt: string;
}

export type TimelineMotionShotStatus = "queued" | "running" | "succeeded" | "failed";

export interface TimelineMotionShot {
  readonly id: string;
  readonly placementId: string;
  readonly anchorRef: string;
  readonly shotNumber: number;
  readonly sourceArtifactId: string;
  readonly sourceKey: string;
  readonly prompt: string;
  readonly requestedDurationSeconds: 3;
  readonly provider: string;
  readonly route: string;
  readonly model: string;
  readonly jobId: string;
  readonly status: TimelineMotionShotStatus;
  readonly outputAssetUrl: string;
  readonly error: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type ScreeningObservationCategory = "intent" | "picture" | "timing" | "continuity" | "sound";
export type ScreeningObservationState = "observed" | "resolved";

export interface ScreeningObservation {
  readonly id: string;
  readonly roughCutId: string;
  readonly productionShotId?: string;
  readonly soundCueId?: string;
  readonly startSecond: number | null;
  readonly endSecond: number | null;
  readonly category: ScreeningObservationCategory;
  readonly summary: string;
  readonly evidenceRefs: readonly string[];
  readonly state: ScreeningObservationState;
  readonly createdAt: string;
}

export interface PrevisGraphicNovelTextBubble {
  readonly speaker: string;
  readonly text: string;
}

export interface PrevisGraphicNovelTextApproval {
  /** Stable Storyboard Mini-Block anchor that owns this 1–25 position. */
  readonly anchorRef: string;
  readonly position: number;
  /** Snapshot key of the locked frame plus derived proposal. A changed source makes approval stale. */
  readonly sourceKey: string;
  /** Human-approved presentation text only. This never mutates screenplay/story canon. */
  readonly narration: string;
  readonly bubbles: readonly PrevisGraphicNovelTextBubble[];
  /** Explicit Human intent for a locked panel to contain no narration or bubbles. */
  readonly noText: boolean;
  readonly approvedAt: string;
}

export interface PrevisProductionState {
  readonly shots: readonly ProductionShotIntent[];
  readonly soundCues?: readonly ProductionSoundCue[];
  readonly takes?: readonly ProductionTake[];
  readonly roughCuts?: readonly RoughCutRevision[];
  readonly timelineAssemblies?: readonly TimelineAssemblyRevision[];
  readonly timelineMotionShots?: readonly TimelineMotionShot[];
  readonly screeningObservations?: readonly ScreeningObservation[];
  readonly graphicNovelTextApprovals?: readonly PrevisGraphicNovelTextApproval[];
}

export function createEmptyPrevisProductionState(): PrevisProductionState {
  return { shots: [], soundCues: [], takes: [], roughCuts: [], timelineAssemblies: [], timelineMotionShots: [], screeningObservations: [], graphicNovelTextApprovals: [] };
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
    editorialShotId: cleanText(item.editorialShotId, 320) || undefined,
    order,
    shotSize: cleanText(item.shotSize, 80),
    angle: cleanText(item.angle, 80),
    movement: cleanText(item.movement, 120),
    lens: cleanText(item.lens, 120),
    visualIntent: cleanText(item.visualIntent, 2_000),
    blockingIntent: cleanText(item.blockingIntent, 1_000),
    performanceEnergy: cleanText(item.performanceEnergy, 1_000),
    pacingIntent: cleanText(item.pacingIntent, 1_000),
    roughMotionEvidenceRefs: Array.isArray(item.roughMotionEvidenceRefs)
      ? [...new Set(item.roughMotionEvidenceRefs
        .map((ref) => cleanText(ref, 500))
        .filter(Boolean))]
        .slice(0, 32)
      : [],
    durationSeconds,
    transitionIn: cleanText(item.transitionIn, 120),
    transitionOut: cleanText(item.transitionOut, 120),
    reviewState: normalizeReviewState(item.reviewState),
    createdAt,
    updatedAt: cleanText(item.updatedAt, 80) || createdAt,
  };
}

function cleanStringList(value: unknown, limit = 64) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => cleanText(item, 500)).filter(Boolean))].slice(0, limit)
    : [];
}

function positiveSecond(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.min(Math.round(value * 1000) / 1000, 86_400)
    : null;
}

function normalizeProductionSoundCue(value: unknown): ProductionSoundCue | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<ProductionSoundCue>;
  const id = cleanText(item.id, 180);
  const anchorRef = cleanText(item.anchorRef, 240);
  const kind = item.kind === "music" || item.kind === "foley" ? item.kind : item.kind === "narration" ? "narration" : null;
  const intent = cleanText(item.intent, 4_000);
  if (!id || !/^storyboard-anchor:block:block-\d{2}:mini-[1-4]$/.test(anchorRef) || !kind || !intent) return null;
  const startSecond = positiveSecond(item.startSecond);
  const endSecond = positiveSecond(item.endSecond);
  const createdAt = cleanText(item.createdAt, 80) || new Date().toISOString();
  return {
    id,
    anchorRef,
    productionShotId: cleanText(item.productionShotId, 180) || undefined,
    kind,
    intent,
    startSecond,
    endSecond: startSecond !== null && endSecond !== null && endSecond > startSecond ? endSecond : null,
    sourceRefs: cleanStringList(item.sourceRefs),
    reviewState: item.reviewState === "approved" || item.reviewState === "rejected" ? item.reviewState : "planned",
    createdAt,
    updatedAt: cleanText(item.updatedAt, 80) || createdAt,
  };
}

function normalizeProductionTake(value: unknown): ProductionTake | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<ProductionTake>;
  const id = cleanText(item.id, 180);
  const productionShotId = cleanText(item.productionShotId, 180);
  const storyboardDependencyKey = cleanText(item.storyboardDependencyKey, 320);
  const mediaRef = cleanText(item.mediaRef, 800);
  if (!id || !productionShotId || !storyboardDependencyKey.startsWith("storyboard-upstream:") || !mediaRef) return null;
  const sourceRevision = typeof item.sourceRevision === "number" && Number.isInteger(item.sourceRevision) && item.sourceRevision >= 0 ? item.sourceRevision : 0;
  return {
    id,
    productionShotId,
    sourceRevision,
    storyboardDependencyKey,
    mediaRef,
    provider: cleanText(item.provider, 120),
    model: cleanText(item.model, 160),
    intendedDurationSeconds: positiveSecond(item.intendedDurationSeconds),
    observedDurationSeconds: positiveSecond(item.observedDurationSeconds),
    provenanceRefs: cleanStringList(item.provenanceRefs),
    reviewState: item.reviewState === "approved" || item.reviewState === "rejected" ? item.reviewState : "candidate",
    replacesTakeId: cleanText(item.replacesTakeId, 180) || undefined,
    createdAt: cleanText(item.createdAt, 80) || new Date().toISOString(),
  };
}

function normalizeRoughCutPlacement(value: unknown): RoughCutPlacement | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<RoughCutPlacement>;
  const productionShotId = cleanText(item.productionShotId, 180);
  if (!productionShotId) return null;
  return {
    productionShotId,
    takeId: cleanText(item.takeId, 180) || null,
    soundCueIds: cleanStringList(item.soundCueIds, 32),
  };
}

function normalizeRoughCutRevision(value: unknown): RoughCutRevision | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<RoughCutRevision>;
  const id = cleanText(item.id, 180);
  if (!id) return null;
  return {
    id,
    sourceRevision: typeof item.sourceRevision === "number" && Number.isInteger(item.sourceRevision) && item.sourceRevision >= 0 ? item.sourceRevision : 0,
    placements: Array.isArray(item.placements)
      ? item.placements.map(normalizeRoughCutPlacement).filter((placement): placement is RoughCutPlacement => Boolean(placement)).slice(0, 500)
      : [],
    supersedesCutId: cleanText(item.supersedesCutId, 180) || undefined,
    createdAt: cleanText(item.createdAt, 80) || new Date().toISOString(),
  };
}

function normalizeTimelineShotImageRef(value: unknown): TimelineShotImageRef | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<TimelineShotImageRef>;
  const shotNumber = typeof item.shotNumber === "number" && Number.isInteger(item.shotNumber)
    ? Math.min(25, Math.max(1, item.shotNumber))
    : 0;
  const artifactId = cleanText(item.artifactId, 200);
  return shotNumber && artifactId ? { shotNumber, artifactId } : null;
}

function normalizeTimelinePrevisPlacement(value: unknown): TimelinePrevisPlacement | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<TimelinePrevisPlacement>;
  const id = cleanText(item.id, 180);
  const anchorRef = cleanText(item.anchorRef, 240);
  const sourceKey = cleanText(item.sourceKey, 16_000);
  const blockNumber = typeof item.blockNumber === "number" && Number.isInteger(item.blockNumber)
    ? Math.min(24, Math.max(1, item.blockNumber))
    : 0;
  const miniBlockNumber = typeof item.miniBlockNumber === "number" && Number.isInteger(item.miniBlockNumber)
    ? Math.min(4, Math.max(1, item.miniBlockNumber))
    : 0;
  if (!id || !blockNumber || !miniBlockNumber || !sourceKey || !/^storyboard-anchor:block:block-\d{2}:mini-[1-4]$/.test(anchorRef)) return null;
  const shotImages = Array.isArray(item.shotImages)
    ? item.shotImages
      .map(normalizeTimelineShotImageRef)
      .filter((image): image is TimelineShotImageRef => Boolean(image))
      .filter((image, index, all) => all.findIndex((candidate) => candidate.shotNumber === image.shotNumber) === index)
      .sort((left, right) => left.shotNumber - right.shotNumber)
      .slice(0, 25)
    : [];
  const durationSeconds = typeof item.durationSeconds === "number" && Number.isFinite(item.durationSeconds) && item.durationSeconds > 0
    ? Math.min(7_200, Math.round(item.durationSeconds * 1000) / 1000)
    : 75;
  const order = typeof item.order === "number" && Number.isInteger(item.order) && item.order > 0 ? Math.min(item.order, 500) : 1;
  return {
    id,
    anchorRef,
    blockNumber,
    miniBlockNumber,
    sourceRevision: typeof item.sourceRevision === "number" && Number.isInteger(item.sourceRevision) && item.sourceRevision >= 0 ? item.sourceRevision : 0,
    sourceKey,
    sourceKind: "previs-flip-book",
    shotImages,
    durationSeconds,
    order,
    createdAt: cleanText(item.createdAt, 80) || new Date().toISOString(),
  };
}

function normalizeTimelineAssemblyRevision(value: unknown): TimelineAssemblyRevision | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<TimelineAssemblyRevision>;
  const id = cleanText(item.id, 180);
  if (!id) return null;
  return {
    id,
    sourceRevision: typeof item.sourceRevision === "number" && Number.isInteger(item.sourceRevision) && item.sourceRevision >= 0 ? item.sourceRevision : 0,
    placements: Array.isArray(item.placements)
      ? item.placements
        .map(normalizeTimelinePrevisPlacement)
        .filter((placement): placement is TimelinePrevisPlacement => Boolean(placement))
        .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
        .slice(0, 500)
      : [],
    supersedesTimelineId: cleanText(item.supersedesTimelineId, 180) || undefined,
    createdAt: cleanText(item.createdAt, 80) || new Date().toISOString(),
  };
}

function normalizeTimelineMotionShot(value: unknown): TimelineMotionShot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<TimelineMotionShot>;
  const id = cleanText(item.id, 180);
  const placementId = cleanText(item.placementId, 180);
  const anchorRef = cleanText(item.anchorRef, 240);
  const sourceArtifactId = cleanText(item.sourceArtifactId, 200);
  const sourceKey = cleanText(item.sourceKey, 8_000);
  const shotNumber = typeof item.shotNumber === "number" && Number.isInteger(item.shotNumber)
    ? Math.min(25, Math.max(1, item.shotNumber))
    : 0;
  const status: TimelineMotionShotStatus = item.status === "queued" || item.status === "running" || item.status === "succeeded" || item.status === "failed"
    ? item.status
    : "failed";
  const outputAssetUrl = cleanText(item.outputAssetUrl, 1_000);
  if (!id || !placementId || !shotNumber || !sourceArtifactId || !sourceKey || !/^storyboard-anchor:block:block-\d{2}:mini-[1-4]$/.test(anchorRef)) return null;
  if (status === "succeeded" && !/^\/api\/local-ai\/assets\/[a-z0-9][a-z0-9._-]*\.(?:mp4|webm)$/iu.test(outputAssetUrl)) return null;
  const createdAt = cleanText(item.createdAt, 80) || new Date().toISOString();
  return {
    id,
    placementId,
    anchorRef,
    shotNumber,
    sourceArtifactId,
    sourceKey,
    prompt: cleanText(item.prompt, 7_000),
    requestedDurationSeconds: 3,
    provider: cleanText(item.provider, 120),
    route: cleanText(item.route, 120),
    model: cleanText(item.model, 160),
    jobId: cleanText(item.jobId, 240),
    status,
    outputAssetUrl,
    error: cleanText(item.error, 1_000),
    createdAt,
    updatedAt: cleanText(item.updatedAt, 80) || createdAt,
  };
}

function normalizeScreeningObservation(value: unknown): ScreeningObservation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<ScreeningObservation>;
  const id = cleanText(item.id, 180);
  const roughCutId = cleanText(item.roughCutId, 180);
  const summary = cleanText(item.summary, 4_000);
  const categories: readonly ScreeningObservationCategory[] = ["intent", "picture", "timing", "continuity", "sound"];
  if (!id || !roughCutId || !summary || !categories.includes(item.category as ScreeningObservationCategory)) return null;
  const startSecond = positiveSecond(item.startSecond);
  const endSecond = positiveSecond(item.endSecond);
  return {
    id,
    roughCutId,
    productionShotId: cleanText(item.productionShotId, 180) || undefined,
    soundCueId: cleanText(item.soundCueId, 180) || undefined,
    startSecond,
    endSecond: startSecond !== null && endSecond !== null && endSecond > startSecond ? endSecond : null,
    category: item.category as ScreeningObservationCategory,
    summary,
    evidenceRefs: cleanStringList(item.evidenceRefs),
    state: item.state === "resolved" ? "resolved" : "observed",
    createdAt: cleanText(item.createdAt, 80) || new Date().toISOString(),
  };
}

function normalizeGraphicNovelTextApproval(value: unknown): PrevisGraphicNovelTextApproval | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<PrevisGraphicNovelTextApproval>;
  const anchorRef = cleanText(item.anchorRef, 240);
  const sourceKey = cleanText(item.sourceKey, 4_000);
  const position = typeof item.position === "number" && Number.isInteger(item.position)
    ? Math.min(25, Math.max(1, item.position))
    : 0;
  const noText = item.noText === true;
  const narration = noText ? "" : cleanText(item.narration, 1_200);
  const bubbles = noText || !Array.isArray(item.bubbles)
    ? []
    : item.bubbles.flatMap((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return [];
      const bubble = value as Partial<PrevisGraphicNovelTextBubble>;
      const speaker = cleanText(bubble.speaker, 80);
      const text = cleanText(bubble.text, 180);
      return speaker && text ? [{ speaker, text } satisfies PrevisGraphicNovelTextBubble] : [];
    }).slice(0, 2);
  if (!/^storyboard-anchor:block:block-\d{2}:mini-[1-4]$/.test(anchorRef) || !position || !sourceKey) return null;
  if (!noText && !narration && !bubbles.length) return null;
  return {
    anchorRef,
    position,
    sourceKey,
    narration,
    bubbles,
    noText,
    approvedAt: cleanText(item.approvedAt, 80) || new Date().toISOString(),
  };
}

export function normalizePrevisProductionState(value: unknown): PrevisProductionState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return createEmptyPrevisProductionState();
  const source = value as {
    readonly shots?: unknown;
    readonly soundCues?: unknown;
    readonly takes?: unknown;
    readonly roughCuts?: unknown;
    readonly timelineAssemblies?: unknown;
    readonly timelineMotionShots?: unknown;
    readonly screeningObservations?: unknown;
    readonly graphicNovelTextApprovals?: unknown;
  };
  const shots = Array.isArray(source.shots)
    ? source.shots
      .map(normalizeProductionShotIntent)
      .filter((shot): shot is ProductionShotIntent => Boolean(shot))
      .filter((shot, index, all) => all.findIndex((candidate) => candidate.id === shot.id) === index)
      .slice(0, 500)
    : [];
  const soundCues = Array.isArray(source.soundCues)
    ? source.soundCues.map(normalizeProductionSoundCue).filter((cue): cue is ProductionSoundCue => Boolean(cue)).slice(0, 1_000)
    : [];
  const takes = Array.isArray(source.takes)
    ? source.takes.map(normalizeProductionTake).filter((take): take is ProductionTake => Boolean(take)).slice(0, 2_000)
    : [];
  const roughCuts = Array.isArray(source.roughCuts)
    ? source.roughCuts.map(normalizeRoughCutRevision).filter((cut): cut is RoughCutRevision => Boolean(cut)).slice(0, 250)
    : [];
  const timelineAssemblies = Array.isArray(source.timelineAssemblies)
    ? source.timelineAssemblies.map(normalizeTimelineAssemblyRevision).filter((assembly): assembly is TimelineAssemblyRevision => Boolean(assembly)).slice(0, 250)
    : [];
  const timelineMotionShots = Array.isArray(source.timelineMotionShots)
    ? source.timelineMotionShots
      .map(normalizeTimelineMotionShot)
      .filter((shot): shot is TimelineMotionShot => Boolean(shot))
      .filter((shot, index, all) => all.findIndex((candidate) => candidate.id === shot.id) === index)
      .slice(0, 2_400)
    : [];
  const screeningObservations = Array.isArray(source.screeningObservations)
    ? source.screeningObservations.map(normalizeScreeningObservation).filter((observation): observation is ScreeningObservation => Boolean(observation)).slice(0, 5_000)
    : [];
  const graphicNovelTextApprovals = Array.isArray(source.graphicNovelTextApprovals)
    ? source.graphicNovelTextApprovals
      .map(normalizeGraphicNovelTextApproval)
      .filter((approval): approval is PrevisGraphicNovelTextApproval => Boolean(approval))
      .filter((approval, index, all) => all.findIndex((candidate) => candidate.anchorRef === approval.anchorRef && candidate.position === approval.position) === index)
      .slice(0, 2_400)
    : [];
  return { shots, soundCues, takes, roughCuts, timelineAssemblies, timelineMotionShots, screeningObservations, graphicNovelTextApprovals };
}