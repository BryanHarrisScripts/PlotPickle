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

test("Learning Studio is searchable, contextual and covers the repository teaching paths", async () => {
  const learning = await source("app/learning-studio.tsx");
  for (const phrase of ["Current story position", "Search screenwriting lessons", "Recommended here", "Apply it to Block", "Concept", "Character", "Structure", "Scenes", "Dialogue", "Revision", "Markdown"] ) {
    assert.ok(learning.includes(phrase), `Learning Studio is missing ${phrase}`);
  }
});

test("Learning Studio preserves the educational and user-work licence boundary", async () => {
  const learning = await source("app/learning-studio.tsx");
  assert.match(learning, /Educational guidance: CC BY-SA 4\.0/);
  assert.match(learning, /Your original story and screenplay remain yours/);
});

test("Afterglow populates the Markdown Treatment and carries it into storyboard prompts", async () => {
  const afterglow = await source("data/afterglow.ts");
  const treatment = await source("data/afterglow-treatment.ts");
  const storyboard = await source("app/visual-storyboard.tsx");
  const page = await source("app/page.tsx");
  for (const phrase of ["afterglowTreatmentSections", "populateAfterglowBlock", "Source-based working treatment", "Source reconciliation required", "miniBlocks", "notes:"]) {
    assert.ok(afterglow.includes(phrase), `Afterglow treatment loading is missing ${phrase}`);
  }
  assert.match(treatment, /PUPPETS AND PUPPETEERS PART 1/);
  assert.match(treatment, /GUIDING STARS/);
  assert.match(treatment, /Block 24\.4/);
  assert.match(storyboard, /Treatment evidence for this exact mini-block/);
  assert.match(storyboard, /mini\.notes\.slice\(0, 1800\)/);
  assert.match(page, /84 source-based Treatment movements, 12 reconciliation slots/);
});
