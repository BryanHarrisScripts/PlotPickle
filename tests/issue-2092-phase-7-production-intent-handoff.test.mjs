import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

async function modules() {
  const editorialTypeScript = await source("core/contracts/storyboard/editorial-shot.ts");
  const editorialCompiled = stripTypeScriptTypes(editorialTypeScript, { mode: "transform" });
  const editorial = await import(`data:text/javascript;base64,${Buffer.from(editorialCompiled).toString("base64")}#editorial-${Date.now()}-${Math.random()}`);

  const handoffTypeScript = await source("lib/preproduction/production-intent-handoff.ts");
  const handoffCompiled = stripTypeScriptTypes(handoffTypeScript, { mode: "transform" });
  const runnable = handoffCompiled.replace(
    /import\s*\{\s*productionReadyShotInformationErrors\s*\}\s*from\s*["']\.\.\/\.\.\/core\/contracts\/storyboard\/editorial-shot["'];?/,
    "const { productionReadyShotInformationErrors } = globalThis.__plotpicklePhase7Editorial;",
  );
  assert.notEqual(runnable, handoffCompiled, "Expected Phase 7 runtime import to be isolated for deterministic tests");
  globalThis.__plotpicklePhase7Editorial = editorial;
  const handoff = await import(`data:text/javascript;base64,${Buffer.from(runnable).toString("base64")}#handoff-${Date.now()}-${Math.random()}`);
  return { editorial, handoff };
}

function project() {
  return {
    id: "story-phase-7",
    title: "Skyline Test",
    revision: 12,
    structure: {
      version: 1,
      activeBlockNumber: 1,
      activeMiniBlockNumber: 1,
      activeStage: "previs",
      blocks: [{
        id: "block-01",
        number: 1,
        actNumber: 1,
        sequenceNumber: 1,
        title: "Opening",
        miniBlocks: [1, 2, 3, 4].map((ordinal) => ({
          id: `mini-0${ordinal}`,
          number: ordinal,
          blockNumber: 1,
          ordinal,
          title: `Mini ${ordinal}`,
          stages: {},
        })),
      }],
    },
    production: {
      shots: [
        {
          id: "previs-shot-1",
          anchorRef: "storyboard-anchor:block:block-01:mini-1",
          storyboardArtifactId: "storyboard-artifact-1",
          storyboardDependencyKey: "storyboard-upstream:phase-7",
          order: 1,
          shotSize: "Medium",
          angle: "Eye level",
          movement: "Locked",
          lens: "Natural",
          visualIntent: "Hold long enough to see the hesitation.",
          durationSeconds: 5.5,
          transitionIn: "cut",
          transitionOut: "cut",
          reviewState: "approved",
          createdAt: "2026-09-16T14:00:00.000Z",
          updatedAt: "2026-09-16T14:00:00.000Z",
        },
        {
          id: "previs-shot-planned",
          anchorRef: "storyboard-anchor:block:block-01:mini-1",
          storyboardArtifactId: "storyboard-artifact-2",
          storyboardDependencyKey: "storyboard-upstream:phase-7",
          order: 2,
          shotSize: "Close",
          angle: "Eye level",
          movement: "Locked",
          lens: "Portrait",
          visualIntent: "Not approved yet.",
          durationSeconds: null,
          transitionIn: "cut",
          transitionOut: "cut",
          reviewState: "planned",
          createdAt: "2026-09-16T14:00:00.000Z",
          updatedAt: "2026-09-16T14:00:00.000Z",
        },
      ],
    },
  };
}

function semantics() {
  return {
    story: {
      id: "story-phase-7:story",
      projectId: "story-phase-7",
      title: "Skyline Test",
      canonicalRevision: 12,
      premise: "A thief hesitates when empathy breaks through the plan.",
      logline: "One look changes the heist.",
      theme: "Mercy costs something.",
    },
    blocks: [{ id: "block-01", number: 1, actNumber: 1, sequenceNumber: 1, miniBlockIds: ["mini-01", "mini-02", "mini-03", "mini-04"] }],
    scenes: [{
      id: "scene-1",
      sourceRef: "legacy-scene:scene-1",
      blockId: "block-01",
      blockNumber: 1,
      title: "Cage Row",
      purpose: "Interrupt the heist with empathy.",
      objective: "Keep moving.",
      opposition: "The trapped creature catches Jace's attention.",
      action: "Jace slows beside the cages.",
      turn: "He lowers the pistol.",
      outcome: "The plan loses momentum.",
      relatedMiniBlockIds: ["mini-01"],
      assetRefs: [
        { kind: "character", id: "character-jace" },
        { kind: "location", id: "location-cage-row" },
      ],
    }],
    miniBlockSceneRelations: [{
      miniBlockId: "mini-01",
      blockId: "block-01",
      blockNumber: 1,
      ordinal: 1,
      sceneIds: ["scene-1"],
      sourceMiniBlockIds: ["legacy-mini-1"],
    }],
    legacyDetailStatus: "matched",
  };
}

function editorialShot(editorial, releaseState = "linked") {
  return editorial.normalizeStoryboardEditorialShot({
    shotId: "storyboard-shot:storyboard-anchor:block:block-01:mini-1:shot-1",
    anchorRef: "storyboard-anchor:block:block-01:mini-1",
    order: 1,
    narrativePurpose: "Show Jace's hesitation without revealing why he recognizes the creature.",
    shotSize: "Medium",
    cameraAngle: "Eye level",
    cameraMovement: "Slow drift",
    lensIntent: "Natural perspective",
    lightingIntent: "Soft practical cage light",
    continuityLockReferences: ["continuity:jace-costume", "continuity:creature-scale"],
    blocking: [{
      subjectId: "character-jace",
      startPosition: "walking left to right",
      facing: "three-quarter",
      eyelineTargetId: "creature-goldie",
      movement: "stops mid-stride and lowers pistol",
      endPosition: "still beside cage",
      screenDirection: "left-to-right",
      axisState: "hold axis",
    }],
    informationDirectives: [
      {
        id: "info-empathy-visible",
        sourceRef: "canon-fact:jace-hesitates",
        sourceFingerprint: "fact-v2",
        statement: "Jace hesitates before continuing the heist.",
        mode: "SHOW_NOW",
        carrier: "observable behavior",
        release: { state: "not-applicable" },
      },
      {
        id: "info-recognition-withheld",
        sourceRef: "canon-fact:jace-recognizes-goldie",
        sourceFingerprint: "fact-v1",
        statement: "Jace recognizes the creature.",
        mode: "WITHHOLD_NOW",
        protectionIntent: "Do not show identifying keepsake or recognition dialogue.",
        release: releaseState === "linked"
          ? { state: "linked", reference: "storyboard-shot:later-recognition", condition: "Jace says the creature's name" }
          : { state: "pending" },
      },
    ],
  }, { anchorRef: "storyboard-anchor:block:block-01:mini-1", order: 1 });
}

function beats() {
  return [{
    id: "beat-1",
    anchorRef: "storyboard-anchor:block:block-01:mini-1",
    order: 1,
    label: "Hesitation",
    purpose: "Make empathy visible as behavior.",
    visualAction: "Jace stops, looks cage to cage, tightens his jaw, lowers the pistol.",
    cameraIntent: "Stay close enough to read the change without melodrama.",
    continuityIn: "Pistol raised.",
    continuityOut: "Pistol lowered.",
    soundIntent: "Diegetic cage ambience and foley only; no music.",
    startSecond: null,
    endSecond: null,
  }];
}

function frames() {
  return [{
    frameId: "frame-1",
    anchorRef: "storyboard-anchor:block:block-01:mini-1",
    storyboardArtifactId: "storyboard-artifact-1",
    storyboardDependencyKey: "storyboard-upstream:phase-7",
    narrativePurpose: "Jace caught between motion and stillness.",
  }];
}

test("#2092 Phase 7 assembles approved structured pre-production state into provider-neutral #2064 input", async () => {
  const { editorial, handoff } = await modules();
  const intent = handoff.assemblePreproductionProductionIntent({
    project: project(),
    semantics: semantics(),
    approvedEditorialShots: [editorialShot(editorial)],
    beats: beats(),
    frames: frames(),
  });

  assert.equal(intent.providerNeutral, true);
  assert.equal(intent.projectionOnly, true);
  assert.equal(intent.projectId, "story-phase-7");
  assert.equal(intent.canonicalRevision, 12);
  assert.equal(intent.story.premise, "A thief hesitates when empathy breaks through the plan.");
  assert.equal(intent.shots.length, 1, "planned/unapproved Previs shots must not enter production intent");

  const shot = intent.shots[0];
  assert.equal(shot.editorialShotId, "storyboard-shot:storyboard-anchor:block:block-01:mini-1:shot-1");
  assert.equal(shot.execution.productionShotId, "previs-shot-1");
  assert.equal(shot.execution.durationSeconds, 5.5);
  assert.equal(shot.camera.movement, "Slow drift");
  assert.deepEqual(shot.frameRefs, ["frame-1"]);
  assert.deepEqual(shot.beatRefs, ["beat-1"]);
  assert.deepEqual(shot.audioIntents, ["Diegetic cage ambience and foley only; no music."]);
  assert.deepEqual(shot.sceneRefs, ["scene-1"]);
  assert.deepEqual(shot.assetRefs, [
    { kind: "character", id: "character-jace" },
    { kind: "location", id: "location-cage-row" },
  ]);
  assert.equal(shot.informationDirectives[0].mode, "SHOW_NOW");
  assert.equal(shot.informationDirectives[1].mode, "WITHHOLD_NOW");
  assert.ok(shot.sourceRefs.includes("canon-fact:jace-recognizes-goldie"));
  assert.ok(intent.sourceRefs.includes("scene-1"));
  assert.equal(Object.hasOwn(intent, "prompt"), false);
  assert.equal(Object.hasOwn(shot, "providerInstructions"), false);
});

test("#2092 Phase 7 fails closed on unresolved reveal timing or missing Storyboard↔Previs identity pairing", async () => {
  const { editorial, handoff } = await modules();
  assert.throws(() => handoff.assemblePreproductionProductionIntent({
    project: project(),
    semantics: semantics(),
    approvedEditorialShots: [editorialShot(editorial, "pending")],
    beats: beats(),
    frames: frames(),
  }), /not production-ready.*pending release responsibility/i);

  assert.throws(() => handoff.assemblePreproductionProductionIntent({
    project: project(),
    semantics: semantics(),
    approvedEditorialShots: [],
    beats: beats(),
    frames: frames(),
  }), /has no approved Storyboard Shot/);
});

test("#2092 Phase 7 remains a projection boundary and does not pre-implement #2064 provider compilation", async () => {
  const handoff = await source("lib/preproduction/production-intent-handoff.ts");
  assert.match(handoff, /providerNeutral: true/);
  assert.match(handoff, /projectionOnly: true/);
  assert.match(handoff, /productionReadyShotInformationErrors/);
  assert.match(handoff, /reviewState === "approved"/);
  assert.doesNotMatch(handoff, /Seedance|Runway|Veo|Kling|providerPrompt|promptProse/);
  assert.doesNotMatch(handoff, /localStorage|sessionStorage|fetch\(|saveFoundationProject|writeStore|create.*Provider/);
});
