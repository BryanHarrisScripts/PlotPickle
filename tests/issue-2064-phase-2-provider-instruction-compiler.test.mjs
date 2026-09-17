import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

async function moduleUnderTest() {
  const typeScript = await source("lib/preproduction/provider-instruction-compiler.ts");
  const compiled = stripTypeScriptTypes(typeScript, { mode: "transform" });
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}#provider-instructions-${Date.now()}-${Math.random()}`);
}

function specification(directionLevel = "production") {
  return {
    version: 1,
    providerNeutral: true,
    projectId: "story-2064",
    canonicalRevision: 22,
    directionLevel,
    scene: {
      sceneId: "scene-1",
      title: "Cage Row",
      purpose: "Interrupt the heist with empathy.",
      objective: "Keep moving without being seen.",
      opposition: "The trapped creature catches Jace's attention.",
      action: "Jace slows beside the cages.",
      turn: "He lowers the pistol.",
      outcome: "The plan loses momentum.",
      assetRefs: [{ kind: "location", id: "location-cage-row" }],
    },
    sequenceDurationSeconds: 9,
    shots: [
      {
        editorialShotId: "editorial-shot-1",
        productionShotId: "previs-shot-1",
        anchorRef: "storyboard-anchor:block:block-01:mini-1",
        order: 1,
        narrativePurpose: "Show the hesitation without revealing recognition.",
        durationSeconds: 5,
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
        continuityLockReferences: ["continuity:jace-costume"],
        informationDirectives: [{
          id: "withhold-recognition",
          sourceRef: "canon-fact:jace-recognizes-goldie",
          sourceFingerprint: "fact-v1",
          statement: "Jace recognizes the creature.",
          mode: "WITHHOLD_NOW",
          protectionIntent: "Do not reveal recognition yet.",
          release: { state: "linked", reference: "editorial-shot-9", condition: "Jace says the creature's name" },
        }],
        audioIntents: ["Diegetic cage ambience only."],
        frameRefs: ["frame-1"],
        assetRefs: [{ kind: "character", id: "character-jace" }],
        transitionIn: "cut",
        transitionOut: "cut",
        sourceRefs: ["scene-1", "editorial-shot-1", "previs-shot-1", "frame-1"],
      },
      {
        editorialShotId: "editorial-shot-2",
        productionShotId: "previs-shot-2",
        anchorRef: "storyboard-anchor:block:block-01:mini-1",
        order: 2,
        narrativePurpose: "Hold on the creature after Jace exits frame.",
        durationSeconds: 4,
        camera: {
          shotSize: "Close",
          angle: "Eye level",
          movement: "Locked",
          lensIntent: "Compressed perspective",
          lightingIntent: "Same practical cage light",
        },
        blocking: [{
          subjectId: "creature-goldie",
          startPosition: "rear of cage",
          facing: "toward lens",
          eyelineTargetId: "character-jace",
          movement: "one small step forward",
          endPosition: "front of cage",
          screenDirection: "neutral",
          axisState: "hold axis",
        }],
        continuityLockReferences: ["continuity:creature-scale"],
        informationDirectives: [],
        audioIntents: ["Cage rattle and room tone."],
        frameRefs: ["frame-2"],
        assetRefs: [{ kind: "character", id: "creature-goldie" }],
        transitionIn: "cut",
        transitionOut: "cut",
        sourceRefs: ["scene-1", "editorial-shot-2", "previs-shot-2", "frame-2"],
      },
    ],
    sourceRefs: ["story-2064:story", "scene-1", "editorial-shot-1", "editorial-shot-2"],
  };
}

function assessment(overrides = {}) {
  return {
    version: 1,
    providerId: "test-video-adapter",
    capability: "video",
    compilationStrategies: ["master", "per-shot"],
    classifications: [
      {
        property: "shot.order",
        strength: "required",
        sourceRef: "scene-1",
        treatment: "enforceable",
        note: "",
        userVisibleAdaptationRequired: false,
      },
      {
        property: "shot.duration",
        strength: "required",
        sourceRef: "scene-1",
        treatment: "best-effort",
        note: "Timing may vary slightly.",
        userVisibleAdaptationRequired: false,
      },
      {
        property: "delivery.frame-rate",
        strength: "required",
        sourceRef: "delivery:fps",
        treatment: "finishing",
        note: "Normalize frame rate in finishing/export.",
        userVisibleAdaptationRequired: false,
      },
      {
        property: "delivery.frame-count",
        strength: "preferred",
        sourceRef: "delivery:frame-count",
        treatment: "unsupported",
        note: "Exact frame count is unavailable.",
        userVisibleAdaptationRequired: false,
      },
    ],
    blockingRequiredProperties: [],
    ...overrides,
  };
}

function adapter() {
  return {
    version: 1,
    providerId: "test-video-adapter",
    compileMaster(payload) {
      return `MASTER ${payload.scene.title} | ${payload.shots.length} shots | ${payload.directionLevel}`;
    },
    compileShot(payload) {
      return `SHOT ${payload.shotIndex + 1}/${payload.shotCount} ${payload.shot.editorialShotId} | ${payload.directionLevel}`;
    },
  };
}

test("#2064 Phase 2 compiles one disposable inspectable master instruction and keeps finishing outside generation payload", async () => {
  const { compileProviderInstructions } = await moduleUnderTest();
  const bundle = compileProviderInstructions({
    specification: specification("production"),
    assessment: assessment(),
    strategy: "master",
    adapter: adapter(),
  });

  assert.equal(bundle.version, 1);
  assert.equal(bundle.disposable, true);
  assert.equal(bundle.providerId, "test-video-adapter");
  assert.equal(bundle.strategy, "master");
  assert.equal(bundle.instructions.length, 1);
  assert.equal(bundle.instructions[0].scope, "master");
  assert.match(bundle.instructions[0].text, /MASTER Cage Row \| 2 shots \| production/);
  assert.equal(bundle.finishingRequirements.length, 1);
  assert.equal(bundle.finishingRequirements[0].property, "delivery.frame-rate");
  assert.equal(bundle.unsupportedPreferences.length, 1);
  assert.equal(bundle.unsupportedPreferences[0].property, "delivery.frame-count");
  assert.ok(bundle.warnings.some((warning) => /Timing may vary slightly/i.test(warning)));
  assert.ok(bundle.warnings.some((warning) => /finishing\/export/i.test(warning)));
  assert.ok(bundle.sourceRefs.includes("scene-1"));
});

test("#2064 Phase 2 compiles one instruction per Shot with stable Shot provenance", async () => {
  const { compileProviderInstructions } = await moduleUnderTest();
  const bundle = compileProviderInstructions({
    specification: specification("directed"),
    assessment: assessment(),
    strategy: "per-shot",
    adapter: adapter(),
  });

  assert.equal(bundle.instructions.length, 2);
  assert.deepEqual(bundle.instructions.map((instruction) => instruction.scope), ["shot", "shot"]);
  assert.deepEqual(bundle.instructions.map((instruction) => instruction.editorialShotId), ["editorial-shot-1", "editorial-shot-2"]);
  assert.match(bundle.instructions[0].text, /SHOT 1\/2 editorial-shot-1 \| directed/);
  assert.ok(bundle.instructions[0].sourceRefs.includes("previs-shot-1"));
  assert.ok(bundle.instructions[1].sourceRefs.includes("previs-shot-2"));
});

test("#2064 Phase 2 applies Automatic, Directed and Production depth before the provider adapter sees the payload", async () => {
  const { compileProviderInstructions } = await moduleUnderTest();
  const captured = [];
  const inspectAdapter = {
    version: 1,
    providerId: "test-video-adapter",
    compileMaster(payload) {
      captured.push(payload);
      return "ok";
    },
  };

  for (const level of ["automatic", "directed", "production"]) {
    compileProviderInstructions({
      specification: specification(level),
      assessment: assessment({ compilationStrategies: ["master"] }),
      strategy: "master",
      adapter: inspectAdapter,
    });
  }

  const [automatic, directed, production] = captured;
  assert.equal(Object.hasOwn(automatic.shots[0], "camera"), false);
  assert.equal(Object.hasOwn(automatic.shots[0], "blocking"), false);
  assert.equal(Object.hasOwn(automatic.shots[0], "audioIntents"), false);
  assert.ok(directed.shots[0].camera);
  assert.ok(directed.shots[0].blocking);
  assert.equal(Object.hasOwn(directed.shots[0], "audioIntents"), false);
  assert.deepEqual(production.shots[0].audioIntents, ["Diegetic cage ambience only."]);
  assert.equal(production.shots[0].transitionIn, "cut");
  assert.equal(production.shots[0].transitionOut, "cut");
  assert.deepEqual(
    production.generationRequirements.map((requirement) => requirement.treatment),
    ["enforceable", "best-effort"],
    "finishing and unsupported properties must not be sent as generation requirements",
  );
});

test("#2064 Phase 2 fails closed for unsupported required properties, mismatched adapters, unsupported strategies and empty output", async () => {
  const { compileProviderInstructions } = await moduleUnderTest();
  const base = {
    specification: specification(),
    assessment: assessment(),
    strategy: "master",
    adapter: adapter(),
  };

  assert.throws(() => compileProviderInstructions({
    ...base,
    assessment: assessment({ blockingRequiredProperties: ["delivery.resolution"] }),
  }), /blocked by unsupported required properties: delivery\.resolution/i);

  assert.throws(() => compileProviderInstructions({
    ...base,
    adapter: { ...adapter(), providerId: "different-adapter" },
  }), /does not match the assessed provider/i);

  assert.throws(() => compileProviderInstructions({
    ...base,
    assessment: assessment({ compilationStrategies: ["per-shot"] }),
  }), /does not declare the master compilation strategy/i);

  assert.throws(() => compileProviderInstructions({
    ...base,
    adapter: { version: 1, providerId: "test-video-adapter", compileMaster: () => "   " },
  }), /returned empty instructions/i);
});

test("#2064 Phase 2 remains disposable adapter translation and does not select routes, call providers, or persist generated prose", async () => {
  const text = await source("lib/preproduction/provider-instruction-compiler.ts");
  assert.match(text, /disposable: true/);
  assert.match(text, /"master" \| "shot"/);
  assert.match(text, /compileMaster/);
  assert.match(text, /compileShot/);
  assert.doesNotMatch(text, /Seedance|Runway|Veo|Kling|MiniMax|OpenAI|ComfyUI/);
  assert.doesNotMatch(text, /fetch\(|localStorage|sessionStorage|saveFoundationProject|media-routing|story-mode-policy|selectProvider|routeProvider/);
  assert.doesNotMatch(text, /canonicalPrompt|persistPrompt|savePrompt|writePrompt/);
});
