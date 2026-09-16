import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

async function importTypeScript(path) {
  const source = await read(path);
  const compiled = stripTypeScriptTypes(source, { mode: "transform" });
  return import(`data:text/javascript;base64,${Buffer.from(compiled, "utf8").toString("base64")}#${Date.now()}-${Math.random()}`);
}

function canonicalProject() {
  return {
    id: "story-1",
    title: "Test Story",
    revision: 7,
    structure: {
      version: 1,
      activeBlockNumber: 1,
      activeMiniBlockNumber: 1,
      activeStage: "plan",
      blocks: [
        {
          id: "block-01",
          number: 1,
          actNumber: 1,
          sequenceNumber: 1,
          title: "Block 01",
          miniBlocks: [1, 2, 3, 4].map((ordinal) => ({
            id: `mini-0${ordinal}`,
            number: ordinal,
            blockNumber: 1,
            ordinal,
            title: `Mini ${ordinal}`,
            stages: {},
          })),
        },
      ],
    },
    production: {
      shots: [
        {
          id: "previs-shot-1",
          anchorRef: "storyboard-anchor:block:block-01:mini-1",
          storyboardArtifactId: "storyboard-frame-1",
          storyboardDependencyKey: "storyboard-upstream:test",
          order: 1,
          shotSize: "Wide",
          angle: "Eye level",
          movement: "Locked",
          lens: "Natural",
          visualIntent: "",
          durationSeconds: 4.5,
          transitionIn: "cut",
          transitionOut: "cut",
          reviewState: "approved",
          createdAt: "2026-09-16T00:00:00.000Z",
          updatedAt: "2026-09-16T00:00:00.000Z",
        },
      ],
    },
  };
}

function legacyProject() {
  return {
    id: "story-1",
    story: {
      premise: "A premise",
      logline: "A logline",
      theme: "A theme",
    },
    blocks: [
      {
        number: 1,
        scenes: [
          {
            id: "scene-1",
            title: "Scene One",
            purpose: "Set the problem",
            objective: "Find the key",
            opposition: "The room is watched",
            conflict: "",
            action: "Search",
            turn: "The key is missing",
            reversal: "",
            outcome: "Leave empty-handed",
            resolution: "",
            characterIds: ["character-sarah"],
            locationIds: ["location-cabin"],
            miniBlocks: [
              { id: "block-01-mini-1", number: 1 },
              { id: "block-01-mini-2", number: 2 },
            ],
          },
        ],
      },
    ],
  };
}

test("#2092 Phase 1 keeps StoryStructureV2 addresses canonical and projects legacy Scene detail onto them", async () => {
  const { projectPreproductionSemantics } = await importTypeScript("lib/preproduction/semantic-projection.ts");
  const canonical = canonicalProject();
  const before = JSON.stringify(canonical);
  const projection = projectPreproductionSemantics(canonical, legacyProject());

  assert.equal(projection.legacyDetailStatus, "matched");
  assert.equal(projection.story.id, "story-1:story");
  assert.equal(projection.story.canonicalRevision, 7);
  assert.equal(projection.blocks[0].id, "block-01");
  assert.deepEqual(projection.blocks[0].miniBlockIds, ["mini-01", "mini-02", "mini-03", "mini-04"]);
  assert.deepEqual(projection.scenes[0].relatedMiniBlockIds, ["mini-01", "mini-02"]);
  assert.deepEqual(projection.scenes[0].assetRefs, [
    { kind: "character", id: "character-sarah" },
    { kind: "location", id: "location-cabin" },
  ]);
  assert.deepEqual(projection.miniBlockSceneRelations[0].sceneIds, ["scene-1"]);
  assert.deepEqual(projection.miniBlockSceneRelations[0].sourceMiniBlockIds, ["block-01-mini-1"]);
  assert.equal(JSON.stringify(canonical), before, "projection must not mutate canonical PPF state");
});

test("#2092 Phase 1 refuses to attach legacy Scene detail from a different project", async () => {
  const { projectPreproductionSemantics } = await importTypeScript("lib/preproduction/semantic-projection.ts");
  const legacy = { ...legacyProject(), id: "other-story" };
  const projection = projectPreproductionSemantics(canonicalProject(), legacy);

  assert.equal(projection.legacyDetailStatus, "project-id-mismatch");
  assert.deepEqual(projection.scenes, []);
  assert.equal(projection.miniBlockSceneRelations[0].sceneIds.length, 0);
  assert.equal(projection.story.premise, "");
});

test("#2092 Phase 1 reuses SequenceDirector beats and ProductionShotIntent timing without new stores", async () => {
  const {
    projectPrevisTiming,
    projectProductionInstruction,
    projectSequenceDirectorBeats,
  } = await importTypeScript("lib/preproduction/semantic-projection.ts");

  const beats = projectSequenceDirectorBeats({
    anchorRef: "storyboard-anchor:block:block-01:mini-1",
    beats: [
      {
        id: "beat-1",
        order: 1,
        label: "Discovery",
        purpose: "Reveal the empty hiding place",
        visualAction: "Sarah lifts the cup",
        cameraIntent: "Hold close",
        continuityIn: "Cup intact",
        continuityOut: "Cup moved",
        soundIntent: "Room tone",
        startSecond: null,
        endSecond: null,
      },
    ],
  });
  assert.equal(beats[0].id, "beat-1");
  assert.equal(beats[0].anchorRef, "storyboard-anchor:block:block-01:mini-1");

  const canonical = canonicalProject();
  const timing = projectPrevisTiming(canonical);
  assert.deepEqual(timing[0], {
    productionShotId: "previs-shot-1",
    anchorRef: "storyboard-anchor:block:block-01:mini-1",
    order: 1,
    durationSeconds: 4.5,
    transitionIn: "cut",
    transitionOut: "cut",
    reviewState: "approved",
  });

  const instruction = projectProductionInstruction(canonical, ["frame-1", "frame-1"]);
  assert.equal(instruction.providerNeutral, true);
  assert.deepEqual(instruction.storyboardFrameRefs, ["frame-1"]);
  assert.deepEqual(instruction.productionShotRefs, ["previs-shot-1"]);
  assert.deepEqual(instruction.approvedProductionShotRefs, ["previs-shot-1"]);
});

test("#2092/#2107 editorial Shot contract preserves independent SHOW_NOW and WITHHOLD_NOW facts", async () => {
  const {
    normalizeStoryboardEditorialShot,
    productionReadyShotInformationErrors,
    storyboardEditorialShotId,
    validateStoryboardEditorialShot,
  } = await importTypeScript("core/contracts/storyboard/editorial-shot.ts");

  const anchorRef = "storyboard-anchor:block:block-01:mini-1";
  const shot = normalizeStoryboardEditorialShot({
    narrativePurpose: "Let the audience know the caller knows Sarah without revealing identity.",
    shotSize: "Medium",
    cameraAngle: "Eye level",
    cameraMovement: "Locked",
    informationDirectives: [
      {
        id: "info-knows-sarah",
        sourceRef: "canon-fact:caller-knows-sarah",
        statement: "The unseen caller knows Sarah.",
        mode: "SHOW_NOW",
        carrier: "offscreen dialogue",
        release: { state: "linked", reference: "should-be-cleared" },
      },
      {
        id: "info-brother",
        sourceRef: "canon-fact:caller-is-brother",
        statement: "The caller is Sarah's missing brother.",
        mode: "WITHHOLD_NOW",
        protectionIntent: "Keep the caller outside frame and unlit.",
        release: { state: "pending" },
      },
    ],
  }, { anchorRef, order: 1 });

  assert.equal(shot.shotId, storyboardEditorialShotId(anchorRef, 1));
  assert.equal(shot.informationDirectives[0].mode, "SHOW_NOW");
  assert.equal(shot.informationDirectives[0].release.state, "not-applicable");
  assert.equal(shot.informationDirectives[1].mode, "WITHHOLD_NOW");
  assert.equal(validateStoryboardEditorialShot(shot).length, 0);
  assert.match(productionReadyShotInformationErrors(shot).join("\n"), /pending release responsibility/);

  const productionReady = normalizeStoryboardEditorialShot({
    ...shot,
    informationDirectives: shot.informationDirectives.map((directive) => directive.id === "info-brother"
      ? { ...directive, release: { state: "linked", reference: "storyboard-shot:later-reveal", condition: "Steps into the light" } }
      : directive),
  }, { anchorRef, order: 1 });
  assert.deepEqual(productionReadyShotInformationErrors(productionReady), []);
});

test("#2092 Phase 1 remains projection-only and reuses existing authorities", async () => {
  const [projection, editorial, structure, previs, director] = await Promise.all([
    read("lib/preproduction/semantic-projection.ts"),
    read("core/contracts/storyboard/editorial-shot.ts"),
    read("core/project/story-structure-v2.ts"),
    read("core/contracts/previs/index.ts"),
    read("core/contracts/sequence-director/index.ts"),
  ]);

  assert.match(projection, /StoryStructureV2/);
  assert.match(projection, /SequenceDirectorDraft/);
  assert.match(projection, /projectPrevisTiming/);
  assert.match(projection, /providerNeutral: true/);
  assert.match(editorial, /semantic contract\/projection, not a new persisted Shot store/);
  assert.match(editorial, /informationDirectives/);
  assert.match(structure, /STORY_BLOCK_COUNT = 24/);
  assert.match(structure, /MINI_BLOCKS_PER_BLOCK = 4/);
  assert.match(previs, /interface ProductionShotIntent/);
  assert.match(director, /interface SequenceDirectorBeat/);
  assert.doesNotMatch(`${projection}\n${editorial}`, /localStorage|sessionStorage|saveFoundationProject|writeStore|createEmpty.*Store/);
});
