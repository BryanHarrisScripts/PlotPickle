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

test("#1918 Phase 5 wires all six Paths and all 24 Craft Modules", async () => {
  const route = await read("app/api/learn/journey-preview/route.ts");
  assert.match(route, /phase: "phase-5-all-paths"/u);
  assert.match(route, /status: "wired"/u);
  assert.match(route, /contentAvailable: true/u);
  assert.match(route, /semesterOneLessonContentExposed: true/u);
  assert.match(route, /laterSemesterLessonContentExposed: true/u);
  assert.match(route, /allPathLessonContentExposed: true/u);

  assert.equal(LEARN_PROGRAM_MAP.courses.length, 24);
  assert.deepEqual(LEARN_PROGRAM_MAP.semesters.map((semester) => semester.courseIds.length), [4, 4, 4, 4, 4, 4]);
});

test("#1918 Phase 5 all-Paths API projects canonical archive lessons without a second curriculum store", async () => {
  const route = await read("app/api/learn/journey-courses/route.ts");
  for (const canonicalImport of [
    "foundations.json",
    "theme.json",
    "character.json",
    "world.json",
    "structure.json",
    "dialogue.json",
    "visual-storytelling.json",
    "drafting.json",
    "revision.json",
    "responsible-ai.json",
    "collaboration.json",
    "industry.json",
  ]) {
    assert.ok(route.includes(canonicalImport), `Phase 5 route must import canonical ${canonicalImport}.`);
  }
  assert.match(route, /LEARN_PROGRAM_COURSE_SPECS/u);
  assert.match(route, /course\.lessonRefs\.flatMap/u);
  assert.match(route, /lessons\[position - 1\]/u);
  assert.match(route, /courses\.length !== 24/u);
  assert.match(route, /curriculumOwner: "existing LEARN archive"/u);
  assert.match(route, /progressOwner: "PPFProject\.learning\.completedLessonIds"/u);
  assert.match(route, /curriculumBodiesDuplicated: false/u);
  assert.doesNotMatch(route, /lessonBodies|copiedCurriculum|journeyCurriculum/u);
});

test("#1918 Phase 5 retains the Phase 4 Path 01 compatibility projection", async () => {
  const route = await read("app/api/learn/journey-semester-one/route.ts");
  assert.match(route, /phase: "phase-4-semester-one"/u);
  assert.match(route, /\.filter\(\(course\) => course\.semester === 1\)/u);
  assert.match(route, /courses\.length !== 4/u);
  assert.match(route, /curriculumOwner: "existing LEARN archive"/u);
});

test("#1918 Phase 5 reuses PPF lesson history as the only Journey progress authority", async () => {
  const ui = await read("app/skin-v1/learn-journey-preview.tsx");
  assert.match(ui, /loadFoundationProject/u);
  assert.match(ui, /saveFoundationProject/u);
  assert.match(ui, /applyStoryCommand/u);
  assert.match(ui, /project\?\.learning\.completedLessonIds/u);
  assert.match(ui, /type: isCompleted \? "lesson\.uncomplete" : "lesson\.complete"/u);
  assert.match(ui, /data-learn-progress-owner="PPFProject\.learning\.completedLessonIds"/u);
  assert.doesNotMatch(ui, /localStorage\.setItem\([^\n]*(?:journey|course-progress)/iu);
});

test("#1918 Phase 5 progress remains order-independent across distant Paths", () => {
  const courseOne = LEARN_PROGRAM_MAP.courses.find((course) => course.id === "course-01");
  const courseTwentyFour = LEARN_PROGRAM_MAP.courses.find((course) => course.id === "course-24");
  assert.ok(courseOne);
  assert.ok(courseTwentyFour);

  const completedOutOfOrder = [...courseTwentyFour.lessonIds];
  assert.deepEqual(progress(courseTwentyFour, completedOutOfOrder), {
    completedCount: courseTwentyFour.lessonIds.length,
    lessonCount: courseTwentyFour.lessonIds.length,
    complete: true,
  });
  assert.deepEqual(progress(courseOne, completedOutOfOrder), {
    completedCount: 0,
    lessonCount: courseOne.lessonIds.length,
    complete: false,
  });
});

test("#1918 Phase 5 keeps every Path and Craft Module selectable without prerequisite gates", async () => {
  const ui = await read("app/skin-v1/learn-journey-preview.tsx");
  assert.match(ui, /IS AVAILABLE\. OPEN ANY CRAFT MODULE IN ANY ORDER/u);
  assert.match(ui, /COMPLETION ORDER IS YOUR CHOICE/u);
  assert.match(ui, /data-learn-course-status="wired"/u);
  assert.match(ui, /data-learn-course-content="available"/u);
  assert.match(ui, /data-skin-menu-connected="true"/u);
  assert.doesNotMatch(ui, /prerequisite.*disabled|disabled.*prerequisite/iu);
  assert.doesNotMatch(ui, /aria-disabled/iu);
});

test("#1918 Phase 5 preserves the Phase 0-2 curriculum integrity validators", async () => {
  for (const validator of [
    "scripts/validate-learn-journey-baseline.mjs",
    "scripts/validate-learn-program-map.mjs",
    "scripts/validate-learn-curriculum-integrity.mjs",
  ]) {
    const { stderr } = await execFileAsync(process.execPath, [validator], { cwd: process.cwd() });
    assert.equal(stderr, "", `${validator} wrote unexpected stderr.`);
  }
});

test("#1918 Phase 5 remains registered in the seven-layer verification mesh", async () => {
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
  assert.ok(apiOwner.include.includes("app/api/learn/journey-courses/route.ts"));
});

test("#1918 Phase 5 canonical development convergence reports CONVERGED against the real diff", async (t) => {
  const baseRef = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "main";
  const changedFiles = changedFilesFromGit({ root: process.cwd(), baseRef });
  if (!changedFiles.includes("config/development-convergence/1918.json")) {
    t.skip("#1918 Phase 5 issue-specific convergence only applies when its convergence manifest is part of the current diff.");
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
