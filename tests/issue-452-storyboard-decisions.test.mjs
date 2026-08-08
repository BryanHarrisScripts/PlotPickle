import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#452 makes Keep, Change, Try Again and Compare the primary Storyboard decisions", async () => {
  const actions = await source("app/creative-director-actions.tsx");

  for (const label of [">Keep<", ">Change<", ">Try Again<", ">Compare<"]) {
    assert.ok(actions.includes(label), `Missing Storyboard decision ${label}`);
  }

  assert.match(actions, /keepCurrent/);
  assert.match(actions, /changeDirection/);
  assert.match(actions, /tryAgain/);
  assert.match(actions, /compareVersions/);
  assert.match(actions, /onIllustrate\(\)/);
  assert.match(actions, /onAnimate/);
});

test("#452 keeps alternatives unapproved until the writer explicitly chooses one", async () => {
  const actions = await source("app/creative-director-actions.tsx");

  assert.match(actions, /alternatives remain unapproved until you choose one/i);
  assert.match(actions, /Nothing becomes approved until you explicitly choose it/i);
  assert.doesNotMatch(actions, /auto.?approve|automatically approve|silent fallback/i);
});

test("#452 keeps technical routing outside the four directing decisions", async () => {
  const actions = await source("app/creative-director-actions.tsx");

  assert.match(actions, /Open Settings/);
  assert.doesNotMatch(actions, /Ollama|ComfyUI|MiniMax|checkpoint|endpoint|apiKey/i);
  assert.match(actions, /Change direction \/ Advanced/);
  assert.match(actions, /Animate approved visual/);
});

test("#452 styles the four decisions as a compact 2x2 directing grid", async () => {
  const styles = await source("app/creative-director-actions.module.css");

  assert.match(styles, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.motionAction/);
  assert.match(styles, /\.versions/);
  assert.match(styles, /scroll-margin-top/);
});
