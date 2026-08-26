import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Story Decision workflow adapter preserves terminal records on replay", async () => {
  const workflow = await readFile(new URL("../modules/story-workflow/story-decisions/workflow.ts", import.meta.url), "utf8");
  assert.match(workflow, /const exact = records\.get\(candidate\.decisionId\)/);
  assert.match(workflow, /"answered", "superseded", "withdrawn", "stale"/);
  assert.match(workflow, /if \(exact && \[.*\]\.includes\(exact\.status\)\) continue/);
  assert.match(workflow, /const previous = exact \?\?/);
});
