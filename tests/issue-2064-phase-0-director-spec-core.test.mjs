import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

async function moduleUnderTest() {
  const typeScript = await source("lib/preproduction/director-specification.ts");
  const compiled = stripTypeScriptTypes(typeScript, { mode: "transform" });
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}#director-spec-${Date.now()}-${Math.random()}`);
}

function readiness(overrides = {}) {
  return {
    version: 1,
    projectId: "story-2064",
    canonicalRevision: 21,
    providerNeutral: true,
    projectionOnly: true,
    scene: {
      sceneId: "scene-1",
      sourceRef: "legacy-scene:scene-1",
      blockId: "block-01",
      blockNumber: 1,
      title: "Cage Row",
      purpose: "Interrupt the heist with empathy.",
      objective: "Keep moving without being seen.",
      opposition: "The trapped creature catches Jace's attention.",
      action: "Jace slows beside the cages.",
      turn: "He lowers the pistol.",
      outcome: "The plan loses momentum.",
      relatedMiniBlockIds: ["mini-01"],
      assetRefs: [
        { kind: "character", id: "character-jace" },
        { kind: "location", id: "location-cage-row" },
      ],
    },
    shots: [{
      editorialShotId: "editorial-shot-1",
      anchorRef: "storyboard-anchor:block:block-01:mini-1",
      order: 1,
      narrativePurpose: "Show the hesitation without revealing recognition.",
      camera: {
        shotSize: "Medium",
        angle: "Eye level",
        movement: "Slow drift",
        lensIntent: "Natural perspective",
        lightingIntent: "Soft practical cage light",
      },
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
      continuityLockReferences: ["continuity:jace-costume", "continuity:creature-scale"],
      informationDirectives: [{
        id: "info-recognition-withheld",
        sourceRef: "canon-fact:jace-recognizes-goldie",
        sourceFingerprint: "fact-v1",
        statement: "Jace recognizes the creature.",
        mode: "WITHHOLD_NOW",
        protectionIntent: "Do not show identifying keepsake or recognition dialogue.",
        release: { state: "linked", reference: "editorial-shot-9", condition: "Jace says the creature's name" },
      }],
      beatRefs: ["beat-1"],
      audioIntents: ["Diegetic cage ambience and foley only; no music."],
      frameRefs: ["frame-1"],
      sceneRefs: ["scene-1"],
      assetRefs: [{ kind: "character", id: "character-jace" }],
      execution: {
        productionShotId: "previs-shot-1",
        storyboardArtifactId: "storyboard-artifact-1",
        storyboardDependencyKey: "storyboard-upstream:2064",
        visualIntent: "Hold long enough to read the hesitation.",
        durationSeconds: 5.5,
        transitionIn: "cut",
        transitionOut: "cut",
      },
      sourceRefs: ["editorial-shot-1", "previs-shot-1", "scene-1", "frame-1"],
    }],
    sequenceDurationSeconds: 5.5,
    coverage: {
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
    },
    readyForDirectorSpec: true,
    missingRequired: [],
    sourceRefs: ["story-2064:story", "scene-1", "previs-shot-1", "editorial-shot-1"],
    ...overrides,
  };
}

test("#2064 Phase 0 compiles approved Scene readiness into one provider-neutral Director Specification", async () => {
  const { compileDirectorSpecification } = await moduleUnderTest();
  const spec = compileDirectorSpecification({ readiness: readiness(), directionLevel: "production" });

  assert.equal(spec.version, 1);
  assert.equal(spec.providerNeutral, true);
  assert.equal(spec.projectId, "story-2064");
  assert.equal(spec.canonicalRevision, 21);
  assert.equal(spec.directionLevel, "production");
  assert.equal(spec.scene.sceneId, "scene-1");
  assert.equal(spec.scene.purpose, "Interrupt the heist with empathy.");
  assert.equal(spec.sequenceDurationSeconds, 5.5);
  assert.equal(spec.shots.length, 1);

  const shot = spec.shots[0];
  assert.equal(shot.editorialShotId, "editorial-shot-1");
  assert.equal(shot.productionShotId, "previs-shot-1");
  assert.equal(shot.durationSeconds, 5.5);
  assert.equal(shot.camera.movement, "Slow drift");
  assert.deepEqual(shot.continuityLockReferences, ["continuity:jace-costume", "continuity:creature-scale"]);
  assert.deepEqual(shot.frameRefs, ["frame-1"]);
  assert.equal(shot.informationDirectives[0].mode, "WITHHOLD_NOW");
  assert.ok(spec.sourceRefs.includes("scene-1"));
  assert.ok(spec.sourceRefs.includes("previs-shot-1"));
  assert.equal(Object.hasOwn(spec, "provider"), false);
  assert.equal(Object.hasOwn(spec, "prompt"), false);
  assert.equal(Object.hasOwn(spec, "instructions"), false);
});

test("#2064 Phase 0 defaults to Directed depth without creating a separate story state", async () => {
  const { compileDirectorSpecification } = await moduleUnderTest();
  const spec = compileDirectorSpecification({ readiness: readiness() });
  assert.equal(spec.directionLevel, "directed");
  assert.equal(spec.scene.sceneId, "scene-1");
});

test("#2064 Phase 0 fails closed when the upstream readiness gate is incomplete", async () => {
  const { compileDirectorSpecification } = await moduleUnderTest();
  assert.throws(() => compileDirectorSpecification({
    readiness: readiness({
      readyForDirectorSpec: false,
      missingRequired: ["authoredTiming"],
      sequenceDurationSeconds: null,
    }),
  }), /not ready: authoredTiming/i);
});

test("#2064 Phase 0 remains provider-neutral and does not pre-implement routing or prompt compilation", async () => {
  const text = await source("lib/preproduction/director-specification.ts");
  assert.match(text, /providerNeutral: true/);
  assert.match(text, /directionLevel/);
  assert.doesNotMatch(text, /Seedance|Runway|Veo|Kling|MiniMax|OpenAI|ComfyUI/);
  assert.doesNotMatch(text, /fetch\(|localStorage|sessionStorage|saveFoundationProject|media-routing|story-mode-policy/);
  assert.doesNotMatch(text, /providerPrompt|promptProse|compileProviderInstructions/);
});
