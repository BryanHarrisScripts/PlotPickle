import {
  SEQUENCE_EVIDENCE_GATE_VERSION,
  SEQUENCE_EVIDENCE_SCHEMA_VERSION,
  attachSequenceEvidenceAnnotation,
  normalizeSequenceEvidenceMachineEvidence,
  sequenceEvidenceAnnotationErrors,
  sequenceEvidenceMachineForRenderSlot,
  type SequenceEvidenceAnnotationInput,
  type SequenceEvidenceCameraMovement,
  type SequenceEvidenceCheckState,
  type SequenceEvidenceClipMeasurement,
  type SequenceEvidenceContactSheetItem,
  type SequenceEvidenceFinding,
  type SequenceEvidenceGateId,
  type SequenceEvidenceGateResult,
  type SequenceEvidenceMiniBlockReport,
  type SequenceEvidenceModelProvenance,
  type SequenceEvidenceRecord,
  type SequenceEvidenceReferenceReport,
  type SequenceEvidenceReferenceShot,
  type SequenceEvidenceSeverity,
} from "../core/contracts/sequence-evidence";
import type { ProductionShotIntent, RenderClipSlot } from "../core/contracts/previs";
import type { SequenceDirectorDraft } from "../core/contracts/sequence-director";
import { sequenceDirectorRenderSlots } from "../core/contracts/sequence-director";
import { selectCinematographyPrimitives } from "./cinematography-grammar";

export const SEQUENCE_EVIDENCE_DURATION_TOLERANCE_SECONDS = 0.15 as const;
export const SEQUENCE_EVIDENCE_NEAR_ZERO_MOTION = 0.02 as const;
export const SEQUENCE_EVIDENCE_HIGH_MOTION = 0.18 as const;

export type VerifySequenceEvidenceInput = Readonly<{
  projectId: string;
  currentRevision: number;
  blockNumber: number;
  miniBlockNumber: number;
  draft?: SequenceDirectorDraft | null;
  productionShots?: readonly ProductionShotIntent[];
  measurements: readonly SequenceEvidenceClipMeasurement[];
  annotations?: Readonly<Record<string, SequenceEvidenceAnnotationInput>>;
  durationToleranceSeconds?: number;
  nearZeroMotionThreshold?: number;
  highMotionThreshold?: number;
  generatedAt?: string;
}>;

export type SequenceEvidenceReferenceBoundary = Readonly<{
  startSecond: number;
  endSecond: number;
  machineEvidenceId?: string;
}>;

function cleanText(value: unknown, maximum = 500) {
  return typeof value === "string" ? value.replace(/\u0000/g, "").trim().slice(0, maximum) : "";
}

function timestamp(value: unknown) {
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function rounded(value: number, places = 4) {
  const multiplier = 10 ** places;
  return Math.round(value * multiplier) / multiplier;
}

function stableToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180) || "unassigned";
}

function findingId(gateId: SequenceEvidenceGateId, target: string) {
  return `sequence-evidence:${gateId}:${stableToken(target)}`;
}

function gate(
  gateId: SequenceEvidenceGateId,
  state: SequenceEvidenceCheckState,
  explanation: string,
  renderAddress = "",
  renderAddressPair: readonly string[] = [],
): SequenceEvidenceGateResult {
  return Object.freeze({
    gateId,
    gateVersion: SEQUENCE_EVIDENCE_GATE_VERSION,
    state,
    renderAddress,
    renderAddressPair: Object.freeze([...renderAddressPair]),
    explanation: cleanText(explanation, 800),
  });
}

function finding(input: {
  gateId: SequenceEvidenceGateId;
  mode?: "verify" | "continuity" | "reference";
  severity: SequenceEvidenceSeverity;
  classification: "blocking" | "advisory";
  state: SequenceEvidenceCheckState;
  explanation: string;
  projectId: string;
  projectRevision: number | null;
  blockNumber: number | null;
  miniBlockNumber: number | null;
  productionShotId?: string;
  renderAddress?: string;
  renderAddressPair?: readonly string[];
  expectedRefs?: readonly string[];
  observedMediaRefs?: readonly string[];
  measurementRefs?: readonly string[];
  annotationRefs?: readonly string[];
  analyzerId?: string;
  analyzerVersion?: string;
  modelProvenance?: SequenceEvidenceModelProvenance | null;
  createdAt: string;
}): SequenceEvidenceFinding {
  const target = input.renderAddress || input.renderAddressPair?.join("+") || `${input.blockNumber ?? "reference"}-${input.miniBlockNumber ?? ""}`;
  return Object.freeze({
    id: findingId(input.gateId, target),
    mode: input.mode ?? "verify",
    projectId: cleanText(input.projectId, 180),
    projectRevision: input.projectRevision,
    blockNumber: input.blockNumber,
    miniBlockNumber: input.miniBlockNumber,
    productionShotId: cleanText(input.productionShotId, 180),
    renderAddress: cleanText(input.renderAddress, 240),
    renderAddressPair: Object.freeze([...(input.renderAddressPair ?? [])]),
    expectedRefs: Object.freeze([...(input.expectedRefs ?? [])]),
    observedMediaRefs: Object.freeze([...(input.observedMediaRefs ?? [])]),
    measurementRefs: Object.freeze([...(input.measurementRefs ?? [])]),
    annotationRefs: Object.freeze([...(input.annotationRefs ?? [])]),
    gateId: input.gateId,
    gateVersion: SEQUENCE_EVIDENCE_GATE_VERSION,
    severity: input.severity,
    classification: input.classification,
    state: input.state,
    explanation: cleanText(input.explanation, 900),
    analyzer: Object.freeze({ id: cleanText(input.analyzerId, 120) || "unavailable", version: cleanText(input.analyzerVersion, 80) || "unknown" }),
    modelProvenance: input.modelProvenance ?? null,
    disposition: "open",
    createdAt: input.createdAt,
  });
}

function overlappingBeatCameraIntent(draft: SequenceDirectorDraft | null | undefined, slot: RenderClipSlot) {
  if (!draft) return "";
  const localStart = (slot.clipNumber - 1) * 3;
  const localEnd = slot.clipNumber * 3;
  return draft.beats
    .filter((beat) => beat.startSecond !== null && beat.endSecond !== null
      && beat.startSecond < localEnd && beat.endSecond > localStart)
    .map((beat) => beat.cameraIntent)
    .filter(Boolean)
    .join(". ");
}

export function sequenceEvidenceExpectedCameraMovement(
  draft: SequenceDirectorDraft | null | undefined,
  slot: RenderClipSlot,
): SequenceEvidenceCameraMovement {
  const cameraIntent = overlappingBeatCameraIntent(draft, slot);
  const intent = `${cameraIntent} ${draft?.motionFlow ?? ""}`.trim();
  if (!intent) return "unknown";
  if (/\b(?:static|locked[- ]?off|locked camera|tripod|no camera movement|still camera)\b/i.test(intent)) return "static";
  const selection = selectCinematographyPrimitives(intent, { medium: "video", limit: 6 });
  const movement = selection.primitiveIds.find((id) => id.startsWith("camera-movement."));
  if (movement === "camera-movement.slow-reveal"
    || movement === "camera-movement.push-attention"
    || movement === "camera-movement.pull-release"
    || movement === "camera-movement.abrupt-snap") return movement;
  return /\b(?:pan|tilt|truck|dolly|push|pull|crane|orbit|handheld|camera move|tracking)\b/i.test(intent) ? "other" : "unknown";
}

function expectedShotForMeasurement(
  productionShots: readonly ProductionShotIntent[],
  measurement: SequenceEvidenceClipMeasurement,
  anchorRef: string,
) {
  const direct = measurement.productionShotId
    ? productionShots.find((shot) => shot.id === measurement.productionShotId)
    : undefined;
  return direct ?? productionShots.find((shot) => shot.anchorRef === anchorRef && shot.reviewState === "approved") ?? null;
}

function measurementMap(measurements: readonly SequenceEvidenceClipMeasurement[]) {
  const map = new Map<string, SequenceEvidenceClipMeasurement>();
  for (const measurement of measurements) {
    const address = cleanText(measurement.renderAddress, 240);
    if (address && !map.has(address)) map.set(address, measurement);
  }
  return map;
}

function contactSheet(records: readonly SequenceEvidenceRecord[]): readonly SequenceEvidenceContactSheetItem[] {
  return Object.freeze(records.flatMap((record) => {
    const machine = record.machine;
    if (!machine.canonicalRenderAddress || !machine.aFrameRef || !machine.bFrameRef) return [];
    return [{
      renderAddress: machine.canonicalRenderAddress,
      aFrameRef: machine.aFrameRef,
      bFrameRef: machine.bFrameRef,
    }];
  }));
}

function analyzerFor(record: SequenceEvidenceRecord | undefined) {
  return record?.machine.analyzer ?? { id: "unavailable", version: "unknown" };
}

export function verifySequenceEvidenceMiniBlock(input: VerifySequenceEvidenceInput): SequenceEvidenceMiniBlockReport {
  const createdAt = timestamp(input.generatedAt);
  const slots = sequenceDirectorRenderSlots(input.blockNumber, input.miniBlockNumber);
  if (slots.length !== 25) throw new Error("Sequence Evidence requires one canonical 25-address Mini-Block from RenderClipSlot.");
  const anchorRef = slots[0].anchorRef;
  const expectedAddresses = Object.freeze(slots.map((slot) => slot.id));
  const expectedSet = new Set(expectedAddresses);
  const byAddress = measurementMap(input.measurements);
  const durationTolerance = Math.max(0, Math.min(input.durationToleranceSeconds ?? SEQUENCE_EVIDENCE_DURATION_TOLERANCE_SECONDS, 1));
  const nearZeroMotion = Math.max(0, Math.min(input.nearZeroMotionThreshold ?? SEQUENCE_EVIDENCE_NEAR_ZERO_MOTION, 1));
  const highMotion = Math.max(nearZeroMotion, Math.min(input.highMotionThreshold ?? SEQUENCE_EVIDENCE_HIGH_MOTION, 1));
  const productionShots = (input.productionShots ?? []).filter((shot) => shot.anchorRef === anchorRef);
  const gateResults: SequenceEvidenceGateResult[] = [];
  const findings: SequenceEvidenceFinding[] = [];
  const records: SequenceEvidenceRecord[] = [];

  for (const measurement of input.measurements) {
    if (!expectedSet.has(measurement.renderAddress)) {
      const address = cleanText(measurement.renderAddress, 240) || "unknown-address";
      gateResults.push(gate("G1-address-coverage", "failed", "Observed media claimed a render address outside the canonical Mini-Block RenderClipSlot set.", address));
      findings.push(finding({
        gateId: "G1-address-coverage",
        severity: "blocker",
        classification: "blocking",
        state: "failed",
        explanation: "Observed generated media is attached to a non-canonical render address. Sequence Evidence will not renumber the render grid from detected media.",
        projectId: input.projectId,
        projectRevision: input.currentRevision,
        blockNumber: input.blockNumber,
        miniBlockNumber: input.miniBlockNumber,
        renderAddress: address,
        observedMediaRefs: measurement.sourceMediaRef ? [measurement.sourceMediaRef] : [],
        createdAt,
      }));
    }
  }

  for (const slot of slots) {
    const measurement = byAddress.get(slot.id);
    if (!measurement || measurement.sourceExists !== true || !cleanText(measurement.sourceMediaRef, 500)) {
      gateResults.push(gate("G1-address-coverage", "failed", "Canonical render address has no generated media output.", slot.id));
      findings.push(finding({
        gateId: "G1-address-coverage",
        severity: "blocker",
        classification: "blocking",
        state: "failed",
        explanation: `Missing generated output for canonical render address ${slot.id}.`,
        projectId: input.projectId,
        projectRevision: input.currentRevision,
        blockNumber: input.blockNumber,
        miniBlockNumber: input.miniBlockNumber,
        renderAddress: slot.id,
        expectedRefs: [slot.id],
        createdAt,
      }));
      continue;
    }

    const expectedShot = expectedShotForMeasurement(productionShots, measurement, anchorRef);
    const machine = sequenceEvidenceMachineForRenderSlot(slot, measurement, {
      projectId: input.projectId,
      projectRevision: input.currentRevision,
      mode: "verify",
    });
    const annotationInput = input.annotations?.[slot.id];
    let record: SequenceEvidenceRecord = Object.freeze({ machine, annotation: null });
    if (annotationInput) {
      const errors = sequenceEvidenceAnnotationErrors(annotationInput);
      if (errors.length) {
        gateResults.push(gate("G9-annotation-schema", "failed", errors.join("; "), slot.id));
        findings.push(finding({
          gateId: "G9-annotation-schema",
          severity: "major",
          classification: "blocking",
          state: "failed",
          explanation: errors.join("; "),
          projectId: input.projectId,
          projectRevision: input.currentRevision,
          blockNumber: input.blockNumber,
          miniBlockNumber: input.miniBlockNumber,
          productionShotId: expectedShot?.id,
          renderAddress: slot.id,
          observedMediaRefs: [machine.sourceMediaRef],
          analyzerId: machine.analyzer.id,
          analyzerVersion: machine.analyzer.version,
          createdAt,
        }));
      } else {
        record = attachSequenceEvidenceAnnotation(machine, annotationInput);
        gateResults.push(gate("G9-annotation-schema", "passed", "Model annotation uses the reviewed bounded Sequence Evidence vocabulary.", slot.id));
      }
    } else {
      gateResults.push(gate("G9-annotation-schema", "skipped", "No model annotation was supplied; deterministic machine evidence remains usable but annotation checks did not pass.", slot.id));
    }
    records.push(record);

    gateResults.push(gate("G4-machine-evidence-integrity", "passed", "Machine evidence was normalized and frozen separately from model annotation.", slot.id));

    if (machine.measurementState !== "measured") {
      const state = machine.measurementState === "unavailable" ? "unavailable" : "skipped";
      gateResults.push(gate("G10-no-silent-skip", state, `Media measurement is ${state}; Sequence Evidence does not convert it to a pass.`, slot.id));
    } else {
      gateResults.push(gate("G10-no-silent-skip", "passed", "Required deterministic media measurement executed.", slot.id));
    }

    if (machine.durationSeconds === null) {
      const state: SequenceEvidenceCheckState = machine.measurementState === "unavailable" ? "unavailable" : "skipped";
      gateResults.push(gate("G2-duration", state, "Measured duration is unavailable; duration verification did not pass.", slot.id));
    } else if (Math.abs(machine.durationSeconds - 3) > durationTolerance) {
      gateResults.push(gate("G2-duration", "failed", `Measured ${machine.durationSeconds.toFixed(3)} s differs from the canonical 3.000 s render clip beyond ±${durationTolerance.toFixed(3)} s.`, slot.id));
      findings.push(finding({
        gateId: "G2-duration",
        severity: "blocker",
        classification: "blocking",
        state: "failed",
        explanation: `Duration mismatch: expected 3.000 s, observed ${machine.durationSeconds.toFixed(3)} s.`,
        projectId: input.projectId,
        projectRevision: input.currentRevision,
        blockNumber: input.blockNumber,
        miniBlockNumber: input.miniBlockNumber,
        productionShotId: expectedShot?.id,
        renderAddress: slot.id,
        expectedRefs: [slot.id],
        observedMediaRefs: [machine.sourceMediaRef],
        measurementRefs: [machine.id],
        analyzerId: machine.analyzer.id,
        analyzerVersion: machine.analyzer.version,
        createdAt,
      }));
    } else {
      gateResults.push(gate("G2-duration", "passed", "Measured duration agrees with the canonical 3-second RenderClipSlot within tolerance.", slot.id));
    }

    if (machine.aFrameRef && machine.bFrameRef) {
      gateResults.push(gate("G5-keyframe-evidence", "passed", "A/B boundary frame evidence is present.", slot.id));
    } else if (machine.measurementState === "unavailable") {
      gateResults.push(gate("G5-keyframe-evidence", "unavailable", "Boundary-frame extraction capability is unavailable; no placeholder evidence was fabricated.", slot.id));
    } else if (machine.measurementState === "skipped") {
      gateResults.push(gate("G5-keyframe-evidence", "skipped", "Boundary-frame extraction was skipped; no placeholder evidence was fabricated.", slot.id));
    } else {
      gateResults.push(gate("G5-keyframe-evidence", "failed", "Measured output is missing required A/B boundary-frame evidence.", slot.id));
      findings.push(finding({
        gateId: "G5-keyframe-evidence",
        severity: "blocker",
        classification: "blocking",
        state: "failed",
        explanation: "Generated output exists but one or both required A/B evidence frames are missing.",
        projectId: input.projectId,
        projectRevision: input.currentRevision,
        blockNumber: input.blockNumber,
        miniBlockNumber: input.miniBlockNumber,
        productionShotId: expectedShot?.id,
        renderAddress: slot.id,
        observedMediaRefs: [machine.sourceMediaRef],
        measurementRefs: [machine.id],
        analyzerId: machine.analyzer.id,
        analyzerVersion: machine.analyzer.version,
        createdAt,
      }));
    }

    const expectedMovement = sequenceEvidenceExpectedCameraMovement(input.draft, slot);
    if (machine.measuredMotion === null) {
      const state: SequenceEvidenceCheckState = machine.measurementState === "unavailable" ? "unavailable" : "skipped";
      gateResults.push(gate("G6-camera-motion", state, "Measured motion is unavailable; camera-motion cross-check did not pass.", slot.id));
    } else if (expectedMovement !== "static" && expectedMovement !== "unknown" && machine.measuredMotion <= nearZeroMotion) {
      gateResults.push(gate("G6-camera-motion", "failed", `Expected ${expectedMovement}, but measured motion ${machine.measuredMotion.toFixed(4)} is at or below the near-zero threshold ${nearZeroMotion.toFixed(4)}.`, slot.id));
      findings.push(finding({
        gateId: "G6-camera-motion",
        severity: "major",
        classification: "blocking",
        state: "failed",
        explanation: `Camera intent contradiction: ${expectedMovement} was expected but machine-measured motion is near zero.`,
        projectId: input.projectId,
        projectRevision: input.currentRevision,
        blockNumber: input.blockNumber,
        miniBlockNumber: input.miniBlockNumber,
        productionShotId: expectedShot?.id,
        renderAddress: slot.id,
        expectedRefs: expectedShot ? [expectedShot.id, expectedShot.storyboardDependencyKey] : [slot.id],
        observedMediaRefs: [machine.sourceMediaRef],
        measurementRefs: [machine.id],
        analyzerId: machine.analyzer.id,
        analyzerVersion: machine.analyzer.version,
        createdAt,
      }));
    } else if (expectedMovement === "static" && machine.measuredMotion >= highMotion) {
      gateResults.push(gate("G6-camera-motion", "advisory", `Expected a static camera, but measured image change is high (${machine.measuredMotion.toFixed(4)}). Subject motion may explain this, so the result is advisory only.`, slot.id));
      findings.push(finding({
        gateId: "G6-camera-motion",
        severity: "advisory",
        classification: "advisory",
        state: "advisory",
        explanation: "High image change under static-camera intent is ambiguous because subject/environment motion can create pixel change; Human review is required.",
        projectId: input.projectId,
        projectRevision: input.currentRevision,
        blockNumber: input.blockNumber,
        miniBlockNumber: input.miniBlockNumber,
        productionShotId: expectedShot?.id,
        renderAddress: slot.id,
        observedMediaRefs: [machine.sourceMediaRef],
        measurementRefs: [machine.id],
        analyzerId: machine.analyzer.id,
        analyzerVersion: machine.analyzer.version,
        createdAt,
      }));
    } else {
      gateResults.push(gate("G6-camera-motion", "passed", expectedMovement === "unknown"
        ? "No meaningful camera movement was asserted by canonical intent; measured motion is retained as evidence without over-interpreting it."
        : "Measured motion does not contradict the one-sided canonical camera-motion rule.", slot.id));
    }

    const revisionMatches = machine.generationBaseRevision !== null && machine.generationBaseRevision === input.currentRevision;
    const dependencyMatches = !expectedShot
      || !machine.storyboardDependencyKey
      || machine.storyboardDependencyKey === expectedShot.storyboardDependencyKey;
    if (!revisionMatches || !dependencyMatches) {
      const missingRevision = machine.generationBaseRevision === null;
      const state: SequenceEvidenceCheckState = missingRevision ? "unavailable" : "stale";
      gateResults.push(gate("G8-revision-provenance", state, missingRevision
        ? "Generation base revision is unavailable; current-intent certification did not pass."
        : "Generated media provenance is stale or incompatible with the current project/Storyboard dependency.", slot.id));
      if (!missingRevision) {
        findings.push(finding({
          gateId: "G8-revision-provenance",
          severity: "blocker",
          classification: "blocking",
          state: "stale",
          explanation: `Generated media was based on revision ${machine.generationBaseRevision}; current project revision is ${input.currentRevision}${dependencyMatches ? "" : " and the Storyboard dependency key also differs"}.`,
          projectId: input.projectId,
          projectRevision: input.currentRevision,
          blockNumber: input.blockNumber,
          miniBlockNumber: input.miniBlockNumber,
          productionShotId: expectedShot?.id,
          renderAddress: slot.id,
          expectedRefs: expectedShot ? [expectedShot.storyboardDependencyKey] : [],
          observedMediaRefs: [machine.sourceMediaRef],
          measurementRefs: [machine.id],
          analyzerId: machine.analyzer.id,
          analyzerVersion: machine.analyzer.version,
          createdAt,
        }));
      }
    } else {
      gateResults.push(gate("G8-revision-provenance", "passed", "Generated media provenance is compatible with the current project revision and Production Shot dependency.", slot.id));
    }
  }

  const observedCoverage = records.reduce((sum, record) => sum + (record.machine.durationSeconds ?? 0), 0);
  const fullyMeasured = records.length === 25 && records.every((record) => record.machine.durationSeconds !== null);
  if (fullyMeasured && Math.abs(observedCoverage - 75) <= durationTolerance * 25) {
    gateResults.push(gate("G3-mini-block-coverage", "passed", "Canonical 25 × 3-second RenderClipSlot coverage proves the 75-second technical Mini-Block without imposing a creative shot count."));
  } else {
    gateResults.push(gate("G3-mini-block-coverage", records.length < 25 ? "failed" : "unavailable", `Observed technical coverage is ${records.length}/25 clips and ${rounded(observedCoverage, 3)} s; complete measured technical coverage is 75 s.`));
    if (records.length < 25) findings.push(finding({
      gateId: "G3-mini-block-coverage",
      severity: "blocker",
      classification: "blocking",
      state: "failed",
      explanation: `Mini-Block technical coverage is incomplete: ${records.length}/25 canonical render outputs are present. This does not imply any required number of creative shots.`,
      projectId: input.projectId,
      projectRevision: input.currentRevision,
      blockNumber: input.blockNumber,
      miniBlockNumber: input.miniBlockNumber,
      expectedRefs: expectedAddresses,
      observedMediaRefs: records.map((record) => record.machine.sourceMediaRef),
      createdAt,
    }));
  }

  const byRecordAddress = new Map(records.map((record) => [record.machine.canonicalRenderAddress, record]));
  for (let index = 0; index < slots.length - 1; index += 1) {
    const left = byRecordAddress.get(slots[index].id);
    const right = byRecordAddress.get(slots[index + 1].id);
    const pair = Object.freeze([slots[index].id, slots[index + 1].id]);
    if (!left || !right) {
      gateResults.push(gate("G7-continuity-handoff", "unavailable", "Adjacent media is incomplete, so the continuity handoff cannot be claimed.", "", pair));
      continue;
    }
    if (!left.machine.bFrameRef || !right.machine.aFrameRef) {
      const state: SequenceEvidenceCheckState = left.machine.measurementState === "unavailable" || right.machine.measurementState === "unavailable" ? "unavailable" : "failed";
      gateResults.push(gate("G7-continuity-handoff", state, "Exact previous-B / next-A lineage is incomplete; continuity did not pass.", "", pair));
      if (state === "failed") findings.push(finding({
        gateId: "G7-continuity-handoff",
        mode: "continuity",
        severity: "blocker",
        classification: "blocking",
        state: "failed",
        explanation: "Continuity comparison is missing the exact previous-end or next-start boundary frame.",
        projectId: input.projectId,
        projectRevision: input.currentRevision,
        blockNumber: input.blockNumber,
        miniBlockNumber: input.miniBlockNumber,
        renderAddressPair: pair,
        observedMediaRefs: [left.machine.sourceMediaRef, right.machine.sourceMediaRef],
        measurementRefs: [left.machine.id, right.machine.id],
        analyzerId: analyzerFor(left).id,
        analyzerVersion: analyzerFor(left).version,
        createdAt,
      }));
    } else {
      gateResults.push(gate("G7-continuity-handoff", "passed", `Exact lineage preserved: ${left.machine.bFrameRef} -> ${right.machine.aFrameRef}.`, "", pair));
    }
  }

  const blockingCount = findings.filter((item) => item.classification === "blocking").length;
  const advisoryCount = findings.filter((item) => item.classification === "advisory").length;
  const skippedOrUnavailableCount = gateResults.filter((item) => item.state === "skipped" || item.state === "unavailable" || item.state === "stale").length;
  return Object.freeze({
    schemaVersion: SEQUENCE_EVIDENCE_SCHEMA_VERSION,
    mode: "verify",
    projectId: cleanText(input.projectId, 180),
    projectRevision: input.currentRevision,
    blockNumber: input.blockNumber,
    miniBlockNumber: input.miniBlockNumber,
    anchorRef,
    expectedRenderAddresses: expectedAddresses,
    records: Object.freeze(records),
    gateResults: Object.freeze(gateResults),
    findings: Object.freeze(findings),
    contactSheet: contactSheet(records),
    expectedTechnicalClipCount: 25,
    expectedTechnicalClipSeconds: 3,
    expectedTechnicalCoverageSeconds: 75,
    observedTechnicalClipCount: records.length,
    observedTechnicalCoverageSeconds: rounded(observedCoverage, 3),
    blockingCount,
    advisoryCount,
    skippedOrUnavailableCount,
    certified: blockingCount === 0 && skippedOrUnavailableCount === 0,
    generatedAt: createdAt,
  });
}

export function sequenceEvidenceContinuityReport(report: SequenceEvidenceMiniBlockReport): SequenceEvidenceMiniBlockReport {
  const continuityGates = report.gateResults.filter((item) => item.gateId === "G7-continuity-handoff" || item.gateId === "G5-keyframe-evidence");
  const continuityFindings = report.findings.filter((item) => item.gateId === "G7-continuity-handoff" || item.gateId === "G5-keyframe-evidence")
    .map((item) => Object.freeze({ ...item, mode: "continuity" as const }));
  const records = report.records.map((record) => Object.freeze({
    machine: normalizeSequenceEvidenceMachineEvidence({ ...record.machine, mode: "continuity" }),
    annotation: record.annotation,
  }));
  const blockingCount = continuityFindings.filter((item) => item.classification === "blocking").length;
  const advisoryCount = continuityFindings.filter((item) => item.classification === "advisory").length;
  const skippedOrUnavailableCount = continuityGates.filter((item) => item.state === "skipped" || item.state === "unavailable" || item.state === "stale").length;
  return Object.freeze({
    ...report,
    mode: "continuity",
    records: Object.freeze(records),
    gateResults: Object.freeze(continuityGates),
    findings: Object.freeze(continuityFindings),
    blockingCount,
    advisoryCount,
    skippedOrUnavailableCount,
    certified: blockingCount === 0 && skippedOrUnavailableCount === 0,
  });
}

export function buildSequenceEvidenceReferenceReport(input: {
  readonly sourceMediaRef: string;
  readonly sourceMediaHash: string;
  readonly durationSeconds: number;
  readonly boundaries: readonly SequenceEvidenceReferenceBoundary[];
  readonly generatedAt?: string;
}): SequenceEvidenceReferenceReport {
  const sourceMediaRef = cleanText(input.sourceMediaRef, 500);
  const sourceMediaHash = cleanText(input.sourceMediaHash, 180);
  const durationSeconds = Number(input.durationSeconds);
  if (!sourceMediaRef || !sourceMediaHash || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error("REFERENCE Sequence Evidence requires an identified source, content hash and positive measured duration.");
  }
  const boundaries = [...input.boundaries]
    .map((boundary) => ({ startSecond: Number(boundary.startSecond), endSecond: Number(boundary.endSecond), machineEvidenceId: cleanText(boundary.machineEvidenceId, 180) }))
    .filter((boundary) => Number.isFinite(boundary.startSecond) && Number.isFinite(boundary.endSecond)
      && boundary.startSecond >= 0 && boundary.endSecond > boundary.startSecond && boundary.endSecond <= durationSeconds + 0.05)
    .sort((left, right) => left.startSecond - right.startSecond);
  const shots: SequenceEvidenceReferenceShot[] = boundaries.map((boundary, index) => Object.freeze({
    shotIndex: index + 1,
    startSecond: rounded(boundary.startSecond, 3),
    endSecond: rounded(boundary.endSecond, 3),
    durationSeconds: rounded(boundary.endSecond - boundary.startSecond, 3),
    machineEvidenceId: boundary.machineEvidenceId || `reference-boundary-${index + 1}`,
  }));
  const durations = shots.map((shot) => shot.durationSeconds).sort((left, right) => left - right);
  const average = durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 0;
  const middle = Math.floor(durations.length / 2);
  const median = !durations.length ? 0 : durations.length % 2 ? durations[middle] : (durations[middle - 1] + durations[middle]) / 2;
  const cuts = Math.max(0, shots.length - 1);
  return Object.freeze({
    schemaVersion: SEQUENCE_EVIDENCE_SCHEMA_VERSION,
    mode: "reference",
    sourceMediaRef,
    sourceMediaHash,
    durationSeconds: rounded(durationSeconds, 3),
    shots: Object.freeze(shots),
    shotCount: shots.length,
    averageShotSeconds: rounded(average, 3),
    medianShotSeconds: rounded(median, 3),
    cutsPerMinute: rounded((cuts / durationSeconds) * 60, 3),
    canonAuthority: false,
    generatedAt: timestamp(input.generatedAt),
  });
}

export function sequenceEvidenceQaFindings(report: SequenceEvidenceMiniBlockReport, routeId = "visual-production") {
  return Object.freeze(report.findings.map((item) => Object.freeze({
    fingerprint: stableToken(`${item.gateId}:${item.renderAddress || item.renderAddressPair.join("+")}:${item.state}`),
    severity: item.severity === "blocker" ? "blocker" : item.severity === "major" ? "major" : "minor",
    routeId,
    expectedRef: item.expectedRefs[0] || report.anchorRef,
    actualRef: item.observedMediaRefs[0] || item.measurementRefs[0] || item.renderAddress || item.renderAddressPair.join("+"),
    reproductionRefs: Object.freeze([item.id, ...item.measurementRefs, ...item.renderAddressPair].filter(Boolean)),
    linkedIssue: "",
  })));
}
