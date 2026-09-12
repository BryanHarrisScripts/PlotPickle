import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import test from "node:test";
import { LEARN_PROGRAM_MAP } from "../learn/program-map.mjs";
import { validateLearnCurriculumIntegrity } from "../scripts/learn-curriculum-integrity.mjs";
import { changedFilesFromGit, runDevelopmentConvergence } from "../scripts/run-development-convergence.mjs";

const execFileAsync = promisify(execFile);
const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

const [baseline, index, presentationAdapterSource, foundationReferenceSource] = await Promise.all([
  readJson("learn/journey-baseline.json"),
  readJson("learn/index.json"),
  read("adapters/curriculum/current-catalog.ts"),
  read("adapters/curriculum/foundation-reference-lessons.ts"),
]);
const topicDocuments = await Promise.all(index.files.map((entry) => readJson(`learn/${entry.file}`)));

const actualInput = () => ({
  baseline: structuredClone(baseline),
  index: structuredClone(index),
  topicDocuments: structuredClone(topicDocuments),
  programMap: structuredClone(LEARN_PROGRAM_MAP),
  presentationAdapterSource,
  foundationReferenceSource,
});

const validate = (mutate) => {
  const input = actualInput();
  mutate?.(input);
  return validateLearnCurriculumIntegrity(input);
};

const hasFailure = (result, pattern) => result.failures.some((failure) => pattern.test(failure));

test("#1918 Phase 2 proves complete archive, source, presentation and Journey coverage with actual hashes", () => {
  const result = validate();
  assert.equal(result.ok, true, result.failures.join("\n"));
  assert.deepEqual(result.summary, {
    topicCount: 12,
    archivedLessonCount: 81,
    bundledSourceCount: 95,
    presentationLessonCount: 88,
    courseCount: 24,
    journeyPresentationCoverageCount: 81,
    referencePresentationCoverageCount: 7,
    lessonContentSha256: baseline.curriculum.lessonContentSha256,
    sourceContentSha256: baseline.curriculum.sourceContentSha256,
  });
  assert.equal(result.coverage.journey.length, 81);
  assert.equal(result.coverage.references.length, 7);
  assert.ok(result.coverage.references.every((entry) => entry.mode === "reference-coverage"));
  assert.ok(result.coverage.references.every((entry) => entry.courseId));
});

test("#1918 Phase 2 fails closed when canonical curriculum is deleted", () => {
  const result = validate((input) => {
    const document = input.topicDocuments.find((item) => item.topic.id === "theme");
    document.lessons.pop();
    document.lessonCount -= 1;
  });
  assert.equal(result.ok, false);
  assert.ok(hasFailure(result, /Expected 81 archived lessons/u));
  assert.ok(hasFailure(result, /lesson content changed from the frozen #1918 baseline hash/u));
});

test("#1918 Phase 2 fails closed on orphaned and duplicate Journey ownership", () => {
  const orphan = validate((input) => {
    input.programMap.courses[0].lessonIds.pop();
  });
  assert.equal(orphan.ok, false);
  assert.ok(hasFailure(orphan, /is orphaned from the 24-course Journey map/u));

  const duplicate = validate((input) => {
    const lessonId = input.programMap.courses[0].lessonIds[0];
    input.programMap.courses[1].lessonIds.push(lessonId);
  });
  assert.equal(duplicate.ok, false);
  assert.ok(hasFailure(duplicate, /duplicate course ownership/u));
});

test("#1918 Phase 2 fails closed on invalid lesson references and broken advisory prerequisites", () => {
  const invalidLesson = validate((input) => {
    input.programMap.courses[0].lessonIds[0] = "missing-canonical-lesson";
  });
  assert.equal(invalidLesson.ok, false);
  assert.ok(hasFailure(invalidLesson, /references unknown canonical lesson missing-canonical-lesson/u));

  const brokenPrerequisite = validate((input) => {
    input.programMap.courses[10].advisoryPrerequisites.push("course-99");
  });
  assert.equal(brokenPrerequisite.ok, false);
  assert.ok(hasFailure(brokenPrerequisite, /references unknown advisory prerequisite course-99/u));
});

test("#1918 Phase 2 fails closed when source or promoted presentation/reference coverage is lost", () => {
  const sourceDeletion = validate((input) => {
    const foundations = input.topicDocuments.find((item) => item.topic.id === "foundations");
    foundations.lessons[0].sources.pop();
    foundations.sourceCount -= 1;
  });
  assert.equal(sourceDeletion.ok, false);
  assert.ok(hasFailure(sourceDeletion, /Expected 95 bundled sources/u));
  assert.ok(hasFailure(sourceDeletion, /Expected 88 presentation lessons/u));
  assert.ok(hasFailure(sourceDeletion, /source content changed from the frozen #1918 baseline hash/u));

  const promotedCoverageDeletion = validate((input) => {
    input.foundationReferenceSource = input.foundationReferenceSource.replace(
      /\n\s*\{\n\s*sourceId: "24-blocks-general-general-the-pitch-md",[\s\S]*?\n\s*\},/u,
      "",
    );
  });
  assert.equal(promotedCoverageDeletion.ok, false);
  assert.ok(hasFailure(promotedCoverageDeletion, /missing promoted presentation\/reference coverage/u));
  assert.ok(hasFailure(promotedCoverageDeletion, /Expected 88 presentation lessons/u));
});

test("#1918 Phase 2 rejects curriculum-body duplication inside the program map", () => {
  const result = validate((input) => {
    input.programMap.courses[0].sections = [{ heading: "copied curriculum" }];
  });
  assert.equal(result.ok, false);
  assert.ok(hasFailure(result, /Program map must remain index\/orchestration only/u));
  assert.ok(hasFailure(result, /programMap\.courses\[0\]\.sections/u));
});

test("#1918 Phase 2 repository validator and prior Phase 0/1 validators all remain green", async () => {
  for (const script of [
    "scripts/validate-learn-journey-baseline.mjs",
    "scripts/validate-learn-program-map.mjs",
    "scripts/validate-learn-curriculum-integrity.mjs",
  ]) {
    const { stdout, stderr } = await execFileAsync(process.execPath, [script], {
      cwd: process.cwd(),
      windowsHide: true,
    });
    assert.equal(stderr, "", `${script} wrote to stderr`);
    assert.match(stdout, /LEARN/u);
  }
});

test("#1918 Phase 2 canonical development convergence reports CONVERGED against the real diff", async (t) => {
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
