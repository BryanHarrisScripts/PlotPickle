import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

async function importDependencyProjection() {
  const source = await read("lib/preproduction/dependency-projection.ts");
  const compiled = stripTypeScriptTypes(source, { mode: "transform" });
  return import(`data:text/javascript;base64,${Buffer.from(compiled, "utf8").toString("base64")}#${Date.now()}-${Math.random()}`);
}

test("#2107 keeps Shot Information Boundary on the existing editorial Shot authority", async () => {
  const contract = await read("core/contracts/storyboard/editorial-shot.ts");

  assert.match(contract, /readonly informationDirectives: readonly ShotInformationDirective\[\]/u);
  assert.match(contract, /"SHOW_NOW", "WITHHOLD_NOW"/u);
  assert.match(contract, /readonly sourceRef: string/u);
  assert.match(contract, /readonly carrier: string/u);
  assert.match(contract, /readonly protectionIntent: string/u);
  assert.match(contract, /readonly release: ShotInformationRelease/u);
  assert.match(contract, /pending release responsibility/u);
  assert.doesNotMatch(contract, /AudienceKnowledge(Store|Engine)|ShotInformationStore/u);
});

test("#2107 linked Frames inherit the owning Shot disclosure directives without becoming a second authority", async () => {
  const projection = await read("lib/preproduction/visual-story-projection.ts");

  assert.match(projection, /readonly informationDirectives: readonly ShotInformationDirective\[\]/u);
  assert.match(projection, /map\(\(frame\) => \(\{ \.\.\.frame, informationDirectives \}\)\)/u);
  assert.match(projection, /informationDirectives: editorial\?\.informationDirectives \?\? \[\]/u);
  assert.doesNotMatch(projection, /saveInformationDirective|persistInformationDirective|informationDirectiveStore/u);
});

test("#2107 reveal-fact changes propagate only through the matching Shot, linked Frame and Previs Shot", async () => {
  const { buildPreproductionDependencySnapshot, downstreamImpactIds } = await importDependencyProjection();

  const project = {
    id: "story-1",
    title: "Disclosure Story",
    revision: 3,
    structure: {
      blocks: [{
        id: "block-01",
        number: 1,
        actNumber: 1,
        sequenceNumber: 1,
        title: "Block 01",
        miniBlocks: [
          { id: "mini-01", number: 1, ordinal: 1, title: "Mini 1" },
          { id: "mini-02", number: 2, ordinal: 2, title: "Mini 2" },
        ],
      }],
    },
    production: {
      shots: [
        {
          id: "previs-1",
          anchorRef: "storyboard-anchor:block:block-01:mini-1",
          storyboardArtifactId: "frame-artifact-1",
          storyboardDependencyKey: "storyboard-upstream:one",
          order: 1,
          visualIntent: "Protect identity",
          durationSeconds: 4,
          reviewState: "approved",
        },
        {
          id: "previs-2",
          anchorRef: "storyboard-anchor:block:block-01:mini-2",
          storyboardArtifactId: "frame-artifact-2",
          storyboardDependencyKey: "storyboard-upstream:two",
          order: 1,
          visualIntent: "Unrelated shot",
          durationSeconds: 4,
          reviewState: "approved",
        },
      ],
    },
  };

  const semantics = {
    story: {
      id: "story-1:story",
      projectId: "story-1",
      title: "Disclosure Story",
      canonicalRevision: 3,
      premise: "",
      logline: "",
      theme: "",
    },
    blocks: [{
      id: "block-01",
      number: 1,
      actNumber: 1,
      sequenceNumber: 1,
      miniBlockIds: ["mini-01", "mini-02"],
    }],
    scenes: [],
    miniBlockSceneRelations: [],
    legacyDetailStatus: "absent",
  };

  const editorialShots = [
    {
      shotId: "editorial-1",
      anchorRef: "storyboard-anchor:block:block-01:mini-1",
      order: 1,
      narrativePurpose: "Keep the visitor anonymous",
      shotSize: "Medium",
      cameraAngle: "",
      cameraMovement: "",
      lensIntent: "",
      lightingIntent: "",
      continuityLockReferences: [],
      notes: "",
      blocking: [],
      informationDirectives: [{
        id: "identity-withhold",
        sourceRef: "canon-fact:visitor-is-maya",
        sourceFingerprint: "v1",
        statement: "The visitor is Maya",
        mode: "WITHHOLD_NOW",
        carrier: "",
        protectionIntent: "Keep face out of light",
        release: { state: "linked", reference: "editorial-3", condition: "Steps into light" },
        rationale: "Preserve the reveal",
      }],
    },
    {
      shotId: "editorial-2",
      anchorRef: "storyboard-anchor:block:block-01:mini-2",
      order: 1,
      narrativePurpose: "Unrelated",
      shotSize: "Wide",
      cameraAngle: "",
      cameraMovement: "",
      lensIntent: "",
      lightingIntent: "",
      continuityLockReferences: [],
      notes: "",
      blocking: [],
      informationDirectives: [{
        id: "other-fact",
        sourceRef: "canon-fact:weather",
        sourceFingerprint: "v1",
        statement: "It is raining",
        mode: "SHOW_NOW",
        carrier: "Visible rain",
        protectionIntent: "",
        release: { state: "not-applicable", reference: "", condition: "" },
        rationale: "",
      }],
    },
  ];

  const frames = [
    {
      frameId: "frame-1",
      anchorRef: "storyboard-anchor:block:block-01:mini-1",
      storyboardArtifactId: "frame-artifact-1",
      storyboardDependencyKey: "storyboard-upstream:one",
      narrativePurpose: "Protected frame",
    },
    {
      frameId: "frame-2",
      anchorRef: "storyboard-anchor:block:block-01:mini-2",
      storyboardArtifactId: "frame-artifact-2",
      storyboardDependencyKey: "storyboard-upstream:two",
      narrativePurpose: "Unrelated frame",
    },
  ];

  const snapshot = buildPreproductionDependencySnapshot({
    project,
    semantics,
    editorialShots,
    frames,
    generatedAt: "2026-09-19T00:00:00.000Z",
  });

  const impacted = downstreamImpactIds(snapshot, ["canon-fact:visitor-is-maya"]);
  assert.ok(impacted.includes("editorial-1"));
  assert.ok(impacted.includes("frame-1"));
  assert.ok(impacted.includes("previs-1"));
  assert.ok(!impacted.includes("editorial-2"));
  assert.ok(!impacted.includes("frame-2"));
  assert.ok(!impacted.includes("previs-2"));
});

test("#2107 production intent keeps reveal timing provider-neutral and fails closed while release is pending", async () => {
  const handoff = await read("lib/preproduction/production-intent-handoff.ts");

  assert.match(handoff, /informationDirectives: readonly ShotInformationDirective\[\]/u);
  assert.match(handoff, /productionReadyShotInformationErrors\(editorial\)/u);
  assert.match(handoff, /informationDirectives: editorial\.informationDirectives/u);
  assert.match(handoff, /providerNeutral: true/u);
  assert.match(handoff, /projectionOnly: true/u);
});
