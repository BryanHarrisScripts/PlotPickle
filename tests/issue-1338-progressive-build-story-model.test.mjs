import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #1338 proves the current BUILD route mounts the modular Foundations workspace", async () => {
  const [page, workspace] = await Promise.all([
    source("app/page.tsx"),
    source("modules/build/ui/foundations-build-workspace.tsx"),
  ]);
  assert.match(page, /import FoundationsBuildWorkspace from "\.\.\/modules\/build\/ui\/foundations-build-workspace"/);
  assert.match(page, /if \(workspace === "build"\)[\s\S]*<FoundationsBuildWorkspace/);
  assert.match(workspace, /import FoundationsStoryCoverage from "\.\/foundations-story-coverage"/);
  assert.match(workspace, /<FoundationsStoryCoverage curriculum=\{curriculum\} project=\{project\} \/>/);
});

test("issue #1338 derives current story coverage from canonical PPF answers and proposals", async () => {
  const model = await source("modules/build/foundations-story-coverage.ts");
  for (const contract of [
    "buildFoundationPlanLessons",
    "isUsableFoundationAnswer",
    'state: "defined"',
    'state: "emerging"',
    'state: "missing"',
    "lessonState?.answers[field.id]",
    "lessonState?.proposal?.values[field.id]",
    "Math.round((defined / total) * 100)",
  ]) assert.ok(model.includes(contract), `Live Story Coverage is missing: ${contract}`);
  assert.doesNotMatch(model, /completedLessonIds|visualArtifacts|acceptedVisualArtifactIds|lib\/projects|screenplay/);
});

test("issue #1338 keeps draft proposals non-canonical and does not inflate coverage", async () => {
  const model = await source("modules/build/foundations-story-coverage.ts");
  assert.match(model, /A draft proposal exists, but it has not become a saved story decision in the canonical PPF/);
  assert.match(model, /const total = defined \+ emerging \+ missing/);
  assert.match(model, /percent: total \? Math\.round\(\(defined \/ total\) \* 100\) : 0/);
  assert.doesNotMatch(model, /\(defined \+ emerging\) \/ total/);
});

test("issue #1338 exposes visible Story Coverage and explainability on the live BUILD screen", async () => {
  const [component, css] = await Promise.all([
    source("modules/build/ui/foundations-story-coverage.tsx"),
    source("modules/build/ui/foundations-story-coverage.module.css"),
  ]);
  for (const contract of [
    "Story Coverage",
    "Defined",
    "Emerging",
    "Missing",
    'data-story-coverage="live-foundations"',
    "Saved Human-approved decisions",
    "Draft proposals awaiting a decision",
    "No usable story support yet",
    "decision.reason",
    "decision.excerpt",
    "decision.sourceLabel",
    "course completion",
    "generated wireframe frames",
  ]) assert.ok(component.includes(contract), `Live BUILD evidence UI is missing: ${contract}`);
  for (const contract of ["panel", "score", "summary", "lessonGrid", "decision", "@media (forced-colors: active)"]) {
    assert.ok(css.includes(contract), `Live BUILD Story Coverage styling is missing: ${contract}`);
  }
});

test("issue #1338 removes the new evidence implementation from the obsolete BUILD surface", async () => {
  const [legacyModel, legacyMap] = await Promise.all([
    source("modules/build/build-workspace-model.ts"),
    source("app/build-health-map.tsx"),
  ]);
  assert.doesNotMatch(legacyModel, /BuildEvidenceStatus|deriveBuildEvidence|BuildStoryCoverage|ScreenplayAnalysisStatus/);
  assert.doesNotMatch(legacyMap, /BuildEvidenceStatus|Story Coverage|Direct screenplay passages|Import review/);
});

test("issue #1338 records that imported Observed evidence still requires modular import migration", async () => {
  const [correction, project, importer] = await Promise.all([
    source("docs/issue-1338-live-build-correction.md"),
    source("core/project/project.ts"),
    source("lib/projects/screenplay/screenplay-import.ts"),
  ]);
  for (const contract of [
    "Phase B — imported screenplay observations",
    "must not fabricate an Observed state",
    "current modular `PPFProject`",
    "legacy `lib/projects` project model",
    "Issue #1338 remains open",
  ]) assert.ok(correction.includes(contract), `Correction record is missing: ${contract}`);
  assert.doesNotMatch(project, /draftElements|analysisStatus|screenplay:/);
  assert.match(importer, /type PlotPickleProject/);
  assert.doesNotMatch(importer, /type PPFProject|core\/project\/project/);
});

test("issue #1338 retains the original PPF authority and no-filler product contract", async () => {
  const brief = await source("docs/PRODUCT-DEVELOPER-BRIEF-08-23-PROGRESSIVE-BUILD-STORY-MODEL.md");
  for (const contract of [
    "PPF remains canonical",
    "Story Knowledge Graph remains derived, read-only",
    "Empty is valid information",
    "Learning completion and story coverage are separate concepts",
    "Pi may be used only as a bounded implementation-review aid",
    "GitHub Actions remains the authoritative automated verification loop",
    "No new `.PPP`",
  ]) assert.ok(brief.includes(contract), `Developer brief missing: ${contract}`);
});
