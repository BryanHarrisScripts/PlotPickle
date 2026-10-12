import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { checkComposition, checkMigration, validateCompositionAssurance } from "../lib/verification/development/composition-migration.mjs";
const baseline = JSON.parse(await readFile("docs/verification/2939-composition-migration.json", "utf8"));
const catalogue = JSON.parse(await readFile("config/verification/test-catalog.json", "utf8"));
const context = { readSource: file => readFile(file, "utf8"), catalogueTargets: new Set(catalogue.entries.flatMap(entry => entry.runner.targets)) };
const codes = result => result.findings.map(row => row.code);
const composition = () => structuredClone(baseline.compositionExample);
const migration = () => structuredClone(baseline.migrationExample);

test("W8/W9: bounded composition requires each dependency assumption", () => {
  assert.equal(checkComposition(composition()).status, "PASS");
  for (const assumption of baseline.compositionExample.assumptions) {
    const scenario = composition();
    scenario.dependencies[0].capabilities = scenario.dependencies[0].capabilities.filter(value => value !== assumption.capability);
    assert.ok(codes(checkComposition(scenario)).includes("unmet-dependency-assumption"), assumption.dimension);
  }
});
test("T6/W8: local-only device-loss recovery is a concrete counterexample", () => {
  const result = checkComposition(baseline.deviceLossCounterexample);
  assert.equal(result.status, "FAIL");
  assert.match(result.findings[0].detail, /device-loss-recovery/u);
});
test("W8: bounded migration preserves independent expected identities and representations", () => {
  const result = checkMigration(migration());
  assert.equal(result.status, "PASS"); assert.equal(result.productConformance, "UNPROVEN");
  for (const change of [record => { record.id = "wrong-story"; }, record => { record.contentDigest = "sha256:changed"; }, record => { record.owner = "other-profile"; }]) {
    const scenario = migration(); change(scenario.steps[1].records[0]);
    assert.equal(checkMigration(scenario).status, "FAIL");
  }
  const lost = migration(); lost.steps[1].records.pop();
  assert.ok(codes(checkMigration(lost)).includes("lost-data"));
});
test("T1/W9: old/new writers and duplicate real effects cannot pass", () => {
  const scenario = migration(); scenario.steps[1].writers.push("legacy-store"); scenario.steps[1].effects[0].count = 1;
  const result = checkMigration(scenario);
  assert.ok(codes(result).includes("competing-writers")); assert.ok(codes(result).includes("duplicate-real-effect"));
});
test("W9: same retry identity with changed content is rejected even with zero new effects", () => {
  const scenario = migration(); scenario.steps[1].effects[0].contentDigest = "sha256:other";
  assert.ok(codes(checkMigration(scenario)).includes("retry-content-changed"));
});
test("T6/W9: rollback must read migrated schemas or have verified data recovery", () => {
  const scenario = migration(); scenario.steps[1].rollbackReadableSchemas = ["legacy-v1"];
  assert.ok(codes(checkMigration(scenario)).includes("rollback-incompatible"));
  scenario.steps[1].rollbackMode = "snapshot";
  assert.ok(codes(checkMigration(scenario)).includes("unproven-recovery"));
  scenario.steps[1].verifiedRecovery = true;
  assert.equal(checkMigration(scenario).status, "PASS");
});
test("W9: premature retirement retains consumer data and evidence obligations", () => {
  for (const patch of [{ remainingConsumers: ["old-reader"] }, { dataTransferred: false }, { removalEvidence: false }]) {
    const scenario = migration(); Object.assign(scenario.steps[2], patch);
    assert.ok(codes(checkMigration(scenario)).includes("premature-retirement"));
  }
});
test("W8/W9: source-pinned audit covers composition migration and owned gaps", async () => {
  const result = await validateCompositionAssurance(baseline, context);
  assert.equal(result.status, "VALID_ASSURANCE_RECORD", JSON.stringify(result.findings));
  assert.equal(result.correspondence, "PARTIAL"); assert.equal(result.semanticReview, "PENDING"); assert.equal(result.productConformance, "UNPROVEN");
});
test("W9: source drift invalidates assurance", async () => {
  assert.ok(codes(await validateCompositionAssurance(baseline, { ...context, readSource: async file => `${await readFile(file, "utf8")}\n// drift` })).includes("source-drift"));
});
test("W8: component tests cannot promote observed product or Human meaning", async () => {
  for (const patch of [{ correspondence: "PROVEN" }, { semanticReview: "APPROVED" }, { productConformance: "PASS" }]) assert.ok(codes(await validateCompositionAssurance({ ...baseline, ...patch }, context)).includes("invalid-claim-scope"));
});
test("W8/W9: missing dimensions mechanisms gaps sources or integration references fail closed", async () => {
  for (const patch of [{ compositionRows: baseline.compositionRows.slice(1) }, { migrationRows: baseline.migrationRows.slice(1) }, { sources: [] }, { integrationTargets: ["invented"] }, { deviceLossCounterexample: baseline.compositionExample }]) assert.equal((await validateCompositionAssurance({ ...baseline, ...patch }, context)).status, "INVALID_ASSURANCE_RECORD");
  const record = structuredClone(baseline); record.migrationRows[0].gaps = [];
  assert.equal((await validateCompositionAssurance(record, context)).status, "INVALID_ASSURANCE_RECORD");
});
test("W8: malformed bounded scenarios cannot silently pass", () => {
  for (const value of [null, {}, { dependencies: [], assumptions: [] }]) assert.equal(checkComposition(value).status, "FAIL");
  for (const value of [null, {}, { owner: "profile-a", expected: [], steps: [] }]) assert.equal(checkMigration(value).status, "FAIL");
  const scenario = migration(); scenario.steps[0].effects[0].count = -1;
  assert.ok(codes(checkMigration(scenario)).includes("invalid-effect"));
  const duplicate = composition(); duplicate.dependencies.push(duplicate.dependencies[0]);
  assert.ok(codes(checkComposition(duplicate)).includes("invalid-dependency"));
});

test("W9: distinct old/new operation ids cannot duplicate the same logical effect", () => {
  const scenario = migration(); scenario.steps[1].effects[0].operationId = "new-operation"; scenario.steps[1].effects[0].count = 1;
  assert.ok(codes(checkMigration(scenario)).includes("duplicate-real-effect"));
});
