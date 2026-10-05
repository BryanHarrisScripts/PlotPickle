import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("#2763 phase 2 keeps Timeline playback and export on the 25 x 3-second Mini-Block contract", async () => {
  const workspace = await read("app/_components/timeline/timeline-assembly-workspace.tsx");

  assert.match(workspace, /SHOTS_PER_MINI_BLOCK = 25/u);
  assert.match(workspace, /PLANNING_SECONDS_PER_SHOT = 3/u);
  assert.match(workspace, /durationMs: PLANNING_SECONDS_PER_SHOT \* 1000/u);
  assert.match(workspace, /Written narration: \{showNarration \? "On" : "Off"\}/u);
  assert.match(workspace, /Export selected Mini-Block MP4/u);
  assert.match(workspace, /25 × 3-second Shots · 75 seconds · 24 fps/u);
});

test("#2763 phase 2 reuses current Previs narration and rejects stale or missing text", async () => {
  const workspace = await read("app/_components/timeline/timeline-assembly-workspace.tsx");

  assert.match(workspace, /graphicNovelTextSourceKey/u);
  assert.match(workspace, /candidate\.anchorRef === placement\.anchorRef && candidate\.position === shotNumber/u);
  assert.match(workspace, /approval\.sourceKey === graphicNovelTextSourceKey/u);
  assert.match(workspace, /Written narration is stale or missing/u);
  assert.match(workspace, /Open this Mini-Block in Previs and Play with Narration again/u);
});

test("#2763 phase 2 treats FFrames fallback or missing video as export failure", async () => {
  const workspace = await read("app/_components/timeline/timeline-assembly-workspace.tsx");

  assert.match(workspace, /result\.mode !== "fframes"/u);
  assert.match(workspace, /result\.evidence\?\.state !== "succeeded"/u);
  assert.match(workspace, /!videoPath/u);
  assert.match(workspace, /Export failure never reports success/u);
  assert.doesNotMatch(workspace, /setExportUrl\([^)]*\)[\s\S]{0,120}mode === "fallback"/u);
});

test("#2763 phase 2 carries written overlays into a silent FFrames MP4", async () => {
  const [engine, bridge] = await Promise.all([
    read("core/media/fframes-local-media-engine.ts"),
    read("tools/fframes-bridge/src/main.rs"),
  ]);

  assert.match(engine, /caption: frame\.caption \?\? ""/u);
  assert.match(engine, /narration: frame\.narration \?\? ""/u);
  assert.match(bridge, /caption: String/u);
  assert.match(bridge, /narration: String/u);
  assert.match(bridge, /AudioMap::none\(\)/u);
  assert.match(bridge, /fill-opacity="0\.86"/u);
  assert.match(bridge, /narration_one/u);
  assert.match(bridge, /narration_two/u);
});
