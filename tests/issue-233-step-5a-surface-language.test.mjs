import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

async function readCopy() {
  return JSON.parse(await source("config/collaboration-copy.json"));
}

test("step 5A defines one JSON copy contract for every collaboration surface", async () => {
  const copy = await readCopy();

  assert.equal(copy.version, 1);
  for (const surface of ["dashboard", "settings", "proposals", "synchronization", "recovery", "advanced"]) {
    assert.ok(copy.surfaces[surface], `Missing collaboration copy surface: ${surface}`);
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
    assert.match(JSON.stringify(copy.surfaces), new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("step 5A centralizes Settings labels, titles and subtitles", async () => {
  const copy = await readCopy();
  assert.equal(copy.settings.repository.key, "settings.repository");
  assert.equal(copy.settings.repository.label, "Repository & Collab");
  assert.match(copy.settings.repository.title, /story history and proposals/i);
  assert.match(copy.settings.repository.subtitle, /Story Proposals and Project Lead decisions/);
});

test("step 5A keeps exact Git terms in the JSON advanced contract", async () => {
  const copy = await readCopy();
  assert.equal(copy.surfaces.advanced.repository, copy.terms.repository.technical);
  assert.equal(copy.surfaces.advanced.pullRequest, copy.terms.pullRequest.technical);
  assert.equal(copy.surfaces.advanced.commit, copy.terms.commit.technical);
  assert.equal(copy.surfaces.advanced.conflict, copy.terms.conflict.technical);
});

test("step 5A copy remains presentation-only", async () => {
  const copy = JSON.stringify(await readCopy());
  assert.doesNotMatch(copy, /fetch\(|onChange\(|syncEnabled|lastPulledCommit|lastPushedCommit|repositoryUrl|projectPath/);
});
