import type { PrevisProductionState, RoughCutRevision } from "../contracts/previs";
import type { PlotPickleMediaEngineEvidence } from "./media-engine-contract";
import { projectPlotPickleProductionPacket } from "../../lib/preproduction/production-convergence";

export type TimelineMediaInstruction = Readonly<{
  order: number;
  productionShotId: string;
  takeId: string;
  mediaRef: string;
  durationMs: number;
  transitionIn: string;
  transitionOut: string;
  audioSourceRefs: readonly string[];
  sourceRefs: readonly string[];
}>;

export type RoughCutAssemblyPlan = Readonly<{
  providerNeutral: true;
  canonical: false;
  roughCutId: string;
  instructions: readonly TimelineMediaInstruction[];
  sourceRefs: readonly string[];
}>;

export function normalizeApprovedTimelineForRoughCut(input: {
  production: PrevisProductionState;
  roughCut: RoughCutRevision;
  currentRevision: number;
}): RoughCutAssemblyPlan {
  const instructions = input.roughCut.placements.flatMap((placement, placementIndex) => {
    const shot = input.production.shots.find((candidate) => candidate.id === placement.productionShotId);
    if (!shot || shot.reviewState !== "approved" || !shot.durationSeconds || shot.durationSeconds <= 0) return [];
    const packet = projectPlotPickleProductionPacket({
      production: input.production,
      productionShotId: shot.id,
      currentRevision: input.currentRevision,
    });
    if (!packet?.approvedTakeId || placement.takeId !== packet.approvedTakeId) return [];
    const take = packet.takes.find((candidate) => candidate.take.id === packet.approvedTakeId && !candidate.stale)?.take;
    if (!take) return [];
    const approvedCueIds = new Set(placement.soundCueIds);
    const audio = packet.soundCues.filter((cue) => cue.reviewState !== "rejected" && approvedCueIds.has(cue.id));
    return [{
      order: placementIndex + 1,
      productionShotId: shot.id,
      takeId: take.id,
      mediaRef: take.mediaRef,
      durationMs: Math.round(shot.durationSeconds * 1000),
      transitionIn: shot.transitionIn,
      transitionOut: shot.transitionOut,
      audioSourceRefs: audio.flatMap((cue) => [cue.id, ...cue.sourceRefs]),
      sourceRefs: [...new Set([shot.id, shot.storyboardArtifactId, shot.storyboardDependencyKey, take.id, take.mediaRef, ...take.provenanceRefs])],
    }];
  });
  return {
    providerNeutral: true,
    canonical: false,
    roughCutId: input.roughCut.id,
    instructions,
    sourceRefs: [...new Set(instructions.flatMap((instruction) => instruction.sourceRefs))],
  };
}

export type RoughCutMediaEvidence = Readonly<{
  roughCutId: string;
  state: "succeeded" | "failed" | "fallback";
  engineEvidence: readonly PlotPickleMediaEngineEvidence[];
  sourceRefs: readonly string[];
  reason: string;
}>;

export function roughCutEvidence(input: {
  plan: RoughCutAssemblyPlan;
  engineEvidence: readonly PlotPickleMediaEngineEvidence[];
}): RoughCutMediaEvidence {
  const failed = input.engineEvidence.some((evidence) => evidence.state !== "succeeded");
  return {
    roughCutId: input.plan.roughCutId,
    state: input.engineEvidence.length === 0 ? "fallback" : failed ? "failed" : "succeeded",
    engineEvidence: input.engineEvidence,
    sourceRefs: input.plan.sourceRefs,
    reason: input.engineEvidence.length === 0
      ? "No optional media-engine output is available; the existing Rough Cut path remains authoritative."
      : failed
        ? "Optional media-engine assembly did not complete; Timeline and Rough Cut state were not mutated."
        : "Optional media-engine evidence matches approved PlotPickle Timeline intent.",
  };
}
