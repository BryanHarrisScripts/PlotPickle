import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("phase 2 step 5 defines writer-facing collaboration terms without renaming technical contracts", async () => {
  const [language, copyText] = await Promise.all([
    source("lib/collaboration-language.ts"),
    source("config/collaboration-copy.json"),
  ]);
  const terms = JSON.stringify(JSON.parse(copyText).terms);
  for (const phrase of [
    "story repository",
    "approved story line",
    "Story Proposal",
    "recorded revision",
    "approve into the official story",
    "refresh approved story",
    "publish approved changes",
    "the approved story changed",
    "competing story changes",
  ]) assert.match(terms, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  for (const technical of [
    "GitHub repository",
    "Git branch",
    "GitHub pull request",
    "Git commit",
    "pull from GitHub",
    "push to GitHub",
    "remote divergence",
    "merge conflict",
  ]) assert.match(terms, new RegExp(technical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  assert.match(language, /collaborationCopy\.terms/);
});

test("phase 2 step 5 keeps technical vocabulary secondary to the primary writer-facing copy", async () => {
  const copy = JSON.parse(await source("config/collaboration-copy.json"));
  assert.deepEqual(copy.terms.repository, {
    primary: "story repository",
    shared: "shared story project",
    technical: "GitHub repository",
  });
  assert.equal(copy.terms.pullRequest.primary, "Story Proposal");
  assert.equal(copy.terms.pullRequest.technical, "GitHub pull request");
  assert.equal(copy.terms.commit.primary, "recorded revision");
  assert.equal(copy.terms.commit.technical, "Git commit");
  assert.equal(copy.terms.conflict.primary, "competing story changes");
  assert.equal(copy.terms.conflict.technical, "merge conflict");
});

test("phase 2 step 5 is presentation-only and does not contain provider operations", async () => {
  const language = await source("lib/collaboration-language.ts");
  assert.doesNotMatch(language, /fetch\(|onChange\(|syncEnabled|lastPulledCommit|lastPushedCommit|projectPath|repositoryUrl/);
  assert.match(language, /export function collaborationTerm/);
});
