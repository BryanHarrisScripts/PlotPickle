import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #343 keeps the public landing keyboard reachable", async () => {
  const splash = await source("app/marketing-splash.tsx");
  assert.match(splash, /href="#plotpickle-main">Skip to main content<\/a>/);
  assert.match(splash, /patch\.id = "plotpickle-main"/);
  assert.match(splash, /patch\.tabIndex = -1/);
  assert.match(splash, /Mobile splash page navigation/);
  assert.match(splash, /MOBILE_SPLASH_LINKS\.map/);
  assert.match(splash, /className=\{auditStyles\.mobileEnter\}/);
});

test("issue #343 gives labelled containers and new-tab links valid accessible semantics", async () => {
  const splash = await source("app/marketing-splash.tsx");
  assert.match(splash, /node\.type === "div" && typeof props\["aria-label"\] === "string"/);
  assert.match(splash, /patch\.role = "group"/);
  assert.match(splash, /node\.type === "a" && props\.target === "_blank"/);
  assert.match(splash, /\(opens in a new tab\)/);
});

test("issue #343 protects mobile targets, sticky anchors and reduced motion", async () => {
  const css = await source("app/marketing-splash-audit.module.css");
  assert.match(css, /@media \(max-width: 780px\)/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /scroll-margin-top: 112px/);
  assert.match(css, /scroll-margin-top: 152px/);
  assert.match(css, /a\[target="_blank"\]::after/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("issue #343 preserves the current product story and truth boundaries", async () => {
  const base = await source("app/marketing-splash-base.tsx");
  for (const phrase of [
    "Stop losing the story",
    "Learn the craft inside the story you are building.",
    "Start privately. Add people only when the story needs them.",
    "not every computer can run every model",
    "nothing becomes canonical until a person approves it",
  ]) assert.ok(base.includes(phrase), `Marketing audit removed required product truth: ${phrase}`);
});

test("issue #408 makes the splash the visual-storytelling design foundation", async () => {
  const [base, css, design, reference] = await Promise.all([
    source("app/marketing-splash-base.tsx"),
    source("app/marketing-splash.module.css"),
    source("docs/design/VISUAL-STORYTELLING-SPLASH.md"),
    source("docs/design/plotpickle-splash-direction-reference.svg"),
  ]);

  for (const phrase of [
    "Storytelling<br />Has Changed.",
    "Write the narrative. Shape the vision.",
    "The writer is no longer only writing the story",
    "they are directing the storyworld.",
    "Narrative First",
    "World & Character Vision",
    "Storyboard Thinking",
    "Human-Led Creative Direction",
    "From Concept to Visual Canon",
  ]) assert.ok(base.includes(phrase), `New splash narrative missing: ${phrase}`);

  for (const asset of [
    "/design/plotpickle-splash-character.svg",
    "/design/plotpickle-splash-world.svg",
    "/design/plotpickle-splash-storyboard.svg",
  ]) assert.ok(base.includes(asset), `New splash visual missing: ${asset}`);

  for (const token of ["#090909", "#ece7dc", "#b98745", "#d3a15d", "Courier New"]) {
    assert.ok(css.includes(token), `New splash visual token missing: ${token}`);
  }

  assert.match(css, /\.heroVisual/);
  assert.match(css, /\.scriptPanel/);
  assert.match(css, /\.characterPanel/);
  assert.match(css, /\.worldPanel/);
  assert.match(css, /\.storyboardPanel/);
  assert.match(design, /Traditional storytelling has changed/);
  assert.match(design, /Concept -> Explore -> Compare -> Direct -> Refine -> Approve -> Reuse/);
  assert.match(reference, /PlotPickle approved splash direction/);
});
