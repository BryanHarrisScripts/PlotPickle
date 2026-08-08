import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#452 exposes a direct Write handoff only for an exact selected Storyboard moment", async () => {
  const handoff = await source("app/storyboard-write-handoff.tsx");

  assert.match(handoff, /workspace"\) !== "storyboard"/);
  assert.match(handoff, /visualSection"\) !== "frames"/);
  assert.match(handoff, /decision"\) === "review"/);
  assert.match(handoff, /queryNumber\(params, "block", 1, 24\)/);
  assert.match(handoff, /queryNumber\(params, "mini", 1, 4\)/);
  assert.match(handoff, /Write this moment/);
  assert.match(handoff, /Same canonical mini-block and owning scene/);
});

test("#452 hands the selected canonical Block and mini-block directly to Write", async () => {
  const handoff = await source("app/storyboard-write-handoff.tsx");

  assert.match(handoff, /`\/\?workspace=write&block=\$\{moment\.block\}&mini=\$\{moment\.mini\}`/);
  assert.doesNotMatch(handoff, /setProject|onChange|fetch\(|localStorage|sessionStorage|provider|apiKey/i);
});

test("#452 Write already receives the same Block and mini-block without creating parallel state", async () => {
  const receiver = await source("app/plan-studio-rail-host.tsx");

  assert.match(receiver, /function applyRequestedWriteMoment\(\)/);
  assert.match(receiver, /params\.get\("workspace"\) !== "write"/);
  assert.match(receiver, /queryNumber\("block", 1, 24\)/);
  assert.match(receiver, /queryNumber\("mini", 1, 4\)/);
  assert.match(receiver, /nav\[aria-label="Screenplay blocks"\] button/);
  assert.match(receiver, /const miniPrefix = `\$\{block\}\.\$\{mini\}`/);
  assert.match(receiver, /miniButton\.click\(\)/);
});

test("#452 mounts the Storyboard Write handoff globally but activates it only from Storyboard frames", async () => {
  const layout = await source("app/layout.tsx");

  assert.match(layout, /import StoryboardWriteHandoff/);
  assert.match(layout, /<StoryboardWriteHandoff \/>/);
  assert.match(layout, /storyboard-write-handoff\.css/);
});

test("#452 Write handoff remains compact, keyboard visible and mobile safe", async () => {
  const styles = await source("app/storyboard-write-handoff.css");

  assert.match(styles, /position:\s*fixed/);
  assert.match(styles, /#cda758/i);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media \(max-width:\s*720px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)/);
});
