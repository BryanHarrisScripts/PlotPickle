import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { verifyStoryToScreenAcceptance } from "../lib/verification/story-to-screen-acceptance.mjs";

const root = new URL("../", import.meta.url);
const read = (relative) => readFile(new URL(relative, root), "utf8");

async function manifest() {
  return JSON.parse(await read("config/verification/afterglow-story-to-screen-uat.json"));
}

test("#2174 Afterglow Block 17.1 passes the deterministic story-to-screen contract chain offline", async () => {
  const report = await verifyStoryToScreenAcceptance(new URL("..", import.meta.url).pathname, await manifest());

  assert.equal(report.passed, true, JSON.stringify(report, null, 2));
  assert.equal(report.fixture.blockNumber, 17);
  assert.equal(report.fixture.miniBlockNumber, 1);
  assert.equal(report.fixture.blockTitle, "Waves of Connections");
  assert.equal(report.fixture.anchorRef, "storyboard-anchor:block:block-17:mini-1");
  assert.deepEqual(report.fixtureIdentityErrors, []);
  assert.equal(report.fixtureProofs.every((item) => item.passed), true);
  assert.equal(report.stages.every((item) => item.passed), true);
  assert.equal(report.ordinaryCi.cloudSpendAllowed, false);
  assert.equal(report.ordinaryCi.providerGenerationExecuted, false);
  assert.equal(report.ordinaryCi.subjectiveQualityJudgment, false);
});

test("#2174 reports the exact stage and missing evidence instead of patching a truthful gap with filler", async () => {
  const input = await manifest();
  const broken = structuredClone(input);
  broken.ciStages = broken.ciStages.map((stage) => stage.id === "production"
    ? { ...stage, requiredTerms: [...stage.requiredTerms, "THIS_TERM_DOES_NOT_EXIST"] }
    : stage);

  const report = await verifyStoryToScreenAcceptance(new URL("..", import.meta.url).pathname, broken);
  assert.equal(report.passed, false);
  const production = report.stages.find((stage) => stage.id === "production");
  assert.ok(production);
  assert.equal(production.passed, false);
  assert.deepEqual(production.missingTerms, ["THIS_TERM_DOES_NOT_EXIST"]);
  assert.equal(report.stages.find((stage) => stage.id === "storyboard")?.passed, true);
});

test("#2174 Human/WebMCP UAT manifest preserves Block 17.1 through every current stage", async () => {
  const input = await manifest();
  const report = await verifyStoryToScreenAcceptance(new URL("..", import.meta.url).pathname, input);

  assert.equal(report.humanUat.passed, true, report.humanUat.errors.join("\n"));
  assert.deepEqual(report.humanUat.stages.map((stage) => stage.id), [
    "story-cards",
    "write",
    "outline",
    "storyboard",
    "previs",
    "scene-workspace",
    "production",
  ]);
  for (const stage of report.humanUat.stages) {
    assert.match(stage.route, /block=17/u);
    assert.match(stage.route, /mini=1/u);
    assert.ok(stage.selector);
  }
});

test("#2174 full 24/96 fixture coverage remains reportable without claiming v9 was authored as 24 source Blocks", async () => {
  const [fixture, source] = await Promise.all([
    read("modules/library/reference/afterglow-golden-story-fixture.ts"),
    read("tests/issue-2168-afterglow-golden-story-fixture.test.mjs"),
  ]);

  assert.match(fixture, /canonicalGrid: "24x96"/u);
  assert.match(fixture, /project\.blocks\.length !== 24/u);
  assert.match(fixture, /sections\.length !== 20/u);
  assert.match(fixture, /authoredBlockCount: "not-asserted"/u);
  assert.match(fixture, /page-progress-fallback/u);
  assert.match(source, /96 Mini-Block cells/u);
});

test("#2174 keeps provider-backed generation and creative-quality judgment outside ordinary CI", async () => {
  const [acceptance, production, execution, manifestText] = await Promise.all([
    read("lib/verification/story-to-screen-acceptance.mjs"),
    read("lib/preproduction/production-convergence.ts"),
    read("lib/preproduction/provider-instruction-execution.ts"),
    read("config/verification/afterglow-story-to-screen-uat.json"),
  ]);

  assert.match(acceptance, /providerGenerationExecuted: false/u);
  assert.match(acceptance, /subjectiveQualityJudgment: false/u);
  assert.match(production, /never chooses a\n \* provider or runtime/u);
  assert.match(execution, /does not read or change routing, call a provider\/model/u);
  assert.doesNotMatch(acceptance, /fetch\(|generateVideo|generateImage|providerRequest|spend/u);
  assert.match(manifestText, /explicitly authorized UAT\/Responsibility Run/u);
});

test("#2174 reuses revision propagation and reports affected versus preserved work", async () => {
  const source = await read("lib/preproduction/creative-revision-propagation.ts");
  for (const contract of [
    "staleAcceptedVisualArtifactIds",
    "staleProductionShotIds",
    "unaffectedAcceptedVisualArtifactIds",
    "unaffectedProductionShotIds",
    "requiresRegeneration: false",
  ]) assert.ok(source.includes(contract), `Missing #2172 acceptance contract: ${contract}`);
});
