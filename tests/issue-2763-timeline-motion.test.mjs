import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("#2763 phase 3 persists one governed motion state per Timeline Shot", async () => {
  const [contract, commands, reducer] = await Promise.all([
    read("core/contracts/previs/index.ts"),
    read("core/contracts/story-command.ts"),
    read("core/project/apply-command.ts"),
  ]);

  assert.match(contract, /interface TimelineMotionShot/u);
  assert.match(contract, /requestedDurationSeconds: 3/u);
  assert.match(contract, /status: TimelineMotionShotStatus/u);
  assert.match(contract, /timelineMotionShots\?: readonly TimelineMotionShot\[\]/u);
  assert.match(contract, /normalizeTimelineMotionShot/u);
  assert.match(commands, /"production\.timeline\.motion\.store"/u);
  assert.match(reducer, /timelineMotionShots: \[command\.motion, \.\.\.existing\]/u);
});

test("#2763/#2803 phase 3 grounds motion in the provider-neutral Shot Generation Packet and three-second authority", async () => {
  const workspace = await read("app/_components/timeline/timeline-assembly-workspace.tsx");

  assert.match(workspace, /function timelineGenerationPacket/u);
  assert.match(workspace, /dramaticResponsibility: evidence\.responsibility/u);
  assert.match(workspace, /screenplay,/u);
  assert.match(workspace, /buildTimelineShotGenerationPacket/u);
  assert.match(workspace, /serializeTimelineShotGenerationPacket\(packet, strategy\)/u);
  assert.match(workspace, /motionSourceKey\(selectedPlacement, packet\)/u);
  assert.match(workspace, /placementSourceKey: placement\.sourceKey/u);
  assert.match(workspace, /requestedDurationSeconds: 3/u);
});

test("#2763/#2776/#2803 phase 3 resolves current capability-aware video authority without unverified fallback", async () => {
  const workspace = await read("app/_components/timeline/timeline-assembly-workspace.tsx");

  assert.match(workspace, /async function resolveTimelineMotionRoute/u);
  assert.match(workspace, /\/api\/ai-routing\/status/u);
  assert.match(workspace, /\/api\/media-routing\/status/u);
  assert.match(workspace, /selected === "comfyui-native" && selectedState\?\.ready/u);
  assert.match(workspace, /selected === "minimax" && selectedState\?\.ready/u);
  assert.match(workspace, /minimax\?\.configured && minimax\.videoVerifiedAt/u);
  assert.match(workspace, /No verified video generation route is ready for this Shot/u);
  assert.doesNotMatch(workspace, /\/api\/local-ai\/plugins\/video/u);
});

test("#2763/#2776 phase 3 requires explicit Human confirmation before route activation or provider generation", async () => {
  const workspace = await read("app/_components/timeline/timeline-assembly-workspace.tsx");

  const generateStart = workspace.indexOf("async function generateMotionShot");
  const generateEnd = workspace.indexOf("function storeRangeExport", generateStart);
  const generation = workspace.slice(generateStart, generateEnd);
  const confirmIndex = generation.indexOf("await requestPlotPickleConfirmation");
  const activationIndex = generation.indexOf("await activateTimelineMotionRoute(route)");
  const requestIndex = generation.indexOf('fetch("/api/local-ai/generate/video"');
  assert.ok(confirmIndex >= 0);
  assert.ok(activationIndex > confirmIndex);
  assert.ok(requestIndex > activationIndex);
  assert.match(generation, /No route activation or generation request is made unless you confirm/u);
  assert.match(generation, /Motion generation was cancelled\. Existing Timeline sources remain unchanged/u);
});

test("#2763/#2776 phase 3 tracks visible job states, retries failures, and never silently substitutes stills in motion mode", async () => {
  const workspace = await read("app/_components/timeline/timeline-assembly-workspace.tsx");

  assert.match(workspace, /\/api\/local-ai\/video\/\$\{encodeURIComponent\(current\.id\)\}/u);
  assert.match(workspace, /type MotionGenerationStage = "PREFLIGHT" \| "SUBMITTING" \| "QUEUED" \| "RUNNING"/u);
  assert.match(workspace, /current\?\.status === "succeeded"[\s\S]*"READY"/u);
  assert.match(workspace, /status: "failed"/u);
  assert.match(workspace, /storeMotion\(running\)/u);
  assert.match(workspace, /Retry motion/u);
  assert.match(workspace, /Regenerate motion/u);
  assert.match(workspace, /Timeline does not silently substitute the still image/u);
  assert.match(workspace, /Playback: \{playbackMode === "stills" \? "Still images" : "Generated motion"\}/u);
  assert.match(workspace, /selectedMotionSucceeded\}\/25 generated Shots ready/u);
});
