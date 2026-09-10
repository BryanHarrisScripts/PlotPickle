import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const read = (file) => fs.readFile(path.join(ROOT, file), "utf8");

test("cinematography grammar remains original, structured and provider independent", async () => {
  const [contract, grammar, docs] = await Promise.all([
    read("core/contracts/cinematography/index.ts"),
    read("lib/cinematography-grammar.ts"),
    read("docs/issues/1868-cinematography-grammar.md"),
  ]);

  for (const category of [
    "framing", "camera-angle", "camera-movement", "lens", "composition", "lighting",
    "colour-texture", "edit-transition", "narrative-device", "vfx-physical", "sound-atmosphere", "continuity",
  ]) assert.match(contract, new RegExp(`\\| \\\"${category}\\\"|= \\\"${category}\\\"`, "u"));

  for (const field of ["intents", "observableEffect", "aliases", "applicability", "compatibleWith", "conflictsWith"]) {
    assert.match(contract, new RegExp(`readonly ${field}`, "u"));
  }

  assert.match(grammar, /selectCinematographyPrimitives/u);
  assert.match(grammar, /compileCinematographySelection/u);
  assert.match(grammar, /conflictsWith\.includes/u);
  assert.match(grammar, /primitive\.applicability === "both" \|\| primitive\.applicability === medium/u);
  assert.doesNotMatch(grammar, /midjourney|runway|veo|grok|cinematique|vvsvs/iu);
  assert.match(docs, /Prompt prose, naming schemes, branding and proprietary databases are not copied/u);
  assert.match(docs, /Story intent -> deterministic grammar selection -> Sequence Director brief/u);
});

test("grammar contains bounded original examples for isolation, intimacy, reveal and continuity", async () => {
  const grammar = await read("lib/cinematography-grammar.ts");
  for (const id of [
    "framing.subject-small-in-world",
    "framing.face-dominant",
    "camera-movement.slow-reveal",
    "composition.negative-space",
    "continuity.carry-motion",
  ]) assert.ok(grammar.includes(`id: "${id}"`));
  assert.match(grammar, /Math\.min\(options\.limit \?\? 5, 8\)/u);
  assert.match(grammar, /if \(!conflicts\) selected\.push/u);
});
