import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #88 exposes real visual production destinations", async () => {
  const board = await source("app/visual-storyboard.tsx");
  for (const label of [
    "Visual overview",
    "Characters & identity locks",
    "Locations & world",
    "Props, vehicles & wardrobe",
    "Colour, lighting & visual language",
    "24-block storyboard",
    "96 mini-block frames",
    "Posters, pitch & production",
    "Continuity & missing assets",
  ]) assert.match(board, new RegExp(label.replace(/[&]/g, "&")));
  assert.match(board, /project\.production\.breakdowns/);
  assert.match(board, /project\.review\.pitchPackage\.visualStatement/);
  assert.match(board, /characterVisualIdentityDiagnostic/);
});

test("issue #88 navigation scrolls, tracks active sections and preserves deep links", async () => {
  const board = await source("app/visual-storyboard.tsx");
  assert.match(board, /IntersectionObserver/);
  assert.match(board, /scrollIntoView/);
  assert.match(board, /visualSection/);
  assert.match(board, /searchParams\.set\("block"/);
  assert.match(board, /searchParams\.set\("mini"/);
  assert.match(board, /aria-current/);
  assert.match(board, /tabIndex=\{-1\}/);
});

test("issue #88 keeps the visual navigator sticky, responsive and keyboard visible", async () => {
  const css = await source("app/visual-storyboard.module.css");
  assert.match(css, /\.visualNav\{position:sticky/);
  assert.match(css, /max-height:calc\(100vh - 154px\)/);
  assert.match(css, /\.visualNav button:focus-visible/);
  assert.match(css, /\.visualLayout\{display:grid/);
  assert.match(css, /@media\(max-width:920px\)/);
});

test("issue #88 storyboard controls remain functional", async () => {
  const board = await source("app/visual-storyboard.tsx");
  const directorActions = await source("app/creative-director-actions.tsx");
  assert.match(board, /onClick=\{\(\) => openSection\("blocks"\)\}/);
  assert.match(board, /onClick=\{\(\) => openSection\("frames"\)\}/);
  assert.match(board, /onClick=\{\(\) => choose\(item\.number/);
  assert.match(board, /onOpenPlannerBlock\(block\.number\)/);
  assert.match(directorActions, /onClick=\{onIllustrate\}/);
  assert.match(directorActions, /Create or try another image for this exact story moment/);
});
