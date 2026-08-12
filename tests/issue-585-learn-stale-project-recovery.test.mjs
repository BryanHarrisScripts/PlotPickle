import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("LEARN repairs stale persisted projects before reading nested state", async () => {
  const [project, workspace] = await Promise.all([
    read("core/project/project.ts"),
    read("modules/learn/ui/learn-workspace.tsx"),
  ]);

  assert.match(project, /normalizeFoundationProject/);
  assert.match(project, /learning:\s*\{/);
  assert.match(project, /creativeRoom:\s*\{/);
  assert.match(project, /completedLessonIds/);
  assert.match(project, /threadId/);
  assert.match(workspace, /normalizeFoundationProject/);
  assert.match(workspace, /const validLessonIds = new Set/);
  assert.match(workspace, /completedLessonIds\.filter/);
  assert.match(workspace, /validLessonIds\.has/);
  assert.match(workspace, /localStorage\.setItem\(PROJECT_KEY, JSON\.stringify\(current\)\)/);
});

test("LEARN never trusts a removed active lesson id from local storage", async () => {
  const workspace = await read("modules/learn/ui/learn-workspace.tsx");

  assert.match(workspace, /activeLessonId:\s*normalized\.learning\.activeLessonId\s*&&\s*validLessonIds\.has/);
  assert.match(workspace, /\? normalized\.learning\.activeLessonId\s*:\s*null/);
  assert.match(workspace, /curriculum\.find\(\(lesson\) => lesson\.id === project\?\.learning\.activeLessonId\) \?\? curriculum\[0\]/);
});
