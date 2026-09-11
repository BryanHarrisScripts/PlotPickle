import type { RenderClipSlot } from "../core/contracts/previs";
import type { SequenceEvidenceClipMeasurement } from "../core/contracts/sequence-evidence";
import {
  normalizeProjectAssetRegistry,
  type ProjectAssetReference,
  type ProjectAssetRegistry,
} from "./projects/persistence/project-assets";

export type SequenceEvidenceAssetBinding = Readonly<{
  slot: RenderClipSlot;
  reference: ProjectAssetReference;
  productionShotId?: string;
  storyboardDependencyKey?: string;
  generationBaseRevision?: number | null;
}>;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function integer(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function sequenceEvidenceMeasurementFromProjectAsset(
  value: ProjectAssetRegistry,
  binding: SequenceEvidenceAssetBinding,
): SequenceEvidenceClipMeasurement {
  const registry = normalizeProjectAssetRegistry(value);
  const asset = registry.assets.find((item) => item.id === binding.reference.assetId);
  const variation = asset?.variations.find((item) => item.id === binding.reference.variationId);
  if (!asset || !variation || asset.kind !== "video") {
    return Object.freeze({
      renderAddress: binding.slot.id,
      sourceMediaRef: "",
      sourceExists: false,
      productionShotId: binding.productionShotId ?? "",
      storyboardDependencyKey: binding.storyboardDependencyKey ?? "",
      generationBaseRevision: binding.generationBaseRevision ?? null,
      generationProvenanceRefs: [],
      measurementState: "unavailable",
      analyzer: { id: "project-asset-registry", version: "1.0.0" },
    });
  }

  const extensions = record(variation.extensions);
  const recordedBaseRevision = integer(extensions.generationBaseRevision);
  return Object.freeze({
    renderAddress: binding.slot.id,
    sourceMediaRef: variation.source || variation.portablePath,
    sourceMediaHash: variation.contentHash || variation.sourceFingerprint,
    sourceExists: Boolean(variation.source || variation.portablePath),
    mediaType: variation.mediaType,
    durationSeconds: null,
    width: null,
    height: null,
    frameRate: null,
    codec: "",
    container: "",
    measuredMotion: null,
    aFrameRef: "",
    bFrameRef: "",
    productionShotId: binding.productionShotId ?? "",
    storyboardDependencyKey: binding.storyboardDependencyKey ?? "",
    generationBaseRevision: binding.generationBaseRevision ?? recordedBaseRevision,
    generationProvenanceRefs: variation.provenanceIds,
    measurementState: "unavailable",
    analyzer: { id: "project-asset-registry", version: "1.0.0" },
  });
}

export function sequenceEvidenceGenerationProvenanceFromProjectAsset(
  value: ProjectAssetRegistry,
  reference: ProjectAssetReference,
) {
  const registry = normalizeProjectAssetRegistry(value);
  const asset = registry.assets.find((item) => item.id === reference.assetId);
  const variation = asset?.variations.find((item) => item.id === reference.variationId);
  if (!asset || !variation) return null;
  return Object.freeze({
    assetId: asset.id,
    variationId: variation.id,
    approval: variation.approval,
    approved: asset.approvedVariationId === variation.id || variation.approval === "approved",
    sourceFingerprint: variation.sourceFingerprint,
    contentHash: variation.contentHash,
    provider: variation.provider,
    model: variation.model,
    generatedAt: variation.generatedAt,
    provenanceIds: Object.freeze([...variation.provenanceIds]),
    extensions: Object.freeze({ ...variation.extensions }),
  });
}
