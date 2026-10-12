import { assuranceDigest } from "./safety-progress.mjs";

const present = value => typeof value === "string" && value.trim().length > 0;
const dimensions = ["identity", "ordering", "permissions", "retries", "storage-recovery"];
const migrationDimensions = ["identity", "representation", "ownership", "recovery", "rollback", "effects", "retirement"];
const safePath = value => present(value) && !/[:\\\u0000\r\n]/u.test(value) && !value.startsWith("/") && value.split("/").every(part => part && part !== "." && part !== "..");
const result = findings => ({ status: findings.length ? "FAIL" : "PASS", findings, scope: "BOUNDED_FIXTURE_ONLY", productConformance: "UNPROVEN" });

// Set inclusion is a necessary composition condition, not a proof that a
// dependency really supplies its declared capabilities in the running product.
export function checkComposition(scenario) {
  const findings = [];
  const fail = (code, detail) => findings.push({ code, detail });
  if (!Array.isArray(scenario?.dependencies) || !scenario.dependencies.length || scenario.dependencies.length > 32 || !Array.isArray(scenario?.assumptions) || !scenario.assumptions.length || scenario.assumptions.length > 128) return result([{ code: "invalid-composition", detail: "Explicit bounded dependencies and assumptions required." }]);
  const dependencies = new Map();
  for (const row of scenario.dependencies) {
    if (!present(row?.id) || dependencies.has(row.id) || !Array.isArray(row.capabilities) || !row.capabilities.every(present)) fail("invalid-dependency", row?.id);
    else dependencies.set(row.id, new Set(row.capabilities));
  }
  const ids = new Set();
  for (const row of scenario.assumptions) {
    if (!present(row?.id) || ids.has(row.id) || !dimensions.includes(row.dimension) || !present(row.dependency) || !present(row.capability)) { fail("invalid-assumption", row?.id); continue; }
    ids.add(row.id);
    if (!dependencies.get(row.dependency)?.has(row.capability)) fail("unmet-dependency-assumption", `${row.id}: ${row.dependency} does not supply ${row.capability}`);
  }
  return result(findings);
}

// Independently supplied expected logical identities/content are compared
// with every migration snapshot. Representation labels cannot redefine data.
export function checkMigration(scenario) {
  const findings = [], fail = (code, step, detail) => findings.push({ code, step, detail });
  if (!Array.isArray(scenario?.expected) || !scenario.expected.length || scenario.expected.length > 128 || !Array.isArray(scenario?.steps) || !scenario.steps.length || scenario.steps.length > 128 || !present(scenario.owner)) return result([{ code: "invalid-migration", detail: "Bounded expected data, owner and migration snapshots required." }]);
  const expected = new Map();
  for (const row of scenario.expected) {
    if (!present(row?.id) || expected.has(row.id) || !present(row.contentDigest)) fail("invalid-expected-data", null, row?.id);
    else expected.set(row.id, row.contentDigest);
  }
  const operations = new Map(), effects = new Map(), stepIds = new Set();
  for (const step of scenario.steps) {
    if (!present(step.id) || stepIds.has(step.id) || !Array.isArray(step.records) || !Array.isArray(step.writers) || !Array.isArray(step.effects) || typeof step.retired !== "boolean" || !Array.isArray(step.remainingConsumers) || typeof step.dataTransferred !== "boolean" || typeof step.removalEvidence !== "boolean" || !present(step.rollbackMode) || !Array.isArray(step.rollbackReadableSchemas) || typeof step.verifiedRecovery !== "boolean") { fail("invalid-step", step?.id, "Typed migration state required."); continue; }
    stepIds.add(step.id);
    if (step.writers.length !== 1 || !present(step.writers[0])) fail("competing-writers", step.id, "Exactly one write authority required in this migration model.");
    const seen = new Set();
    for (const row of step.records) {
      if (!present(row?.id) || seen.has(row.id) || !expected.has(row.id)) fail("data-identity", step.id, row?.id);
      seen.add(row?.id);
      if (expected.get(row?.id) !== row?.contentDigest || !present(row?.schema)) fail("data-representation", step.id, row?.id);
      if (row?.owner !== scenario.owner) fail("ownership-transfer", step.id, row?.id);
      if (step.rollbackMode === "code" && !step.rollbackReadableSchemas.includes(row?.schema)) fail("rollback-incompatible", step.id, row?.schema);
    }
    for (const id of expected.keys()) if (!seen.has(id)) fail("lost-data", step.id, id);
    if (!["code", "snapshot"].includes(step.rollbackMode) || (step.rollbackMode === "snapshot" && !step.verifiedRecovery)) fail("unproven-recovery", step.id, "Code rollback or verified data recovery required.");
    // Effects are incremental observations, not cumulative totals. A resumed
    // operation may be recorded again only as a zero-effect reconciliation.
    for (const effect of step.effects) {
      if (!present(effect?.effectId) || !present(effect?.operationId) || !present(effect?.contentDigest) || !Number.isInteger(effect?.count) || effect.count < 0) { fail("invalid-effect", step.id, "Explicit operation identity/content/count required."); continue; }
      const old = operations.get(effect.operationId);
      if (old && old.contentDigest !== effect.contentDigest) fail("retry-content-changed", step.id, effect.operationId);
      const count = (old?.count || 0) + effect.count;
      const effectiveCount = (effects.get(effect.effectId) || 0) + effect.count;
      if (count > 1 || effectiveCount > 1) fail("duplicate-real-effect", step.id, effect.effectId);
      effects.set(effect.effectId, effectiveCount);
      operations.set(effect.operationId, { contentDigest: effect.contentDigest, count });
    }
    if (step.retired && (step.remainingConsumers.length || !step.dataTransferred || !step.removalEvidence)) fail("premature-retirement", step.id, "Consumers, data and removal evidence must transfer before retirement.");
  }
  return result(findings);
}

export async function validateCompositionAssurance(record, { readSource, catalogueTargets }) {
  const findings = [], fail = (code, detail) => findings.push({ code, detail });
  if (record?.schemaVersion !== 1 || record?.issue !== 2939 || record?.correspondence !== "PARTIAL" || record?.productConformance !== "UNPROVEN" || record?.semanticReview !== "PENDING" || record?.finalConfirmationIssue !== 2943) fail("invalid-claim-scope", "Inventory integrity does not establish product or Human acceptance.");
  const sources = new Set();
  for (const row of record?.sources || []) {
    if (!present(row?.id) || sources.has(row.id) || !safePath(row.path) || !/^[a-f0-9]{64}$/u.test(row.digest)) { fail("invalid-source", row?.id); continue; }
    sources.add(row.id);
    try { if (assuranceDigest(await readSource(row.path)) !== row.digest) fail("source-drift", row.id); }
    catch { fail("missing-source", row.id); }
  }
  for (const id of ["white-paper", "save-contract", "profile-write", "revision-save", "migration-store", "migration-gateway", "bridge-register"]) if (!sources.has(id)) fail("missing-required-source", id);
  function inventory(rows, required, kind) {
    const ids = new Set(), covered = new Set();
    for (const row of rows || []) {
      if (!present(row?.id) || ids.has(row.id) || !required.includes(row.dimension) || !present(row.assumption) || !present(row.mechanism) || !Array.isArray(row.sourceIds) || !row.sourceIds.length || row.sourceIds.some(id => !sources.has(id)) || row.status !== "PARTIAL" || !Array.isArray(row.gaps) || !row.gaps.length || !row.gaps.every(present) || row.confirmationIssue !== 2943) fail("invalid-inventory-row", row?.id);
      ids.add(row?.id); covered.add(row?.dimension);
    }
    for (const dimension of required) if (!covered.has(dimension)) fail(`missing-${kind}-dimension`, dimension);
  }
  inventory(record?.compositionRows, dimensions, "composition");
  inventory(record?.migrationRows, migrationDimensions, "migration");
  if (checkComposition(record?.compositionExample).status !== "PASS") fail("invalid-composition-example", "The bounded baseline must satisfy its explicit assumptions.");
  if (checkMigration(record?.migrationExample).status !== "PASS") fail("invalid-migration-example", "The bounded baseline must preserve its independent expected data.");
  const counterexample = checkComposition(record?.deviceLossCounterexample);
  if (!counterexample.findings.some(row => row.code === "unmet-dependency-assumption" && row.detail.includes("device-loss-recovery"))) fail("missing-device-loss-counterexample", "Local persistence cannot supply recovery after device loss.");
  if (!Array.isArray(record?.integrationTargets) || !record.integrationTargets.length || record.integrationTargets.some(target => !catalogueTargets.has(target))) fail("missing-integration-reference", "Reuse registered proofs without promoting their meaning.");
  return { status: findings.length ? "INVALID_ASSURANCE_RECORD" : "VALID_ASSURANCE_RECORD", findings, correspondence: "PARTIAL", semanticReview: "PENDING", productConformance: "UNPROVEN", finalConfirmationIssue: 2943, deviceLossCounterexample: counterexample };
}
