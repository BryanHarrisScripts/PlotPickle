import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #193 defines one conversion-first product-positioning contract", async () => {
  const contract = await source("lib/product-direction.ts");
  for (const phrase of [
    "Visual storyworld and AI previsualization engine",
    "See the whole movie before you make it.",
    "portable creative source of truth",
    "Whole Film → Storyworld Map",
    "Graphic Novel + Storyboard → shared rendering",
    "Generated assets → PPF",
    "Animatic → watchable prototype",
    "does not aim to replace Final Draft",
  ]) assert.ok(contract.includes(phrase), `Missing positioning contract: ${phrase}`);
  assert.equal([...contract.matchAll(/statusLabel: "(Available now|Conversion roadmap)"/g)].length, 5);
});

test("issue #193 makes the product loop visible on the existing accessible splash", async () => {
  const [splash, css] = await Promise.all([
    source("app/marketing-splash-base.tsx"),
    source("app/marketing-splash.module.css"),
  ]);
  for (const phrase of [
    "See the whole movie",
    "before you make it.",
    "STORYWORLD_PROTOTYPE_LOOP.map",
    "Available now and conversion roadmap",
    "PlotPickle storyworld-to-prototype product loop",
    "Roadmap cards describe planned conversions",
    "not Final Draft parity or studio finishing",
  ]) assert.ok(splash.includes(phrase), `Splash missing: ${phrase}`);
  assert.match(splash, /data-status=\{step\.status\}/);
  assert.match(splash, /data-status=\{feature\.status\}/);
  assert.match(css, /\[data-status="roadmap"\]/);
  assert.match(splash, /aria-label="Splash page navigation"/);
  assert.match(splash, /aria-label="PlotPickle operating principles"/);
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /@media \(max-width: 780px\)/);
});

test("issue #193 gives each existing visual function one role without adding an engine", async () => {
  const [splash, readme, documentation] = await Promise.all([
    source("app/marketing-splash-base.tsx"),
    source("README.md"),
    source("docs/issue-193-visual-storyworld-positioning.md"),
  ]);
  const combined = `${splash}\n${readme}\n${documentation}`;
  for (const feature of [
    "Whole Film",
    "Graphic Novel",
    "Storyboard",
    "Production Shots",
    "Animatic",
    "Pitch",
    "Reports",
    "Afterglow: Reflections of Sentience",
  ]) assert.ok(combined.includes(feature), `Missing existing function: ${feature}`);
  for (const boundary of [
    "It does not add a workspace, data model, renderer, provider button, asset service or prototype player.",
    "must not create a second story graph, renderer, asset identity system or prototype player",
    "does not currently claim to render a complete movie",
  ]) assert.ok(documentation.includes(boundary), `Missing non-duplication boundary: ${boundary}`);
});

test("issue #193 visibly separates shipped capability from the conversion roadmap", async () => {
  const [readme, about, content] = await Promise.all([
    source("README.md"),
    source("app/about/page.tsx"),
    source("app/about/about-content.ts"),
  ]);
  assert.match(readme, /### Available now/);
  assert.match(readme, /### Conversion roadmap/);
  assert.match(about, /Available now and conversion roadmap/);
  assert.match(about, /STORYWORLD_PROTOTYPE_LOOP\.map/);
  assert.match(content, /Whole Film, Graphic Novel, Storyboard, Production Shots, Animatic, Pitch and Reports are available now/);
  assert.match(content, /reference project for verifying the complete prototype workflow/);
});

test("issue #193 updates metadata and top-level product documentation", async () => {
  const [layout, welcome, readme, brief] = await Promise.all([
    source("app/layout.tsx"),
    source("app/welcome/page.tsx"),
    source("README.md"),
    source("docs/PRODUCT-DEVELOPER-BRIEF-07-26.md"),
  ]);
  for (const text of [layout, welcome, readme, brief]) {
    assert.match(text, /visual storyworld and AI previsualization engine/i);
  }
  assert.match(layout, /See the whole movie before you make it/);
  assert.match(welcome, /From first idea to visual prototype/);
  assert.match(readme, /PPF is the portable creative source of truth/);
  assert.match(brief, /This is a conversion-first roadmap/);
  assert.match(brief, /must not claim that it can render a complete movie/);
});

test("issue #193 regression is registered with a focused command", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-193-visual-storyworld-positioning\.test\.mjs/);
  assert.equal(
    packageJson.scripts["test:visual-storyworld-positioning"],
    "node --test tests/issue-193-visual-storyworld-positioning.test.mjs",
  );
});
