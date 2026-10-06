import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("#2776 verified MiniMax H3 remains discoverable when AI video routing is Off", async () => {
  const workspace = await read("app/_components/timeline/timeline-assembly-workspace.tsx");

  const start = workspace.indexOf("async function resolveTimelineMotionRoute");
  const end = workspace.indexOf("async function activateTimelineMotionRoute", start);
  const resolver = workspace.slice(start, end);

  assert.match(resolver, /Promise\.all\(\[[\s\S]*\/api\/ai-routing\/status[\s\S]*\/api\/media-routing\/status/u);
  assert.match(resolver, /const selected = routing\.video\?\.selected \?\? "off"/u);
  assert.match(resolver, /minimax\?\.configured && minimax\.videoVerifiedAt/u);
  assert.match(resolver, /route: "minimax"/u);
  assert.match(resolver, /needsActivation: selected !== "minimax"/u);
  assert.doesNotMatch(resolver, /openai[\s\S]*videoVerifiedAt[\s\S]*needsActivation/u);
});

test("#2776 one-shot MiniMax activation is behind the Human confirmation boundary", async () => {
  const workspace = await read("app/_components/timeline/timeline-assembly-workspace.tsx");

  const start = workspace.indexOf("async function generateMotionShot");
  const end = workspace.indexOf("function storeRangeExport", start);
  const generation = workspace.slice(start, end);

  const confirmation = generation.indexOf("await requestPlotPickleConfirmation");
  const activation = generation.indexOf("await activateTimelineMotionRoute(route)");
  const generationRequest = generation.indexOf('fetch("/api/local-ai/generate/video"');

  assert.ok(confirmation >= 0, "Human confirmation must exist");
  assert.ok(activation > confirmation, "route activation must happen only after confirmation");
  assert.ok(generationRequest > activation, "paid generation must happen after any required activation");
  assert.match(workspace, /fetch\("\/api\/ai-routing\/select"/u);
  assert.match(workspace, /capability: "video"/u);
  assert.match(workspace, /paidAcknowledged: route\.locality === "cloud"/u);
  assert.match(workspace, /dataSharingAcknowledged: route\.locality === "cloud"/u);
});

test("#2776/#2803 Timeline exposes provider readiness and per-Shot generation progress", async () => {
  const workspace = await read("app/_components/timeline/timeline-assembly-workspace.tsx");

  assert.match(workspace, /Checking video generation provider/u);
  assert.match(workspace, /ready to activate only after Generate motion is confirmed/u);
  assert.match(workspace, /"PREFLIGHT" \| "SUBMITTING" \| "QUEUED" \| "RUNNING"/u);
  assert.match(workspace, /setGeneratingMotionStage\("PREFLIGHT"\)/u);
  assert.match(workspace, /setGeneratingMotionStage\("SUBMITTING"\)/u);
  assert.match(workspace, /setGeneratingMotionStage\(job\.status === "queued" \? "QUEUED" : "RUNNING"\)/u);
  assert.match(workspace, /current\?\.status === "succeeded"[\s\S]*"READY"/u);
  assert.match(workspace, /current\?\.status\?\.toUpperCase\(\) \?\? "NOT GENERATED"/u);
  assert.match(workspace, /current\?\.error \? <small>\{current\.error\}<\/small>/u);
});

test("#2776 meaningful queue/running transitions remain persisted with motion provenance", async () => {
  const workspace = await read("app/_components/timeline/timeline-assembly-workspace.tsx");

  const start = workspace.indexOf("const result = await pollMotionJob");
  const end = workspace.indexOf("const completedAt", start);
  const progress = workspace.slice(start, end);

  assert.match(progress, /progress\.status !== "queued" && progress\.status !== "running"/u);
  assert.match(progress, /provider: progress\.provider \?\? running\.provider/u);
  assert.match(progress, /route: progress\.route \?\? running\.route/u);
  assert.match(progress, /model: progress\.model \?\? running\.model/u);
  assert.match(progress, /jobId: progress\.id/u);
  assert.match(progress, /storeMotion\(running\)/u);
});

test("#2776 playback transport steps exact Shots rather than whole Mini-Block placements", async () => {
  const workspace = await read("app/_components/timeline/timeline-assembly-workspace.tsx");

  assert.match(workspace, /function seekToShot\(placementIndex: number, shotNumber: number\)/u);
  assert.match(workspace, /const shotSeconds = placement\.durationSeconds \/ SHOTS_PER_MINI_BLOCK/u);
  assert.match(workspace, /setPlayheadSeconds\(placementStart \+ \(\(shotNumber - 1\) \* shotSeconds\)\)/u);
  assert.match(workspace, /function previousShot\(\)/u);
  assert.match(workspace, /seekToShot\(placementIndex - 1, SHOTS_PER_MINI_BLOCK\)/u);
  assert.match(workspace, /function nextShot\(\)/u);
  assert.match(workspace, /seekToShot\(placementIndex \+ 1, 1\)/u);
  assert.match(workspace, />Previous Shot<\/button>/u);
  assert.match(workspace, />Next Shot<\/button>/u);
  assert.doesNotMatch(workspace, />Previous clip<\/button>|>Next clip<\/button>/u);
});

test("#2776 generated-motion playback still refuses silent still-image substitution", async () => {
  const workspace = await read("app/_components/timeline/timeline-assembly-workspace.tsx");

  assert.match(workspace, /Motion Shot \{String\(activeShotNumber\)\.padStart\(2, "0"\)\} not ready/u);
  assert.match(workspace, /Timeline does not silently substitute the still image/u);
  assert.match(workspace, /playbackMode === "motion" && activeMotion\.current\?\.status === "succeeded"/u);
});
