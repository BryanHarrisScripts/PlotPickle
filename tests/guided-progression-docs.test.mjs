import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("guided creation documentation preserves the Foundations-only implementation boundary", async () => {
  const doc = await read("docs/guided-creation-progression.md");
  assert.match(doc, /LEARN → PLAN → BUILD → next curriculum group/);
  assert.match(doc, /Foundations is the only implemented vertical slice/);
  assert.match(doc, /Complete all 11 Foundations LEARN lessons/);
  assert.match(doc, /Generation alone is not approval/);
  assert.match(doc, /World LEARN\/PLAN\/BUILD workspaces remain deliberately gated/);
  assert.match(doc, /Dashboard must not create a second progress store/);
  assert.match(doc, /Storyboard and Previs are later production stages/);
});
