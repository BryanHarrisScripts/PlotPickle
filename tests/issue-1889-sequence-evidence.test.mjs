import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

import {
  probeSequenceEvidenceMedia,
  sequenceEvidenceBoundaryFrameTimes,
  sequenceEvidenceMediaCapabilities,
  sequenceEvidenceNormalizedFrameDifference,
} from "../lib/sequence-evidence-media-probe.mjs";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const asDataUrl = (text) => `data:text/javascript;base64,${Buffer.from(text).toString("base64")}`;

async function loadRuntime() {
  const previsSource = stripTypeScriptTypes(await source("core/contracts/previs/index.ts"));
  const previsUrl = asDataUrl(previsSource);

  const sequenceDirectorSource = stripTypeScriptTypes(await source("core/contracts/sequence-director/index.ts"))
    .replaceAll('"../previs"', JSON.stringify(previsUrl));
  const sequenceDirectorUrl = asDataUrl(sequenceDirectorSource);

  const cinematographySource = stripTypeScriptTypes(await source("lib/cinematography-grammar.ts"));
  const cinematographyUrl = asDataUrl(cinematographySource);

  const evidenceContractSource = stripTypeScriptTypes(await source("core/contracts/sequence-evidence/index.ts"));
  const evidenceContractUrl = asDataUrl(evidenceContractSource);

  const runtimeSource = stripTypeScriptTypes(await source("lib/sequence-evidence.ts"))
    .replaceAll('"../core/contracts/sequence-evidence"', JSON.stringify(evidenceContractUrl))
    .replaceAll('"../core/contracts/sequence-director"', JSON.stringify(sequenceDirectorUrl))
    .replaceAll('"./cinematography-grammar"', JSON.stringify(cinematographyUrl));

  const [runtime, contract, sequenceDirector] = await Promise.all([
    import(asDataUrl(runtimeSource)),
    import(evidenceContractUrl),
    import(sequenceDirectorUrl),
  ]);
  return { runtime, contract, sequenceDirector };
}

const loaded = await loadRuntime();
const { runtime, contract, sequenceDirector } = loaded;
const slots = sequenceDirector.sequenceDirectorRenderSlots(1, 1);

function annotations() {
  return Object.fromEntries(slots.map((slot) => [slot.id, {
    shotSize: "medium",
    shotCategory: "coverage",
    cameraMovement: "unknown",
    visibleDescription: "Synthetic gate fixture.",
    continuityObservation: "",
    provenance: { provider: "fixture", model: "fixture", runtime: "node-test", routeId: "fixture" },
    annotatedAt: "2026-09-11T12:00:00.000Z",
  }]));
}

function measurements() {
  return slots.map((slot) => ({
    renderAddress: slot.id,
    sourceMediaRef: `assets/${slot.id}.mp4`,
    sourceMediaHash: `sha256:${String(slot.globalClipNumber).padStart(64, "0")}`,
    sourceExists: true,
    mediaType: "video/mp4",
    durationSeconds: 3,
    width: 1920,
    height: 1080,
    frameRate: 24,
    codec: "h264",
    container: "mov,mp4,m4a,3gp,3g2,mj2",
    measuredMotion: 0.08,
    aFrameRef: `evidence/${slot.id}-A.jpg`,
    bFrameRef: `evidence/${slot.id}-B.jpg`,
    generationBaseRevision: 7,
    generationProvenanceRefs: [`generation:${slot.id}`],
    measurementState: "measured",
    analyzer: { id: "fixture-probe", version: "1.0.0" },
    measuredAt: "2026-09-11T12:00:00.000Z",
  }));
}

function verify(overrides = {}) {
  return runtime.verifySequenceEvidenceMiniBlock({
    projectId: "project-fixture",
    currentRevision: 7,
    blockNumber: 1,
    miniBlockNumber: 1,
    measurements: measurements(),
    annotations: annotations(),
    generatedAt: "2026-09-11T12:01:00.000Z",
    ...overrides,
  });
}

function gate(report, gateId, state, renderAddress = undefined) {
  return report.gateResults.find((item) => item.gateId === gateId
    && item.state === state
    && (renderAddress === undefined || item.renderAddress === renderAddress));
}

function blocker(report, gateId) {
  return report.findings.find((item) => item.gateId === gateId && item.classification === "blocking");
}

test("#1889 reuses the canonical 25 RenderClipSlot addresses and keeps creative shots variable", async () => {
  const [contractSource, runtimeSource, assetAdapter, architecture] = await Promise.all([
    source("core/contracts/sequence-evidence/index.ts"),
    source("lib/sequence-evidence.ts"),
    source("lib/sequence-evidence-project-assets.ts"),
    source("docs/architecture/sequence-evidence-24-96-2400.md"),
  ]);

  assert.equal(slots.length, 25);
  const report = verify({ productionShots: [] });
  assert.equal(report.expectedTechnicalClipCount, 25);
  assert.equal(report.observedTechnicalClipCount, 25);
  assert.equal(report.expectedTechnicalCoverageSeconds, 75);
  assert.equal(report.certified, true);
  assert.match(runtimeSource, /sequenceDirectorRenderSlots/);
  assert.match(contractSource, /RenderClipSlot/);
  assert.doesNotMatch(`${contractSource}\n${runtimeSource}`, /Array\.from\(\{\s*length:\s*2400|renderClips:\s*\[/u);
  assert.match(assetAdapter, /normalizeProjectAssetRegistry/);
  assert.match(assetAdapter, /asset\.kind !== "video"/);
  assert.match(architecture, /never interprets 25 technical clips as 25 creative shots/i);
});

test("#1889 G1 and G3 break on a missing canonical output instead of fabricating coverage", () => {
  const broken = measurements().slice(0, 24);
  const report = verify({ measurements: broken });
  assert.ok(gate(report, "G1-address-coverage", "failed", slots[24].id));
  assert.ok(blocker(report, "G1-address-coverage"));
  assert.ok(gate(report, "G3-mini-block-coverage", "failed"));
  assert.ok(blocker(report, "G3-mini-block-coverage"));
  assert.equal(report.observedTechnicalClipCount, 24);
  assert.equal(report.certified, false);
});

test("#1889 G1 rejects media that claims a noncanonical render address", () => {
  const broken = [...measurements(), { ...measurements()[0], renderAddress: "render-clip:invented" }];
  const report = verify({ measurements: broken });
  assert.ok(gate(report, "G1-address-coverage", "failed", "render-clip:invented"));
  assert.match(blocker(report, "G1-address-coverage").explanation, /non-canonical render address/i);
});

test("#1889 G2 breaks on measured duration outside the reviewed tolerance", () => {
  const broken = measurements();
  broken[3] = { ...broken[3], durationSeconds: 2.42 };
  const report = verify({ measurements: broken });
  assert.ok(gate(report, "G2-duration", "failed", slots[3].id));
  assert.match(blocker(report, "G2-duration").explanation, /expected 3\.000 s, observed 2\.420 s/i);
  assert.equal(report.certified, false);
});

test("#1889 G4 keeps machine facts immutable and structurally separate from model annotation", () => {
  const machine = contract.sequenceEvidenceMachineForRenderSlot(slots[0], measurements()[0], {
    projectId: "project-fixture",
    projectRevision: 7,
  });
  const record = contract.attachSequenceEvidenceAnnotation(machine, {
    shotSize: "close",
    shotCategory: "reaction",
    cameraMovement: "static",
    visibleDescription: "Face remains visible.",
  });
  assert.equal(Object.isFrozen(record), true);
  assert.equal(Object.isFrozen(record.machine), true);
  assert.equal(record.machine.durationSeconds, 3);
  assert.throws(() => { record.machine.durationSeconds = 99; }, TypeError);
  assert.equal(record.annotation.shotSize, "close");
  assert.equal("durationSeconds" in record.annotation, false);
});

test("#1889 G5 breaks when measured output lacks real A/B keyframe evidence", () => {
  const broken = measurements();
  broken[5] = { ...broken[5], aFrameRef: "" };
  const report = verify({ measurements: broken });
  assert.ok(gate(report, "G5-keyframe-evidence", "failed", slots[5].id));
  assert.ok(blocker(report, "G5-keyframe-evidence"));
  assert.equal(report.contactSheet.some((item) => item.renderAddress === slots[5].id), false);
});

test("#1889 G6 blocks meaningful camera movement contradicted by near-zero measured motion", () => {
  const broken = measurements();
  broken[0] = { ...broken[0], measuredMotion: 0.001 };
  const report = verify({
    measurements: broken,
    draft: {
      version: 1,
      anchorRef: slots[0].anchorRef,
      blockNumber: 1,
      miniBlockNumber: 1,
      title: "fixture",
      purpose: "fixture",
      rhythm: "fixture",
      motionFlow: "push in toward the subject",
      globalContinuity: [],
      hardRules: [],
      references: [],
      beats: [],
      status: "approved",
    },
  });
  assert.ok(gate(report, "G6-camera-motion", "failed", slots[0].id));
  assert.ok(blocker(report, "G6-camera-motion"));
});

test("#1889 G6 remains one-sided: static intent plus high image change is advisory, not a false blocker", () => {
  const changed = measurements();
  changed[0] = { ...changed[0], measuredMotion: 0.5 };
  const report = verify({
    measurements: changed,
    draft: {
      version: 1,
      anchorRef: slots[0].anchorRef,
      blockNumber: 1,
      miniBlockNumber: 1,
      title: "fixture",
      purpose: "fixture",
      rhythm: "fixture",
      motionFlow: "locked-off static camera",
      globalContinuity: [],
      hardRules: [],
      references: [],
      beats: [],
      status: "approved",
    },
  });
  assert.ok(gate(report, "G6-camera-motion", "advisory", slots[0].id));
  const finding = report.findings.find((item) => item.gateId === "G6-camera-motion" && item.renderAddress === slots[0].id);
  assert.equal(finding.classification, "advisory");
  assert.equal(report.blockingCount, 0);
});

test("#1889 G7 breaks exact N-B -> N+1-A continuity when a boundary frame is missing", () => {
  const broken = measurements();
  broken[0] = { ...broken[0], bFrameRef: "" };
  const report = verify({ measurements: broken });
  const continuity = report.gateResults.find((item) => item.gateId === "G7-continuity-handoff"
    && item.state === "failed"
    && item.renderAddressPair[0] === slots[0].id
    && item.renderAddressPair[1] === slots[1].id);
  assert.ok(continuity);
  assert.ok(blocker(report, "G7-continuity-handoff"));
  const continuityOnly = runtime.sequenceEvidenceContinuityReport(report);
  assert.equal(continuityOnly.mode, "continuity");
  assert.ok(continuityOnly.gateResults.every((item) => item.gateId === "G5-keyframe-evidence" || item.gateId === "G7-continuity-handoff"));
});

test("#1889 G8 marks incompatible generation provenance stale and blocks current certification", () => {
  const broken = measurements();
  broken[8] = { ...broken[8], generationBaseRevision: 6 };
  const report = verify({ measurements: broken });
  assert.ok(gate(report, "G8-revision-provenance", "stale", slots[8].id));
  const finding = blocker(report, "G8-revision-provenance");
  assert.equal(finding.state, "stale");
  assert.match(finding.explanation, /revision 6; current project revision is 7/i);
});

test("#1889 G9 rejects model annotation outside the reviewed vocabulary", () => {
  const badAnnotations = annotations();
  badAnnotations[slots[2].id] = { ...badAnnotations[slots[2].id], cameraMovement: "teleport-orbit" };
  const report = verify({ annotations: badAnnotations });
  assert.ok(gate(report, "G9-annotation-schema", "failed", slots[2].id));
  assert.ok(blocker(report, "G9-annotation-schema"));
  assert.equal(report.records.find((record) => record.machine.canonicalRenderAddress === slots[2].id).annotation, null);
});

test("#1889 G10 reports unavailable measurement honestly and never converts it to green", () => {
  const unavailable = measurements();
  unavailable[4] = {
    ...unavailable[4],
    durationSeconds: null,
    measuredMotion: null,
    aFrameRef: "",
    bFrameRef: "",
    measurementState: "unavailable",
  };
  const report = verify({ measurements: unavailable });
  assert.ok(gate(report, "G10-no-silent-skip", "unavailable", slots[4].id));
  assert.ok(gate(report, "G2-duration", "unavailable", slots[4].id));
  assert.ok(gate(report, "G5-keyframe-evidence", "unavailable", slots[4].id));
  assert.ok(gate(report, "G6-camera-motion", "unavailable", slots[4].id));
  assert.equal(report.certified, false);
});

test("#1889 REFERENCE mode reports factual rhythm statistics and has no canon authority", () => {
  const report = runtime.buildSequenceEvidenceReferenceReport({
    sourceMediaRef: "reference/example.mp4",
    sourceMediaHash: "sha256:fixture",
    durationSeconds: 12,
    boundaries: [
      { startSecond: 0, endSecond: 2 },
      { startSecond: 2, endSecond: 5 },
      { startSecond: 5, endSecond: 12 },
    ],
    generatedAt: "2026-09-11T12:02:00.000Z",
  });
  assert.equal(report.mode, "reference");
  assert.equal(report.canonAuthority, false);
  assert.equal(report.shotCount, 3);
  assert.equal(report.averageShotSeconds, 4);
  assert.equal(report.medianShotSeconds, 3);
  assert.equal(report.cutsPerMinute, 10);
});

test("#1889 local media probe is bounded, local-only and truthfully unavailable without tools/media", async () => {
  const capabilities = await sequenceEvidenceMediaCapabilities({
    ffprobePath: "/definitely/missing/plotpickle-ffprobe",
    ffmpegPath: "/definitely/missing/plotpickle-ffmpeg",
  });
  assert.equal(capabilities.metadata, "unavailable");
  assert.equal(capabilities.boundaryFrames, "unavailable");
  assert.equal(capabilities.motion, "unavailable");
  assert.equal(capabilities.automaticInstall, false);
  assert.equal(capabilities.cloudFallback, false);

  const missing = await probeSequenceEvidenceMedia({
    filePath: "/definitely/missing/plotpickle-video.mp4",
    sourceMediaRef: "assets/missing.mp4",
    ffprobePath: "/definitely/missing/plotpickle-ffprobe",
    ffmpegPath: "/definitely/missing/plotpickle-ffmpeg",
  });
  assert.equal(missing.sourceExists, false);
  assert.equal(missing.measurementState, "unavailable");

  assert.deepEqual(sequenceEvidenceBoundaryFrameTimes(3), { startSecond: 0.2, endSecond: 2.8 });
  assert.equal(sequenceEvidenceNormalizedFrameDifference(Buffer.alloc(4, 0), Buffer.alloc(4, 255)), 1);
});

test("#1889 findings project into existing autonomous QA shape without granting repair authority", () => {
  const broken = measurements();
  broken[1] = { ...broken[1], durationSeconds: 1.5 };
  const report = verify({ measurements: broken });
  const qa = runtime.sequenceEvidenceQaFindings(report);
  assert.ok(qa.some((item) => item.routeId === "visual-production" && item.severity === "blocker"));
  assert.ok(qa.every((item) => Array.isArray(item.reproductionRefs) && item.reproductionRefs.length > 0));
});
