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

test("issue #1338 keeps draft and imported proposals non-canonical and does not inflate coverage", async () => {
  const model = await source("modules/build/foundations-story-coverage.ts");
  assert.match(model, /A draft proposal exists, but it has not become a saved story decision in the canonical PPF/);
  assert.match(model, /const total = defined \+ emerging \+ missing/);
  assert.match(model, /percent: total \? Math\.round\(\(defined \/ total\) \* 100\) : 0/);
  assert.doesNotMatch(model, /\(defined \+ emerging\) \/ total/);
});

test("issue #1338 exposes visible Story Coverage and 24/96 explainability on the live BUILD screen", async () => {
  const [component, css, mapComponent, mapCss, mapModel] = await Promise.all([
    source("modules/build/ui/foundations-story-coverage.tsx"),
    source("modules/build/ui/foundations-story-coverage.module.css"),
    source("modules/build/ui/progressive-story-map.tsx"),
    source("modules/build/ui/progressive-story-map.module.css"),
    source("modules/build/progressive-story-map.ts"),
  ]);
  for (const contract of [
    "Story Coverage",
    "Defined",
    "Emerging",
    "Missing",
    'data-story-coverage="live-foundations"',
    "Saved Human-approved decisions",
    "Draft/import proposals awaiting a decision",
    "No usable story support yet",
    "decision.reason",
    "decision.excerpt",
    "decision.sourceLabel",
    "course completion",
    "generated wireframe frames",
    "<ProgressiveStoryMap project={project} />",
  ]) assert.ok(component.includes(contract), `Live BUILD evidence UI is missing: ${contract}`);
  for (const contract of ["panel", "score", "summary", "lessonGrid", "decision", "@media (forced-colors: active)"]) {
    assert.ok(css.includes(contract), `Live BUILD Story Coverage styling is missing: ${contract}`);
  }
  for (const contract of [
    'data-progressive-story-map="24x96"',
    "24 Blocks / 96 Mini-Blocks",
    "Observed",
    "Locked",
    "Not enough information yet",
    "Selected story position",
    "screenplay text is observed evidence",
  ]) assert.ok(mapComponent.includes(contract), `24/96 BUILD UI is missing: ${contract}`);
  assert.match(mapModel, /Array\.from\(\{ length: 24 \}/);
  assert.match(mapModel, /\["Promise", "Progress", "Pressure", "Payoff"\]/);
  assert.match(mapModel, /analysisStatus === "reviewed"/);
  assert.match(mapModel, /placement remains importer-suggested and requires Human review/);
  assert.match(mapCss, /grid-template-columns: repeat\(6/);
});

test("issue #1338 removes the new evidence implementation from the obsolete BUILD surface", async () => {
  const [legacyModel, legacyMap] = await Promise.all([
    source("modules/build/build-workspace-model.ts"),
    source("app/build-health-map.tsx"),
  ]);
  assert.doesNotMatch(legacyModel, /BuildEvidenceStatus|deriveBuildEvidence|BuildStoryCoverage|ScreenplayAnalysisStatus/);
  assert.doesNotMatch(legacyMap, /BuildEvidenceStatus|Story Coverage|Direct screenplay passages|Import review/);
});

test("issue #1338 bridges rich imported PPF evidence into the current modular Library project without canon inflation", async () => {
  const [bridge, evidence, library, gateway] = await Promise.all([
    source("modules/library/import/rich-ppf-to-library-project.ts"),
    source("core/contracts/imported-screenplay-evidence/index.ts"),
    source("core/storage/project-library-browser.ts"),
    source("build/library-ppf-import-gateway.ts"),
  ]);
  for (const contract of [
    "richPpfToLibraryProject",
    "Imported screenplay analysis",
    "proposal:",
    "sourceEvidence",
    "draftElements",
    "analysisStatus",
    "MAX_IMPORTED_PASSAGES",
    "createEmptyProject",
  ]) assert.ok(bridge.includes(contract), `Library import bridge is missing: ${contract}`);
  assert.doesNotMatch(bridge, /completedLessonIds\s*:/);
  assert.match(evidence, /passagesTruncated/);
  assert.match(evidence, /slice\(0, 2500\)/);
  assert.match(library, /normalizeLibraryProject/);
  assert.match(library, /normalizeProjectSourceEvidence/);
  assert.match(library, /importLibraryProject/);
  assert.match(gateway, /openLocalPpf/);
  assert.match(gateway, /richPpfToLibraryProject/);
  assert.match(gateway, /\/api\/library\/import\/ppf/);
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
