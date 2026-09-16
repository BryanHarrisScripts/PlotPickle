import {
  renderClipSlotsForAnchor,
  type ProductionShotIntent,
  type RenderClipSlot,
} from "../../core/contracts/previs";
import type { SequenceEvidenceClipMeasurement } from "../../core/contracts/sequence-evidence";
import type { PreproductionProductionIntent } from "./production-intent-handoff";

export type PreproductionSequenceEvidenceBindingMode =
  | "no-creative-shot"
  | "single-creative-shot"
  | "explicit-clip-shot-provenance"
  | "technical-only-multi-shot";

export type PreproductionCreativeShotEvidenceRef = {
  readonly editorialShotId: string;
  readonly productionShotId: string;
  readonly order: number;
  readonly storyboardArtifactId: string;
  readonly storyboardDependencyKey: string;
};

export type PreproductionRenderEvidenceHandoff = {
  readonly projectId: string;
  readonly canonicalRevision: number;
  readonly anchorRef: string;
  readonly blockNumber: number;
  readonly miniBlockNumber: number;
  /** Fixed technical execution addresses. These are never creative-shot identities. */
  readonly technicalRenderSlots: readonly RenderClipSlot[];
  /** Variable creative shots approved for this anchor. */
  readonly creativeShotRefs: readonly PreproductionCreativeShotEvidenceRef[];
  readonly technicalClipCount: number;
  readonly creativeShotCount: number;
  /** Safe ProductionShotIntent inputs for the existing Sequence Evidence verifier. */
  readonly sequenceEvidenceProductionShots: readonly ProductionShotIntent[];
  readonly bindingMode: PreproductionSequenceEvidenceBindingMode;
  /** Canonical render addresses that supplied media but did not identify a creative shot. */
  readonly unresolvedRenderAddresses: readonly string[];
};

export type PreparePreproductionRenderEvidenceHandoffInput = {
  readonly productionIntent: PreproductionProductionIntent;
  readonly productionShots: readonly ProductionShotIntent[];
  readonly blockNumber: number;
  readonly miniBlockNumber: number;
  readonly measurements?: readonly Pick<SequenceEvidenceClipMeasurement, "renderAddress" | "productionShotId">[];
};

function stableStrings(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))].sort();
}

function creativeShotsForAnchor(intent: PreproductionProductionIntent, anchorRef: string) {
  return intent.shots
    .filter((shot) => shot.anchorRef === anchorRef)
    .sort((left, right) => left.order - right.order || left.execution.productionShotId.localeCompare(right.execution.productionShotId));
}

function currentProductionShots(
  intent: PreproductionProductionIntent,
  productionShots: readonly ProductionShotIntent[],
  anchorRef: string,
) {
  return creativeShotsForAnchor(intent, anchorRef).map((shot) => {
    const current = productionShots.find((candidate) => candidate.id === shot.execution.productionShotId);
    if (!current) {
      throw new Error(`Approved production intent references missing Production Shot ${shot.execution.productionShotId}.`);
    }
    if (current.reviewState !== "approved") {
      throw new Error(`Production Shot ${current.id} is no longer approved for Sequence Evidence.`);
    }
    if (current.anchorRef !== anchorRef) {
      throw new Error(`Production Shot ${current.id} no longer belongs to ${anchorRef}.`);
    }
    if (current.storyboardArtifactId !== shot.execution.storyboardArtifactId
      || current.storyboardDependencyKey !== shot.execution.storyboardDependencyKey) {
      throw new Error(`Production Shot ${current.id} is stale relative to the approved pre-production intent.`);
    }
    return current;
  });
}

/**
 * Phase 8 adapter between approved #2092 production intent and the existing
 * RenderClip/Sequence Evidence system. It deliberately keeps the fixed 25-slot
 * technical grid independent from variable creative-shot density.
 *
 * When multiple creative shots share one Mini-Block, missing per-clip shot
 * provenance does not fall back to the first shot. Instead the verifier receives
 * no creative-shot candidates and remains technical-only until explicit IDs are
 * available. This prevents a fixed render grid from becoming a hidden shot quota
 * or silently assigning evidence to the wrong creative shot.
 */
export function preparePreproductionRenderEvidenceHandoff(
  input: PreparePreproductionRenderEvidenceHandoffInput,
): PreproductionRenderEvidenceHandoff {
  const slots = renderClipSlotsForAnchor(input.blockNumber, input.miniBlockNumber);
  if (slots.length !== 25) {
    throw new Error("PRE-PRODUCTION Render Evidence handoff requires one canonical 25-slot Mini-Block render grid.");
  }
  const anchorRef = slots[0].anchorRef;
  const intentShots = creativeShotsForAnchor(input.productionIntent, anchorRef);
  const currentShots = currentProductionShots(input.productionIntent, input.productionShots, anchorRef);
  const slotIds = new Set(slots.map((slot) => slot.id));
  const intentShotIds = new Set(intentShots.map((shot) => shot.execution.productionShotId));
  const canonicalMeasurements = (input.measurements ?? []).filter((measurement) => slotIds.has(measurement.renderAddress));

  for (const measurement of canonicalMeasurements) {
    const productionShotId = String(measurement.productionShotId ?? "").trim();
    if (productionShotId && !intentShotIds.has(productionShotId)) {
      throw new Error(`Sequence Evidence render address ${measurement.renderAddress} references Production Shot ${productionShotId}, which is not in the approved production intent for ${anchorRef}.`);
    }
  }

  const unresolvedRenderAddresses = stableStrings(canonicalMeasurements
    .filter((measurement) => !String(measurement.productionShotId ?? "").trim())
    .map((measurement) => measurement.renderAddress));

  let bindingMode: PreproductionSequenceEvidenceBindingMode;
  let sequenceEvidenceProductionShots: readonly ProductionShotIntent[];
  if (intentShots.length === 0) {
    bindingMode = "no-creative-shot";
    sequenceEvidenceProductionShots = [];
  } else if (intentShots.length === 1) {
    bindingMode = "single-creative-shot";
    sequenceEvidenceProductionShots = currentShots;
  } else if (canonicalMeasurements.length > 0 && unresolvedRenderAddresses.length === 0) {
    bindingMode = "explicit-clip-shot-provenance";
    sequenceEvidenceProductionShots = currentShots;
  } else {
    bindingMode = "technical-only-multi-shot";
    sequenceEvidenceProductionShots = [];
  }

  return {
    projectId: input.productionIntent.projectId,
    canonicalRevision: input.productionIntent.canonicalRevision,
    anchorRef,
    blockNumber: input.blockNumber,
    miniBlockNumber: input.miniBlockNumber,
    technicalRenderSlots: slots,
    creativeShotRefs: intentShots.map((shot) => ({
      editorialShotId: shot.editorialShotId,
      productionShotId: shot.execution.productionShotId,
      order: shot.order,
      storyboardArtifactId: shot.execution.storyboardArtifactId,
      storyboardDependencyKey: shot.execution.storyboardDependencyKey,
    })),
    technicalClipCount: slots.length,
    creativeShotCount: intentShots.length,
    sequenceEvidenceProductionShots,
    bindingMode,
    unresolvedRenderAddresses,
  };
}
