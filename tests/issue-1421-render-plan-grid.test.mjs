import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const contractPath = "core/contracts/previs/index.ts";
const modelPath = "app/_components/previs/previs-projection-model.ts";
const workspacePath = "app/_components/previs/previs-readiness-workspace.tsx";
const architecturePath = "docs/architecture/structure-engine.md";
const publicGuidePath = "public/docs/readme/WRITING-AND-PRODUCTION.md";

test("#1421 defines the two-hour production grid as 96 Mini-Blocks × 25 × 3-second render clips", async () => {
  const contract = await read(contractPath);

  assert.match(contract, /RENDER_CLIP_SECONDS = 3 as const/);
  assert.match(contract, /RENDER_CLIPS_PER_MINI_BLOCK = 25 as const/);
  assert.match(contract, /RENDER_MINI_BLOCKS_PER_BLOCK = 4 as const/);
  assert.match(contract, /RENDER_BLOCKS_PER_FEATURE = 24 as const/);
  assert.match(contract, /RENDER_CLIPS_PER_BLOCK = RENDER_CLIPS_PER_MINI_BLOCK \* RENDER_MINI_BLOCKS_PER_BLOCK/);
  assert.match(contract, /RENDER_CLIPS_PER_FEATURE = RENDER_CLIPS_PER_BLOCK \* RENDER_BLOCKS_PER_FEATURE/);
  assert.match(contract, /RENDER_KEYFRAMES_PER_FEATURE = RENDER_CLIPS_PER_FEATURE \+ 1/);
});

test("#1421 derives stable render addresses and shared first-frame/last-frame boundaries without persisting empty clip records", async () => {
  const [contract, model] = await Promise.all([read(contractPath), read(modelPath)]);

  assert.match(contract, /render-clip:block-\$\{String\(blockNumber\)\.padStart\(2, "0"\)\}:mini-\$\{miniBlockNumber\}:clip-/);
  assert.match(contract, /startKeyframeNumber: globalClipNumber - 1/);
  assert.match(contract, /endKeyframeNumber: globalClipNumber/);
  assert.match(contract, /startSecond: \(globalClipNumber - 1\) \* RENDER_CLIP_SECONDS/);
  assert.match(contract, /endSecond: globalClipNumber \* RENDER_CLIP_SECONDS/);
  assert.match(model, /renderClipSlotsForAnchor\(blockNumber, miniBlockNumber\)/);
  assert.doesNotMatch(contract, /interface PrevisProductionState \{[\s\S]*renderClips:/);
});

test("#1421 keeps creative Previs timing separate from the technical clip grid", async () => {
  const [contract, model, workspace] = await Promise.all([
    read(contractPath),
    read(modelPath),
    read(workspacePath),
  ]);

  assert.match(contract, /creative shots may share an anchor/i);
  assert.match(contract, /Creative shots may span one or more fixed 3-second render clips/);
  assert.match(model, /allShotsTimed/);
  assert.match(model, /Math\.abs\(authoredDuration - RENDER_MINI_BLOCK_SECONDS\) < 0\.01/);
  assert.match(workspace, /Storyboard → Visualize → Previs → Render Plan → Generate/);
  assert.match(workspace, /Creative shots<\/dt>/);
  assert.match(workspace, /Render clips<\/dt>/);
  assert.match(workspace, /Previs timing<\/dt>/);
  assert.match(workspace, /RENDER PLAN READY/);
  assert.match(workspace, /Clip 01–25/);
});

test("#1421 documents the retired 16-shot preset and does not hard-code provider pricing", async () => {
  const [architecture, publicGuide, workspace] = await Promise.all([
    read(architecturePath),
    read(publicGuidePath),
    read(workspacePath),
  ]);

  assert.match(architecture, /previous default of roughly 16 editorial shots per Mini-Block[\s\S]*is retired/i);
  assert.match(architecture, /2,400 render clips/);
  assert.match(architecture, /2,401 shared boundary keyframes/);
  assert.match(publicGuide, /25 technical 3-second render clips per mini-block/);
  assert.match(publicGuide, /2,400 render clips across the complete 2-hour feature/);
  assert.doesNotMatch(publicGuide, /4 beats and 16 shots per mini-block|1,536 shot targets|4\.69 seconds average shot length/);
  assert.doesNotMatch(`${architecture}\n${workspace}`, /\$216|\$72|\$0\.03|0\.03\/sec/i);
});
