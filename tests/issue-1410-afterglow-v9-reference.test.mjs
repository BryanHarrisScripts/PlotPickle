import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#1410 uses one stable v9 identity across reference PPF and the new Foundations fixture", async () => {
  const [identity, referencePpf, fixture] = await Promise.all([
    source("data/afterglow-reference-identity.ts"),
    source("lib/afterglow-reference-ppf.ts"),
    source("modules/library/reference/afterglow-v9-foundations.ts"),
  ]);

  assert.match(identity, /AFTERGLOW_V9_REFERENCE_SOURCE_ID = "afterglow-v9-complete-baseline"/);
  assert.match(identity, /AFTERGLOW_V9_SOURCE_VERSION = "v9"/);
  assert.match(identity, /AFTERGLOW_V9_SOURCE_SHA = "54b5967644c5a41363fa88f57b02473ea758acc2"/);
  assert.match(identity, /AFTERGLOW_V9_FOUNDATIONS_FIXTURE_ID = "afterglow-v9-through-foundations"/);
  assert.match(referencePpf, /AFTERGLOW_V9_REFERENCE_SOURCE_ID/);
  assert.match(referencePpf, /AFTERGLOW_V9_SOURCE_FILE_NAME/);
  assert.match(referencePpf, /AFTERGLOW_V9_SOURCE_VERSION/);
  assert.match(fixture, /AFTERGLOW_V9_FOUNDATIONS_FIXTURE_ID/);
  assert.match(fixture, /AFTERGLOW_V9_SOURCE_SHA/);
});

test("#1410 derives the fixture from the live Foundations curriculum and fails closed when fields drift", async () => {
  const fixture = await source("modules/library/reference/afterglow-v9-foundations.ts");
  for (const contract of [
    "plotPickleCurriculum",
    "buildFoundationPlanLessons(plotPickleCurriculum)",
    "satisfies Readonly<Record<FoundationLessonTitle, ThreeReferenceAnswers>>",
    "answers.length !== lesson.fields.length",
    "Add an explicit reference mapping before accepting the curriculum change",
    "curriculumFingerprint(lessons)",
    "completedLessonIds",
    "assembleFoundationsBrief",
  ]) assert.ok(fixture.includes(contract), `Afterglow reference fixture is missing: ${contract}`);

  assert.match(fixture, /"The Anatomy of a Screenplay"/);
  assert.match(fixture, /"Build the Story Experience"/);
  assert.match(fixture, /kind: "observed"/);
  assert.match(fixture, /kind: "synthetic-reference"/);
  assert.match(fixture, /acceptanceState: "reference-defined"/);
  assert.doesNotMatch(fixture, /completedLessonIds:\s*plotPickleCurriculum\.map/,
    "the reference must complete only the current Foundations lesson set, not every curriculum lesson");
});

test("#1410 builds from the real complete v9 project and preserves direct screenplay evidence", async () => {
  const [fixture, richSource, screenplay, bridge] = await Promise.all([
    source("modules/library/reference/afterglow-v9-foundations.ts"),
    source("data/afterglow-complete.ts"),
    source("data/afterglow-screenplay.ts"),
    source("modules/library/import/rich-ppf-to-library-project.ts"),
  ]);

  assert.match(fixture, /createAfterglowProject as createRichAfterglowProject/);
  assert.match(fixture, /richPpfToLibraryProject/);
  assert.match(richSource, /Afterglow: Reflections of Sentience/);
  assert.match(screenplay, /Complete canonical demonstration screenplay/);
  assert.match(screenplay, /afterglow-v9-\$\{String\(index \+ 1\)\.padStart\(4, "0"\)\}/);
  assert.match(bridge, /direct screenplay passages stay[\s\S]*source evidence/i);
  assert.match(bridge, /referenceFixture: null/,
    "ordinary screenplay imports must not masquerade as the special reference fixture");
});

test("#1410 persists field-level reference provenance without creating another canon store", async () => {
  const [evidence, fixture, browserStore] = await Promise.all([
    source("core/contracts/imported-screenplay-evidence/index.ts"),
    source("modules/library/reference/afterglow-v9-foundations.ts"),
    source("core/storage/project-library-browser.ts"),
  ]);

  for (const contract of [
    'ReferenceFixtureFieldKind = "observed" | "synthetic-reference"',
    'ReferenceFixtureAcceptanceState = "reference-defined" | "proposed"',
    "fixtureId",
    "curriculumFingerprint",
    "sourceRefs",
    "normalizeReferenceFixture",
    "referenceFixture",
  ]) assert.ok(evidence.includes(contract), `Reference provenance contract is missing: ${contract}`);
  assert.match(fixture, /sourceEvidence:\s*\{[\s\S]*referenceFixture:/);
  assert.match(browserStore, /normalizeProjectSourceEvidence/,
    "reference provenance must travel through the existing Library source-evidence boundary");
  assert.doesNotMatch(fixture, /indexedDB|sqlite|new Database|second canon|story database/i);
});

test("#1410 replaces the fake Afterglow catalog story and lazy-loads the heavy v9 reference only after confirmation", async () => {
  const [catalog, workspace] = await Promise.all([
    source("modules/library/project-library-catalog.ts"),
    source("modules/library/ui/library-workspace.tsx"),
  ]);

  assert.match(catalog, /id: "afterglow-v9"/);
  assert.match(catalog, /title: "Afterglow: Reflections of Sentience"/);
  assert.match(catalog, /referenceLoader: "afterglow-v9-foundations"/);
  assert.doesNotMatch(catalog, /missing brother|memory archive|destabilized coast/i,
    "the old disconnected synthetic Afterglow card must not survive");

  assert.match(workspace, /await import\("\.\.\/reference\/afterglow-v9-foundations"\)/);
  assert.match(workspace, /createAfterglowV9FoundationsReference\(\)/);
  assert.match(workspace, /complete v9 reference is loaded only after you confirm/i);
  assert.match(workspace, /createLibraryWorkingCopy/);
  assert.doesNotMatch(catalog, /from "\.\/reference\/afterglow-v9-foundations"/,
    "the full v9 reference must remain off the initial Library catalog import path");
});

test("#1410 shows lesson-family frontier coverage without pretending later product stages are complete", async () => {
  const [catalog, workspace, css] = await Promise.all([
    source("modules/library/project-library-catalog.ts"),
    source("modules/library/ui/library-workspace.tsx"),
    source("modules/library/ui/library-workspace.module.css"),
  ]);

  for (const contract of [
    'foundations: "100%"',
    'world: "Not started"',
    'character: "Not available yet"',
    'structure: "Locked"',
    'storyboard: "Locked"',
  ]) assert.ok(catalog.includes(contract), `Afterglow Library frontier rail is missing: ${contract}`);
  assert.match(workspace, /COVERAGE_LABELS/);
  assert.match(workspace, /item\.coverage\[key\]/);
  assert.match(workspace, /curriculum coverage/);
  assert.match(css, /\.coverage/);
  assert.match(css, /data-coverage-state="Locked"/);
});

test("#1410 makes BUILD distinguish observed v9 evidence from synthetic reference decisions", async () => {
  const [model, component] = await Promise.all([
    source("modules/build/foundations-story-coverage.ts"),
    source("modules/build/ui/foundations-story-coverage.tsx"),
  ]);

  assert.match(model, /FoundationsStoryEvidenceState = "defined" \| "observed" \| "emerging" \| "missing"/);
  assert.match(model, /reference\.kind === "observed"/);
  assert.match(model, /reference\.kind === "synthetic-reference"/);
  assert.match(model, /Synthetic reference decision · not screenplay evidence/);
  assert.match(model, /const supported = defined \+ observed/);
  assert.match(component, /Observed/);
  assert.match(component, /synthetic fixture decisions are labelled separately from observed source evidence/i);
});
