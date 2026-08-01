import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #193 defines the completed visual storyworld product contract", async () => {
  const contract = await source("lib/product-direction.ts");
  for (const phrase of [
    "Visual storyworld collaboration and previsualization engine",
    "See the whole movie before you make it.",
    "portable creative source of truth",
    "Interactive Storyworld Map",
    "Graphic Novel + Storyboard",
    "Production Shots + Animatic",
    "Pitch + Reports",
    "Collab + Buzz",
    "does not require them",
  ]) assert.ok(contract.includes(phrase), `Missing completed product contract: ${phrase}`);
  assert.equal([...contract.matchAll(/statusLabel: "Available now"/g)].length, 5);
  assert.match(contract, /statusLabel: "Optional connections"/);
  assert.doesNotMatch(contract, /statusLabel: "Conversion roadmap"/);
});

test("issue #193 makes the completed core visible on the accessible product-authentic Splash", async () => {
  const [splash, css] = await Promise.all([
    source("app/marketing-splash-base.tsx"),
    source("app/marketing-splash.module.css"),
  ]);
  for (const phrase of [
    "Stop losing the story",
    "between the notes, drafts and visuals.",
    "Product-authentic PlotPickle Dashboard preview",
    "One living story graph",
    "Self-learning",
    "Story graph",
    "Portable PPF",
    "Visual writing",
    "Visual pitch",
    "Community feedback",
    "PPF is the creative source of truth",
  ]) assert.ok(splash.includes(phrase), `Splash missing: ${phrase}`);
  assert.match(splash, /data-status="available"/);
  assert.match(splash, /aria-label="Splash page navigation"/);
  assert.match(splash, /aria-label="PlotPickle operating principles"/);
  assert.match(splash, /aria-label="Product-authentic PlotPickle Dashboard preview"/);
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /@media \(max-width: 780px\)/);
});

test("issue #193 gives every existing visual function one role without adding an engine", async () => {
  const [splash, readme, documentation] = await Promise.all([
    source("app/marketing-splash-base.tsx"),
    source("README.md"),
    source("docs/issue-193-visual-storyworld-positioning.md"),
  ]);
  const combined = `${splash}\n${readme}\n${documentation}`;
  for (const feature of [
    "Storyworld Map",
    "Graphic Novel",
    "Storyboard",
    "Production Shots",
    "Animatic",
    "Pitch",
    "Reports",
    "Afterglow: Reflections of Sentience",
  ]) assert.ok(combined.includes(feature), `Missing existing function: ${feature}`);
  for (const boundary of [
    "without creating a second project model",
    "extends the existing Whole Film wall rather than replacing it with a second engine",
    "does not currently claim to render a complete movie",
  ]) assert.ok(documentation.includes(boundary), `Missing non-duplication boundary: ${boundary}`);
});

test("issue #193 records closed renderer phases and current optional connections", async () => {
  const [readme, about, documentation, splash] = await Promise.all([
    source("README.md"),
    source("app/about/page.tsx"),
    source("docs/issue-193-visual-storyworld-positioning.md"),
    source("app/marketing-splash-base.tsx"),
  ]);
  assert.match(readme, /## The visual storyworld core/);
  assert.match(about, /Complete visual storyworld core/);
  assert.match(about, /STORYWORLD_CORE_LOOP\.map/);
  assert.match(documentation, /Issues #196, #199, #198, #197 and #200 were closed as not planned/);
  for (const label of ["Story & Art", "Repository & Collab", "Scheduling & Meetings", "Media & Film Engines", "Buzz"]) {
    assert.ok(`${readme}\n${documentation}\n${splash}`.includes(label), `Missing optional connection: ${label}`);
  }
  assert.match(splash, /Buzz is dormant by default/);
  assert.match(splash, /Native bundled Buzz binaries are not advertised as shipped/);
});

test("issue #193 updates metadata and top-level product documentation", async () => {
  const [layout, welcome, readme, brief] = await Promise.all([
    source("app/layout.tsx"),
    source("app/welcome/page.tsx"),
    source("README.md"),
    source("docs/PRODUCT-DEVELOPER-BRIEF-07-26.md"),
  ]);
  for (const text of [layout, welcome, brief]) {
    assert.match(text, /visual storyworld collaboration and previsualization engine/i);
  }
  assert.match(readme, /local-first, self-learning visual writing and pitch studio/i);
  assert.match(layout, /See the whole movie before you make it/);
  assert.match(welcome, /From first idea to a visible storyworld/);
  assert.match(readme, /PPF is the portable creative source of truth/);
  assert.match(readme, /Buzz: optional and dormant by default/);
  assert.match(brief, /Completed visual storyworld core/);
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
