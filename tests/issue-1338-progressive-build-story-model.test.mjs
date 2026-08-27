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

test("issue #1338/#1410 derives current story coverage from canonical PPF answers, explicit reference provenance and proposals", async () => {
  const model = await source("modules/build/foundations-story-coverage.ts");
  for (const contract of [
    "buildFoundationPlanLessons",
    "isUsableFoundationAnswer",
    'state: "defined"',
    'state: "observed"',
    'state: "emerging"',
    'state: "missing"',
    "lessonState?.answers[field.id]",
    "lessonState?.proposal?.values[field.id]",
    "referenceFixture",
    "reference-defined",
    "const supported = defined + observed",
    "Math.round((supported / total) * 100)",
  ]) assert.ok(model.includes(contract), `Live Story Coverage is missing: ${contract}`);
  assert.doesNotMatch(model, /completedLessonIds|visualArtifacts|acceptedVisualArtifactIds|lib\/projects/);
});

test("issue #1338/#1410 keeps proposals non-canonical while allowing direct observed reference evidence to count as supported", async () => {
  const model = await source("modules/build/foundations-story-coverage.ts");
  assert.match(model, /A draft proposal exists, but it has not become a saved story decision in the canonical PPF/);
  assert.match(model, /const total = defined \+ observed \+ emerging \+ missing/);
  assert.match(model, /const supported = defined \+ observed/);
  assert.match(model, /percent: total \? Math\.round\(\(supported \/ total\) \* 100\) : 0/);
  assert.doesNotMatch(model, /\(defined \+ emerging\) \/ total/);
  assert.match(model, /Synthetic reference decision · not screenplay evidence/,
    "synthetic fixture decisions must remain visibly distinct from observed source evidence");
});

test("issue #1338/#1410 exposes visible Story Coverage and 24/96 explainability on the live BUILD screen", async () => {
  const [component, css, mapComponent, mapCss, mapModel] = await Promise.all([
    source("modules/build/ui/foundations-story-coverage.tsx"),
    source("modules/build/ui/foundations-story-coverage.module.css"),
    source("modules/build/ui/progressive-story-map.tsx"),
    source("modules/build/ui/progressive-story-map.module.css"),
    source("modules/build/progressive-story-map.ts"),
  ]);
  for (const contract of [
    "Story Coverage",
    "DEFINED",
    "OBSERVED",
    "EMERGING",
    "MISSING",
    "LOCKED",
    'data-story-coverage="live-foundations"',
    "explicit reference-fixture decisions",
    "Directly supported by immutable reference/source evidence",
    "Draft/import proposals awaiting a decision",
    "No usable story support yet",
    "decision.reason",
    "decision.excerpt",
    "decision.sourceLabel",
    "course completion",
    "generated wireframe frames",
    "<ProgressiveStoryMap project={project} />",
  ]) assert.ok(component.includes(contract), `Live BUILD evidence UI is missing: ${contract}`);
  for (const contract of ["panel", "score", "summary", "lessonGrid", "decision", 'data-state="observed"']) {
    assert.ok(css.includes(contract), `Live BUILD Story Coverage styling is missing: ${contract}`);
  }
  for (const colour of ["#35d779", "#3bb8ff", "#f6a93b", "#ff4d6d", "#a875ff"]) {
    assert.ok(css.includes(colour), `Live BUILD shared evidence colour is missing: ${colour}`);
    assert.ok(mapCss.includes(colour), `24/96 shared evidence colour is missing: ${colour}`);
  }
  for (const contract of [
    'data-progressive-story-map="24x96"',
    "24 Blocks / 96 Mini-Blocks",
    "OBSERVED",
    "LOCKED",
    "Not enough information yet",
    "Selected story position",
    "screenplay text is observed evidence",
  ]) assert.ok(mapComponent.includes(contract), `24/96 BUILD UI is missing: ${contract}`);
  assert.match(mapComponent, /className=\{styles\.statusDot\}/);
  assert.doesNotMatch(mapComponent, /<strong>\{STATE_LABELS\[block\.state\]\}<\/strong>/,
    "Living story cards use the colour-coded status light rather than repeating a label.");
  assert.match(mapModel, /Array\.from\(\{ length: 24 \}/);
  assert.match(mapModel, /\["Promise", "Progress", "Pressure", "Payoff"\]/);
  assert.match(mapModel, /analysisStatus === "reviewed"/);
  assert.match(mapModel, /placement remains importer-suggested and requires Human review/);
  assert.match(mapCss, /grid-template-columns:\s*repeat\(3/);
});

test("issue #1357/#1392/#1402 groups the 24 Blocks and keeps the approved side markers", async () => {
  const [mapComponent, mapCss] = await Promise.all([
    source("modules/build/ui/progressive-story-map.tsx"),
    source("modules/build/ui/progressive-story-map.module.css"),
  ]);
  for (const contract of [
    "Array.from({ length: 12 }",
    "block.sequenceNumber === number",
    "STRUCTURAL_MARKERS",
    '3: { badge: "A1 TP"',
    '6: { badge: "A2 TP"',
    '9: { badge: "A3 TP"',
    '12: { badge: "FINALE"',
    'data-sequence={sequence.number}',
    "sequence.marker.meaning",
    "sequenceSlotWithMarker",
    "FINALE",
  ]) assert.ok(mapComponent.includes(contract), `BUILD sequence/turning-point contract is missing: ${contract}`);
  assert.doesNotMatch(mapComponent, /ABSOLUTE_TURNING_POINTS|turningPointSpacer/);
  for (const contract of [".sequenceSlot", ".sequenceSlotWithMarker", ".sequenceBox", ".sequenceBlocks", ".turningPoint"]) {
    assert.ok(mapCss.includes(contract), `BUILD sequence/turning-point styling is missing: ${contract}`);
  }
  assert.match(mapCss, /grid-template-columns:\s*repeat\(3\s*,\s*minmax\(0\s*,\s*1fr\)\)/);
  assert.match(mapCss, /grid-template-columns:\s*repeat\(2\s*,\s*minmax\(0\s*,\s*1fr\)\)/);
  assert.doesNotMatch(mapCss, /\.turningPointSpacer/);
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
