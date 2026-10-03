import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, extname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Use the real TS contracts without substituting project normalization or validation.
const root = fileURLToPath(new URL("..", import.meta.url));
const modules = new Map();
async function moduleUrl(path) {
  const absolute = resolve(path);
  if (modules.has(absolute)) return modules.get(absolute);
  let source = extname(absolute) === ".json" ? `export default ${readFileSync(absolute, "utf8")};` : stripTypeScriptTypes(readFileSync(absolute, "utf8"));
  for (const match of [...source.matchAll(/from\s*["'](\.[^"']+)["']/gu)]) {
    const requested = resolve(dirname(absolute), match[1]);
    const target = [requested, `${requested}.ts`, `${requested}.json`, resolve(requested, "index.ts")].find((candidate) => existsSync(candidate) && /\.(ts|json)$/u.test(candidate));
    assert.ok(target, `Missing contract import ${match[1]}`);
    source = source.replace(match[0], `from "${await moduleUrl(target)}"`);
  }
  const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  modules.set(absolute, url);
  return url;
}
const { normalizeLibraryProject } = await import(await moduleUrl(resolve(root, "core/storage/library-project.ts")));
const { buildOutlineAgentAssessmentRequest, outlineAssessmentMaterialReceipt, outlineAssessmentFingerprint, validateOutlineAgentAssessment } = await import(await moduleUrl(resolve(root, "modules/plan/outline-agent-assessment.ts")));

function fixture() {
  const project = normalizeLibraryProject({ id: "synthetic-durable-project", title: "Synthetic Outline", revision: 4 });
  return { ...project, sourceEvidence: { ...project.sourceEvidence, screenplay: {
    sourceId: "fixture", analysisStatus: "reviewed", passagesTruncated: false,
    passages: Array.from({ length: 10 }, (_, index) => ({ id: `p-${index}`, blockNumber: 1, miniBlockNumber: 1, type: "action", sceneNumber: 1, text: `Synthetic passage ${index}.` })),
  } } };
}

test("durable material receipt tolerates only assessment history and top-level revision bookkeeping", async () => {
  const project = fixture();
  const receipt = await outlineAssessmentMaterialReceipt(project);
  assert.match(receipt, /^outline-material:v1:[a-f\d]{64}$/u);
  const saved = { ...project, revision: 8, updatedAt: "later", sourceEvidence: { ...project.sourceEvidence, outlineAssessments: [{ synthetic: true }], outlineAssessmentRuns: [{ synthetic: true }] } };
  assert.equal(await outlineAssessmentMaterialReceipt(saved), receipt);
  assert.equal(outlineAssessmentFingerprint(saved, 1), outlineAssessmentFingerprint(project, 1));
  assert.doesNotMatch(receipt, /Synthetic|passage/u);
});

test("source, planning, character and project edits invalidate material even outside the bounded sample", async () => {
  const project = fixture();
  const receipt = await outlineAssessmentMaterialReceipt(project);
  const clone = () => structuredClone(project);
  const changes = [
    (p) => { p.id = "another-project"; },
    (p) => { p.title = "New title"; },
    (p) => { p.structure.blocks[0].note = "Writer revised the plan."; },
    (p) => { p.sourceEvidence.screenplay.passages[4].text = "Changed unsampled source."; },
    (p) => { p.sourceEvidence.screenplay.passagesTruncated = true; },
    (p) => { p.sourceEvidence.characterTruth = { schemaVersion: 1, fixtureId: "synthetic", sources: [], claims: [], principalCharacterIds: ["character-1"], arcCells: [], checkpoints: [], governingRule: "Synthetic changed character input." }; },
    (p) => { p.writing.entries = [{ id: "write:block-01:mini-1", blockNumber: 1, miniBlockNumber: 1, text: "Writer changed the script.", updatedAt: "now" }]; },
  ];
  for (const change of changes) {
    const changed = clone(); change(changed);
    assert.notEqual(await outlineAssessmentMaterialReceipt(changed), receipt);
  }
});

test("material identity survives JSON persistence and property order changes", async () => {
  const project = fixture();
  const reordered = JSON.parse(JSON.stringify(project), (_key, value) => value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).reverse()) : value);
  assert.equal(await outlineAssessmentMaterialReceipt(reordered), await outlineAssessmentMaterialReceipt(project));
});

test("shared request stays bounded and contains only the existing Story Architect worker contract", () => {
  const project = fixture();
  const request = buildOutlineAgentAssessmentRequest(project, 1);
  assert.equal(request.agentId, "story-architect");
  assert.equal(request.modelRole, "quality");
  const context = JSON.parse(request.message.split("\n\n").at(-1));
  assert.equal(context.passages.length, 6);
  assert.equal(context.sampleIncomplete, true);
  assert.equal(context.passages.some((p) => p.id === "p-4"), false);
  assert.equal(context.miniBlocks.length, 4);
  assert.throws(() => buildOutlineAgentAssessmentRequest(project, 25), /valid Story Block/u);
});

test("canonical validation still rejects citations omitted from supplied bounded context", () => {
  const project = fixture();
  const output = {
    structural: { state: "covered", reason: "Synthetic assessment references a causal change.", passageIds: ["p-4"] },
    characters: [], miniBlocks: [],
  };
  assert.throws(() => validateOutlineAgentAssessment(JSON.stringify(output), project, 1, "fixture", "now"), /outside this Block/u);
});
