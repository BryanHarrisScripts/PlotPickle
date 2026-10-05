import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("#2755 Outline shows story information by default and removes redundant launch/action controls", async () => {
  const [storyCards, writtenStory] = await Promise.all([
    read("app/skin-v1/story-card-foundation-board.tsx"),
    read("app/skin-v1/act-written-story-board.tsx"),
  ]);

  assert.doesNotMatch(storyCards, /Assess Act \$\{act\} with Story Architect/u);
  assert.doesNotMatch(storyCards, /Assess this Block with Story Architect|Reassess this Block/u);
  assert.match(storyCards, /<details open className="pp-skin-v1-story-card-structural-review">/u);
  assert.match(storyCards, /<details open className="pp-skin-v1-story-card-character-review">/u);
  assert.match(storyCards, /<details open><summary>Character source policy<\/summary>/u);
  assert.doesNotMatch(storyCards, /pp-skin-v1-story-card-actions/u);
  assert.doesNotMatch(storyCards, />Move earlier<\/button>|>Move later<\/button>|>Lock card<\/button>/u);
  assert.match(writtenStory, /<details open className="pp-skin-v1-written-act-mini"/u);
});

test("#2755 visual-anchor actions are boxed and selection survives project rerenders", async () => {
  const [blockAnchor, miniAnchor, styles] = await Promise.all([
    read("app/skin-v1/outline-block-anchor-workspace.tsx"),
    read("app/skin-v1/outline-mini-block-anchor-workspace.tsx"),
    read("app/skin-v1/outline-mini-block-workspace.module.css"),
  ]);

  for (const source of [blockAnchor, miniAnchor]) {
    assert.match(source, /pendingSelectedId = useRef/u);
    assert.match(source, /versions\.some\(\(version\) => version\.id === pending\)/u);
    assert.match(source, /pendingSelectedId\.current = artifactId/u);
    assert.doesNotMatch(source, /setSelectedId\(artifactId\)/u);
  }

  assert.match(styles, /\.actions button,/u);
  assert.match(styles, /border:\s*1px solid currentColor/u);
  assert.match(styles, /border-radius:\s*6px/u);
});
