import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("#2458 extends the existing PPF production authority without creating a second production store", async () => {
  const [previs, commands, apply] = await Promise.all([
    read("core/contracts/previs/index.ts"),
    read("core/contracts/story-command.ts"),
    read("core/project/apply-command.ts"),
  ]);

  for (const contract of [
    "ProductionSoundCue",
    "ProductionTake",
    "RoughCutRevision",
    "ScreeningObservation",
    "soundCues?",
    "takes?",
    "roughCuts?",
    "screeningObservations?",
    "normalizePrevisProductionState",
  ]) assert.ok(previs.includes(contract), "Missing production convergence contract: " + contract);

  for (const command of [
    "production.sound.store",
    "production.take.store",
    "production.cut.store",
    "production.screening.store",
  ]) assert.ok(commands.includes(command), "Missing story command: " + command);

  assert.match(apply, /\.\.\.project\.production/u);
  assert.doesNotMatch(apply, /productionPacketStore|roughCutStore|screeningStore/u);
});

test("#2458 Production Packet is a read-only provider-neutral projection over existing Shot identity", async () => {
  const source = await read("lib/preproduction/story-to-screen-convergence.ts");

  for (const contract of [
    "projectionOnly: true",
    "providerNeutral: true",
    "productionShotId",
    "storyboardArtifactId",
    "storyboardDependencyKey",
    "intendedDurationSeconds",
    "soundCues",
    "takes",
    "approvedTakeId",
    "activeCutIds",
    "screeningObservations",
    "sourceRefs",
  ]) assert.ok(source.includes(contract), "Missing Production Packet projection field: " + contract);

  assert.match(source, /Storyboard dependency changed/u);
  assert.match(source, /take\.sourceRevision > input\.currentRevision/u);
  assert.doesNotMatch(source, /compileProviderInstructions|persistProductionPacket/u);
});

test("#2458 keeps intended timing separate from observed take timing", async () => {
  const [previs, surface] = await Promise.all([
    read("core/contracts/previs/index.ts"),
    read("app/skin-v1/preproduction-review-surfaces.tsx"),
  ]);

  assert.match(previs, /intendedDurationSeconds: number \| null/u);
  assert.match(previs, /observedDurationSeconds: number \| null/u);
  assert.match(surface, /intendedDurationSeconds: shot\.durationSeconds/u);
  assert.match(surface, /Observed seconds/u);
  assert.doesNotMatch(surface, /durationSeconds: observedDurationSeconds/u);
});

test("#2458 projects typed Narration Music and Foley cues into the existing Timeline authority", async () => {
  const [workspace, surface, menu] = await Promise.all([
    read("lib/preproduction/scene-workspace-projection.ts"),
    read("app/skin-v1/preproduction-review-surfaces.tsx"),
    read("app/skin-v1/dashboard-menu-registry.ts"),
  ]);

  assert.match(workspace, /project\.production\.soundCues \?\? \[\]/u);
  assert.match(workspace, /cue\.kind === "narration"/u);
  assert.match(workspace, /cue\.kind === "music"/u);
  assert.match(workspace, /production-sound:/u);
  assert.match(surface, /SkinV1SoundReviewSurface/u);
  assert.match(surface, /PlotPickle will not invent missing sound/u);

  for (const id of ["sound-narration", "sound-music", "sound-foley"]) {
    assert.ok(menu.includes('"' + id + '"'), "Missing Sound Dashboard id: " + id);
  }
});

test("#2458 versions generated takes and preserves earlier Rough Cut revisions", async () => {
  const [surface, convergence] = await Promise.all([
    read("app/skin-v1/preproduction-review-surfaces.tsx"),
    read("lib/preproduction/story-to-screen-convergence.ts"),
  ]);

  assert.match(surface, /Register a generated take/u);
  assert.match(surface, /Existing takes were preserved/u);
  assert.match(surface, /Create Rough Cut revision/u);
  assert.match(surface, /supersedesCutId: previous\?\.id/u);
  assert.match(surface, /missing takes remain explicit placeholders/u);
  assert.match(convergence, /newest\(roughCuts/u);
  assert.doesNotMatch(surface, /delete.*take/iu);
});

test("#2458 makes Screening observed evidence under Human authority", async () => {
  const [surface, convergence, host] = await Promise.all([
    read("app/skin-v1/preproduction-review-surfaces.tsx"),
    read("lib/preproduction/story-to-screen-convergence.ts"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
  ]);

  assert.match(surface, /SCREENING · OBSERVED EVIDENCE/u);
  assert.match(surface, /Add observed evidence/u);
  assert.match(surface, /No story, shot, sound or media was changed automatically/u);
  assert.match(surface, /does not invent a quality score/u);
  assert.match(convergence, /unresolved: observations\.filter/u);
  assert.match(host, /setScreeningOpen\(true\)/u);
  assert.match(host, /<SkinV1ScreeningReviewSurface/u);
});

test("#2458 preserves the current Act-first Previs Flip Book boundary", async () => {
  const host = await read("app/skin-v1/dashboard-bbs-review-host.tsx");
  const start = host.indexOf("if (previsOpen)");
  const end = host.indexOf("if (timelineOpen)", start);
  const previs = host.slice(start, end);

  assert.match(previs, /<StoryActRail activeAct=/u);
  assert.match(previs, /<SkinV1PrevisStoryMap/u);
  assert.match(previs, /<SkinV1PrevisReviewSurface/u);
  assert.doesNotMatch(previs, /<PreproductionStageRail/u);
});
