import type {
  PrevisProductionState,
  ProductionShotIntent,
  ProductionSoundCue,
  ProductionTake,
  RoughCutPlacement,
  RoughCutRevision,
  ScreeningObservation,
} from "../../core/contracts/previs";

export type ProductionPacketTakeProjection = {
  readonly take: ProductionTake;
  readonly stale: boolean;
  readonly staleBecause: readonly string[];
};

export type PlotPickleProductionPacket = {
  readonly projectionOnly: true;
  readonly providerNeutral: true;
  readonly productionShotId: string;
  readonly anchorRef: string;
  readonly storyboardArtifactId: string;
  readonly storyboardDependencyKey: string;
  readonly intendedDurationSeconds: number | null;
  readonly soundCues: readonly ProductionSoundCue[];
  readonly takes: readonly ProductionPacketTakeProjection[];
  readonly approvedTakeId: string | null;
  readonly activeCutIds: readonly string[];
  readonly screeningObservations: readonly ScreeningObservation[];
  readonly sourceRefs: readonly string[];
};

export type RoughCutAnchorProjection = {
  readonly projectionOnly: true;
  readonly anchorRef: string;
  readonly shots: readonly Readonly<{
    shot: ProductionShotIntent;
    packet: PlotPickleProductionPacket;
    placement: RoughCutPlacement | null;
  }>[];
  readonly cuts: readonly RoughCutRevision[];
};

export type ScreeningProjection = {
  readonly projectionOnly: true;
  readonly cut: RoughCutRevision | null;
  readonly observations: readonly ScreeningObservation[];
  readonly unresolved: readonly ScreeningObservation[];
};

function stableStrings(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))].sort();
}

function newest<T extends { readonly createdAt: string }>(values: readonly T[]) {
  return [...values].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function downstream(state: PrevisProductionState) {
  return {
    soundCues: state.soundCues ?? [],
    takes: state.takes ?? [],
    roughCuts: state.roughCuts ?? [],
    screeningObservations: state.screeningObservations ?? [],
  } as const;
}

/**
 * Read-only Production Packet projection for #2458.
 *
 * This is intentionally assembled from existing authorities. It does not become
 * a second canon store and it never compiles a provider prompt.
 */
export function projectPlotPickleProductionPacket(input: {
  readonly production: PrevisProductionState;
  readonly productionShotId: string;
  readonly currentRevision: number;
}): PlotPickleProductionPacket | null {
  const shot = input.production.shots.find((candidate) => candidate.id === input.productionShotId);
  if (!shot) return null;
  const { soundCues, takes, roughCuts, screeningObservations } = downstream(input.production);
  const shotTakes = newest(takes.filter((take) => take.productionShotId === shot.id));
  const projectedTakes = shotTakes.map((take): ProductionPacketTakeProjection => {
    const staleBecause = [
      ...(take.sourceRevision !== input.currentRevision ? [`source revision ${take.sourceRevision} != current revision ${input.currentRevision}`] : []),
      ...(take.storyboardDependencyKey !== shot.storyboardDependencyKey ? ["Storyboard dependency changed"] : []),
    ];
    return { take, stale: staleBecause.length > 0, staleBecause };
  });
  const validApprovedTake = projectedTakes.find((item) => item.take.reviewState === "approved" && !item.stale) ?? null;
  const shotCues = soundCues.filter((cue) => cue.productionShotId === shot.id || (!cue.productionShotId && cue.anchorRef === shot.anchorRef));
  const activeCuts = newest(roughCuts.filter((cut) => cut.placements.some((placement) => placement.productionShotId === shot.id)));
  const activeCutIds = activeCuts.map((cut) => cut.id);
  const activeCutSet = new Set(activeCutIds);
  const observations = screeningObservations.filter((item) => (
    item.productionShotId === shot.id || activeCutSet.has(item.roughCutId)
  ));

  return {
    projectionOnly: true,
    providerNeutral: true,
    productionShotId: shot.id,
    anchorRef: shot.anchorRef,
    storyboardArtifactId: shot.storyboardArtifactId,
    storyboardDependencyKey: shot.storyboardDependencyKey,
    intendedDurationSeconds: shot.durationSeconds,
    soundCues: shotCues,
    takes: projectedTakes,
    approvedTakeId: validApprovedTake?.take.id ?? null,
    activeCutIds,
    screeningObservations: observations,
    sourceRefs: stableStrings([
      shot.id,
      shot.storyboardArtifactId,
      shot.storyboardDependencyKey,
      ...shot.roughMotionEvidenceRefs ?? [],
      ...shotCues.flatMap((cue) => [cue.id, ...cue.sourceRefs]),
      ...shotTakes.flatMap((take) => [take.id, take.mediaRef, ...take.provenanceRefs]),
      ...activeCutIds,
      ...observations.map((item) => item.id),
    ]),
  };
}

export function projectRoughCutAnchor(input: {
  readonly production: PrevisProductionState;
  readonly anchorRef: string;
  readonly currentRevision: number;
}): RoughCutAnchorProjection {
  const cuts = newest((input.production.roughCuts ?? []).filter((cut) => (
    cut.placements.some((placement) => input.production.shots.some((shot) => (
      shot.id === placement.productionShotId && shot.anchorRef === input.anchorRef
    )))
  )));
  const currentCut = cuts[0] ?? null;
  const placementByShot = new Map((currentCut?.placements ?? []).map((placement) => [placement.productionShotId, placement] as const));
  const shots = input.production.shots
    .filter((shot) => shot.anchorRef === input.anchorRef)
    .sort((left, right) => left.order - right.order)
    .flatMap((shot) => {
      const packet = projectPlotPickleProductionPacket({
        production: input.production,
        productionShotId: shot.id,
        currentRevision: input.currentRevision,
      });
      return packet ? [{ shot, packet, placement: placementByShot.get(shot.id) ?? null }] : [];
    });
  return { projectionOnly: true, anchorRef: input.anchorRef, shots, cuts };
}

export function projectScreening(input: {
  readonly production: PrevisProductionState;
  readonly roughCutId?: string;
}): ScreeningProjection {
  const cuts = newest(input.production.roughCuts ?? []);
  const cut = input.roughCutId
    ? cuts.find((candidate) => candidate.id === input.roughCutId) ?? null
    : cuts[0] ?? null;
  const observations = cut
    ? newest((input.production.screeningObservations ?? []).filter((item) => item.roughCutId === cut.id))
    : [];
  return {
    projectionOnly: true,
    cut,
    observations,
    unresolved: observations.filter((item) => item.state === "observed"),
  };
}
