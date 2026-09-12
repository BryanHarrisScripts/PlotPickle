import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";
import { LEARN_PROGRAM_MAP } from "../learn/program-map.mjs";
import { changedFilesFromGit, runDevelopmentConvergence } from "../scripts/run-development-convergence.mjs";

const execFileAsync = promisify(execFile);
const read = (path) => readFile(path, "utf8");

function progress(course, completedLessonIds) {
  const completed = new Set(completedLessonIds);
  const completedCount = course.lessonIds.filter((lessonId) => completed.has(lessonId)).length;
  return {
    completedCount,
    lessonCount: course.lessonIds.length,
    complete: completedCount === course.lessonIds.length,
  };
}

test("#1918 Phase 4 wires exactly Semester 1 and leaves Semesters 2-6 preview-only internally", async () => {
  const route = await read("app/api/learn/journey-preview/route.ts");
  assert.match(route, /phase: "phase-4-semester-one"/u);
  assert.match(route, /const contentAvailable = semester\.semester === 1/u);
  assert.match(route, /status: contentAvailable \? "wired" : "preview-only"/u);
  assert.match(route, /semesterOneLessonContentExposed: true/u);
  assert.match(route, /laterSemesterLessonContentExposed: false/u);

  const semesterOne = LEARN_PROGRAM_MAP.courses.filter((course) => course.semester === 1);
  assert.deepEqual(semesterOne.map((course) => course.id), ["course-01", "course-02", "course-03", "course-04"]);
  assert.equal(LEARN_PROGRAM_MAP.courses.filter((course) => course.semester > 1).length, 20);
});

test("#1918 Phase 4 Path 01 API projects canonical archive lessons without a second curriculum store", async () => {
  const route = await read("app/api/learn/journey-semester-one/route.ts");
  for (const canonicalImport of ["foundations.json", "theme.json", "character.json", "world.json"]) {
    assert.ok(route.includes(canonicalImport), `Path 01 route must import canonical ${canonicalImport}.`);
  }
  assert.match(route, /LEARN_PROGRAM_COURSE_SPECS/u);
  assert.match(route, /course\.lessonRefs\.flatMap/u);
  assert.match(route, /lessons\[position - 1\]/u);
  assert.match(route, /curriculumOwner: "existing LEARN archive"/u);
  assert.match(route, /curriculumBodiesDuplicated: false/u);
  assert.doesNotMatch(route, /lessonBodies|copiedCurriculum|journeyCurriculum/u);
});

test("#1918 Phase 4 reuses PPF lesson history as the only Journey progress authority", async () => {
  const ui = await read("app/skin-v1/learn-journey-preview.tsx");
  assert.match(ui, /loadFoundationProject/u);
  assert.match(ui, /saveFoundationProject/u);
  assert.match(ui, /applyStoryCommand/u);
  assert.match(ui, /project\?\.learning\.completedLessonIds/u);
  assert.match(ui, /type: isCompleted \? "lesson\.uncomplete" : "lesson\.complete"/u);
  assert.match(ui, /data-learn-progress-owner="PPFProject\.learning\.completedLessonIds"/u);
  assert.doesNotMatch(ui, /localStorage\.setItem\([^\n]*(?:journey|course-progress)/iu);
});

test("#1918 Phase 4 Craft Module progress is order-independent", () => {
  const courseOne = LEARN_PROGRAM_MAP.courses.find((course) => course.id === "course-01");
  const courseFour = LEARN_PROGRAM_MAP.courses.find((course) => course.id === "course-04");
  assert.ok(courseOne);
  assert.ok(courseFour);

  const completedOutOfOrder = [...courseFour.lessonIds];
  assert.deepEqual(progress(courseFour, completedOutOfOrder), {
    completedCount: courseFour.lessonIds.length,
    lessonCount: courseFour.lessonIds.length,
    complete: true,
  });
  assert.deepEqual(progress(courseOne, completedOutOfOrder), {
    completedCount: 0,
    lessonCount: courseOne.lessonIds.length,
    complete: false,
  });
});

test("#1918 Phase 4 keeps every Path 01 Craft Module and lesson selectable without prerequisite gates", async () => {
  const ui = await read("app/skin-v1/learn-journey-preview.tsx");
  assert.match(ui, /OPEN ANY CRAFT MODULE IN ANY ORDER/u);
  assert.match(ui, /COMPLETION ORDER IS YOUR CHOICE/u);
  assert.match(ui, /data-learn-course-content=\{course\.contentAvailable \? "available" : "unavailable"\}/u);
  assert.match(ui, /data-skin-menu-connected=\{course\.contentAvailable \? "true" : "false"\}/u);
  assert.doesNotMatch(ui, /prerequisite.*disabled|disabled.*prerequisite/iu);
  assert.doesNotMatch(ui, /aria-disabled/iu);
});

test("#1918 Phase 4 preserves the Phase 0-2 curriculum integrity validators", async () => {
  for (const validator of [
    "scripts/validate-learn-journey-baseline.mjs",
    "scripts/validate-learn-program-map.mjs",
    "scripts/validate-learn-curriculum-integrity.mjs",
  ]) {
    const { stderr } = await execFileAsync(process.execPath, [validator], { cwd: process.cwd() });
    assert.equal(stderr, "", `${validator} wrote unexpected stderr.`);
  }
});

test("#1918 Phase 4 is registered in the seven-layer verification mesh", async () => {
  const [catalogSource, ownershipSource] = await Promise.all([
    read("config/verification/test-catalog.json"),
    read("config/verification/ownership-map.json"),
  ]);
  const catalog = JSON.parse(catalogSource);
  const ownership = JSON.parse(ownershipSource);
  const entry = catalog.entries.find((candidate) => candidate.id === "experience.learn-semester-one");
  assert.ok(entry);
  assert.equal(entry.ownerLayer, "experience-skins");
  assert.deepEqual(entry.runner.targets, ["tests/issue-1918-learn-semester-one.test.mjs"]);

  const apiOwner = ownership.rules.find((rule) => rule.id === "learn-journey-preview-api");
  assert.ok(apiOwner);
  assert.ok(apiOwner.include.includes("app/api/learn/journey-semester-one/route.ts"));
});

test("#1918 Phase 4 canonical development convergence reports CONVERGED against the real diff", async (t) => {
  const baseRef = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "main";
  const changedFiles = changedFilesFromGit({ root: process.cwd(), baseRef });
  if (!changedFiles.includes("config/development-convergence/1918.json")) {
    t.skip("#1918 Phase 4 issue-specific convergence only applies when its convergence manifest is part of the current diff.");
    return;
  }

  const result = await runDevelopmentConvergence([
    "--manifest",
    "config/development-convergence/1918.json",
    "--base-ref",
    baseRef,
    "--report-dir",
    ".artifacts/development-convergence",
  ]);

  assert.equal(result.exitCode, 0);
  assert.equal(result.reports.length, 1);
  assert.equal(result.reports[0].issue, 1918);
  assert.equal(result.reports[0].status, "CONVERGED");
  assert.deepEqual(result.reports[0].remaining, []);
});
