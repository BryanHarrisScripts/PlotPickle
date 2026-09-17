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
  const handoffRunnable = handoffCompiled.replace(
    /import\s*\{\s*productionReadyShotInformationErrors\s*\}\s*from\s*["']\.\.\/\.\.\/core\/contracts\/storyboard\/editorial-shot["'];?/,
    "const { productionReadyShotInformationErrors } = globalThis.__plotpickleSlice7Editorial;",
  );
  assert.notEqual(handoffRunnable, handoffCompiled, "Expected production-intent runtime import to be isolated for deterministic tests");
  globalThis.__plotpickleSlice7Editorial = editorial;
  const handoff = await import(`data:text/javascript;base64,${Buffer.from(handoffRunnable).toString("base64")}#handoff-${Date.now()}-${Math.random()}`);

  const readinessTypeScript = await source("lib/preproduction/director-spec-readiness.ts");
  const readinessCompiled = stripTypeScriptTypes(readinessTypeScript, { mode: "transform" });
  const readiness = await import(`data:text/javascript;base64,${Buffer.from(readinessCompiled).toString("base64")}#readiness-${Date.now()}-${Math.random()}`);
  return { editorial, handoff, readiness };
}

function project(durationSeconds = 5.5) {
  return {
    id: "story-slice-7",
    title: "Skyline Test",
    revision: 14,
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
      shots: [{
        id: "previs-shot-1",
        anchorRef: "storyboard-anchor:block:block-01:mini-1",
        storyboardArtifactId: "storyboard-artifact-1",
        storyboardDependencyKey: "storyboard-upstream:slice-7",
        order: 1,
        shotSize: "Medium",
        angle: "Eye level",
        movement: "Locked",
        lens: "Natural",
        visualIntent: "Hold long enough to see the hesitation.",
        durationSeconds,
        transitionIn: "cut",
        transitionOut: "cut",
        reviewState: "approved",
        createdAt: "2026-09-17T01:00:00.000Z",
        updatedAt: "2026-09-17T01:00:00.000Z",
      }],
    },
  };
}

function semantics() {
  return {
    story: {
      id: "story-slice-7:story",
      projectId: "story-slice-7",
      title: "Skyline Test",
      canonicalRevision: 14,
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

function editorialShot(editorial) {
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
        release: { state: "linked", reference: "storyboard-shot:later-recognition", condition: "Jace says the creature's name" },
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
    storyboardDependencyKey: "storyboard-upstream:slice-7",
    narrativePurpose: "Jace caught between motion and stillness.",
  }];
}

async function assembled(durationSeconds = 5.5) {
  const { editorial, handoff, readiness } = await modules();
  const semanticProjection = semantics();
  const productionIntent = handoff.assemblePreproductionProductionIntent({
    project: project(durationSeconds),
    semantics: semanticProjection,
    approvedEditorialShots: [editorialShot(editorial)],
    beats: beats(),
    frames: frames(),
  });
  return { readiness, semanticProjection, productionIntent };
}

test("#2125 Slice 7 proves one Scene can expose a complete inspectable provider-neutral #2064 readiness handoff", async () => {
  const { readiness, semanticProjection, productionIntent } = await assembled();
  const scene = readiness.inspectPreproductionSceneDirectorSpecReadiness({
    productionIntent,
    semantics: semanticProjection,
    sceneId: "scene-1",
  });

  assert.equal(scene.providerNeutral, true);
  assert.equal(scene.projectionOnly, true);
  assert.equal(scene.projectId, "story-slice-7");
  assert.equal(scene.canonicalRevision, 14);
  assert.equal(scene.scene.sceneId, "scene-1");
  assert.equal(scene.scene.purpose, "Interrupt the heist with empathy.");
  assert.equal(scene.scene.action, "Jace slows beside the cages.");
  assert.equal(scene.sequenceDurationSeconds, 5.5);
  assert.equal(scene.shots.length, 1);
  assert.equal(scene.shots[0].camera.movement, "Slow drift");
  assert.deepEqual(scene.shots[0].frameRefs, ["frame-1"]);
  assert.deepEqual(scene.shots[0].audioIntents, ["Diegetic cage ambience and foley only; no music."]);
  assert.equal(scene.shots[0].informationDirectives[1].mode, "WITHHOLD_NOW");
  assert.deepEqual(scene.coverage, {
    sceneIntent: true,
    approvedShotPlan: true,
    authoredTiming: true,
    cameraDirection: true,
    blocking: true,
    continuity: true,
    references: true,
    audioIntent: true,
    transitions: true,
    informationBoundary: true,
    provenance: true,
  });
  assert.equal(scene.readyForDirectorSpec, true);
  assert.deepEqual(scene.missingRequired, []);
  assert.ok(scene.sourceRefs.includes("legacy-scene:scene-1"));
  assert.ok(scene.sourceRefs.includes("canon-fact:jace-recognizes-goldie"));
  assert.equal(Object.hasOwn(scene, "prompt"), false);
  assert.equal(Object.hasOwn(scene, "providerInstructions"), false);
});

test("#2125 Slice 7 reports missing authored timing without inventing it", async () => {
  const { readiness, semanticProjection, productionIntent } = await assembled(null);
  const scene = readiness.inspectPreproductionSceneDirectorSpecReadiness({
    productionIntent,
    semantics: semanticProjection,
    sceneId: "scene-1",
  });

  assert.equal(scene.sequenceDurationSeconds, null);
  assert.equal(scene.coverage.authoredTiming, false);
  assert.equal(scene.readyForDirectorSpec, false);
  assert.deepEqual(scene.missingRequired, ["authoredTiming"]);
  assert.equal(scene.shots[0].execution.durationSeconds, null);
});

test("#2125 Slice 7 stays upstream of #2064 compilation and provider routing", async () => {
  const readiness = await source("lib/preproduction/director-spec-readiness.ts");
  assert.match(readiness, /providerNeutral: true/);
  assert.match(readiness, /projectionOnly: true/);
  assert.match(readiness, /does not create a Director Specification/);
  assert.doesNotMatch(readiness, /Seedance|Runway|Veo|Kling|providerPrompt|promptProse|compileProvider/i);
  assert.doesNotMatch(readiness, /fetch\(|localStorage|sessionStorage|saveFoundationProject|applyStoryCommand/);
});
