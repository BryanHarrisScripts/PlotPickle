import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";
import { LEARN_PROGRAM_MAP } from "../learn/program-map.mjs";
import { LEARN_PROGRAM_COURSE_SPECS, LEARN_PROGRAM_SHELL_SPEC } from "../learn/program-map-spec.mjs";
import { changedFilesFromGit, runDevelopmentConvergence } from "../scripts/run-development-convergence.mjs";

const execFileAsync = promisify(execFile);
const read = (path) => readFile(path, "utf8");

const WRITER_CRAFT_COMPATIBILITY_IDS = [
  "foundations",
  "visual-writing",
  "method",
  "ai-revision",
  "characters",
  "dialogue",
  "story-craft",
  "working-together",
  "collaboration",
];

const shellFields = (course) => ({
  id: course.id,
  year: course.year,
  semester: course.semester,
  orderInSemester: course.orderInSemester,
  title: course.title,
  purpose: course.purpose,
  lessonRefs: course.lessonRefs,
  advisoryPrerequisites: course.advisoryPrerequisites,
  applicationTargets: course.applicationTargets,
});

test("#1918 Phase 3 shell compatibility survives Phase 6 Explore", async () => {
  const route = await read("app/api/learn/journey-preview/route.ts");

  assert.equal(LEARN_PROGRAM_MAP.yearCount, 3);
  assert.equal(LEARN_PROGRAM_MAP.semesterCount, 6);
  assert.equal(LEARN_PROGRAM_MAP.coursesPerSemester, 4);
  assert.equal(LEARN_PROGRAM_MAP.courseCount, 24);
  assert.deepEqual(LEARN_PROGRAM_MAP.semesters.map((semester) => semester.courseIds.length), [4, 4, 4, 4, 4, 4]);
  assert.equal(LEARN_PROGRAM_SHELL_SPEC.courseCount, 24);
  assert.deepEqual(LEARN_PROGRAM_MAP.courses.map(shellFields), LEARN_PROGRAM_COURSE_SPECS.map(shellFields));
  assert.deepEqual(LEARN_PROGRAM_MAP.semesters, LEARN_PROGRAM_SHELL_SPEC.semesters);

  assert.match(route, /LEARN_PROGRAM_COURSE_SPECS/u);
  assert.match(route, /LEARN_PROGRAM_SHELL_SPEC/u);
  assert.doesNotMatch(route, /program-map\.mjs/u);
  assert.match(route, /phase: "phase-5-all-paths"/u);
  assert.match(route, /lessonCount: course\.lessonRefs\.reduce/u);
  assert.match(route, /status: "wired"/u);
  assert.match(route, /contentAvailable: true/u);
  assert.match(route, /laterSemesterLessonContentExposed: true/u);
  assert.match(route, /allPathLessonContentExposed: true/u);
  assert.doesNotMatch(route, /overview|sections|definitions|example|checklist|mistakes|exercise|sourceContent/u);
});

test("#1967 retired Writer's Craft collection navigation remains retired", async () => {
  const [dashboard, skin, baselineSource] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1/skin-v1-client.tsx"),
    read("learn/journey-baseline.json"),
  ]);
  const baseline = JSON.parse(baselineSource);

  assert.equal(baseline.writerCraftCompatibility.collectionCount, 9);
  assert.equal(WRITER_CRAFT_COMPATIBILITY_IDS.length, 9);
  assert.equal(baseline.writerCraftCompatibility.collections.length, 9);
  for (const label of baseline.writerCraftCompatibility.collections) {
    assert.equal(typeof label, "string");
    assert.ok(label.length > 0);
    assert.ok(!dashboard.includes(label), `Legacy collection label ${label} must not render in the production Writer's Craft route.`);
  }

  assert.doesNotMatch(dashboard, /const WRITER_CRAFT_MENU/u);
  assert.doesNotMatch(dashboard, /data-skin-menu="writer-craft"/u);
  assert.match(dashboard, /<LearnJourneyPreview onBack=\{\(\) => setWriterCraftMenuOpen\(false\)\} \/>/u);
  assert.match(skin, /id: "learn", shortcut: "1", label: "Writer's Craft"/u);
});

test("#1975 Path and Craft Module presentation language survives Phase 6", async () => {
  const preview = await read("app/skin-v1/learn-journey-preview.tsx");

  assert.match(preview, /OPEN JOURNEY \/ 6 PATHS \/ 24 CRAFT MODULES/u);
  assert.match(preview, /CHOOSE ANY PATH\. MOVE AT YOUR OWN PACE\. THE ORDER IS A GUIDE, NOT A GATE\./u);
  assert.match(preview, /IS AVAILABLE\. OPEN ANY CRAFT MODULE IN ANY ORDER\./u);
  assert.match(preview, /STORY FOUNDATIONS/u);
  assert.match(preview, /STRUCTURE & STORY MOTION/u);
  assert.match(preview, /CHARACTER, DIALOGUE & VISUAL STORYTELLING/u);
  assert.match(preview, /DRAFTING THE STORY/u);
  assert.match(preview, /REVISION & COLLABORATIVE CRAFT/u);
  assert.match(preview, /PROFESSIONAL PRACTICE/u);
  assert.match(preview, /CRAFT MODULE \$\{craftModuleNumber\(course\.id\)\}/u);
  assert.doesNotMatch(preview, />3 YEARS \/ 6 SEMESTERS \/ 24 COURSES</u);
  assert.doesNotMatch(preview, />Back to Semesters</u);

  assert.match(preview, /year: number/u);
  assert.match(preview, /semester: number/u);
  assert.match(preview, /course-\(\\d\+\)/u);
  assert.match(preview, /recommendedSequenceIsAccessControl: false/u);
  assert.match(preview, /humanMayLearnOutOfOrder: true/u);
});

test("#1918 Phase 6 exposes first-class unrestricted Explore beside the guided Journey", async () => {
  const [journey, explore] = await Promise.all([
    read("app/skin-v1/learn-journey-preview.tsx"),
    read("app/skin-v1/learn-explore.tsx"),
  ]);

  assert.match(journey, /import LearnExplore from "\.\/learn-explore"/u);
  assert.match(journey, /data-learn-explore-open="true"/u);
  assert.match(journey, /\[E\] EXPLORE \/ ALL CURRICULUM/u);
  assert.match(journey, /event\.key\.toLowerCase\(\) === "e"/u);
  assert.match(journey, /completedLessonIds=\{completedLessonIds\}/u);
  assert.match(journey, /onToggleLessonCompletion=\{toggleLessonCompletion\}/u);

  assert.match(explore, /fetch\("\/api\/learn\/explore"/u);
  assert.match(explore, /data-learn-explore-phase="6"/u);
  assert.match(explore, /data-learn-explore-access="unrestricted"/u);
  assert.match(explore, /ALL CURRICULUM \/ 12 TOPICS \/ 88 PRESENTATION LESSONS \/ 95 BUNDLED SOURCES/u);
  assert.match(explore, /aria-label="Search all curriculum"/u);
  assert.match(explore, /aria-label="Filter Explore by topic"/u);
  assert.match(explore, /aria-label="Filter Explore by Craft Module"/u);
  assert.match(explore, /ORDER DOES NOT CONTROL ACCESS/u);
  assert.doesNotMatch(explore, /aria-disabled/iu);
  assert.doesNotMatch(explore, /prerequisite.*(?:disabled|locked)|(?:disabled|locked).*prerequisite/iu);
});

test("#1918 Journey remains keyboard reachable and guided-not-gated with all Paths wired", async () => {
  const preview = await read("app/skin-v1/learn-journey-preview.tsx");

  assert.match(preview, /data-skin-menu="learn-journey"/u);
  assert.match(preview, /data-skin-menu="learn-journey-courses"/u);
  assert.match(preview, /data-skin-menu="learn-journey-lessons"/u);
  assert.match(preview, /data-learn-journey-phase="5"/u);
  assert.match(preview, /data-learn-semester-open="true"/u);
  assert.match(preview, /data-learn-semester-content="wired"/u);
  assert.match(preview, /data-learn-course-content="available"/u);
  assert.match(preview, /event\.key === "ArrowDown"/u);
  assert.match(preview, /event\.key === "ArrowUp"/u);
  assert.match(preview, /event\.key === "Escape"/u);
  assert.match(preview, /event\.key\.toLowerCase\(\) === "e"/u);
  assert.match(preview, /\^\[1-6\]\$/u);
  assert.match(preview, /\^\[1-4\]\$/u);
  assert.match(preview, /CHOOSE ANY PATH/u);
  assert.match(preview, /OPEN ANY CRAFT MODULE IN ANY ORDER/u);
  assert.doesNotMatch(preview, /aria-disabled/u);
  assert.doesNotMatch(preview, /LESSON CONTENT IS UNAVAILABLE UNTIL PHASE 5/u);
});

test("#1918 LEARN Journey and Explore continue to consume Skin V1 tokens and full-width directory geometry", async () => {
  const css = await read("app/skin-v1/learn-journey-preview.module.css");
  assert.match(css, /width: min\(var\(--pp-skin-shell-max\), calc\(100vw - 40px\)\) !important;/u);
  assert.match(css, /width: min\(var\(--pp-skin-menu-max\), calc\(100% - 72px\)\) !important;/u);
  assert.match(css, /background: var\(--pp-skin-accent-deep\) !important;/u);
  assert.match(css, /border: var\(--pp-skin-border-thin\) solid var\(--pp-skin-accent-bright\) !important;/u);
  assert.match(css, /\.exploreControls/u);
  assert.match(css, /\.exploreResults/u);
  assert.match(css, /var\(--pp-skin-control-height\)/u);
});

test("#1918 Journey preserves the Phase 0, Phase 1 and Phase 2 deterministic LEARN validators", async () => {
  for (const validator of [
    "scripts/validate-learn-journey-baseline.mjs",
    "scripts/validate-learn-program-map.mjs",
    "scripts/validate-learn-curriculum-integrity.mjs",
  ]) {
    const { stderr } = await execFileAsync(process.execPath, [validator], { cwd: process.cwd() });
    assert.equal(stderr, "", `${validator} wrote unexpected stderr.`);
  }
});

test("#1918 Journey and Explore remain governed by the seven-layer verification mesh", async () => {
  const [catalogSource, ownershipSource] = await Promise.all([
    read("config/verification/test-catalog.json"),
    read("config/verification/ownership-map.json"),
  ]);
  const catalog = JSON.parse(catalogSource);
  const ownership = JSON.parse(ownershipSource);

  const entry = catalog.entries.find((candidate) => candidate.id === "experience.learn-journey-shell");
  assert.ok(entry);
  assert.equal(entry.ownerLayer, "experience-skins");
  assert.deepEqual(entry.runner.targets, ["tests/issue-1918-learn-journey-shell.test.mjs"]);

  const apiOwner = ownership.rules.find((rule) => rule.id === "learn-journey-preview-api");
  assert.ok(apiOwner);
  assert.equal(apiOwner.ownerLayer, "experience-contract");
  assert.ok(apiOwner.include.includes("app/api/learn/journey-preview/route.ts"));
  assert.ok(apiOwner.include.includes("app/api/learn/journey-semester-one/route.ts"));
  assert.ok(apiOwner.include.includes("app/api/learn/journey-courses/route.ts"));
  assert.ok(apiOwner.include.includes("app/api/learn/explore/route.ts"));
});

test("#1918 Phase 3 convergence remains historical after Phase 6", async (t) => {
  const manifest = JSON.parse(await read("config/development-convergence/1918.json"));
  if (manifest.phase !== "phase-3-journey-shell") {
    t.skip("Phase 3 convergence is historical; the active #1918 phase owns convergence now.");
    return;
  }
  assert.equal(manifest.phase, "phase-3-journey-shell");
});

test("#1975 canonical development convergence remains independently scoped", async (t) => {
  const baseRef = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "main";
  const changedFiles = changedFilesFromGit({ root: process.cwd(), baseRef });
  if (!changedFiles.includes("config/development-convergence/1975.json")) {
    t.skip("#1975 issue-specific convergence only applies when its convergence manifest is part of the current diff.");
    return;
  }

  const result = await runDevelopmentConvergence([
    "--manifest",
    "config/development-convergence/1975.json",
    "--base-ref",
    baseRef,
    "--report-dir",
    ".artifacts/development-convergence",
  ]);

  assert.equal(result.exitCode, 0);
  assert.equal(result.reports.length, 1);
  assert.equal(result.reports[0].issue, 1975);
  assert.equal(result.reports[0].status, "CONVERGED");
  assert.deepEqual(result.reports[0].remaining, []);
});
