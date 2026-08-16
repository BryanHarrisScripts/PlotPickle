import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("PLAN keeps editing in the middle and renders a separate read-only lesson answer view on the right", async () => {
  const [page, preview, styles] = await Promise.all([
    read("app/page.tsx"),
    read("modules/plan/ui/plan-lesson-answer-preview.tsx"),
    read("modules/plan/ui/plan-lesson-answer-preview.module.css"),
  ]);

  assert.match(page, /PlanLessonAnswerPreview/);
  assert.match(page, /<FoundationsPlanWorkspace curriculum=\{plotPickleCurriculum\} \/>/);
  assert.match(page, /<PlanLessonAnswerPreview curriculum=\{plotPickleCurriculum\} \/>/);

  assert.match(preview, /createPortal/);
  assert.match(preview, /Read-only Foundations lesson answers/);
  assert.match(preview, /READ-ONLY LESSON VIEW/);
  assert.match(preview, /Create and edit in the middle column/);
  assert.match(preview, /activeLesson\.fields\.map/);
  assert.match(preview, /activeAnswers\[field\.id\]/);
  assert.match(preview, /No answer yet\. Write it or create an AI draft in the middle column\./);
  assert.match(preview, /View only · edits happen in the middle column/);
  assert.doesNotMatch(preview, /<textarea\b|<input\b|<button\b|contentEditable/i);

  assert.match(styles, /data-plan-answer-panel/);
  assert.match(styles, /:not\(\[data-plan-answer-preview="true"\]\)/);
  assert.match(styles, /white-space: pre-wrap/);
});

test("the read-only lesson view refreshes whenever the canonical Foundations project is saved", async () => {
  const [preview, storage] = await Promise.all([
    read("modules/plan/ui/plan-lesson-answer-preview.tsx"),
    read("core/storage/foundation-project-browser.ts"),
  ]);

  assert.match(storage, /FOUNDATION_PROJECT_SAVED_EVENT/);
  assert.match(storage, /window\.dispatchEvent\(new Event\(FOUNDATION_PROJECT_SAVED_EVENT\)\)/);
  assert.match(preview, /window\.addEventListener\(FOUNDATION_PROJECT_SAVED_EVENT, handleSavedProject\)/);
  assert.match(preview, /document\.addEventListener\("click", handleClick\)/);
  assert.match(preview, /new URLSearchParams\(window\.location\.search\)\.get\("lesson"\)/);
});

test("focused PLAN UAT owns the read-only lesson answer regression", async () => {
  const registry = JSON.parse(await read("config/uat-autopilot-registry.json"));
  const plan = registry.areas.find((area) => area.id === "plan");
  assert.ok(plan);
  assert.ok(plan.tests.includes("tests/plan-readonly-lesson-answer-view.test.mjs"));
});
