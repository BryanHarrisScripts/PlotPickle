import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("#1918 Phase 0 freezes the current LEARN inventory without changing curriculum content", async () => {
  const [baselineSource, indexSource] = await Promise.all([
    read("learn/journey-baseline.json"),
    read("learn/index.json"),
  ]);
  const baseline = JSON.parse(baselineSource);
  const index = JSON.parse(indexSource);

  assert.equal(baseline.issue, 1918);
  assert.equal(baseline.phase, "phase-0-baseline");
  assert.equal(baseline.curriculum.topicCount, 12);
  assert.equal(baseline.curriculum.archivedLessonCount, 81);
  assert.equal(baseline.curriculum.bundledSourceCount, 95);
  assert.equal(baseline.curriculum.presentationLessonCount, 88);
  assert.equal(baseline.curriculum.foundationsPresentationLessonCount, 11);
  assert.equal(baseline.curriculum.lessonContentSha256, index.lessonContentSha256);
  assert.equal(baseline.curriculum.sourceContentSha256, index.sourceContentSha256);
  assert.equal(baseline.invariants.curriculumContentMutationAllowed, false);
  assert.equal(baseline.invariants.journeyMayGateCurriculumAccess, false);
  assert.equal(baseline.invariants.programMapMayDuplicateLessonBodies, false);
  assert.equal(baseline.invariants.humanRemainsLearningSequenceAuthority, true);
});

test("#1918 Phase 0 preserves the #1915 Writer's Craft compatibility rows", async () => {
  const [baselineSource, dashboard] = await Promise.all([
    read("learn/journey-baseline.json"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
  ]);
  const baseline = JSON.parse(baselineSource);

  assert.equal(baseline.writerCraftCompatibility.issue, 1915);
  assert.equal(baseline.writerCraftCompatibility.collectionCount, 9);
  assert.equal(baseline.writerCraftCompatibility.collections.length, 9);

  let previous = -1;
  for (const collection of baseline.writerCraftCompatibility.collections) {
    const current = dashboard.indexOf(`label: "${collection}"`);
    assert.ok(current > previous, `${collection} must remain in the #1915 Writer's Craft order`);
    previous = current;
  }
});

test("#1918 Phase 0 deterministic baseline validator passes against the repository", async () => {
  const { stdout, stderr } = await execFileAsync(process.execPath, ["scripts/validate-learn-journey-baseline.mjs"], {
    cwd: root,
    windowsHide: true,
  });

  assert.equal(stderr, "");
  assert.match(stdout, /12 topics, 81 archived lessons, 95 bundled sources, 88 presentation lessons and 9 Writer's Craft compatibility rows/u);
});
