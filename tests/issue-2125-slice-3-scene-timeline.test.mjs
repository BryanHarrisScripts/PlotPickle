import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2125 Slice 3 is a temporal projection over Visual Story and Previs, not a timeline store", async () => {
  const source = await read("lib/preproduction/scene-timeline-projection.ts");

  for (const contract of [
    "VisualStoryProjection",
    "VisualStoryShotProjection",
    "RENDER_MINI_BLOCK_SECONDS",
    "projectionOnly: true",
    '"timed"',
    '"untimed"',
    '"blocked-by-untimed-predecessor"',
  ]) assert.ok(source.includes(contract), `Scene Timeline projection is missing: ${contract}`);

  assert.match(source, /if \(durationSeconds === null\)[\s\S]*positionKnown = false/);
  assert.match(source, /else if \(positionKnown\)[\s\S]*startSecond = cursor[\s\S]*endSecond = cursor \+ durationSeconds/);
  assert.match(source, /else \{[\s\S]*positionState = "blocked-by-untimed-predecessor"/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|saveFoundationProject|writeStore|createEmpty.*Store/);
  assert.doesNotMatch(source, /renderClipSlotsForAnchor|RENDER_CLIPS_PER_FEATURE|RENDER_CLIPS_PER_MINI_BLOCK/,
    "The Human Scene Timeline must not project the 2,400 technical RenderClip grid as creative timing.");
});

test("#2125 Slice 3 exposes only Frames, Shots, Action and Timing lanes with synchronized selection/transport", async () => {
  const source = await read("app/_components/storyboard/scene-timeline-workspace.tsx");

  for (const contract of [
    'data-scene-timeline="frames-shots-action-timing"',
    'data-lane="frames"',
    'data-lane="shots"',
    'data-lane="action"',
    'data-lane="timing"',
    "Scene Timeline playhead",
    "onSelectShot(activeShot.id)",
    "setPlayheadSeconds(shot.startSecond)",
    "INTENT PREVIEW",
    "does not claim frame-accurate media playback",
  ]) assert.ok(source.includes(contract), `Scene Timeline surface is missing: ${contract}`);

  assert.doesNotMatch(source, /data-lane="(?:dialogue|foley|ambience|music|voice|transitions|vfx|camera)"/i,
    "Slice 3 must not pull Slice 4 production lanes into the visual core.");
  assert.doesNotMatch(source, /previs\.shot\.store[\s\S]{0,500}(setInterval|requestAnimationFrame)/,
    "Transport ticks must not write project state every animation/timer frame.");
});

test("#2125 Slice 3 timing controls reuse ProductionShotIntent authority and protect approved timing", async () => {
  const source = await read("app/_components/storyboard/scene-timeline-workspace.tsx");

  assert.match(source, /project\.production\.shots\.find\(\(shot\) => shot\.id === selectedShot\.productionShotId\)/);
  assert.match(source, /current\.reviewState === "approved"/);
  assert.match(source, /#2035/);
  assert.match(source, /applyStoryCommand\(project, \{/);
  assert.match(source, /type: "previs\.shot\.store"/);
  assert.match(source, /saveFoundationProject\(next\)/);
  assert.match(source, /durationSeconds: normalized/);
  assert.match(source, /Clear timing/);
  assert.match(source, /−1s/);
  assert.match(source, /\+\.25/);
  assert.match(source, /Start position is derived from Shot order plus preceding authored durations/);
  assert.doesNotMatch(source, /startSecond:\s*(?:Number|parseFloat|parseInt)|name="startSecond"/,
    "Slice 3 must not invent an independent persisted start-time field.");
});

test("#2125 Slice 3 keeps Visual Story and Scene Timeline on one shared Scene/Shot selection", async () => {
  const source = await read("app/_components/storyboard/visual-story-workspace.tsx");

  assert.match(source, /useState\(initialShotId \?\? ""\)/);
  assert.match(source, /useState<"story" \| "timeline">\(initialView\)/);
  assert.match(source, />Visual Story<\/button>/);
  assert.match(source, />Scene Timeline<\/button>/);
  assert.match(source, /selectedShotId=\{selectedShot\?\.id \?\? ""\}/);
  assert.match(source, /onSelectShot=\{setSelectedShotId\}/);
  assert.match(source, /active=\{view === "timeline"\}/);
});

test("#2125 Slice 3 accepts optional scene/shot/view navigation refs without creating creative authority", async () => {
  const [page, readiness] = await Promise.all([
    read("app/storyboard/page.tsx"),
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
  ]);

  assert.match(page, /search\.get\("scene"\)/);
  assert.match(page, /search\.get\("shot"\)/);
  assert.match(page, /search\.get\("view"\) === "timeline"/);
  assert.match(readiness, /initialShotId=\{initialShotId\}/);
  assert.match(readiness, /initialView=\{initialVisualView\}/);
  assert.match(readiness, /onProjectChange=\{onProjectChange\}/);
});
