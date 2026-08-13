import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("LEARN uses the detailed eleven-lesson Foundations path without restoring PLAN", async () => {
  const [catalog, deep, page] = await Promise.all([
    read("adapters/curriculum/current-catalog.ts"),
    read("adapters/curriculum/foundation-deep-learning.ts"),
    read("app/page.tsx"),
  ]);

  assert.match(catalog, /buildDeepFoundationCurriculum/);
  assert.match(catalog, /lesson\.number !== index \+ 1/);
  assert.match(deep, /A screenplay is a system, not a pile of categories/);
  assert.match(deep, /A development logline must carry the middle/);
  assert.match(deep, /Theme becomes dramatic when credible answers collide/);
  assert.match(deep, /Apply this to your story/);
  assert.match(deep, /storyOutputs/);
  assert.doesNotMatch(deep, /\bPLAN\b|planOutput/);
  assert.doesNotMatch(page, /FoundationsPlanWorkspace|workspace=plan/);
});
