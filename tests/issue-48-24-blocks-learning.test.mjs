import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const concepts = [
  "A New Spin",
  "Structure Guide",
  "Structure’s Role",
  "Story Beats",
  "Principle of Three",
  "Dramatic Question",
  "Structure Diversity",
  "Reflection",
  "Blocks with AI",
  "Dynamic Scenes",
];

test("The 24 Blocks Method exposes all ten original source concepts", async () => {
  const lessons = await source("app/learning-24-blocks.ts");
  assert.equal((lessons.match(/^    sourceConcept:/gm) ?? []).length, 10);
  for (const concept of concepts) assert.ok(lessons.includes(concept), `Missing source concept: ${concept}`);
  for (const phrase of ["The 24 Blocks Method", "sourceNote", "howPlotPickleApplies", "visual:", "workspaceLink", "twentyFourBlocksSourceMap", "searchTerms"]) {
    assert.ok(lessons.includes(phrase), `Missing learning metadata: ${phrase}`);
  }
});

test("Principle of Three preserves the original triad and identifies Pressure as PlotPickle's extension", async () => {
  const lessons = await source("app/learning-24-blocks.ts");
  for (const phrase of [
    "Promise–Progress–Payoff foundation",
    "PlotPickle adds Pressure",
    "It extends the original method; it does not replace or obscure it",
    "Promise, Progress, Pressure, Payoff",
  ]) assert.ok(lessons.includes(phrase), `Missing Principle of Three distinction: ${phrase}`);
});

test("Dramatic questions and structure diversity are taught at the required resolution", async () => {
  const lessons = await source("app/learning-24-blocks.ts");
  for (const phrase of ["Story:", "Act:", "Sequence:", "Block:", "Scene:", "planning resolution", "Nonlinear", "Parallel", "Episodic", "Circular"]) {
    assert.ok(lessons.includes(phrase), `Missing structural teaching: ${phrase}`);
  }
});

test("Every method lesson includes application, example, visual, mistakes and active-project exercise", async () => {
  const lessons = await source("app/learning-24-blocks.ts");
  for (const field of ["example:", "mistakes:", "exercise:", "apply:", "howPlotPickleApplies:", "visual:"]) {
    assert.equal((lessons.match(new RegExp(`^    ${field}`, "gm")) ?? []).length, 10, `Every lesson needs ${field}`);
  }
});

test("Read & Learn integrates the method collection, search and contextual recommendations", async () => {
  const studio = await source("app/learning-studio.tsx");
  for (const phrase of [
    "twentyFourBlocksLessons",
    "twentyFourBlocksSearchText",
    "The 24 Blocks Method",
    "Source concept:",
    "How PlotPickle applies this",
    "Active-project exercise",
    "24b-principle-three",
    "24b-dynamic-scenes",
    "Open {module.apply}",
  ]) assert.ok(studio.includes(phrase), `Learning Studio integration is missing ${phrase}`);
});
