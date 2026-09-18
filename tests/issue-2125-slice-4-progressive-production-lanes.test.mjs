import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2125 Slice 4 projects only existing screenplay, sound, camera and transition owners", async () => {
  const source = await read("lib/preproduction/progressive-production-lanes.ts");

  for (const contract of [
    "legacyProject.screenplay.draftElements",
    'element.sceneId === visualStory.selectedScene?.id',
    'element.type !== "dialogue" && element.type !== "dual-dialogue"',
    "beat.soundIntent",
    "legacyProject.production.cues",
    'cue.sceneId === visualStory.selectedScene?.id',
    "shot.shotSize",
    "shot.angle",
    "shot.movement",
    "shot.lens",
    "shot.lightingIntent",
    "shot.transitionIn",
    "shot.transitionOut",
    "projectSceneTimeline(visualStory)",
  ]) assert.ok(source.includes(contract), `Progressive production projection is missing: ${contract}`);

  assert.doesNotMatch(source, /create.*(?:Dialogue|Sound|Camera|Transition).*Store|new .*Store|writeStore/,
    "Slice 4 must not create a new production-context store.");
});

test("#2125 Slice 4 never converts descriptive screenplay or Sonic Cue context into invented timestamps", async () => {
  const source = await read("lib/preproduction/progressive-production-lanes.ts");

  assert.match(source, /timingState: "unplaced"/);
  assert.match(source, /const timed = beat\.startSecond !== null && beat\.endSecond !== null/);
  assert.match(source, /startSecond: null,[\s\S]*endSecond: null,[\s\S]*timingState: "unplaced" as const/);
  assert.doesNotMatch(source, /Date\.parse\(cue\.(?:cueIn|cueOut)|parseFloat\(cue\.(?:cueIn|cueOut)|Number\(cue\.(?:cueIn|cueOut)/,
    "Descriptive Sonic Cue in/out text must not be treated as a timecode.");
  assert.doesNotMatch(source, /saveFoundationProject|applyStoryCommand|localStorage|sessionStorage/,
    "The Slice 4 projection is read-only.");
});

test("#2125 Slice 4 keeps extra production layers optional and collapsible", async () => {
  const source = await read("app/_components/storyboard/progressive-production-lanes.tsx");

  for (const contract of [
    'type LayerId = "dialogue" | "sound" | "camera" | "transitions"',
    "visibleLayers",
    "toggleLayer",
    'data-lane="dialogue"',
    'data-lane="sound"',
    'data-lane="camera"',
    'data-lane="transitions"',
    'SOURCE CONTEXT · UNTIMED',
    'View-only production context in Slice 4',
  ]) assert.ok(source.includes(contract), `Progressive production surface is missing: ${contract}`);

  assert.doesNotMatch(source, /data-lane="(?:foley|ambience|music|voice)"/i,
    "Slice 4 must not invent dedicated Foley/ambience/music/voice authorities.");
  assert.doesNotMatch(source, /saveFoundationProject|applyStoryCommand/,
    "Layer visibility must remain a view-only interaction.");
});

test("#2125/#2171 reuses Slice 4 sound ownership inside the single Scene Workspace projection", async () => {
  const [visualStory, workspace] = await Promise.all([
    read("app/_components/storyboard/visual-story-workspace.tsx"),
    read("lib/preproduction/scene-workspace-projection.ts"),
  ]);

  assert.doesNotMatch(visualStory, /import ProgressiveProductionLanes/u);
  assert.match(visualStory, /<SceneTimelineWorkspace/u);
  assert.match(visualStory, /legacyProject=\{legacyProject\}/);
  assert.match(visualStory, /onSelectShot=\{setSelectedShotId\}/);
  assert.match(workspace, /projectProgressiveProductionLanes/u);
  assert.match(workspace, /const audio = audioCues/u);
  assert.match(workspace, /owner: item\.source/u);
  assert.match(workspace, /lane: "audio"/u);
});
