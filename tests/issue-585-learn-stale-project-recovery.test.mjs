import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the project normalizer restores every nested object LEARN and PLAN dereference", async () => {
  const project = await read("core/project/project.ts");

  assert.match(project, /normalizeFoundationProject/);
  assert.match(project, /project: Partial<PPFProject> \| null \| undefined/);
  assert.match(project, /learning:\s*\{/);
  assert.match(project, /creativeRoom:\s*\{/);
  assert.match(project, /foundations: normalizeFoundations/);
  assert.match(project, /completedLessonIds/);
  assert.match(project, /threadId/);
  assert.match(project, /recoveredId/);
});

test("the composition root repairs stale local storage before mounting LEARN or PLAN", async () => {
  const page = await read("app/page.tsx");

  assert.match(page, /repairPersistedProject/);
  assert.match(page, /normalizeFoundationProject/);
  assert.match(page, /const validLessonIds = new Set/);
  assert.match(page, /completedLessonIds\.filter/);
  assert.match(page, /validLessonIds\.has/);
  assert.match(page, /localStorage\.setItem\(PROJECT_KEY, JSON\.stringify\(repaired\)\)/);
  assert.match(page, /localStorage\.removeItem\(PROJECT_KEY\)/);
  assert.match(page, /storageReady/);
  assert.match(page, /if \(!storageReady\)/);
});

test("removed lesson ids are discarded while LEARN still falls back to its first lesson", async () => {
  const [page, workspace] = await Promise.all([
    read("app/page.tsx"),
    read("modules/learn/ui/learn-workspace.tsx"),
  ]);

  assert.match(page, /activeLessonId: normalized\.learning\.activeLessonId && validLessonIds\.has\(normalized\.learning\.activeLessonId\)/);
  assert.match(page, /\? normalized\.learning\.activeLessonId\s*:\s*null/);
  assert.match(workspace, /curriculum\.find\(\(lesson\) => lesson\.id === project\?\.learning\.activeLessonId\) \?\? curriculum\[0\]/);
});
