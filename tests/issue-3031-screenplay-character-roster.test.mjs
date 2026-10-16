import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { discoverScreenplayCastCandidates } from "../modules/learn/model/screenplay-character-cues.mjs";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const cue = (id, type, text, sceneNumber = 1) => Object.freeze({ id, type, text, sceneNumber });
const fake = (passages, characterTruth = null) => ({
  sourceEvidence: { screenplay: { sourceFileName: "synthetic.fountain", importedAt: "2026-10-16T12:00:00Z", passages }, characterTruth },
  worldMap: { version: 1, characterVisuals: [] },
});
const characterTruth = Object.freeze({
  schemaVersion: 1, fixtureId: "synthetic",
  principalCharacterIds: ["character:athan"], sources: [], arcCells: [], checkpoints: [],
  claims: [{ id: "human-identity-character:athan", characterIds: ["character:athan"], kind: "identity",
    summary: "Athan", sourceId: "fixture", sourceRef: "synthetic-passage", sourceVersion: "synthetic",
    reviewState: "human-approved", handling: "writer-reference", canonEffect: "none", note: "", targetArcField: null }],
  governingRule: "Human choice only",
});

test("#3031 exact typed screenplay cues auto-populate cast without character-name entry", () => {
  const rows = discoverScreenplayCastCandidates([
    cue("p1", "character", "ATHAN"),
    cue("p2", "dialogue", "AMBROSE runs away"),
    cue("p3", "Character", "ATHAN (V.O.)", 2),
    cue("p4", "character", "AMBROSE (CONT'D)", 2),
    cue("p5", "character", "Ambrose", 3),
    cue("p6", "action", "MOTHER", 3),
    cue("p7", "character", "CUT TO", 3),
  ], new Map());
  assert.deepEqual(rows.map(row => ({name:row.name,count:row.occurrenceCount,scenes:row.sceneNumbers,ids:row.passageIds})),[
    {name:"ATHAN",count:2,scenes:[1,2],ids:["p1","p3"]},
    {name:"AMBROSE",count:2,scenes:[2,3],ids:["p4","p5"]},
  ]);
  assert.ok(rows.every(row => row.canonicalCharacterId === null));
});

test("#3031 existing canonical IDs remain the same and source candidate does not mutate source", () => {
  const passages = Object.freeze([cue("first","character","ATHAN"),cue("second","character","MOTHER")]);
  const project = fake(passages, characterTruth);
  const snapshot = JSON.stringify(project);
  const cast = discoverScreenplayCastCandidates(project.sourceEvidence.screenplay.passages, new Map([["athan", "character:athan"]]));
  assert.equal(cast[0].canonicalCharacterId, "character:athan");
  assert.equal(cast[1].canonicalCharacterId, null);
  assert.equal(JSON.stringify(project), snapshot);
});

test("#3031 UI shows discovered candidates but requires explicit Human acceptance before canon and image generation", async () => {
  const [ui, helper] = await Promise.all([
    read("app/skin-v1/assets-characters.tsx"),
    read("modules/learn/model/screenplay-character-roster.ts"),
  ]);
  for (const token of [
    "screenplayCastCandidates(project)", "data-screenplay-cast-candidate", "toReview.length",
    "Review & Add to Character Truth", "createCanonicalCharacterTruth(",
    "sourceRef", "await durableSave(project, next", "claim.reviewState === \"human-approved\"",
    "setCharacterId(created.characterId)", "setCandidate(null)", "validateProject(project.id, project.revision)",
  ]) assert.ok(ui.includes(token), `Missing source-to-PPF review gate: ${token}`);
  assert.match(helper, /discoverScreenplayCastCandidates\(screenplay\.passages, canonicalIds\)/u);
  assert.match(helper, /mindMapCharacterRoster\(project\)/u);
  const pure = await read("modules/learn/model/screenplay-character-cues.mjs");
  assert.match(pure, /passage\.type\.trim\(\)\.toLowerCase\(\) !== "character"/u);
  assert.doesNotMatch(ui, /window\.confirm\([^)]*API|localStorage\.setItem/u);
});

test("#3031 imported screenplay source IDs/scene references are visible without over-promoting a composite image", async () => {
  const [ui, css, poster] = await Promise.all([
    read("app/skin-v1/assets-characters.tsx"), read("app/skin-v1/assets-characters.module.css"),
    read("app/skin-v1/assets-workspace.tsx"),
  ]);
  assert.match(ui, /pendingReview\.passageIds\[0\]/u);
  assert.match(ui, /pendingReview\.sceneNumbers\[0\]/u);
  assert.match(ui, /The PPF Character Truth roster is at its supported limit/u);
  assert.match(css, /\.discoveries\{/u);
  assert.match(ui, /worldMapCharacterVisualVersions/u);
  assert.match(poster, /lockedMarketingReference/u);
});
