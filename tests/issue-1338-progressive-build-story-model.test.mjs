import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #1338 keeps story evidence separate from production readiness", async () => {
  const model = await source("modules/build/build-workspace-model.ts");
  assert.match(model, /export type BuildBlockStatus = "empty" \| "developing" \| "ready" \| "locked"/);
  assert.match(model, /export type BuildEvidenceStatus = "defined" \| "observed" \| "emerging" \| "missing" \| "locked"/);
  assert.match(model, /evidence: BuildEvidenceSummary/);
  assert.match(model, /status: buildStatus\(block\)/);
  assert.match(model, /const evidence = deriveBuildEvidence\(project, block\)/);
});

test("issue #1338 classifies direct imported screenplay passages as Observed", async () => {
  const model = await source("modules/build/build-workspace-model.ts");
  for (const contract of [
    "project.screenplay.draftElements.filter",
    "element.blockNumber === block.number",
    'status = "observed"',
    "directEvidenceCount: directEvidence.length",
    "sourceIds:",
    "sources,",
  ]) assert.ok(model.includes(contract), `Missing direct import evidence contract: ${contract}`);
  assert.match(model, /reviewStatus === "suggested"[\s\S]*structural interpretation remains a reviewable import suggestion/);
});

test("issue #1338 keeps importer interpretation Emerging until reviewed", async () => {
  const model = await source("modules/build/build-workspace-model.ts");
  assert.match(model, /reviewStatus === "suggested" && \(hasImportedGuidance \|\| hasUsableSupport\)/);
  assert.match(model, /status = "emerging"/);
  assert.match(model, /Review it before treating the interpretation as canon/);
  assert.match(model, /reviewStatus === "reviewed"[\s\S]*reviewed and this Block now has usable canonical support/);
  assert.match(model, /status = "defined"/);
});

test("issue #1338 leaves placeholder-only and unsupported material Missing", async () => {
  const model = await source("modules/build/build-workspace-model.ts");
  for (const prompt of ["suggested", "review", "identify", "confirm", "record", "define", "state", "compare", "collect", "locate", "track", "add", "select", "build"]) {
    assert.ok(model.toLowerCase().includes(prompt), `Placeholder guidance detector is missing ${prompt}`);
  }
  assert.match(model, /let status: BuildEvidenceStatus = "missing"/);
  assert.match(model, /No usable canonical Block decision or direct screenplay evidence/);
  assert.doesNotMatch(model, /status = "locked"/);
});

test("issue #1338 derives Story Coverage from deterministic BUILD requirements rather than lesson count", async () => {
  const model = await source("modules/build/build-workspace-model.ts");
  for (const requirement of [
    "Dramatic purpose",
    "Conflict",
    "Choice",
    "Visible action",
    "Consequence",
    "Emotional turn",
    "Setup",
    "Payoff",
    "Character linkage",
    "Location linkage",
    "Source or summary support",
  ]) assert.ok(model.includes(requirement), `Story coverage requirement missing: ${requirement}`);
  assert.match(model, /supportedRequirements \/ expectedRequirements/);
  assert.match(model, /percent: expectedRequirements \? Math\.round/);
  assert.doesNotMatch(model, /completedLessonIds|lessonCount|lessons\.length/);
});

test("issue #1338 exposes Story Coverage and evidence explainability in the 24-Block BUILD map", async () => {
  const [map, css] = await Promise.all([
    source("app/build-health-map.tsx"),
    source("app/build-health-map.module.css"),
  ]);
  for (const contract of [
    "Story Coverage",
    "Defined",
    "Observed",
    "Emerging",
    "Missing",
    "Why Block",
    "Direct screenplay passages",
    "Import review",
    "Show source evidence",
    "Still underdeveloped",
    "Readiness colours show production development only",
  ]) assert.ok(map.includes(contract), `BUILD evidence UI missing: ${contract}`);
  assert.match(map, /selectedCard\.evidence\.reason/);
  assert.match(map, /selectedCard\.evidence\.sources/);
  assert.match(map, /selectedCard\.evidence\.missingRequirementLabels/);
  assert.ok(css.includes("evidencePanel"));
  assert.ok(css.includes("coverageMetric"));
  assert.ok(css.includes("evidenceBadge"));
});

test("issue #1338 preserves screenplay evidence across Final Draft project to PPF exchange", async () => {
  const [importer, folder, exchange] = await Promise.all([
    source("lib/projects/screenplay/screenplay-import.ts"),
    source("lib/projects/persistence/project-folder.ts"),
    source("lib/projects/canon/ppf-exchange.ts"),
  ]);
  assert.match(importer, /export function createProjectFromScreenplay/);
  assert.match(importer, /analysisStatus: "suggested"/);
  assert.match(importer, /const draftElements = createDraftElements/);
  assert.match(importer, /screenplay: \{ \.\.\.document, draftElements \}/);
  assert.doesNotMatch(importer, /completedLessonIds/);
  assert.match(folder, /"screenplay\/module\.json": project\.screenplay/);
  assert.match(folder, /screenplay: files\["screenplay\/module\.json"\]/);
  assert.match(exchange, /createProjectFolder\(project/);
  assert.match(exchange, /parseProjectFolder\(files\)/);
});

test("issue #1338 documents PPF authority, graph boundary, and bounded Pi review", async () => {
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
