import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

async function importProjection() {
  const source = await read("lib/preproduction/dependency-projection.ts");
  const compiled = stripTypeScriptTypes(source, { mode: "transform" });
  return import(`data:text/javascript;base64,${Buffer.from(compiled, "utf8").toString("base64")}#${Date.now()}-${Math.random()}`);
}

function fixture() {
  const project = {
    id: "story-1",
    title: "Trace Story",
    revision: 8,
    structure: {
      version: 1,
      activeBlockNumber: 1,
      activeMiniBlockNumber: 1,
      activeStage: "storyboard",
      blocks: [{
        id: "block-01",
        number: 1,
        actNumber: 1,
        sequenceNumber: 1,
        title: "Block 01",
        miniBlocks: [
          { id: "mini-01", number: 1, blockNumber: 1, ordinal: 1, title: "Mini 1", stages: {} },
          { id: "mini-02", number: 2, blockNumber: 1, ordinal: 2, title: "Mini 2", stages: {} },
        ],
      }],
    },
    production: {
      shots: [
        {
          id: "previs-1",
          anchorRef: "storyboard-anchor:block:block-01:mini-1",
          storyboardArtifactId: "artifact-1",
          storyboardDependencyKey: "storyboard-upstream:one",
          order: 1,
          visualIntent: "First shot",
          durationSeconds: 5,
          reviewState: "approved",
        },
        {
          id: "previs-2",
          anchorRef: "storyboard-anchor:block:block-01:mini-2",
          storyboardArtifactId: "artifact-2",
          storyboardDependencyKey: "storyboard-upstream:two",
          order: 1,
          visualIntent: "Second shot",
          durationSeconds: 6,
          reviewState: "approved",
        },
      ],
    },
  };

  const semantics = {
    story: {
      id: "story-1:story",
      projectId: "story-1",
      title: "Trace Story",
      canonicalRevision: 8,
      premise: "",
      logline: "Trace it",
      theme: "",
    },
    blocks: [{ id: "block-01", number: 1, actNumber: 1, sequenceNumber: 1, miniBlockIds: ["mini-01", "mini-02"] }],
    scenes: [
      {
        id: "scene-1",
        sourceRef: "legacy-scene:scene-1",
        blockId: "block-01",
        blockNumber: 1,
        title: "Scene One",
        purpose: "",
        objective: "",
        opposition: "",
        action: "",
        turn: "",
        outcome: "",
        relatedMiniBlockIds: ["mini-01"],
        assetRefs: [],
      },
      {
        id: "scene-2",
        sourceRef: "legacy-scene:scene-2",
        blockId: "block-01",
        blockNumber: 1,
        title: "Scene Two",
        purpose: "",
        objective: "",
        opposition: "",
        action: "",
        turn: "",
        outcome: "",
        relatedMiniBlockIds: ["mini-02"],
        assetRefs: [],
      },
    ],
    miniBlockSceneRelations: [],
    legacyDetailStatus: "matched",
  };

  const beats = [1, 2].map((number) => ({
    id: `beat-${number}`,
    anchorRef: `storyboard-anchor:block:block-01:mini-${number}`,
    order: 1,
    label: `Beat ${number}`,
    purpose: "",
    visualAction: "",
    cameraIntent: "",
    continuityIn: "",
    continuityOut: "",
    soundIntent: "",
    startSecond: null,
    endSecond: null,
  }));

  const editorialShots = [1, 2].map((number) => ({
    shotId: `editorial-shot-${number}`,
    anchorRef: `storyboard-anchor:block:block-01:mini-${number}`,
    order: 1,
    narrativePurpose: `Editorial shot ${number}`,
    shotSize: "Medium",
    cameraAngle: "Eye level",
    cameraMovement: "Locked",
    lensIntent: "Natural",
    lightingIntent: "",
    continuityLockReferences: [],
    notes: "",
    blocking: [],
    informationDirectives: number === 1 ? [{
      id: "directive-1",
      sourceRef: "canon-fact:caller-knows-sarah",
      sourceFingerprint: "fact-v1",
      statement: "The caller knows Sarah",
      mode: "SHOW_NOW",
      carrier: "dialogue",
      protectionIntent: "",
      release: { state: "not-applicable", reference: "", condition: "" },
      rationale: "",
    }] : [],
  }));

  const frames = [1, 2].map((number) => ({
    frameId: `frame-${number}`,
    anchorRef: `storyboard-anchor:block:block-01:mini-${number}`,
    storyboardArtifactId: `artifact-${number}`,
    storyboardDependencyKey: `storyboard-upstream:${number}`,
    narrativePurpose: `Frame ${number}`,
  }));

  const productionInstruction = {
    projectId: "story-1",
    canonicalRevision: 8,
    providerNeutral: true,
    storyboardFrameRefs: ["frame-1", "frame-2"],
    productionShotRefs: ["previs-1", "previs-2"],
    approvedProductionShotRefs: ["previs-1", "previs-2"],
  };

  return { project, semantics, beats, editorialShots, frames, productionInstruction };
}

test("#2092 Phase 2 traces current PPF production semantics through the existing dependency snapshot format", async () => {
  const { buildPreproductionDependencySnapshot, upstreamTraceIds } = await importProjection();
  const snapshot = buildPreproductionDependencySnapshot({ ...fixture(), generatedAt: "2026-09-16T12:00:00.000Z" });

  assert.equal(snapshot.version, "2.0.0");
  assert.equal(snapshot.projectId, "story-1");
  assert.ok(snapshot.graph.nodes.some((node) => node.id === "mini-01" && node.kind === "mini-block"));
  assert.ok(snapshot.graph.nodes.some((node) => node.id === "beat-1" && node.kind === "production-cue" && node.metadata.semanticKind === "beat"));
  assert.ok(snapshot.graph.nodes.some((node) => node.id === "editorial-shot-1" && node.metadata.semanticKind === "storyboard-shot"));

  const upstream = new Set(upstreamTraceIds(snapshot, "previs-1"));
  for (const expected of ["frame-1", "mini-01", "block-01", "sequence-01", "story-1:act:1", "story-1:story", "story-1"]) {
    assert.ok(upstream.has(expected), `Expected ${expected} in Previs shot upstream trace`);
  }
});

test("#2092 Phase 2 calculates bounded downstream impact without invalidating an unrelated Mini-Block", async () => {
  const { buildPreproductionDependencySnapshot, downstreamImpactIds } = await importProjection();
  const snapshot = buildPreproductionDependencySnapshot(fixture());
  const impacted = new Set(downstreamImpactIds(snapshot, ["mini-01"]));

  for (const expected of ["scene-1", "beat-1", "editorial-shot-1", "frame-1", "previs-1", "production-instruction:story-1:revision-8"]) {
    assert.ok(impacted.has(expected), `Expected ${expected} to be impacted by mini-01`);
  }
  for (const unaffected of ["scene-2", "beat-2", "editorial-shot-2", "frame-2", "previs-2", "mini-02"]) {
    assert.equal(impacted.has(unaffected), false, `Did not expect ${unaffected} to be impacted by mini-01`);
  }
});

test("#2092/#2107 source evidence can target only the editorial Shot that carries its information boundary", async () => {
  const { buildPreproductionDependencySnapshot, downstreamImpactIds } = await importProjection();
  const snapshot = buildPreproductionDependencySnapshot(fixture());
  const impacted = new Set(downstreamImpactIds(snapshot, ["canon-fact:caller-knows-sarah"]));

  assert.ok(impacted.has("editorial-shot-1"));
  assert.equal(impacted.has("editorial-shot-2"), false);
  assert.equal(impacted.has("previs-2"), false);
});

test("#2092 Phase 2 remains a graph projection and does not create persistence or orchestration machinery", async () => {
  const source = await read("lib/preproduction/dependency-projection.ts");
  assert.match(source, /StoryDependencySnapshot/);
  assert.match(source, /references/);
  assert.match(source, /reverseIndex/);
  assert.match(source, /downstreamImpactIds/);
  assert.match(source, /upstreamTraceIds/);
  assert.doesNotMatch(source, /LangGraph|workflow editor|localStorage|sessionStorage|saveFoundationProject|writeStore|CreativeChangeSet/);
});
