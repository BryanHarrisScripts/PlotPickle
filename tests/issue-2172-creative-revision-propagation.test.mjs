import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

async function dependencyRuntime() {
  const source = await read("lib/preproduction/dependency-projection.ts");
  const compiled = stripTypeScriptTypes(source, { mode: "transform" });
  return import(`data:text/javascript;base64,${Buffer.from(compiled, "utf8").toString("base64")}#${Date.now()}-${Math.random()}`);
}

function afterglowTestCopy() {
  const project = {
    id: "afterglow-v9-working-copy",
    title: "Afterglow: Reflections of Sentience",
    revision: 41,
    structure: {
      version: 1,
      activeBlockNumber: 17,
      activeMiniBlockNumber: 1,
      activeStage: "storyboard",
      blocks: [{
        id: "block-17",
        number: 17,
        actNumber: 3,
        sequenceNumber: 9,
        title: "Waves of Connections",
        note: "Known Afterglow Block 17 test copy.",
        planningLockedAt: null,
        miniBlocks: [
          { id: "mini-65", number: 65, blockNumber: 17, ordinal: 1, title: "Promise", note: "", stages: {} },
          { id: "mini-66", number: 66, blockNumber: 17, ordinal: 2, title: "Progress", note: "", stages: {} },
        ],
      }],
    },
    production: {
      shots: [
        {
          id: "previs-afterglow-17-1",
          anchorRef: "storyboard-anchor:block:block-17:mini-1",
          storyboardArtifactId: "storyboard-afterglow-17-1",
          storyboardDependencyKey: "storyboard-upstream:storyboard-anchor:block:block-17:mini-1:legacy",
          order: 1,
          visualIntent: "Ren and Summer in the same visual beat.",
          durationSeconds: 5,
          reviewState: "approved",
        },
        {
          id: "previs-afterglow-17-2",
          anchorRef: "storyboard-anchor:block:block-17:mini-2",
          storyboardArtifactId: "storyboard-afterglow-17-2",
          storyboardDependencyKey: "storyboard-upstream:storyboard-anchor:block:block-17:mini-2:legacy",
          order: 1,
          visualIntent: "Unrelated Block 17.2 visual beat.",
          durationSeconds: 6,
          reviewState: "approved",
        },
      ],
    },
  };

  const semantics = {
    story: {
      id: "afterglow-v9-working-copy:story",
      projectId: "afterglow-v9-working-copy",
      title: project.title,
      canonicalRevision: 41,
      premise: "",
      logline: "",
      theme: "",
    },
    blocks: [{
      id: "block-17",
      number: 17,
      actNumber: 3,
      sequenceNumber: 9,
      miniBlockIds: ["mini-65", "mini-66"],
    }],
    scenes: [
      {
        id: "source-scene:81",
        sourceRef: "screenplay-scene:Afterglow-v9:scene-81",
        blockId: "block-17",
        blockNumber: 17,
        title: "Afterglow scene 81",
        purpose: "",
        objective: "",
        opposition: "",
        action: "",
        turn: "",
        outcome: "",
        relatedMiniBlockIds: ["mini-65"],
        assetRefs: [],
      },
      {
        id: "source-scene:82",
        sourceRef: "screenplay-scene:Afterglow-v9:scene-82",
        blockId: "block-17",
        blockNumber: 17,
        title: "Afterglow scene 82",
        purpose: "",
        objective: "",
        opposition: "",
        action: "",
        turn: "",
        outcome: "",
        relatedMiniBlockIds: ["mini-66"],
        assetRefs: [],
      },
    ],
    miniBlockSceneRelations: [],
    legacyDetailStatus: "absent",
  };

  const frames = [1, 2].map((mini) => ({
    frameId: `storyboard-afterglow-17-${mini}`,
    anchorRef: `storyboard-anchor:block:block-17:mini-${mini}`,
    storyboardArtifactId: `storyboard-afterglow-17-${mini}`,
    storyboardDependencyKey: `storyboard-upstream:storyboard-anchor:block:block-17:mini-${mini}:legacy`,
    narrativePurpose: `Afterglow Block 17.${mini} kept visual`,
  }));

  const productionInstruction = {
    projectId: project.id,
    canonicalRevision: project.revision,
    providerNeutral: true,
    storyboardFrameRefs: frames.map((frame) => frame.frameId),
    productionShotRefs: project.production.shots.map((shot) => shot.id),
    approvedProductionShotRefs: project.production.shots.map((shot) => shot.id),
  };

  return { project, semantics, frames, productionInstruction };
}

test("#2172 Afterglow Block 17.1 change invalidates only its real downstream fixture dependencies", async () => {
  const { buildPreproductionDependencySnapshot, downstreamImpactIds, downstreamImpactPaths } = await dependencyRuntime();
  const fixture = afterglowTestCopy();
  const snapshot = buildPreproductionDependencySnapshot(fixture);
  const impacted = new Set(downstreamImpactIds(snapshot, ["mini-65"]));
  const paths = downstreamImpactPaths(snapshot, ["mini-65"]);

  for (const expected of [
    "source-scene:81",
    "storyboard-afterglow-17-1",
    "previs-afterglow-17-1",
    "production-instruction:afterglow-v9-working-copy:revision-41",
  ]) {
    assert.equal(impacted.has(expected), true, `Expected Afterglow 17.1 to affect ${expected}`);
  }

  for (const preserved of [
    "mini-66",
    "source-scene:82",
    "storyboard-afterglow-17-2",
    "previs-afterglow-17-2",
  ]) {
    assert.equal(impacted.has(preserved), false, `Unrelated Afterglow 17.2 work must remain current: ${preserved}`);
  }

  assert.deepEqual(paths["previs-afterglow-17-1"], [
    "mini-65",
    "storyboard-afterglow-17-1",
    "previs-afterglow-17-1",
  ]);
});

test("#2172 planning lock metadata has no creative descendants", async () => {
  const { buildPreproductionDependencySnapshot, downstreamImpactIds } = await dependencyRuntime();
  const snapshot = buildPreproductionDependencySnapshot(afterglowTestCopy());
  assert.deepEqual(downstreamImpactIds(snapshot, ["planning-lock:block-17"]), []);
});

test("#2172 planner reuses #2035 and separates affected from preserved accepted work", async () => {
  const source = await read("lib/preproduction/creative-revision-propagation.ts");
  for (const contract of [
    "createPreproductionCreativeChangeSet",
    "verifyPreproductionCreativeChangeSet",
    "buildPreproductionDependencySnapshot",
    "downstreamImpactIds",
    "downstreamImpactPaths",
    "staleAcceptedVisualArtifactIds",
    "staleProductionShotIds",
    "unaffectedAcceptedVisualArtifactIds",
    "unaffectedProductionShotIds",
    "requiresRegeneration: false",
  ]) assert.ok(source.includes(contract), `Missing #2172 consequence contract: ${contract}`);
  assert.doesNotMatch(source, /createLocalCreativeTransactionProvider|createGitHubCreativeTransactionProvider|generateImage|generateVideo|provider\.execute|spend/i);
});

test("#2172 preserves legacy Storyboard keys and marks only post-upgrade affected visuals stale", async () => {
  const model = await read("app/_components/storyboard/storyboard-editorial-model.ts");
  const propagation = await read("lib/preproduction/creative-revision-propagation.ts");
  assert.match(model, /STORYBOARD_UPSTREAM_V2_PREFIX = "storyboard-upstream:v2:"/u);
  assert.match(model, /STORYBOARD_STALE_PREFIX = "storyboard-stale:"/u);
  assert.match(model, /const recordedV2 = keys\.find/u);
  assert.match(model, /if \(keys\.some\(\(key\) => key\.startsWith\(legacyPrefix\)\)\) return \[\]/u);
  assert.match(propagation, /storyboard-stale:\$\{anchorRef\}:revision-\$\{atRevision\}/u);
  assert.match(propagation, /visualArtifacts: project\.build\.foundations\.visualArtifacts\.map/u);
  assert.match(propagation, /visualArtifacts: project\.build\.world\.visualArtifacts\.map/u);
});

test("#2172 Write and Story Cards expose bounded impact without regeneration", async () => {
  const [write, board] = await Promise.all([
    read("modules/write/ui/block-native-write-workspace.tsx"),
    read("app/skin-v1/story-card-foundation-board.tsx"),
  ]);
  assert.match(write, /planCreativeRevisionPropagation/u);
  assert.match(write, /kind: "writing"/u);
  assert.match(write, /Dependency impact preview/u);
  assert.match(write, /No regeneration was triggered/u);
  assert.match(write, /markCreativeRevisionDependentsStale/u);
  assert.match(board, /kind: "block-content"/u);
  assert.match(board, /kind: "mini-content"/u);
  assert.match(board, /kind: "planning-lock"/u);
  assert.match(board, /Planning lock state changed without invalidating downstream creative work/u);
  assert.match(board, /No story content changed merely because the lock changed/u);
});

test("#2172 accepted visual replacement previews only dependent Previs review impact", async () => {
  const editorial = await read("app/_components/storyboard/storyboard-editorial-workspace.tsx");
  assert.match(editorial, /kind: "accepted-visual"/u);
  assert.match(editorial, /Accepted visual change consequence preview/u);
  assert.match(editorial, /dependent Previs Shot/u);
  assert.match(editorial, /unrelated Previs Shot/u);
  assert.match(editorial, /does not trigger regeneration, provider spend or downstream approval/u);
});
