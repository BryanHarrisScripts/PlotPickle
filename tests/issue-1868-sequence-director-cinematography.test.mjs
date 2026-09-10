import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const read = (file) => fs.readFile(path.join(ROOT, file), "utf8");

test("Sequence Director consumes the cinematography grammar without provider authority", async () => {
  const [director, compiler, skill] = await Promise.all([
    read("lib/sequence-director.ts"),
    read("lib/sequence-director-cinematography.ts"),
    read(".agents/skills/sequence-director/SKILL.md"),
  ]);

  assert.match(director, /compileSequenceCinematography/u);
  assert.match(director, /compileBeatCinematography/u);
  assert.match(director, /=== CINEMATOGRAPHY GRAMMAR ===/u);
  assert.match(compiler, /selectCinematographyPrimitives/u);
  assert.match(compiler, /medium: "video", limit: 4/u);
  assert.doesNotMatch(compiler, /provider|model|api key|runtime/iu);
  assert.match(skill, /cannot:[\s\S]*choose or change providers, models, runtimes, API keys/u);
});
