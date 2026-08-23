import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const doc = await readFile(new URL("../docs/acceptance/local-uat-engine.md", import.meta.url), "utf8");

test("local UAT documentation makes cloud independence and optional Codex explicit", () => {
  assert.match(doc, /defaults to the local engine/i);
  assert.match(doc, /does not require Codex or ChatGPT usage quota/i);
  assert.match(doc, /-Engine codex/);
  assert.match(doc, /PLOTPICKLE_UAT_OLLAMA_MODEL/);
  assert.match(doc, /advisory/);
});
