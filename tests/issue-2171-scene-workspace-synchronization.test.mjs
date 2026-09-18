import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2171 projects current PPF screenplay Scenes without requiring legacy localStorage authority", async () => {
  const semantic = await read("lib/preproduction/semantic-projection.ts");

  assert.match(semantic, /normalizeProjectSourceEvidence/u);
  assert.match(semantic, /function projectSourceScenes/u);
  assert.match(semantic, /sourceSceneId\(passage\.sceneId, passage\.sceneNumber\)/u);
  assert.match(semantic, /screenplay-scene:\$\{screenplay\.sourceFileName\}:scene-/u);
  assert.match(semantic, /canonicalBlock\?\.id/u);
  assert.match(semantic, /relatedMiniBlockIds/u);
  assert.match(semantic, /const sourceScenes = matched \? \[\] : projectSourceScenes\(canonical\)/u);
  assert.doesNotMatch(semantic, /localStorage|sessionStorage/u);
});

test("#2171 creates one read-only Scene Workspace projection over existing cue owners", async () => {
  const projection = await read("lib/preproduction/scene-workspace-projection.ts");

  for (const contract of [
    'SceneWorkspaceLane = "dialogue" | "action" | "shot" | "audio"',
    'owner: "screenplay"',
    'owner: "previs"',
    "projectProgressiveProductionLanes",
    "projectSceneTimeline",
    'owner: item.source',
    "screenplay-passage:",
    "production-shot:",
    "projectionOnly: true",
  ]) assert.ok(projection.includes(contract), `Missing Scene Workspace contract: ${contract}`);

  assert.match(projection, /dialogueCues\(passages\)/u);
  assert.match(projection, /actionCues\(passages\)/u);
  assert.match(projection, /shotCues\(timeline\)/u);
  assert.match(projection, /audioCues\(input\.visualStory, input\.legacyProject\)/u);
  assert.match(projection, /const cues = \[\.\.\.dialogue, \.\.\.action, \.\.\.shot, \.\.\.audio\]/u);
  assert.doesNotMatch(projection, /saveFoundationProject|applyStoryCommand|localStorage|sessionStorage|createEmpty.*Store|new .*Store/u);
});

test("#2171 uses only authored cue timing and never the 75-second RenderClip grid as creative timing", async () => {
  const [timeline, lanes, workspace] = await Promise.all([
    read("lib/preproduction/scene-timeline-projection.ts"),
    read("lib/preproduction/progressive-production-lanes.ts"),
    read("lib/preproduction/scene-workspace-projection.ts"),
  ]);

  assert.match(timeline, /Only Human-authored ProductionShotIntent durations place material on the clock/u);
  assert.match(timeline, /startSecond: anchorStartSecond/u);
  assert.match(timeline, /endSecond: positionKnown \? cursor : null/u);
  assert.match(timeline, /positionState = "blocked-by-untimed-predecessor"/u);
  assert.doesNotMatch(timeline, /RENDER_MINI_BLOCK_SECONDS|renderClipSlotsForAnchor|RENDER_CLIPS_PER/u);

  assert.match(lanes, /timelineAnchor\.startSecond !== null/u);
  assert.match(lanes, /timelineAnchor\.startSecond! \+ beat\.endSecond!/u);
  assert.doesNotMatch(lanes, /Math\.min\(totalSeconds/u);

  assert.match(workspace, /const timedEnds = cues/u);
  assert.match(workspace, /Math\.max\(\.\.\.timedEnds\)/u);
});

test("#2171 presents screenplay source, intent playback, cue inspector and synchronized Dialogue Action Shot Audio lanes", async () => {
  const surface = await read("app/_components/storyboard/scene-timeline-workspace.tsx");

  for (const contract of [
    'data-scene-workspace="dialogue-action-shot-audio"',
    "Screenplay source",
    "Intent playback",
    "Cue inspector",
    'renderLane("Dialogue", workspace.dialogue)',
    'renderLane("Action", workspace.action)',
    'renderLane("Shot", workspace.shot)',
    'renderLane("Audio", workspace.audio)',
    "REAL IMPORTED EVIDENCE",
    "NO MAPPED SOURCE",
    "Missing cues remain missing",
  ]) assert.ok(surface.includes(contract), `Scene Workspace UI missing: ${contract}`);

  assert.match(surface, /workspace\.sourcePassages\.map/u);
  assert.match(surface, /workspace\.cues\.find/u);
  assert.match(surface, /timingState === "blocked"/u);
  assert.match(surface, /ROUGH \/ PREVIS MEDIA IS VALID/u);
  assert.match(surface, /does not claim frame-accurate final-media playback/u);
});

test("#2171 keeps cue edits bounded to the existing Previs Shot authority", async () => {
  const surface = await read("app/_components/storyboard/scene-timeline-workspace.tsx");

  assert.match(surface, /selectedCue\?\.lane === "shot"/u);
  assert.match(surface, /project\.production\.shots\.find\(\(shot\) => shot\.id === selectedShot\.productionShotId\)/u);
  assert.match(surface, /current\.reviewState === "approved"/u);
  assert.match(surface, /#2035 creative-transaction path/u);
  assert.match(surface, /type: "previs\.shot\.store"/u);
  assert.match(surface, /durationSeconds: normalized/u);
  assert.match(surface, /Dialogue, Action and Audio remain source-owned/u);
  assert.doesNotMatch(surface, /type: "(?:screenplay|dialogue|audio|scene)\./u);
});

test("#2171 preserves Block Mini Scene Shot context and routes to current Write and Previs authorities", async () => {
  const surface = await read("app/_components/storyboard/scene-timeline-workspace.tsx");

  assert.match(surface, /url\.searchParams\.set\("view", "timeline"\)/u);
  assert.match(surface, /url\.searchParams\.set\("block", String\(cue\.blockNumber\)\)/u);
  assert.match(surface, /url\.searchParams\.set\("mini", String\(cue\.miniBlockNumber\)\)/u);
  assert.match(surface, /url\.searchParams\.set\("scene", workspace\.sceneId\)/u);
  assert.match(surface, /url\.searchParams\.set\("shot", cue\.shotId\)/u);
  assert.match(surface, /\\/write\\?block=\\$\\{selectedCue\\.blockNumber\\}&mini=\\$\\{selectedCue\\.miniBlockNumber\\}/u);
  assert.match(surface, /\/previs\?block=\$\{selectedCue\.blockNumber\}&mini=\$\{selectedCue\.miniBlockNumber\}/u);
});

test("#2171 Visual Story exposes Scene Workspace as the single synchronized sibling view", async () => {
  const visualStory = await read("app/_components/storyboard/visual-story-workspace.tsx");

  assert.match(visualStory, />Scene Workspace<\/button>/u);
  assert.match(visualStory, /<SceneTimelineWorkspace/u);
  assert.match(visualStory, /legacyProject=\{legacyProject\}/u);
  assert.match(visualStory, /data-scene-workspace="dialogue-action-shot-audio"/u);
  assert.match(visualStory, /Scene Workspace does not manufacture Dialogue, Action, Shot or Audio cues/u);
  assert.doesNotMatch(visualStory, /import ProgressiveProductionLanes/u);
  assert.doesNotMatch(visualStory, /<ProgressiveProductionLanes/u);
});

test("#2171 Scene Workspace remains on the current Skin V1 visual contract and verification selector", async () => {
  const [css, bridge, registry, manifestText] = await Promise.all([
    read("app/_components/storyboard/scene-timeline-workspace.module.css"),
    read("app/skin-v1/preproduction-matrix-contract.css"),
    read("lib/verification/webmcp-surface-capture-registry.mjs"),
    read("tests/visual-baselines/skin-v1/manifest.json"),
  ]);
  const manifest = JSON.parse(manifestText);

  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|ui-monospace|SFMono-Regular|Menlo/u);
  for (const token of [
    "--pp-skin-font-ui",
    "--pp-skin-fill-panel",
    "--pp-skin-line-strong",
    "--pp-skin-accent-bright",
    "--pp-skin-selected-bg",
    "--pp-skin-focus",
    "--pp-skin-radius",
  ]) assert.ok(css.includes(token), `Missing Skin token ${token}`);

  assert.match(bridge, /data-scene-workspace="dialogue-action-shot-audio"/u);
  assert.match(registry, /label: "Scene Workspace"/u);
  assert.match(registry, /surface: "SCENE_WORKSPACE"/u);
  assert.match(registry, /rootSelector: "\[data-scene-workspace='dialogue-action-shot-audio'\]"/u);
  assert.equal(manifest.surfaces["scene-timeline"].label, "Scene Workspace");
  assert.equal(manifest.surfaces["scene-timeline"].selector, "[data-scene-workspace='dialogue-action-shot-audio']");
});
