import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";
import { LEARN_PROGRAM_MAP } from "../learn/program-map.mjs";
import { LEARN_PROGRAM_COURSE_SPECS, LEARN_PROGRAM_SHELL_SPEC } from "../learn/program-map-spec.mjs";

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

test("#1918 Phase 3 shell compatibility survives selective Phase 4 Semester 1 wiring", async () => {
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
  assert.match(route, /phase: "phase-4-semester-one"/u);
  assert.match(route, /lessonCount: course\.lessonRefs\.reduce/u);
  assert.match(route, /const contentAvailable = semester\.semester === 1/u);
  assert.match(route, /status: contentAvailable \? "wired" : "preview-only"/u);
  assert.match(route, /semesterOneLessonContentExposed: true/u);
  assert.match(route, /laterSemesterLessonContentExposed: false/u);
  assert.doesNotMatch(route, /overview|sections|definitions|example|checklist|mistakes|exercise|sourceContent/u);
});

test("#1918 Journey preserves the nine Writer's Craft collection compatibility rows and explicit J destination", async () => {
  const [dashboard, baselineSource] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("learn/journey-baseline.json"),
  ]);
  const baseline = JSON.parse(baselineSource);

  assert.equal(baseline.writerCraftCompatibility.collectionCount, 9);
  assert.equal(WRITER_CRAFT_COMPATIBILITY_IDS.length, 9);
  assert.equal(baseline.writerCraftCompatibility.collections.length, 9);

  for (const id of WRITER_CRAFT_COMPATIBILITY_IDS) {
    assert.ok(dashboard.includes(`id: "${id}"`), `Writer's Craft compatibility row ${id} must remain.`);
  }
  for (const label of baseline.writerCraftCompatibility.collections) {
    assert.equal(typeof label, "string");
    assert.ok(dashboard.includes(label), `Writer's Craft compatibility label ${label} must remain.`);
  }

  assert.match(dashboard, /data-skin-menu-row="learn-journey"/u);
  assert.match(dashboard, /data-skin-menu-shortcut="J"/u);
  assert.match(dashboard, /data-skin-menu-connected="true"/u);
  assert.match(dashboard, /LEARN Journey \/ 24-Course Program/u);
  assert.match(dashboard, /setLearnJourneyOpen\(true\)/u);
});

test("#1918 Journey remains keyboard reachable and guided-not-gated while Phase 4 wires only Semester 1", async () => {
  const preview = await read("app/skin-v1/learn-journey-preview.tsx");

  assert.match(preview, /data-skin-menu="learn-journey"/u);
  assert.match(preview, /data-skin-menu="learn-journey-courses"/u);
  assert.match(preview, /data-skin-menu="learn-journey-lessons"/u);
  assert.match(preview, /data-learn-journey-phase="4"/u);
  assert.match(preview, /data-learn-semester-open="true"/u);
  assert.match(preview, /event\.key === "ArrowDown"/u);
  assert.match(preview, /event\.key === "ArrowUp"/u);
  assert.match(preview, /event\.key === "Escape"/u);
  assert.match(preview, /\^\[1-6\]\$/u);
  assert.match(preview, /\^\[1-4\]\$/u);
  assert.match(preview, /ALL SEMESTERS REMAIN OPEN/u);
  assert.match(preview, /SEMESTER 1 IS WIRED END-TO-END\. OPEN ANY COURSE IN ANY ORDER/u);
  assert.match(preview, /LESSON CONTENT REMAINS UNWIRED UNTIL PHASE 5/u);
  assert.doesNotMatch(preview, /aria-disabled/u);
});

test("#1918 Journey shell continues to consume Skin V1 tokens and full-width directory geometry", async () => {
  const css = await read("app/skin-v1/learn-journey-preview.module.css");

  assert.match(css, /width: min\(var\(--pp-skin-shell-max\), calc\(100vw - 40px\)\) !important;/u);
  assert.match(css, /width: min\(var\(--pp-skin-menu-max\), calc\(100% - 72px\)\) !important;/u);
  assert.match(css, /display: block !important;/u);
  assert.match(css, /background: var\(--pp-skin-accent-deep\) !important;/u);
  assert.match(css, /border: var\(--pp-skin-border-thin\) solid var\(--pp-skin-accent-bright\) !important;/u);
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

test("#1918 Journey remains governed by the seven-layer verification mesh", async () => {
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
  assert.ok(entry.triggerTokens.includes("navigation"));
  assert.ok(entry.triggerTokens.includes("skin"));

  const apiOwner = ownership.rules.find((rule) => rule.id === "learn-journey-preview-api");
  assert.ok(apiOwner);
  assert.equal(apiOwner.ownerLayer, "experience-contract");
  assert.ok(apiOwner.include.includes("app/api/learn/journey-preview/route.ts"));
  assert.ok(apiOwner.include.includes("app/api/learn/journey-semester-one/route.ts"));

  const mapOwner = ownership.rules.find((rule) => rule.id === "learn-program-map");
  assert.ok(mapOwner);
  assert.ok(mapOwner.include.includes("learn/program-map.mjs"));
  assert.ok(mapOwner.include.includes("learn/program-map-spec.mjs"));
});

test("#1918 Phase 3 issue-specific convergence is superseded once Phase 4 is active", async (t) => {
  const manifest = JSON.parse(await read("config/development-convergence/1918.json"));
  if (manifest.phase !== "phase-3-journey-shell") {
    t.skip("Phase 3 convergence is historical; the active #1918 phase owns convergence now.");
    return;
  }
  assert.equal(manifest.phase, "phase-3-journey-shell");
});
