import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("logline lab supports six purposes and seven transparent sentence shapes", async () => {
  const lab = await source("lib/logline-lab.ts");
  for (const purpose of ["development", "submission", "pitch-deck", "public-teaser", "collaborator-brief", "custom"]) {
    assert.ok(lab.includes(`id: "${purpose}"`), `Missing purpose: ${purpose}`);
  }
  for (const shape of ["causal-engine", "irony-contradiction", "relationship-pressure", "world-rule-pressure", "mystery-thriller", "dual-ensemble", "character-first"]) {
    assert.ok(lab.includes(`id: "${shape}"`), `Missing shape: ${shape}`);
  }
  assert.match(lab, /buildLoglineAlternatives/);
  assert.match(lab, /addedAssumptions/);
  assert.doesNotMatch(lab, /in a story distinguished by/);
});

test("candidate metadata is optional and backward compatible", async () => {
  const lab = await source("lib/logline-lab.ts");
  for (const field of ["purpose?", "intendedAudience?", "shape?", "ingredients?", "rationale?", "linkedProjectEvidence?", "deliberateOmissions?", "wordCount?", "writerNotes?", "reviewStatus?", "updatedAt?", "sourceType?", "importedEvidence?", "uncertainInterpretations?"]) {
    assert.ok(lab.includes(field), `Missing optional candidate metadata: ${field}`);
  }
  assert.match(lab, /PurposeAwareLoglineCandidate = LoglineCandidate & LoglineCandidateMetadata/);
});

test("evidence model separates sentence support from project-only and intentional omission", async () => {
  const lab = await source("lib/logline-lab.ts");
  for (const state of ["sentence-supported", "review", "intentional-omission", "project-only"]) {
    assert.ok(lab.includes(`"${state}"`), `Missing evidence state: ${state}`);
  }
  for (const group of ["Core dramatic engine", "Promise and distinction", "Clarity and delivery"]) {
    assert.ok(lab.includes(`"${group}"`), `Missing evidence group: ${group}`);
  }
  assert.match(lab, /Core engine visible/);
  assert.match(lab, /Promise developing/);
  assert.match(lab, /Review the missing evidence/);
  assert.doesNotMatch(lab, /Exceptional|Pitch-ready|Needs rebuilding/);
});

test("approval is selective and preserves revision history", async () => {
  const lab = await source("lib/logline-lab.ts");
  for (const target of ["primary", "oneSentencePitch", "pitchPackage", "purposeVariant", "createRevisionSnapshot"]) {
    assert.ok(lab.includes(`${target}: boolean`), `Missing approval target: ${target}`);
  }
  assert.match(lab, /if \(targets\.primary\) next\.story\.logline = candidate\.text/);
  assert.match(lab, /if \(targets\.oneSentencePitch\) next\.development\.pitch\.oneSentence = candidate\.text/);
  assert.match(lab, /if \(targets\.pitchPackage\)/);
  assert.match(lab, /previousPrimary/);
  assert.match(lab, /next\.revisions\.push/);
});

test("imported screenplay loglines remain suggestions with evidence and uncertainty", async () => {
  const lab = await source("lib/logline-lab.ts");
  assert.match(lab, /createImportedLoglineSuggestion/);
  assert.match(lab, /sourceType: "imported-suggestion"/);
  assert.match(lab, /reviewStatus: "draft"/);
  assert.match(lab, /importedEvidence: evidence/);
  assert.match(lab, /uncertainInterpretations/);
});

test("focused learning deep dive extends The Pitch without creating a broad curriculum", async () => {
  const learning = await source("app/learning-loglines-that-carry-the-movie.ts");
  assert.match(learning, /title: "Loglines That Carry the Movie"/);
  assert.match(learning, /development logline/i);
  assert.match(learning, /pitch-deck logline/i);
  assert.match(learning, /public teaser/i);
  assert.match(learning, /collaborator brief/i);
  assert.match(learning, /One Afterglow project, three useful versions/);
  for (const alias of ["The Art of Crafting Loglines", "20-step logline guide", "perfect logline", "logline deconstruction", "avoid character names", "irony", "active voice"]) {
    assert.ok(learning.includes(alias), `Missing legacy alias: ${alias}`);
  }
});

test("manual local-only and no-AI operation remain complete", async () => {
  const lab = await source("lib/logline-lab.ts");
  const learning = await source("app/learning-loglines-that-carry-the-movie.ts");
  assert.match(lab, /buildLoglineAlternative/);
  assert.match(lab, /sourceType: metadata\.sourceType \|\| "manual"/);
  assert.match(learning, /no-AI creation stays complete/);
  assert.match(learning, /Imported screenplay suggestions and optional AI proposals remain labelled proposals/);
});
