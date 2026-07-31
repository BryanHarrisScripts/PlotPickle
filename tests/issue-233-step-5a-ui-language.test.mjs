import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Step 5A mounts one writer-facing collaboration language adapter", async () => {
  const layout = await source("app/layout.tsx");
  assert.match(layout, /import WriterFacingCollaborationLanguage from "\.\/writer-facing-collaboration-language"/);
  assert.match(layout, /<WriterFacingCollaborationLanguage \/>/);
});

test("Step 5A translates visible Git vocabulary into writer language", async () => {
  const adapter = await source("app/writer-facing-collaboration-language.tsx");
  for (const phrase of [
    "story repository",
    "proposal change workspace",
    "approved story line",
    "Story Proposal",
    "recorded revision",
    "approved into the official story",
    "competing story changes",
    "refresh approved story",
    "publish approved changes",
  ]) assert.match(adapter, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("Step 5A preserves Advanced and machine-facing technical details", async () => {
  const adapter = await source("app/writer-facing-collaboration-language.tsx");
  assert.match(adapter, /closest\("details, code, pre, input, textarea, select/);
  assert.match(adapter, /\[data-technical-language\]/);
  assert.match(adapter, /MutationObserver/);
  assert.doesNotMatch(adapter, /fetch\(|syncEnabled|lastPulledCommit|lastPushedCommit|onChange\(/);
});
