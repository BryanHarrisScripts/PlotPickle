import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Foundations promotes all seven embedded references into standalone lessons", async () => {
  const [catalog, promoted, deep] = await Promise.all([
    read("adapters/curriculum/current-catalog.ts"),
    read("adapters/curriculum/foundation-reference-lessons.ts"),
    read("adapters/curriculum/foundation-deep-learning.ts"),
  ]);

  for (const sourceId of [
    "24-blocks-general-general-the-pitch-md",
    "24-blocks-general-readme-md",
    "24-blocks-loglines-loglines-md",
    "24-blocks-essentials-essential-aspects-1-md",
    "24-blocks-essentials-essential-aspects-2-md",
    "24-blocks-essentials-readme-md",
    "24-blocks-essentials-storytelling-dynamics-md",
  ]) {
    assert.match(promoted, new RegExp(sourceId));
  }

  assert.match(catalog, /buildDeepFoundationCurriculum/);
  assert.match(deep, /buildFoundationCurriculum/);
  assert.match(catalog, /standaloneFoundations\.length !== 11/);
  assert.match(catalog, /standaloneFoundations\.some\(\(lesson\) => lesson\.sources\.length !== 0\)/);
  assert.match(catalog, /standalonePlotPickleCurriculum\.length !== 88/);
  assert.match(promoted, /sources: \[\]/);
  assert.match(deep, /eleven-lesson learning path/);
});

test("promoted source material is parsed into headings, paragraphs, points, and lesson scaffolding", async () => {
  const promoted = await read("adapters/curriculum/foundation-reference-lessons.ts");

  assert.match(promoted, /sourceContentToSections/);
  assert.match(promoted, /markdownHeading/);
  assert.match(promoted, /emphasizedHeading/);
  assert.match(promoted, /listItem/);
  assert.match(promoted, /line\.includes\("\|"\)/);
  assert.match(promoted, /objectives: plan\.objectives/);
  assert.match(promoted, /example: plan\.example/);
  assert.match(promoted, /checklist: plan\.checklist/);
  assert.match(promoted, /mistakes: plan\.mistakes/);
  assert.match(promoted, /exercise: plan\.exercise/);
});

test("LEARN lessons use readable card formatting instead of uninterrupted text walls", async () => {
  const [layout, styles] = await Promise.all([
    read("app/layout.tsx"),
    read("app/learn-lesson-formatting.css"),
  ]);

  assert.match(layout, /learn-lesson-formatting\.css/);
  assert.match(styles, /article\[aria-label="Active lesson"\] > section/);
  assert.match(styles, /max-width: 70ch/);
  assert.match(styles, /font-family: ui-sans-serif/);
  assert.match(styles, /display: grid/);
  assert.match(styles, /content: "◆"/);
  assert.match(styles, /section:last-of-type:not\(:has\(details\)\)/);
});
