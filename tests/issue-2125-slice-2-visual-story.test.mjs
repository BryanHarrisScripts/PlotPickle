import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2125 Slice 2 projects Scene, Beat, Shot and Frame from existing owners without a new store", async () => {
  const source = await read("lib/preproduction/visual-story-projection.ts");

  for (const contract of [
    "projectPreproductionSemantics",
    "projectSequenceDirectorBeats",
    "sequenceDirectorAnchorRef",
    "project.production.shots",
    "project.build.foundations.visualArtifacts",
    "project.build.world.visualArtifacts",
    "acceptedVisualArtifactIds",
    "StoryboardEditorialShot",
    "informationDirectives",
    "projectionOnly: true",
  ]) assert.ok(source.includes(contract), `Visual Story projection is missing existing-owner contract: ${contract}`);

  assert.doesNotMatch(source, /localStorage|sessionStorage|saveFoundationProject|writeStore|createEmpty.*Store/);
  assert.doesNotMatch(source, /renderClipSlotsForAnchor|RENDER_CLIPS_PER_FEATURE|RENDER_CLIPS_PER_MINI_BLOCK/);
});

test("#2125 Slice 2 preserves variable density and refuses to invent Beat-to-Shot relationships", async () => {
  const source = await read("lib/preproduction/visual-story-projection.ts");

  assert.match(source, /drafts[\s\S]*\.filter\(\(draft\) => draft\.anchorRef === anchorRef\)[\s\S]*projectSequenceDirectorBeats/);
  assert.match(source, /project\.production\.shots\.filter\(\(shot\) => shot\.anchorRef === anchorRef\)/);
  assert.match(source, /editorialShots\.filter\(\(shot\) => shot\.anchorRef === anchorRef\)/);
  assert.match(source, /unassignedFrames: frames\.filter/);
  assert.doesNotMatch(source, /beatTarget|shotTarget|Array\.from\(\{ length: 25|RENDER_CLIP/);
});

test("#2125 Slice 2 delivers a monochrome visual screenplay and compact #2107 Shot inspector", async () => {
  const [workspace, css] = await Promise.all([
    read("app/_components/storyboard/visual-story-workspace.tsx"),
    read("app/_components/storyboard/visual-story-workspace.module.css"),
  ]);

  for (const contract of [
    'data-visual-story="scene-beat-shot-frame"',
    'data-projection-only="true"',
    "Scene → Beat → Shot → Frame",
    "No authored Sequence Director Beat is attached",
    "The 2,400 technical RenderClip grid is not used as a substitute",
    "AUDIENCE LEARNS NOW",
    "AUDIENCE MUST NOT KNOW YET",
    "No SHOW_NOW information directive is recorded",
    "No WITHHOLD_NOW information directive is recorded",
    "does not guess that relationship",
  ]) assert.ok(workspace.includes(contract), `Visual Story surface is missing: ${contract}`);

  assert.match(css, /filter:\s*var\(--pp-skin-media-filter\)/u);
  assert.match(css, /background:\s*var\(--pp-skin-surface-0\)/u);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/iu);
  assert.doesNotMatch(workspace, /FOLEY|AMBIENCE|MUSIC|VOICE|VFX|TRANSITIONS/,
    "Visual Story must not duplicate the synchronized Scene Workspace production lanes.");
});

test("#2125/#2189 keeps Story Map Block/Mini selection without reading legacy Storyboard authority", async () => {
  const [page, readiness, skinReview] = await Promise.all([
    read("app/storyboard/page.tsx"),
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("app/skin-v1/preproduction-review-surfaces.tsx"),
  ]);

  assert.match(page, /boundedMini\(search\.get\("mini"\)\)/);
  assert.match(page, /search\.get\("scene"\)/);
  assert.doesNotMatch(page, /plotpickle\.project\.v1|localStorage|normalizePlotPickleProject|legacySceneProjectionSource/u);
  assert.doesNotMatch(skinReview, /plotpickle\.project\.v1|localStorage|normalizePlotPickleProject|legacySceneProjectionSource/u);

  assert.match(readiness, /selectedMiniBlockNumber/);
  assert.match(readiness, /data-selected=\{selectedMiniBlockNumber === miniNumber/);
  assert.doesNotMatch(readiness, /Open Visual Story/);
  assert.match(readiness, /<VisualStoryWorkspace[\s\S]*?embedded/);
  assert.match(page, /legacyProject=\{null\}/);
  assert.match(skinReview, /legacyProject=\{null\}/);
  assert.match(readiness, /miniBlockNumber=\{selectedMiniBlockNumber\}/);
});
