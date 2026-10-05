import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("#2763 phase 4 adds a distinct bounded Timeline range media contract without weakening Mini-Block limits", async () => {
  const [contract, engine, bridge] = await Promise.all([
    read("core/media/media-engine-contract.ts"),
    read("core/media/fframes-local-media-engine.ts"),
    read("tools/fframes-bridge/src/main.rs"),
  ]);

  assert.match(contract, /createPlotPickleMiniBlockMediaRequest/u);
  assert.match(contract, /input\.frames\.length > 25/u);
  assert.match(contract, /createPlotPickleTimelineRangeMediaRequest/u);
  assert.match(contract, /input\.frames\.length > 100/u);
  assert.match(contract, /input\.frames\.length % 25 !== 0/u);
  assert.match(contract, /Timeline range export requires complete 25-Shot Mini-Blocks/u);
  assert.match(contract, /frame\.durationMs !== 3_000/u);
  assert.match(contract, /Timeline range export requires exactly 3,000 ms per Shot/u);
  assert.match(engine, /renderTimelineRange\(/u);
  assert.match(engine, /private async renderSequence/u);
  assert.match(bridge, /request\.frames\.len\(\) > 100/u);
  assert.match(bridge, /Mini-Block callers remain capped at 25/u);
});

test("#2763 phase 4 keeps opening-range rendering local, authorized, silent and failure-explicit", async () => {
  const [route, handoff, bridge] = await Promise.all([
    read("app/api/timeline/media-engine/render/route.ts"),
    read("build/timeline-media-engine-handoff.ts"),
    read("tools/fframes-bridge/src/main.rs"),
  ]);

  assert.match(route, /authorizeRequest\(requestBoundary\(request\), \{ mutation: true \}\)/u);
  assert.match(route, /frameCount > 100/u);
  assert.match(route, /frameCount % 25 !== 0/u);
  assert.match(handoff, /localImageAssetFilePath/u);
  assert.match(handoff, /renderTimelineRange/u);
  assert.match(handoff, /Timeline keeps the saved assembly and does not report an MP4 export/u);
  assert.match(bridge, /AudioMap::none\(\)/u);
});

test("#2763 phase 4 assembles only consecutive complete Mini-Blocks in story order", async () => {
  const workspace = await read("app/_components/timeline/timeline-assembly-workspace.tsx");

  assert.match(workspace, /function storyPosition/u);
  assert.match(workspace, /function openingStoryRun/u);
  assert.match(workspace, /storyPosition\(left\) - storyPosition\(right\)/u);
  assert.match(workspace, /placement\.shotImages\.length === SHOTS_PER_MINI_BLOCK/u);
  assert.match(workspace, /position !== expected/u);
  assert.match(workspace, /run\.length < 4/u);
  assert.match(workspace, /Four Mini-Blocks = one 5-minute Block/u);
});

test("#2763 phase 4 exports 25, 50, 75 or 100 authoritative still frames as one MP4", async () => {
  const workspace = await read("app/_components/timeline/timeline-assembly-workspace.tsx");

  assert.match(workspace, /selectedOpeningPlacements\.flatMap/u);
  assert.match(workspace, /position: \(placementIndex \* SHOTS_PER_MINI_BLOCK\) \+ shotNumber/u);
  assert.match(workspace, /durationMs: PLANNING_SECONDS_PER_SHOT \* 1000/u);
  assert.match(workspace, /fetch\("\/api\/timeline\/media-engine\/render"/u);
  assert.match(workspace, /result\.mode !== "fframes"/u);
  assert.match(workspace, /result\.evidence\?\.state !== "succeeded"/u);
  assert.match(workspace, /Opening MP4 ready:/u);
  assert.match(workspace, /Baseline assembled export uses the locked still-image presentation/u);
});

test("#2763 phase 4 persists exact assembled-range provenance across project reload", async () => {
  const [contract, commands, reducer, workspace] = await Promise.all([
    read("core/contracts/previs/index.ts"),
    read("core/contracts/story-command.ts"),
    read("core/project/apply-command.ts"),
    read("app/_components/timeline/timeline-assembly-workspace.tsx"),
  ]);

  assert.match(contract, /interface TimelineRangeExport/u);
  assert.match(contract, /readonly timelineAssemblyId: string/u);
  assert.match(contract, /readonly placementIds: readonly string\[\]/u);
  assert.match(contract, /readonly sourceKeys: readonly string\[\]/u);
  assert.match(contract, /readonly mediaMode: "stills"/u);
  assert.match(contract, /timelineRangeExports\?: readonly TimelineRangeExport\[\]/u);
  assert.match(contract, /normalizeTimelineRangeExport/u);
  assert.match(commands, /"production\.timeline\.export\.store"/u);
  assert.match(reducer, /timelineRangeExports: \[command\.export, \.\.\.existing\]/u);
  assert.match(workspace, /type: "production\.timeline\.export\.store"/u);
  assert.match(workspace, /timelineAssemblyId: latestAssembly\.id/u);
  assert.match(workspace, /sourceKeys: selectedOpeningPlacements\.map\(\(placement\) => placement\.sourceKey\)/u);
  assert.match(workspace, /Saved export/u);
});
