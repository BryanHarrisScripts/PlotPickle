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

test("#1918 Phase 5 all-Path Journey wiring survives Phase 6", async () => {
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

test("#1918 all-Paths API follows the current canonical Journey projection while preserving the base archive", async () => {
  const [route, catalog] = await Promise.all([
    read("app/api/learn/journey-courses/route.ts"),
    read("adapters/curriculum/current-catalog-integrated.ts"),
  ]);
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
    assert.ok(catalog.includes(canonicalImport), `Current catalog must preserve canonical ${canonicalImport}.`);
  }
  assert.match(route, /canonicalTopicDocuments/u);
  assert.match(route, /ISSUE_1976_CANONICAL_REGISTRY/u);
  assert.match(route, /LEARN_PROGRAM_COURSE_SPECS/u);
  assert.match(route, /course\.lessonRefs\.flatMap/u);
  assert.match(route, /lessons\[position - 1\]/u);
  assert.match(route, /courses\.length !== 24/u);
  assert.match(route, /size !== 89/u);
  assert.match(route, /curriculumOwner: "adapters\/curriculum\/current-catalog\.ts"/u);
  assert.match(route, /progressOwner: "PPFProject\.learning\.completedLessonIds"/u);
  assert.match(route, /curriculumBodiesDuplicated: false/u);
  assert.doesNotMatch(route, /lessonBodies|copiedCurriculum|journeyCurriculum/u);
});

test("#1918 Explore projects the current 96-lesson presentation catalog and 24-Craft-Module ownership", async () => {
  const route = await read("app/api/learn/explore/route.ts");

  assert.match(route, /plotPickleCurriculum/u);
  assert.match(route, /adapters\/curriculum\/current-catalog/u);
  assert.match(route, /FOUNDATION_PROMOTED_SOURCE_IDS/u);
  assert.match(route, /LEARN_PROGRAM_COURSE_SPECS/u);
  assert.match(route, /ISSUE_1976_CANONICAL_REGISTRY/u);
  assert.match(route, /coverageMode: lesson\.id === canonicalLessonId \? "journey" as const : "reference-coverage" as const/u);
  assert.match(route, /entries\.length !== 96/u);
  assert.match(route, /canonicalLessonCount: 89/u);
  assert.match(route, /representedTopics\.size !== 12/u);
  assert.match(route, /representedCraftModules\.size !== 24/u);
  assert.match(route, /sourceIds\.size !== 95/u);
  assert.match(route, /referenceCoverageCount !== 7/u);
  assert.match(route, /curriculumOwner: "adapters\/curriculum\/current-catalog\.ts"/u);
  assert.match(route, /journeyMapOwner: "learn\/program-map-spec\.mjs"/u);
  assert.match(route, /curriculumBodiesDuplicated: false/u);
  assert.doesNotMatch(route, /const curriculum = \[|lessonBodies|exploreCurriculum/u);
});

test("#1918 Phase 6 promoted Foundations presentation lessons retain canonical reference coverage", async () => {
  const route = await read("app/api/learn/explore/route.ts");

  assert.match(route, /promotedFoundationSourceIds/u);
  assert.match(route, /lesson\.sources\.find\(\(source\) => promotedFoundationSourceIds\.has\(source\.id\)\)/u);
  assert.match(route, /foundationsDocument\?\.lessons\.find/u);
  assert.match(route, /candidate\.sources\.some\(\(source\) => source\.id === promotedSource\.id\)/u);
  assert.match(route, /archiveLessonOwner\.get\(canonicalLessonId\)/u);
  assert.match(route, /referenceCoverageCount/u);
});

test("#1918 Phase 5 retains the Phase 4 Path 01 compatibility projection", async () => {
  const route = await read("app/api/learn/journey-semester-one/route.ts");
  assert.match(route, /phase: "phase-4-semester-one"/u);
  assert.match(route, /\.filter\(\(course\) => course\.semester === 1\)/u);
  assert.match(route, /courses\.length !== 4/u);
  assert.match(route, /curriculumOwner: "existing LEARN archive"/u);
});

test("#1918 Phase 6 Journey and Explore reuse one PPF lesson-history authority", async () => {
  const [journey, explore, route] = await Promise.all([
    read("app/skin-v1/learn-journey-preview.tsx"),
    read("app/skin-v1/learn-explore.tsx"),
    read("app/api/learn/explore/route.ts"),
  ]);

  assert.match(journey, /loadFoundationProject/u);
  assert.match(journey, /saveFoundationProject/u);
  assert.match(journey, /applyStoryCommand/u);
  assert.match(journey, /project\?\.learning\.completedLessonIds/u);
  assert.match(journey, /type: isCompleted \? "lesson\.uncomplete" : "lesson\.complete"/u);
  assert.match(journey, /completedLessonIds=\{completedLessonIds\}/u);
  assert.match(journey, /onLessonOpen=\{\(lessonId\) => commit\(\{ type: "lesson\.open"/u);
  assert.match(journey, /onToggleLessonCompletion=\{toggleLessonCompletion\}/u);

  assert.match(explore, /data-learn-progress-owner="PPFProject\.learning\.completedLessonIds"/u);
  assert.match(explore, /completedLessonIds\.has\(entry\.lesson\.id\)/u);
  assert.match(explore, /onToggleLessonCompletion\(openEntry\.lesson\)/u);
  assert.match(route, /progressOwner: "PPFProject\.learning\.completedLessonIds"/u);
  assert.match(route, /journeyAndExploreShareProgress: true/u);

  assert.doesNotMatch(journey, /localStorage\.setItem\([^\n]*(?:journey|course-progress|explore)/iu);
  assert.doesNotMatch(explore, /localStorage\.setItem/iu);
});

test("#1918 Phase 6 Explore supports topic, Craft Module, lesson, concept and application discovery", async () => {
  const [route, explore] = await Promise.all([
    read("app/api/learn/explore/route.ts"),
    read("app/skin-v1/learn-explore.tsx"),
  ]);

  assert.match(route, /topic: \{/u);
  assert.match(route, /craftModule: \{/u);
  assert.match(route, /concepts: unique\(/u);
  assert.match(route, /applicationAreas: unique\(/u);
  assert.match(route, /\.\.\.lesson\.tags/u);
  assert.match(route, /definition\.term/u);
  assert.match(route, /section\.heading/u);
  assert.match(route, /lesson\.apply/u);
  assert.match(route, /\.\.\.course\.applicationTargets/u);

  assert.match(explore, /matchesQuery/u);
  assert.match(explore, /entry\.topic\.title/u);
  assert.match(explore, /entry\.craftModule\.title/u);
  assert.match(explore, /entry\.lesson\.title/u);
  assert.match(explore, /\.\.\.entry\.concepts/u);
  assert.match(explore, /\.\.\.entry\.applicationAreas/u);
  assert.match(explore, /topicFilter === "all"/u);
  assert.match(explore, /craftModuleFilter === "all"/u);
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

test("#1918 Phase 6 keeps Journey and Explore unrestricted by prerequisites or completion", async () => {
  const [journey, explore, route] = await Promise.all([
    read("app/skin-v1/learn-journey-preview.tsx"),
    read("app/skin-v1/learn-explore.tsx"),
    read("app/api/learn/explore/route.ts"),
  ]);

  assert.match(journey, /IS AVAILABLE\. OPEN ANY CRAFT MODULE IN ANY ORDER/u);
  assert.match(journey, /COMPLETION ORDER IS YOUR CHOICE/u);
  assert.match(journey, /data-learn-course-status="wired"/u);
  assert.match(journey, /data-learn-course-content="available"/u);
  assert.match(explore, /data-learn-explore-access="unrestricted"/u);
  assert.match(explore, /EXPLORE IS UNRESTRICTED/u);
  assert.match(route, /accessMode: "unrestricted" as const/u);
  assert.match(route, /recommendedSequenceIsAccessControl: false/u);
  assert.match(route, /humanMayLearnOutOfOrder: true/u);
  assert.doesNotMatch(journey, /prerequisite.*disabled|disabled.*prerequisite/iu);
  assert.doesNotMatch(explore, /prerequisite.*(?:disabled|locked)|(?:disabled|locked).*prerequisite/iu);
  assert.doesNotMatch(journey, /aria-disabled/iu);
  assert.doesNotMatch(explore, /aria-disabled/iu);
});

test("#1918 Phase 6 preserves the Phase 0-2 curriculum integrity validators", async () => {
  for (const validator of [
    "scripts/validate-learn-journey-baseline.mjs",
    "scripts/validate-learn-program-map.mjs",
    "scripts/validate-learn-curriculum-integrity.mjs",
  ]) {
    const { stderr } = await execFileAsync(process.execPath, [validator], { cwd: process.cwd() });
    assert.equal(stderr, "", `${validator} wrote unexpected stderr.`);
  }
});

test("#1918 Phase 6 remains registered in the seven-layer verification mesh", async () => {
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
  assert.ok(apiOwner.include.includes("app/api/learn/explore/route.ts"));
});

test("#1918 Phase 6 canonical development convergence reports CONVERGED against the real diff", async (t) => {
  const baseRef = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "main";
  const changedFiles = changedFilesFromGit({ root: process.cwd(), baseRef });
  if (!changedFiles.includes("config/development-convergence/1918.json")) {
    t.skip("#1918 Phase 6 issue-specific convergence only applies when its convergence manifest is part of the current diff.");
    return;
  }

  const manifest = JSON.parse(await read("config/development-convergence/1918.json"));
  if (manifest.phase !== "phase-6-explore-all-curriculum") {
    t.skip("Phase 6 convergence is historical; the active #1918 phase owns convergence now.");
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
