import type { RenderClipSlot } from "../previs";

export const SEQUENCE_EVIDENCE_SCHEMA_VERSION = 1 as const;
export const SEQUENCE_EVIDENCE_GATE_VERSION = "1.0.0" as const;

export type SequenceEvidenceMode = "reference" | "verify" | "continuity";
export type SequenceEvidenceCheckState = "passed" | "failed" | "advisory" | "skipped" | "unavailable" | "stale";
export type SequenceEvidenceSeverity = "blocker" | "major" | "minor" | "advisory";
export type SequenceEvidenceClassification = "blocking" | "advisory";
export type SequenceEvidenceDisposition = "open" | "repair-requested" | "resolved-after-rerun" | "accepted-risk" | "dismissed";
export type SequenceEvidenceMeasurementState = "measured" | "skipped" | "unavailable";

export type SequenceEvidenceGateId =
  | "G1-address-coverage"
  | "G2-duration"
  | "G3-mini-block-coverage"
  | "G4-machine-evidence-integrity"
  | "G5-keyframe-evidence"
  | "G6-camera-motion"
  | "G7-continuity-handoff"
  | "G8-revision-provenance"
  | "G9-annotation-schema"
  | "G10-no-silent-skip";

export type SequenceEvidenceShotSize = "wide" | "medium" | "close" | "extreme-close" | "insert" | "unknown";
export type SequenceEvidenceShotCategory = "establishing" | "coverage" | "reaction" | "detail" | "transition" | "other" | "unknown";
export type SequenceEvidenceCameraMovement =
  | "static"
  | "camera-movement.slow-reveal"
  | "camera-movement.push-attention"
  | "camera-movement.pull-release"
  | "camera-movement.abrupt-snap"
  | "other"
  | "unknown";

export type SequenceEvidenceAnalyzer = Readonly<{
  id: string;
  version: string;
}>;

export type SequenceEvidenceModelProvenance = Readonly<{
  provider: string;
  model: string;
  runtime: string;
  routeId: string;
}>;

export type SequenceEvidenceMachineEvidence = Readonly<{
  id: string;
  mode: SequenceEvidenceMode;
  sourceMediaRef: string;
  sourceMediaHash: string;
  sourceExists: boolean;
  mediaType: string;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  frameRate: number | null;
  codec: string;
  container: string;
  measuredMotion: number | null;
  aFrameRef: string;
  bFrameRef: string;
  contactSheetRef: string;
  canonicalRenderAddress: string;
  canonicalRenderAddressPair: readonly string[];
  blockNumber: number | null;
  miniBlockNumber: number | null;
  productionShotId: string;
  storyboardDependencyKey: string;
  projectId: string;
  projectRevision: number | null;
  generationBaseRevision: number | null;
  generationProvenanceRefs: readonly string[];
  boundaryStartSecond: number | null;
  boundaryEndSecond: number | null;
  measurementState: SequenceEvidenceMeasurementState;
  analyzer: SequenceEvidenceAnalyzer;
  measuredAt: string;
}>;

export type SequenceEvidenceAnnotation = Readonly<{
  shotSize: SequenceEvidenceShotSize;
  shotCategory: SequenceEvidenceShotCategory;
  cameraMovement: SequenceEvidenceCameraMovement;
  visibleDescription: string;
  continuityObservation: string;
  provenance: SequenceEvidenceModelProvenance | null;
  annotatedAt: string;
}>;

export type SequenceEvidenceRecord = Readonly<{
  machine: SequenceEvidenceMachineEvidence;
  annotation: SequenceEvidenceAnnotation | null;
}>;

export type SequenceEvidenceFinding = Readonly<{
  id: string;
  mode: SequenceEvidenceMode;
  projectId: string;
  projectRevision: number | null;
  blockNumber: number | null;
  miniBlockNumber: number | null;
  productionShotId: string;
  renderAddress: string;
  renderAddressPair: readonly string[];
  expectedRefs: readonly string[];
  observedMediaRefs: readonly string[];
  measurementRefs: readonly string[];
  annotationRefs: readonly string[];
  gateId: SequenceEvidenceGateId;
  gateVersion: typeof SEQUENCE_EVIDENCE_GATE_VERSION;
  severity: SequenceEvidenceSeverity;
  classification: SequenceEvidenceClassification;
  state: SequenceEvidenceCheckState;
  explanation: string;
  analyzer: SequenceEvidenceAnalyzer;
  modelProvenance: SequenceEvidenceModelProvenance | null;
  disposition: SequenceEvidenceDisposition;
  createdAt: string;
}>;

export type SequenceEvidenceGateResult = Readonly<{
  gateId: SequenceEvidenceGateId;
  gateVersion: typeof SEQUENCE_EVIDENCE_GATE_VERSION;
  state: SequenceEvidenceCheckState;
  renderAddress: string;
  renderAddressPair: readonly string[];
  explanation: string;
}>;

export type SequenceEvidenceContactSheetItem = Readonly<{
  renderAddress: string;
  aFrameRef: string;
  bFrameRef: string;
}>;

export type SequenceEvidenceMiniBlockReport = Readonly<{
  schemaVersion: typeof SEQUENCE_EVIDENCE_SCHEMA_VERSION;
  mode: "verify" | "continuity";
  projectId: string;
  projectRevision: number;
  blockNumber: number;
  miniBlockNumber: number;
  anchorRef: string;
  expectedRenderAddresses: readonly string[];
  records: readonly SequenceEvidenceRecord[];
  gateResults: readonly SequenceEvidenceGateResult[];
  findings: readonly SequenceEvidenceFinding[];
  contactSheet: readonly SequenceEvidenceContactSheetItem[];
  expectedTechnicalClipCount: 25;
  expectedTechnicalClipSeconds: 3;
  expectedTechnicalCoverageSeconds: 75;
  observedTechnicalClipCount: number;
  observedTechnicalCoverageSeconds: number;
  blockingCount: number;
  advisoryCount: number;
  skippedOrUnavailableCount: number;
  certified: boolean;
  generatedAt: string;
}>;

export type SequenceEvidenceReferenceShot = Readonly<{
  shotIndex: number;
  startSecond: number;
  endSecond: number;
  durationSeconds: number;
  machineEvidenceId: string;
}>;

export type SequenceEvidenceReferenceReport = Readonly<{
  schemaVersion: typeof SEQUENCE_EVIDENCE_SCHEMA_VERSION;
  mode: "reference";
  sourceMediaRef: string;
  sourceMediaHash: string;
  durationSeconds: number;
  shots: readonly SequenceEvidenceReferenceShot[];
  shotCount: number;
  averageShotSeconds: number;
  medianShotSeconds: number;
  cutsPerMinute: number;
  canonAuthority: false;
  generatedAt: string;
}>;

export type SequenceEvidenceClipMeasurement = Readonly<{
  renderAddress: string;
  sourceMediaRef: string;
  sourceMediaHash?: string;
  sourceExists: boolean;
  mediaType?: string;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  frameRate?: number | null;
  codec?: string;
  container?: string;
  measuredMotion?: number | null;
  aFrameRef?: string;
  bFrameRef?: string;
  contactSheetRef?: string;
  productionShotId?: string;
  storyboardDependencyKey?: string;
  projectRevision?: number | null;
  generationBaseRevision?: number | null;
  generationProvenanceRefs?: readonly string[];
  measurementState?: SequenceEvidenceMeasurementState;
  analyzer?: Partial<SequenceEvidenceAnalyzer>;
  measuredAt?: string;
}>;

export type SequenceEvidenceAnnotationInput = Readonly<{
  shotSize?: string;
  shotCategory?: string;
  cameraMovement?: string;
  visibleDescription?: string;
  continuityObservation?: string;
  provenance?: Partial<SequenceEvidenceModelProvenance> | null;
  annotatedAt?: string;
}>;

const SHOT_SIZES = new Set<SequenceEvidenceShotSize>(["wide", "medium", "close", "extreme-close", "insert", "unknown"]);
const SHOT_CATEGORIES = new Set<SequenceEvidenceShotCategory>(["establishing", "coverage", "reaction", "detail", "transition", "other", "unknown"]);
const CAMERA_MOVEMENTS = new Set<SequenceEvidenceCameraMovement>([
  "static",
  "camera-movement.slow-reveal",
  "camera-movement.push-attention",
  "camera-movement.pull-release",
  "camera-movement.abrupt-snap",
  "other",
  "unknown",
]);

function cleanText(value: unknown, maximum = 500) {
  return typeof value === "string" ? value.replace(/\u0000/g, "").trim().slice(0, maximum) : "";
}

function finite(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

function integer(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

function timestamp(value: unknown, fallback = new Date().toISOString()) {
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function stringList(value: unknown, maximum = 80) {
  return Object.freeze(Array.isArray(value)
    ? [...new Set(value.map((item) => cleanText(item, 240)).filter(Boolean))].slice(0, maximum)
    : []);
}

function analyzer(value: unknown): SequenceEvidenceAnalyzer {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<SequenceEvidenceAnalyzer> : {};
  return Object.freeze({
    id: cleanText(source.id, 120) || "unavailable",
    version: cleanText(source.version, 80) || "unknown",
  });
}

function modelProvenance(value: unknown): SequenceEvidenceModelProvenance | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Partial<SequenceEvidenceModelProvenance>;
  const provider = cleanText(source.provider, 120);
  const model = cleanText(source.model, 160);
  const runtime = cleanText(source.runtime, 120);
  const routeId = cleanText(source.routeId, 160);
  if (!provider && !model && !runtime && !routeId) return null;
  return Object.freeze({ provider, model, runtime, routeId });
}

export function normalizeSequenceEvidenceMachineEvidence(value: Partial<SequenceEvidenceMachineEvidence>): SequenceEvidenceMachineEvidence {
  const mode: SequenceEvidenceMode = value.mode === "reference" || value.mode === "continuity" ? value.mode : "verify";
  const measurementState: SequenceEvidenceMeasurementState = value.measurementState === "skipped" || value.measurementState === "unavailable"
    ? value.measurementState
    : "measured";
  const pair = stringList(value.canonicalRenderAddressPair, 2);
  const blockNumber = integer(value.blockNumber, 1, 24);
  const miniBlockNumber = integer(value.miniBlockNumber, 1, 4);
  return Object.freeze({
    id: cleanText(value.id, 180),
    mode,
    sourceMediaRef: cleanText(value.sourceMediaRef, 500),
    sourceMediaHash: cleanText(value.sourceMediaHash, 180),
    sourceExists: value.sourceExists === true,
    mediaType: cleanText(value.mediaType, 120),
    durationSeconds: finite(value.durationSeconds, 0, 86_400),
    width: integer(value.width, 1, 32_768),
    height: integer(value.height, 1, 32_768),
    frameRate: finite(value.frameRate, 0.01, 1_000),
    codec: cleanText(value.codec, 120),
    container: cleanText(value.container, 120),
    measuredMotion: finite(value.measuredMotion, 0, 1),
    aFrameRef: cleanText(value.aFrameRef, 500),
    bFrameRef: cleanText(value.bFrameRef, 500),
    contactSheetRef: cleanText(value.contactSheetRef, 500),
    canonicalRenderAddress: cleanText(value.canonicalRenderAddress, 240),
    canonicalRenderAddressPair: pair,
    blockNumber,
    miniBlockNumber,
    productionShotId: cleanText(value.productionShotId, 180),
    storyboardDependencyKey: cleanText(value.storyboardDependencyKey, 360),
    projectId: cleanText(value.projectId, 180),
    projectRevision: integer(value.projectRevision),
    generationBaseRevision: integer(value.generationBaseRevision),
    generationProvenanceRefs: stringList(value.generationProvenanceRefs),
    boundaryStartSecond: finite(value.boundaryStartSecond, 0, 86_400),
    boundaryEndSecond: finite(value.boundaryEndSecond, 0, 86_400),
    measurementState,
    analyzer: analyzer(value.analyzer),
    measuredAt: timestamp(value.measuredAt),
  });
}

export function normalizeSequenceEvidenceAnnotation(value: SequenceEvidenceAnnotationInput): SequenceEvidenceAnnotation {
  const shotSize = SHOT_SIZES.has(value.shotSize as SequenceEvidenceShotSize) ? value.shotSize as SequenceEvidenceShotSize : "unknown";
  const shotCategory = SHOT_CATEGORIES.has(value.shotCategory as SequenceEvidenceShotCategory) ? value.shotCategory as SequenceEvidenceShotCategory : "unknown";
  const cameraMovement = CAMERA_MOVEMENTS.has(value.cameraMovement as SequenceEvidenceCameraMovement)
    ? value.cameraMovement as SequenceEvidenceCameraMovement
    : "unknown";
  return Object.freeze({
    shotSize,
    shotCategory,
    cameraMovement,
    visibleDescription: cleanText(value.visibleDescription, 600),
    continuityObservation: cleanText(value.continuityObservation, 600),
    provenance: modelProvenance(value.provenance),
    annotatedAt: timestamp(value.annotatedAt),
  });
}

export function sequenceEvidenceAnnotationErrors(value: SequenceEvidenceAnnotationInput) {
  const errors: string[] = [];
  if (value.shotSize !== undefined && !SHOT_SIZES.has(value.shotSize as SequenceEvidenceShotSize)) errors.push("shotSize is outside the reviewed Sequence Evidence vocabulary");
  if (value.shotCategory !== undefined && !SHOT_CATEGORIES.has(value.shotCategory as SequenceEvidenceShotCategory)) errors.push("shotCategory is outside the reviewed Sequence Evidence vocabulary");
  if (value.cameraMovement !== undefined && !CAMERA_MOVEMENTS.has(value.cameraMovement as SequenceEvidenceCameraMovement)) errors.push("cameraMovement is outside the reviewed Sequence Evidence vocabulary");
  return errors;
}

export function attachSequenceEvidenceAnnotation(
  machine: SequenceEvidenceMachineEvidence,
  value: SequenceEvidenceAnnotationInput,
): SequenceEvidenceRecord {
  const immutableMachine = normalizeSequenceEvidenceMachineEvidence(machine);
  const errors = sequenceEvidenceAnnotationErrors(value);
  if (errors.length) throw new Error(`Invalid Sequence Evidence annotation: ${errors.join("; ")}`);
  return Object.freeze({ machine: immutableMachine, annotation: normalizeSequenceEvidenceAnnotation(value) });
}

export function sequenceEvidenceMachineForRenderSlot(
  slot: RenderClipSlot,
  measurement: SequenceEvidenceClipMeasurement,
  context: { readonly projectId: string; readonly projectRevision: number; readonly mode?: "verify" | "continuity" },
): SequenceEvidenceMachineEvidence {
  return normalizeSequenceEvidenceMachineEvidence({
    id: `sequence-evidence:${slot.id}`,
    mode: context.mode ?? "verify",
    sourceMediaRef: measurement.sourceMediaRef,
    sourceMediaHash: measurement.sourceMediaHash ?? "",
    sourceExists: measurement.sourceExists,
    mediaType: measurement.mediaType ?? "",
    durationSeconds: measurement.durationSeconds ?? null,
    width: measurement.width ?? null,
    height: measurement.height ?? null,
    frameRate: measurement.frameRate ?? null,
    codec: measurement.codec ?? "",
    container: measurement.container ?? "",
    measuredMotion: measurement.measuredMotion ?? null,
    aFrameRef: measurement.aFrameRef ?? "",
    bFrameRef: measurement.bFrameRef ?? "",
    contactSheetRef: measurement.contactSheetRef ?? "",
    canonicalRenderAddress: slot.id,
    canonicalRenderAddressPair: [],
    blockNumber: slot.blockNumber,
    miniBlockNumber: slot.miniBlockNumber,
    productionShotId: measurement.productionShotId ?? "",
    storyboardDependencyKey: measurement.storyboardDependencyKey ?? "",
    projectId: context.projectId,
    projectRevision: context.projectRevision,
    generationBaseRevision: measurement.generationBaseRevision ?? measurement.projectRevision ?? null,
    generationProvenanceRefs: measurement.generationProvenanceRefs ?? [],
    boundaryStartSecond: slot.startSecond,
    boundaryEndSecond: slot.endSecond,
    measurementState: measurement.measurementState ?? "measured",
    analyzer: measurement.analyzer ?? {},
    measuredAt: measurement.measuredAt,
  });
}
