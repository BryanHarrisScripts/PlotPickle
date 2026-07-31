import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("step 5A defines one writer-facing copy contract for every collaboration surface", async () => {
  const copy = await source("lib/collaboration-surface-language.ts");

  for (const surface of ["dashboard", "settings", "proposals", "synchronization", "recovery", "advanced"]) {
    assert.match(copy, new RegExp(`\\b${surface}: \\{`));
  }

  for (const phrase of [
    "Local story project",
    "Shared story project",
    "Story repository connection",
    "Story Proposals",
    "Approve into official story",
    "Shared story synchronization",
    "Get official story updates",
    "Story recovery",
    "Competing story changes",
  ]) {
    assert.match(copy, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("step 5A keeps exact Git terms inside advanced details only", async () => {
  const copy = await source("lib/collaboration-surface-language.ts");
  assert.match(copy, /advanced: \{[\s\S]*COLLABORATION_LANGUAGE\.repository\.technical/);
  assert.match(copy, /COLLABORATION_LANGUAGE\.pullRequest\.technical/);
  assert.match(copy, /COLLABORATION_LANGUAGE\.commit\.technical/);
  assert.match(copy, /COLLABORATION_LANGUAGE\.conflict\.technical/);
});

test("step 5A copy remains presentation-only", async () => {
  const copy = await source("lib/collaboration-surface-language.ts");
  assert.doesNotMatch(copy, /fetch\(|onChange\(|syncEnabled|lastPulledCommit|lastPushedCommit|repositoryUrl|projectPath/);
});
