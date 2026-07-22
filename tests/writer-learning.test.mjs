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
