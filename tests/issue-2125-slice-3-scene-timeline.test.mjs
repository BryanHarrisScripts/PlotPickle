import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2125 Slice 3 is a temporal projection over Visual Story and Previs, not a timeline store", async () => {
  const source = await read("lib/preproduction/scene-timeline-projection.ts");

  for (const contract of [
    "VisualStoryProjection",
    "VisualStoryShotProjection",
    "projectionOnly: true",
    '"timed"',
    '"untimed"',
    '"blocked-by-untimed-predecessor"',
    "Only Human-authored ProductionShotIntent durations place material on the clock",
  ]) assert.ok(source.includes(contract), `Scene Workspace timing projection is missing: ${contract}`);

  assert.match(source, /if \(durationSeconds === null\)[\s\S]*positionKnown = false/);
  assert.match(source, /else if \(positionKnown\)[\s\S]*startSecond = cursor[\s\S]*endSecond = cursor \+ durationSeconds/);
  assert.match(source, /else \{[\s\S]*positionState = "blocked-by-untimed-predecessor"/);
  assert.match(source, /startSecond: anchorStartSecond/);
  assert.match(source, /endSecond: positionKnown \? cursor : null/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|saveFoundationProject|writeStore|createEmpty.*Store/);
  assert.doesNotMatch(source, /renderClipSlotsForAnchor|RENDER_CLIPS_PER_FEATURE|RENDER_CLIPS_PER_MINI_BLOCK|RENDER_MINI_BLOCK_SECONDS/,
    "Scene Workspace must not derive creative timing from the technical RenderClip/Mini-Block grid.");
});

test("#2125/#2171 exposes one synchronized Dialogue Action Shot Audio Scene Workspace", async () => {
  const source = await read("app/_components/storyboard/scene-timeline-workspace.tsx");

  for (const contract of [
    'data-scene-workspace="dialogue-action-shot-audio"',
    'renderLane("Dialogue", workspace.dialogue)',
    'renderLane("Action", workspace.action)',
    'renderLane("Shot", workspace.shot)',
    'renderLane("Audio", workspace.audio)',
    "Scene Workspace playhead",
    "Cue inspector",
    "Screenplay source",
    "Intent playback",
    "onSelectShot(activeShot.id)",
    "INTENT PREVIEW",
    "does not claim frame-accurate final-media playback",
  ]) assert.ok(source.includes(contract), `Scene Workspace surface is missing: ${contract}`);

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
  assert.match(source, /Only the existing planned Previs ProductionShotIntent duration is editable here/);
  assert.match(source, /#2035/);
  assert.doesNotMatch(source, /startSecond:\s*(?:Number|parseFloat|parseInt)|name="startSecond"/,
    "Slice 3 must not invent an independent persisted start-time field.");
});

test("#2125/#2171 keeps Visual Story and Scene Workspace on one shared Scene/Shot selection", async () => {
  const source = await read("app/_components/storyboard/visual-story-workspace.tsx");

  assert.match(source, /useState\(initialShotId \?\? ""\)/);
  assert.match(source, /useState<"story" \| "timeline">\(initialView\)/);
  assert.match(source, />Visual Story<\/button>/);
  assert.match(source, />Scene Workspace<\/button>/);
  assert.match(source, /selectedShotId=\{selectedShot\?\.id \?\? ""\}/);
  assert.match(source, /onSelectShot=\{setSelectedShotId\}/);
  assert.match(source, /legacyProject=\{legacyProject\}/);
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
