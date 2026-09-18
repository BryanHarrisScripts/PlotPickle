import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

async function runtime(path) {
  const source = await read(path);
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const runtimeModule = { exports: {} };
  vm.runInNewContext(compiled, {
    module: runtimeModule,
    exports: runtimeModule.exports,
    require: () => ({}),
  });
  return { source, exports: runtimeModule.exports };
}

test("#2178 preserves all five supplied profiles as immutable historical reference files", async () => {
  const [manifest, amy, joy, ren, summer, twins] = await Promise.all([
    read("data/reference/afterglow/character-profiles/index.ts"),
    read("data/reference/afterglow/character-profiles/Character Profile - AMY.md"),
    read("data/reference/afterglow/character-profiles/Character Profile - JOY.md"),
    read("data/reference/afterglow/character-profiles/Character Profile - REN.md"),
    read("data/reference/afterglow/character-profiles/Character Profile - SUMMER.md"),
    read("data/reference/afterglow/character-profiles/Character Profile - The TWINS.md"),
  ]);

  for (const fileName of [
    "Character Profile - AMY.md",
    "Character Profile - JOY.md",
    "Character Profile - REN.md",
    "Character Profile - SUMMER.md",
    "Character Profile - The TWINS.md",
  ]) assert.ok(manifest.includes(fileName), fileName);

  for (const sha of [
    "1608a68ca46ca9ad7068b4a6e4b36ae1cac86fc4",
    "d9a0b7ad99e56bd8631ce0c0896d1f21634e2588",
    "2437d62b384ca229adcd86b42ab2f8b6c8841dd5",
    "323d8f27a3fa9287b3f04f24eb89d72bac7aa650",
    "d97f37776371df9c37a3f1b91e1c04d2c33796b8",
  ]) assert.ok(manifest.includes(sha), sha);

  assert.match(amy, /Initially programmed to be logical and neutral/u);
  assert.match(joy, /based on an internal staff member suffering from bipolar disorder/u);
  assert.match(ren, /Ren Edward Smith/u);
  assert.match(summer, /Summer Isobel Ray/u);
  assert.match(twins, /Kai Williams and Jai Harper/u);
  assert.match(manifest, /immutable: true/u);
  assert.match(manifest, /status: "historical-reference"/u);
});

test("#2178 keeps sensitive and version-contested profile claims source-only", async () => {
  const manifest = await read("data/reference/afterglow/character-profiles/index.ts");

  assert.match(manifest, /id: "joy-health-source"[\s\S]*handling: "restricted-reference"[\s\S]*canonEffect: "none"/u);
  assert.match(manifest, /Do not infer behaviour from a diagnosis/u);
  assert.match(manifest, /id: "summer-likeness-source"[\s\S]*handling: "restricted-reference"[\s\S]*canonEffect: "none"/u);
  assert.match(manifest, /Do not convert this claim into a visual-generation likeness instruction/u);
  assert.match(manifest, /id: "summer-identity"[\s\S]*reviewState: "needs-review"/u);
  assert.match(manifest, /id: "twins-worldview-source"[\s\S]*reviewState: "needs-review"/u);
  assert.match(manifest, /versioned source claim/u);
  assert.doesNotMatch(manifest, /canonEffect: "(?!none)[^"]+"/u);
});

test("#2178 character evidence contract separates profile truth, arc evidence and screenplay proof", async () => {
  const contract = await runtime("core/contracts/character-truth-evidence.ts");
  const evidence = contract.exports.normalizeCharacterTruthEvidence({
    fixtureId: "test-character-truth",
    sources: [{
      id: "profile-ren",
      fileName: "Character Profile - REN.md",
      repoPath: "data/reference/afterglow/character-profiles/Character Profile - REN.md",
      blobSha: "abc123",
      characterIds: ["ren"],
      immutable: true,
      sourceVersion: "historical-profile",
      status: "historical-reference",
      handlingNotes: [],
    }],
    claims: [{
      id: "ren-start",
      characterIds: ["ren"],
      kind: "starting-state",
      summary: "Profile-only starting-state claim.",
      sourceId: "profile-ren",
      sourceRef: "profile#start",
      sourceVersion: "historical-profile",
      reviewState: "source-only",
      targetArcField: "startingState",
      handling: "writer-reference",
      canonEffect: "none",
      note: "Not screenplay proof.",
    }],
    principalCharacterIds: ["ren"],
    arcCells: [{
      characterId: "ren",
      blockNumber: 4,
      state: "unresolved-insufficient-evidence",
      reviewState: "unreviewed",
      passageIds: ["p1"],
      sceneNumbers: [2],
      profileClaimIds: ["ren-start"],
      note: "Observed screenplay evidence exists.",
      reviewedAt: null,
    }],
    checkpoints: [{
      characterId: "ren",
      kind: "opening",
      targetArcField: "startingState",
      blockNumbers: [1, 2],
      passageIds: ["p1"],
      sceneNumbers: [2],
      note: "Flexible evidence window.",
    }],
    governingRule: "Character Truth is not automatically audience knowledge.",
  });

  assert.equal(evidence.claims[0].canonEffect, "none");
  assert.equal(evidence.claims[0].reviewState, "source-only");
  assert.equal(evidence.arcCells[0].reviewState, "unreviewed");
  assert.equal(evidence.checkpoints[0].targetArcField, "startingState");

  const reviewed = contract.exports.reviewCharacterArcEvidence(
    evidence,
    "ren",
    4,
    "meaningful-choice",
    "Human reviewed the visible choice.",
    "2026-09-18T01:00:00.000Z",
  );
  assert.equal(reviewed.arcCells[0].state, "meaningful-choice");
  assert.equal(reviewed.arcCells[0].reviewState, "human-reviewed");
  assert.equal(reviewed.claims[0].reviewState, "source-only");
  assert.equal(reviewed.claims[0].canonEffect, "none");
});

test("#2178 builds six principal character traces across 24 Blocks using existing Arc Matrix field names", async () => {
  const builder = await read("modules/library/reference/afterglow-character-truth.ts");

  for (const id of ["ren", "amy", "isobel", "joy", "kai", "jai"]) {
    assert.match(builder, new RegExp(`${id}: \\\[`), id);
  }
  assert.match(builder, /Array\.from\(\{ length: 24 \}/u);
  assert.match(builder, /state: hasEvidence \? "unresolved-insufficient-evidence" : "not-present-no-evidence"/u);
  assert.match(builder, /Human review must decide/u);
  assert.match(builder, /evidence absence, not automatic proof/u);
  assert.match(builder, /targetArcField: "startingState"/u);
  assert.match(builder, /targetArcField: "midpointShift"/u);
  assert.match(builder, /targetArcField: "crisisChoice"/u);
  assert.match(builder, /targetArcField: "climaxChoice"/u);
  assert.match(builder, /targetArcField: "endingState"/u);
  assert.match(builder, /does not require the character to change here/u);
  assert.match(builder, /does not create a second Character or Arc Matrix authority/u);
});

test("#2178 attaches character evidence to the same PPF and cross-links #2168 structural Blocks", async () => {
  const [evidence, reference, storyMatrix] = await Promise.all([
    read("core/contracts/imported-screenplay-evidence/index.ts"),
    read("modules/library/reference/afterglow-v9-foundations.ts"),
    read("core/contracts/story-evidence-matrix.ts"),
  ]);

  assert.match(evidence, /readonly characterTruth\?: CharacterTruthEvidence \| null/u);
  assert.match(evidence, /normalizeCharacterTruthEvidence\(source\.characterTruth\)/u);
  assert.match(reference, /createAfterglowCharacterTruthEvidence/u);
  assert.match(reference, /storyMatrixWithCharacterEvidence/u);
  assert.match(reference, /characterEvidenceRefs/u);
  assert.match(reference, /character:\$\{cell\.characterId\}:block-/u);
  assert.match(reference, /characterTruth,/u);
  assert.match(storyMatrix, /readonly characterEvidenceRefs: readonly string\[\]/u);
  assert.match(storyMatrix, /characterEvidenceRefs: uniqueStrings/u);
});

test("#2178 Story Cards let Humans review arc evidence while restricted claims stay out of guidance", async () => {
  const [board, css] = await Promise.all([
    read("app/skin-v1/story-card-foundation-board.tsx"),
    read("app/skin-v1/preproduction-review-flow.css"),
  ]);

  assert.match(board, /const characterTruth = normalizedSourceEvidence\.characterTruth/u);
  assert.match(board, /Character arc evidence/u);
  assert.match(board, /Human arc-evidence finding/u);
  assert.match(board, /reviewCharacterArcEvidence/u);
  assert.match(board, /handling === "writer-reference"/u);
  assert.match(board, /restricted historical reference/u);
  assert.match(board, /not surfaced as character guidance/u);
  assert.match(board, /Profile\/backstory may explain motivation, but it is not audience-visible screenplay proof/u);
  assert.match(board, /Character profile source and screenplay text were not changed/u);
  assert.match(css, /pp-skin-v1-story-card-character-review/u);
  assert.match(css, /pp-skin-v1-story-card-character-grid/u);
});
