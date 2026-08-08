import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#473 mounts Graphic Novel as a Studio continuity layer without replacing its working engine", async () => {
  const [layout, host, workspace] = await Promise.all([
    source("app/layout.tsx"),
    source("app/graphic-novel-studio-host.tsx"),
    source("app/ai-pitch-deck-workspace.tsx"),
  ]);

  assert.match(layout, /import GraphicNovelStudioHost/);
  assert.match(layout, /<GraphicNovelStudioHost \/>/);
  assert.match(layout, /graphic-novel-studio\.css/);
  assert.match(host, /section\[aria-labelledby="graphic-novel-title"\]/);
  assert.match(workspace, /<GraphicNovelViewer/);
  assert.match(workspace, /<AiPitchDeckWorkspaceBase/);
  assert.match(workspace, /exportGraphicNovel/);
});

test("#473 carries canonical Act Block mini-block and owning scene identity into Graphic Novel", async () => {
  const host = await source("app/graphic-novel-studio-host.tsx");

  assert.match(host, /const STORAGE_KEY = "plotpickle\.project\.v1"/);
  assert.match(host, /normalizePlotPickleProject\(JSON\.parse\(stored\)\)/);
  assert.match(host, /requestedNumber\("block", 1, 1, 24\)/);
  assert.match(host, /requestedNumber\("mini", 1, 1, 4\)/);
  assert.match(host, /buildGlobalSceneIndex\(project\.blocks\)/);
  assert.match(host, /entry\.blockNumber === blockNumber && entry\.miniBlockNumbers\.includes\(miniBlockNumber\)/);
  assert.match(host, /Act \$\{block\?\.act/);
  assert.match(host, /Block \$\{blockNumber\}/);
  assert.match(host, /Mini \$\{blockNumber\}\.\$\{miniBlockNumber\}/);
  assert.match(host, /Scene \$\{sceneEntry\?\.globalNumber/);
});

test("#473 exposes the full 4 Act 24 Block 96 mini-block structure without creating shadow canon", async () => {
  const host = await source("app/graphic-novel-studio-host.tsx");

  assert.match(host, /for \(let act = 1; act <= 4; act \+= 1\)/);
  assert.match(host, /const first = \(act - 1\) \* 6 \+ 1/);
  assert.match(host, /for \(let number = 1; number <= 4; number \+= 1\)/);
  assert.match(host, /project\.screenplay\.draftElements\.filter/);
  assert.match(host, /block\?\.visuals\.filter/);
  assert.doesNotMatch(host, /setProject|onProjectChange|createRevisionSnapshot|reconcileProductionDraft|fetch\(|provider|apiKey|Ollama|ComfyUI|MiniMax/i);
});

test("#473 preserves source-module return paths for the exact selected moment", async () => {
  const host = await source("app/graphic-novel-studio-host.tsx");

  assert.match(host, /Back to Edit \$\{blockNumber\}\.\$\{miniBlockNumber\}/);
  assert.match(host, /`\/edit\?block=\$\{blockNumber\}&mini=\$\{miniBlockNumber\}`/);
  assert.match(host, /Open approved visual source/);
  assert.match(host, /workspace=storyboard&block=\$\{blockNumber\}&mini=\$\{miniBlockNumber\}/);
});

test("#473 follows the reviewed matte-black warm-gold PlotPickle Studio visual contract", async () => {
  const styles = await source("app/graphic-novel-studio.css");

  assert.match(styles, /#090909/i);
  assert.match(styles, /#cda758/i);
  assert.match(styles, /Georgia/);
  assert.match(styles, /graphic-novel-studio-context/);
  assert.match(styles, /graphic-novel-act-rail/);
  assert.match(styles, /graphic-novel-mini-rail/);
  assert.match(styles, /@media\(max-width:820px\)/);
  assert.doesNotMatch(styles, /purple|violet|#7c3aed|#8b5cf6/i);
});
