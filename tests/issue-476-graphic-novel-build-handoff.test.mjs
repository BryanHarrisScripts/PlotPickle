import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#476 mounts the Graphic Novel to Build continuity bridge in the existing Studio shell", async () => {
  const [layout, handoff, build] = await Promise.all([
    source("app/layout.tsx"),
    source("app/graphic-novel-build-handoff.tsx"),
    source("app/build-workspace.tsx"),
  ]);

  assert.match(layout, /import GraphicNovelBuildHandoff/);
  assert.match(layout, /<GraphicNovelBuildHandoff \/>/);
  assert.match(layout, /graphic-novel-build-handoff\.css/);
  assert.match(handoff, /aside\[aria-label="Build sections"\]/);
  assert.match(build, /One canonical 24-Block and 96-mini-block structure/);
});

test("#476 carries the exact Graphic Novel block and mini-block into Build", async () => {
  const handoff = await source("app/graphic-novel-build-handoff.tsx");

  assert.match(handoff, /workspace=build&block=\$\{block\}&mini=\$\{mini\}&from=graphic-novel/);
  assert.match(handoff, /requestedNumber\("block", 1, 1, 24\)/);
  assert.match(handoff, /requestedNumber\("mini", 1, 1, 4\)/);
  assert.match(handoff, /buildGlobalSceneIndex\(project\.blocks\)/);
  assert.match(handoff, /entry\.blockNumber === blockNumber && entry\.miniBlockNumbers\.includes\(miniBlockNumber\)/);
  assert.match(handoff, /Act \$\{block\?\.act/);
  assert.match(handoff, /Block \$\{blockNumber\}/);
  assert.match(handoff, /Mini \$\{blockNumber\}\.\$\{miniBlockNumber\}/);
  assert.match(handoff, /Scene \$\{sceneEntry\?\.globalNumber/);
});

test("#476 references approved source material without creating shadow story state", async () => {
  const handoff = await source("app/graphic-novel-build-handoff.tsx");

  assert.match(handoff, /project\.screenplay\.draftElements\.filter/);
  assert.match(handoff, /project\.review\.pitchPackage\.comicDeck\?\.panels\.filter/);
  assert.match(handoff, /asset\?\.approvedVariationId === panel\.assetRef\.variationId/);
  assert.match(handoff, /frame\.approvedImageVersionId/);
  assert.match(handoff, /Canonical project only/);
  assert.doesNotMatch(handoff, /fetch\(|apiKey|Ollama|ComfyUI|MiniMax|provider/i);
});

test("#476 preserves the exact return path to Graphic Novel and screenplay source", async () => {
  const handoff = await source("app/graphic-novel-build-handoff.tsx");

  assert.match(handoff, /Back to Graphic Novel \$\{blockNumber\}\.\$\{miniBlockNumber\}/);
  assert.match(handoff, /workspace=pitch&block=\$\{blockNumber\}&mini=\$\{miniBlockNumber\}/);
  assert.match(handoff, /Open screenplay source/);
  assert.match(handoff, /`\/edit\?block=\$\{blockNumber\}&mini=\$\{miniBlockNumber\}`/);
});

test("#476 keeps Build in the reviewed matte-black and restrained warm-gold design system", async () => {
  const styles = await source("app/graphic-novel-build-handoff.css");

  assert.match(styles, /#090909/i);
  assert.match(styles, /#cda758/i);
  assert.match(styles, /Georgia/);
  assert.match(styles, /build-studio-context/);
  assert.match(styles, /@media\(max-width:820px\)/);
  assert.doesNotMatch(styles, /purple|violet|#7c3aed|#8b5cf6/i);
});
