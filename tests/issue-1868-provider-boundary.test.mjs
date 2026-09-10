import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const read = (file) => fs.readFile(path.join(ROOT, file), "utf8");

test("cinematography grammar does not acquire provider authority", async () => {
  const source = await read("lib/cinematography-grammar.ts");
  for (const forbidden of ["OPENAI_API_KEY", "MINIMAX", "OLLAMA_HOST", "providerModel", "selectModel(", "fetch("]) {
    assert.ok(!source.includes(forbidden), `grammar must not contain ${forbidden}`);
  }
});
