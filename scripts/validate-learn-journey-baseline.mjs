import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = async (path) => readFile(new URL(path, root), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const [baseline, index, catalog, dashboard] = await Promise.all([
  readJson("learn/journey-baseline.json"),
  readJson("learn/index.json"),
  read("adapters/curriculum/current-catalog.ts"),
  read("app/skin-v1/dashboard-bbs-panel.tsx"),
]);

const topicDocuments = await Promise.all(index.files.map((entry) => readJson(`learn/${entry.file}`)));
const archivedLessons = topicDocuments.flatMap((document) => document.lessons);
const bundledSources = archivedLessons.flatMap((lesson) => lesson.sources);

check(baseline.schemaVersion === "1.0", "LEARN journey baseline schema must be 1.0.");
check(baseline.issue === 1918, "LEARN journey baseline must belong to issue #1918.");
check(baseline.phase === "phase-0-baseline", "LEARN journey baseline must identify Phase 0.");

check(index.files.length === baseline.curriculum.topicCount, `Expected ${baseline.curriculum.topicCount} LEARN topics, found ${index.files.length}.`);
check(archivedLessons.length === baseline.curriculum.archivedLessonCount, `Expected ${baseline.curriculum.archivedLessonCount} archived lessons, found ${archivedLessons.length}.`);
check(bundledSources.length === baseline.curriculum.bundledSourceCount, `Expected ${baseline.curriculum.bundledSourceCount} bundled sources, found ${bundledSources.length}.`);
check(index.lessonContentSha256 === baseline.curriculum.lessonContentSha256, "Canonical LEARN lesson-content hash changed from the #1918 baseline.");
check(index.sourceContentSha256 === baseline.curriculum.sourceContentSha256, "Canonical LEARN source-content hash changed from the #1918 baseline.");

check(
  catalog.includes(`standalonePlotPickleCurriculum.length !== ${baseline.curriculum.presentationLessonCount}`),
  `Current catalog no longer enforces ${baseline.curriculum.presentationLessonCount} presentation lessons.`,
);
check(
  catalog.includes(`standaloneFoundations.length !== ${baseline.curriculum.foundationsPresentationLessonCount}`),
  `Current catalog no longer enforces ${baseline.curriculum.foundationsPresentationLessonCount} Foundations presentation lessons.`,
);

const collections = baseline.writerCraftCompatibility.collections;
check(collections.length === baseline.writerCraftCompatibility.collectionCount, "Writer's Craft compatibility count does not match the baseline collection list.");
let previousIndex = -1;
for (const collection of collections) {
  const indexInDashboard = dashboard.indexOf(`label: \"${collection}\"`);
  check(indexInDashboard >= 0, `Writer's Craft compatibility row is missing: ${collection}.`);
  check(indexInDashboard > previousIndex, `Writer's Craft compatibility order changed at: ${collection}.`);
  previousIndex = indexInDashboard;
}

check(baseline.invariants.curriculumContentMutationAllowed === false, "Phase 0 must forbid curriculum-content mutation.");
check(baseline.invariants.journeyMayGateCurriculumAccess === false, "#1918 Journey must remain guided, never gatekept.");
check(baseline.invariants.programMapMayDuplicateLessonBodies === false, "The future program map must reference lessons rather than duplicate lesson bodies.");
check(baseline.invariants.humanRemainsLearningSequenceAuthority === true, "The Human must remain authority over learning sequence.");

if (failures.length) {
  console.error("PlotPickle LEARN journey baseline validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    `LEARN journey baseline passed: ${index.files.length} topics, ${archivedLessons.length} archived lessons, ${bundledSources.length} bundled sources, ${baseline.curriculum.presentationLessonCount} presentation lessons and ${collections.length} Writer's Craft compatibility rows.`,
  );
}
