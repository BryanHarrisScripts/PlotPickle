import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

async function generationModule() {
  const source = await read("lib/preproduction/provider-capability-contract.ts");
  const compiled = stripTypeScriptTypes(source, { mode: "transform" });
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}#timeline-shot-generation-${Date.now()}-${Math.random()}`);
}

function packetInput(overrides = {}) {
  return {
    projectId: "project-1",
    canonicalRevision: 10,
    placementId: "placement-1",
    anchorRef: "storyboard-anchor:block:block-01:mini-1",
    blockNumber: 1,
    miniBlockNumber: 1,
    shotNumber: 1,
    dramaticResponsibility: "Establish the danger before the character recognizes it.",
    screenplay: "REN crosses the empty room and stops at the window.",
    progressionLabel: "Opening",
    progressionDirection: "Establish geography and the immediate dramatic question.",
    previousShotContext: "Mini-Block opening boundary.",
    nextShotContext: "Move closer as Ren notices the signal.",
    narrativeIntention: "Ren is isolated in the wide room.",
    visualDirection: "Wide frame, restrained camera.",
    characterFacts: ["Ren", "dark coat"],
    productionDirection: ["Framing: Wide", "Movement: slow push"],
    continuityLocks: ["Preserve character identity: Ren"],
    sourceRefs: ["placement-1", "artifact-1"],
    ...overrides,
  };
}

test("#2803 builds deterministic provider-neutral three-second Shot Generation Packets", async () => {
  const { buildTimelineShotGenerationPacket } = await generationModule();
  const first = buildTimelineShotGenerationPacket(packetInput());
  const second = buildTimelineShotGenerationPacket(packetInput());
  assert.equal(first.providerNeutral, true);
  assert.equal(first.canonical, false);
  assert.equal(first.shotNumber, 1);
  assert.equal(first.intendedDurationSeconds, 3);
  assert.equal(first.id, "timeline-generation:placement-1:shot-01");
  assert.equal(first.sourceFingerprint, second.sourceFingerprint);
  const changed = buildTimelineShotGenerationPacket(packetInput({ screenplay: "REN runs to the window." }));
  assert.notEqual(changed.sourceFingerprint, first.sourceFingerprint);
});

test("#2803 allows text-to-video without inventing a required image", async () => {
  const { buildTimelineShotGenerationPacket, resolveTimelineGenerationStrategy } = await generationModule();
  const packet = buildTimelineShotGenerationPacket(packetInput());
  const local = resolveTimelineGenerationStrategy({
    route: "comfyui-native",
    locality: "local",
    ready: true,
    workflowFamily: "text-to-video",
    vramProfile: "constrained",
    performanceAcknowledged: true,
  }, packet);
  assert.equal(local.eligible, true);
  assert.equal(local.modality, "text-to-video");
  assert.equal(local.sourceAssetUrl, "");
  assert.equal(local.performanceAcknowledged, true);
  const cloud = resolveTimelineGenerationStrategy({ route: "minimax", locality: "cloud", ready: true }, packet);
  assert.equal(cloud.eligible, true);
  assert.equal(cloud.modality, "text-to-video");
});

test("#2803 binds image/reference modes only when authoritative inputs exist", async () => {
  const { buildTimelineShotGenerationPacket, resolveTimelineGenerationStrategy } = await generationModule();
  const noImage = buildTimelineShotGenerationPacket(packetInput());
  const blocked = resolveTimelineGenerationStrategy({
    route: "comfyui-native", locality: "local", ready: true, workflowFamily: "image-to-video",
  }, noImage);
  assert.equal(blocked.eligible, false);
  assert.match(blocked.reason, /requires an approved source image/i);

  const sourceOnly = buildTimelineShotGenerationPacket(packetInput({
    references: [{ role: "source-image", id: "artifact-1", assetUrl: "/api/local-ai/assets/frame.webp" }],
  }));
  const image = resolveTimelineGenerationStrategy({
    route: "comfyui-native", locality: "local", ready: true, workflowFamily: "image-to-video",
  }, sourceOnly);
  assert.equal(image.eligible, true);
  assert.equal(image.modality, "image-to-video");

  const firstLastBlocked = resolveTimelineGenerationStrategy({
    route: "comfyui-native", locality: "local", ready: true, workflowFamily: "first-last-frame",
  }, sourceOnly);
  assert.equal(firstLastBlocked.eligible, false);

  const firstLastPacket = buildTimelineShotGenerationPacket(packetInput({
    references: [
      { role: "source-image", id: "artifact-1", assetUrl: "/api/local-ai/assets/frame-1.webp" },
      { role: "last-frame", id: "artifact-2", assetUrl: "/api/local-ai/assets/frame-2.webp" },
    ],
  }));
  const firstLast = resolveTimelineGenerationStrategy({
    route: "comfyui-native", locality: "local", ready: true, workflowFamily: "first-last-frame",
  }, firstLastPacket);
  assert.equal(firstLast.eligible, true);
  assert.equal(firstLast.modality, "first-last-frame");
  assert.equal(firstLast.lastFrameAssetUrl, "/api/local-ai/assets/frame-2.webp");
});

test("#2803 blocks incompatible H3 workflow families before dispatch", async () => {
  const { buildTimelineShotGenerationPacket, resolveTimelineGenerationStrategy } = await generationModule();
  const packet = buildTimelineShotGenerationPacket(packetInput());
  const result = resolveTimelineGenerationStrategy({
    route: "comfyui-native", locality: "local", ready: true, workflowFamily: "in-place-edit",
  }, packet);
  assert.equal(result.eligible, false);
  assert.match(result.reason, /not compatible with Timeline Shot generation/i);
});

test("#2803 Timeline dispatch carries packet lineage, H3 acknowledgement and Production Take projection", async () => {
  const [workspace, gateway, contract] = await Promise.all([
    read("app/_components/timeline/timeline-assembly-workspace.tsx"),
    read("build/ai-routing-gateway.ts"),
    read("core/contracts/previs/index.ts"),
  ]);
  assert.match(workspace, /buildTimelineShotGenerationPacket/u);
  assert.match(workspace, /serializeTimelineShotGenerationPacket\(packet, strategy\)/u);
  assert.match(workspace, /performanceAcknowledged: strategy\.performanceAcknowledged/u);
  assert.match(workspace, /generationMode: strategy\.modality/u);
  assert.match(workspace, /packetFingerprint: packet\.sourceFingerprint/u);
  assert.match(workspace, /type: "production\.take\.store"/u);
  assert.match(workspace, /observedDurationSeconds: result\.durationSeconds \?\? null/u);
  assert.match(workspace, /disabled=\{generatingShotNumber !== null\}/u);
  assert.doesNotMatch(workspace, /has no locked Storyboard Image to animate/u);
  assert.match(gateway, /workflowFamily: nativeProbe\.workflowFamily/u);
  assert.match(gateway, /performanceAcknowledged: native\.allowConstrainedVram/u);
  assert.match(contract, /TimelineMotionGenerationMode/u);
  assert.match(contract, /packetFingerprint\?: string/u);
  assert.match(contract, /providerDurationSeconds\?: number \| null/u);
  assert.match(contract, /takeId\?: string/u);
  assert.match(contract, /Empty for a valid text-to-video Shot/u);
});
