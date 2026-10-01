import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const handoff = await readFile(new URL("../build/previs-media-engine-handoff.ts", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/previs/media-engine/render/route.ts", import.meta.url), "utf8");

test("#2664 begins the optional FFrames handoff at Previs", () => {
  assert.match(route, /previs-media-engine-handoff/);
  assert.match(handoff, /FFramesLocalMediaEngine/);
  assert.doesNotMatch(handoff, /Storyboard.*mutat|applyStoryCommand|saveFoundationProject/);
});

test("#2664 accepts only authoritative local Storyboard assets in deterministic contract order", () => {
  assert.match(handoff, /frame\.authoritative === true/);
  assert.match(handoff, /createPlotPickleMiniBlockMediaRequest/);
  assert.match(handoff, /localAssetFilePath/);
  assert.match(handoff, /frames\.length/);
});

test("#2664 explicitly falls back when FFrames is absent or fails", () => {
  assert.match(handoff, /mode: "fallback"/);
  assert.match(handoff, /Flip Book, Graphic Novel, and WebP remain available/);
  assert.match(handoff, /evidence/);
});

test("#2664 keeps the route bounded and Human-session authorized", () => {
  assert.match(route, /authorizeRequest/);
  assert.match(route, /input\.frames\.length > 25/);
  assert.match(route, /Cache-Control.*no-store/);
});
