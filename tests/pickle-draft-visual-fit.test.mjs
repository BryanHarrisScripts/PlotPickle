import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("the branded first-draft lesson is called Pickle Draft everywhere", async () => {
  const library = await source("app/learning-library.ts");
  const studio = await source("app/learning-studio.tsx");

  assert.match(library, /id: "pickle-draft"/);
  assert.match(library, /title: "The Pickle Draft"/);
  assert.match(library, /The Pickle Draft is an intentionally rough first draft/);
  assert.doesNotMatch(library, /Vomit Draft|vomit draft|vomit-draft/);
  assert.match(studio, /"pickle-draft"/);
  assert.doesNotMatch(studio, /vomit-draft/);
});

test("the Visual Board overview is embedded inside its story-column layout", async () => {
  const host = await source("app/workspace-intro-host.tsx");
  const css = await source("app/workspace-intro.module.css");

  assert.match(host, /visual-studio-layout > :last-child/);
  assert.match(host, /embedded=\{activeLabel === "Visual Board"\}/);
  assert.match(css, /max-width: 100vw/);
  assert.match(css, /overflow-x: clip/);
  assert.match(css, /overflow-wrap: anywhere/);
});
