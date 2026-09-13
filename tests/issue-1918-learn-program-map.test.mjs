import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { LEARN_PROGRAM_ARCHIVE_LESSONS, LEARN_PROGRAM_MAP } from "../learn/program-map.mjs";
import { changedFilesFromGit, runDevelopmentConvergence } from "../scripts/run-development-convergence.mjs";
import "./issue-1976-phase-d-integration.test.mjs";

const execFileAsync = promisify(execFile);

test("#1918 Phase 1 defines exactly 24 stable courses in six four-course semesters", () => {
  assert.equal(LEARN_PROGRAM_MAP.courseCount, 24);
  assert.equal(LEARN_PROGRAM_MAP.courses.length, 24);
  assert.equal(LEARN_PROGRAM_MAP.semesters.length, 6);
  assert.deepEqual(
    LEARN_PROGRAM_MAP.courses.map((course) => course.id),
    Array.from({ length: 24 }, (_, index) => `course-${String(index + 1).padStart(2, "0")}`),
  );
  for (const semester of LEARN_PROGRAM_MAP.semesters) assert.equal(semester.courseIds.length, 4);
});

test("#1918 Phase 1 maps every canonical archive lesson exactly once without duplicating curriculum bodies", () => {
  const canonicalIds = LEARN_PROGRAM_ARCHIVE_LESSONS.map((lesson) => lesson.id);
  const mappedIds = LEARN_PROGRAM_MAP.courses.flatMap((course) => course.lessonIds);

  assert.equal(canonicalIds.length, 81);
  assert.equal(mappedIds.length, 81);
  assert.equal(new Set(mappedIds).size, 81);
  assert.deepEqual([...mappedIds].sort(), [...canonicalIds].sort());
  assert.equal(LEARN_PROGRAM_MAP.authority.mapRole, "index-and-orchestration-only");
  assert.equal(LEARN_PROGRAM_MAP.authority.curriculumBodiesDuplicated, false);
});

test("#1918 Phase 1 remains guided-not-gated and keeps Industry primarily late", () => {
  assert.equal(LEARN_PROGRAM_MAP.authority.recommendedSequenceIsAccessControl, false);
  assert.equal(LEARN_PROGRAM_MAP.authority.humanMayLearnOutOfOrder, true);
  assert.ok(LEARN_PROGRAM_MAP.courses.every((course) => course.access === "open"));
  assert.ok(LEARN_PROGRAM_MAP.courses.every((course) => course.prerequisiteMode === "advisory-only"));

  const industryCourses = LEARN_PROGRAM_MAP.courses.filter((course) => course.lessonRefs.some((ref) => ref.topic === "industry"));
  assert.deepEqual(industryCourses.map((course) => course.id), ["course-23", "course-24"]);
  assert.ok(industryCourses.every((course) => course.semester === 6));
});

test("#1918 Phase 1 deterministic validator passes against the repository", async () => {
  const { stdout, stderr } = await execFileAsync(process.execPath, ["scripts/validate-learn-program-map.mjs"], {
    cwd: process.cwd(),
    windowsHide: true,
  });

  assert.equal(stderr, "");
  assert.match(stdout, /24 courses, 6 semesters, 4 courses per semester, all 81 archive lessons mapped exactly once/u);
});

test("#1918 Phase 1 canonical development convergence reports CONVERGED against the real diff", async (t) => {
  const baseRef = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "main";
  const changedFiles = changedFilesFromGit({ root: process.cwd(), baseRef });
  if (!changedFiles.includes("config/development-convergence/1918.json")) {
    t.skip("#1918 issue-specific convergence only applies when its convergence manifest is part of the current diff.");
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
