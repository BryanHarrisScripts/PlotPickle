import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("phase 2 step 5 defines writer-facing collaboration terms without renaming technical contracts", async () => {
  const language = await source("lib/collaboration-language.ts");
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
  ]) assert.match(language, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  for (const technical of [
    "GitHub repository",
    "Git branch",
    "GitHub pull request",
    "Git commit",
    "pull from GitHub",
    "push to GitHub",
    "remote divergence",
    "merge conflict",
  ]) assert.match(language, new RegExp(technical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("phase 2 step 5 keeps technical vocabulary secondary to the primary writer-facing copy", async () => {
  const language = await source("lib/collaboration-language.ts");
  assert.match(language, /primary: "story repository"[\s\S]*technical: "GitHub repository"/);
  assert.match(language, /primary: "Story Proposal"[\s\S]*technical: "GitHub pull request"/);
  assert.match(language, /primary: "recorded revision"[\s\S]*technical: "Git commit"/);
  assert.match(language, /primary: "competing story changes"[\s\S]*technical: "merge conflict"/);
});

test("phase 2 step 5 is presentation-only and does not contain provider operations", async () => {
  const language = await source("lib/collaboration-language.ts");
  assert.doesNotMatch(language, /fetch\(|onChange\(|syncEnabled|lastPulledCommit|lastPushedCommit|projectPath|repositoryUrl/);
  assert.match(language, /export function collaborationTerm/);
});
