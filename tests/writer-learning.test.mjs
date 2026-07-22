import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Writer connects Treatment, Screenplay and Read & Learn to the same story position", async () => {
  const workspace = await source("app/script-workspace.tsx");
  for (const phrase of ["TreatmentEditor", "LearningStudio", 'type ViewMode = "treatment" | "screenplay" | "learn"', "Treatment", "Screenplay", "Read & learn", "onProjectChange"]) {
    assert.ok(workspace.includes(phrase), `Writer is missing ${phrase}`);
  }
});

test("Markdown treatment supports local writing, preview, export, AI approval and screenplay handoff", async () => {
  const treatment = await source("app/treatment-editor.tsx");
  for (const phrase of ["Markdown Treatment", "MarkdownPreview", "Export section", "Export complete treatment", "Clean up with AI", "Approve revision", "Send to screenplay as action", "mini.notes"]) {
    assert.ok(treatment.includes(phrase), `Treatment editor is missing ${phrase}`);
  }
  assert.match(treatment, /\/api\/local-ai\/generate\/text/);
  assert.match(treatment, /AI is optional and changes nothing until you approve it/);
});

test("Learning Studio connects contextual guidance to the complete course", async () => {
  const learning = await source("app/learning-studio.tsx");
  for (const phrase of ["Current story position", "Search screenwriting lessons", "Recommended here", "Apply it to Block", "Screenplay anatomy", "Complete Learning Library", "Fourteen full learning modules", "Read full module"] ) {
    assert.ok(learning.includes(phrase), `Learning Studio is missing ${phrase}`);
  }
});

test("Learning Library contains all 14 source modules with substantial teaching tools", async () => {
  const library = await source("app/learning-library.ts");
  assert.equal((library.match(/number: \d+,/g) ?? []).length, 14);
  for (const phrase of ["The Pitch", "Tropes and Genres", "Story Structures: Screenplays to Improv", "The Writing Process", "Concept to Final Draft", "World-Building", "Story Bible: Character", "The Story Bible", "The Vomit Draft", "Script Formatting", "Books, Screenplays and Deliberate Study", "Screenplay Challenges Guide", "The Film Industry", "Responsible AI-Assisted Writing"]) {
    assert.ok(library.includes(phrase), `Learning Library is missing ${phrase}`);
  }
  for (const teachingTool of ["objectives:", "sections:", "definitions:", "example:", "checklist:", "mistakes:", "exercise:", "apply:"]) {
    assert.equal((library.match(new RegExp(`^    ${teachingTool}`, "gm")) ?? []).length, 14, `Every module needs ${teachingTool}`);
  }
});

test("Learning progress is per project and survives a browser restart", async () => {
  const learning = await source("app/learning-studio.tsx");
  assert.match(learning, /plotpickle-learning-progress:\$\{project\.id\}/);
  assert.match(learning, /window\.localStorage\.getItem/);
  assert.match(learning, /window\.localStorage\.setItem/);
  assert.match(learning, /modules complete/);
});

test("Learning Studio preserves the educational and user-work licence boundary", async () => {
  const learning = await source("app/learning-studio.tsx");
  assert.match(learning, /Educational guidance: CC BY-SA 4\.0/);
  assert.match(learning, /Your original story and screenplay remain yours/);
});

test("Afterglow populates the Markdown Treatment and carries it into storyboard prompts", async () => {
  const afterglow = await source("data/afterglow.ts");
  const storyboard = await source("app/visual-storyboard.tsx");
  const page = await source("app/page.tsx");
  for (const phrase of ["populateAfterglowBlock", "Known Afterglow summary already included in PlotPickle", "Source reconciliation required", "Treatment task", "miniBlocks", "notes:"]) {
    assert.ok(afterglow.includes(phrase), `Afterglow treatment loading is missing ${phrase}`);
  }
  assert.match(storyboard, /Treatment evidence for this exact mini-block/);
  assert.match(storyboard, /mini\.notes\.slice\(0, 1800\)/);
  assert.match(page, /all 96 Treatment positions/);
  assert.match(page, /Unreconciled material is clearly marked/);
});
