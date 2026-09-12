import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  evaluateOwnershipDecision,
  translatePhase0Entry,
  validateCatalogDocument,
  validateCatalogEntry,
  validateDisplayChecks,
  validateEvidenceRecord,
  validateOwnershipMap,
  validateVocabulary,
} from "../lib/verification/verification-contracts.mjs";

const root = process.cwd();
const readJson = async (relative) => JSON.parse(await readFile(path.join(root, relative), "utf8"));

const loadContracts = async () => {
  const [architecture, phase0Inventory, vocabulary, catalog, ownership] = await Promise.all([
    readJson("architecture/plotpickle.architecture.json"),
    readJson("config/verification/phase-0-inventory.json"),
    readJson("config/verification/phase-1-vocabulary.json"),
    readJson("config/verification/test-catalog.json"),
    readJson("config/verification/ownership-map.json"),
  ]);
  return { architecture, phase0Inventory, vocabulary, catalog, ownership };
};

const expectedCheckNames = [
  "Layer 1 Experience Skins",
  "Layer 2 Experience Contract",
  "Layer 3 Production Orchestration",
  "Layer 4 Agent & Skill Mesh",
  "Layer 5 Story / Canon / Evidence",
  "Layer 6 Provider Runtime",
  "Layer 7 Validation & Operations",
];

test("#1926 keeps one seven-layer display-check source aligned with the canonical architecture", async () => {
  const { architecture, phase0Inventory, vocabulary, catalog, ownership } = await loadContracts();
  assert.deepEqual(validateDisplayChecks({ architecture, phase0Inventory }), []);
  assert.deepEqual(validateVocabulary({ architecture, phase0Inventory, vocabulary }), []);
  assert.deepEqual(phase0Inventory.displayChecks.map((check) => check.name), expectedCheckNames);
  assert.deepEqual(
    phase0Inventory.displayChecks.map((check) => check.id),
    architecture.layers.map((layer) => layer.id),
  );
  assert.equal(vocabulary.displayChecksSource, "config/verification/phase-0-inventory.json#displayChecks");

  const secondaryConfiguration = `${JSON.stringify(vocabulary)}\n${JSON.stringify(catalog)}\n${JSON.stringify(ownership)}`;
  for (const name of expectedCheckNames) assert.equal(secondaryConfiguration.includes(name), false, `${name} must not be duplicated in Phase 1 configuration`);
});

test("#1926 catalog validator accepts typed runners and rejects duplicate IDs, unknown layers, and arbitrary shell", async () => {
  const { architecture, vocabulary, catalog } = await loadContracts();
  assert.deepEqual(validateCatalogDocument({ catalog, architecture, vocabulary }), []);

  const validEntry = {
    id: "layer1.skin-contract",
    ownerLayer: "experience-skins",
    architectureComponents: ["Skin V1"],
    triggerTokens: ["skin", "visual"],
    runner: { kind: "node-test", targets: ["tests/example.test.mjs"] },
    cost: "fast",
    modes: ["baseline", "impact"],
    platforms: ["linux"],
    requirements: { network: false, native: false, secrets: false },
    evidence: { types: ["test-result"], artifactPaths: [] },
  };
  assert.deepEqual(validateCatalogEntry(validEntry, { architecture, vocabulary }), []);

  const duplicateCatalog = { ...catalog, entries: [validEntry, { ...validEntry }] };
  assert.match(validateCatalogDocument({ catalog: duplicateCatalog, architecture, vocabulary }).join("\n"), /duplicate catalog id/u);

  const unknownLayer = { ...validEntry, ownerLayer: "made-up-layer" };
  assert.match(validateCatalogEntry(unknownLayer, { architecture, vocabulary }).join("\n"), /unknown owner layer/u);

  const invalidRunner = { ...validEntry, runner: { kind: "remote-shell", targets: ["tests/example.test.mjs"] } };
  assert.match(validateCatalogEntry(invalidRunner, { architecture, vocabulary }).join("\n"), /invalid runner kind/u);

  const shellText = { ...validEntry, runner: { kind: "node-test", targets: ["node test; curl example.invalid"] } };
  assert.match(validateCatalogEntry(shellText, { architecture, vocabulary }).join("\n"), /looks like shell text/u);
});

test("#1926 translates every Phase 0 inventory entry into the typed catalog contract without moving execution", async () => {
  const { architecture, phase0Inventory, vocabulary } = await loadContracts();
  assert.ok(phase0Inventory.entries.length > 0, "Phase 0 must provide measured inventory entries");

  for (const legacyEntry of phase0Inventory.entries) {
    const translated = translatePhase0Entry(legacyEntry, vocabulary);
    assert.equal(translated.runner.kind, "legacy-workflow-step");
    assert.deepEqual(validateCatalogEntry(translated, { architecture, vocabulary }), [], `Phase 0 entry ${legacyEntry.id} must be translatable`);
  }
});

test("#1926 ownership contract fails closed when production ownership is unmapped", async () => {
  const { architecture, vocabulary, ownership } = await loadContracts();
  assert.deepEqual(validateOwnershipMap({ ownership, architecture, vocabulary }), []);

  const decision = evaluateOwnershipDecision({
    classification: "production",
    matchedRuleIds: [],
    ownership,
  });
  assert.deepEqual(decision, {
    status: "blocked",
    policy: "fail-closed",
    evidenceCode: "unmapped-production-ownership",
  });

  const unsafeOwnership = {
    ...ownership,
    unknownProduction: { ...ownership.unknownProduction, policy: "ignore" },
  };
  assert.match(validateOwnershipMap({ ownership: unsafeOwnership, architecture, vocabulary }).join("\n"), /must fail closed/u);
});

test("#1926 normalized evidence validates exact-head layer results and rejects unknown layers", async () => {
  const { architecture } = await loadContracts();
  const validEvidence = {
    schemaVersion: "1.0",
    commitSha: "a".repeat(40),
    layerId: "verification",
    architectureComponents: ["verification-contracts"],
    triggerReasons: [{ kind: "changed-file", value: "config/verification/test-catalog.json" }],
    selectedTestIds: ["verification.phase1-contracts"],
    skippedTests: [],
    runtime: { platform: "linux", runner: "github-actions", nodeVersion: "22.13.0" },
    result: "pass",
    durationMs: 12,
    artifacts: [{ kind: "report", path: ".artifacts/verification/layer-7.json" }],
    security: { networkUsed: false, nativeUsed: false, secretsAccessed: false },
  };
  assert.deepEqual(validateEvidenceRecord({ evidence: validEvidence, architecture }), []);

  assert.match(
    validateEvidenceRecord({ evidence: { ...validEvidence, layerId: "unknown-layer" }, architecture }).join("\n"),
    /unknown layer id/u,
  );
  assert.match(
    validateEvidenceRecord({ evidence: { ...validEvidence, commitSha: "abc" }, architecture }).join("\n"),
    /exact 40-character SHA/u,
  );
});

test("#1926 schemas are closed JSON Schema 2020-12 contracts with required safety metadata", async () => {
  const [catalogSchema, ownershipSchema, evidenceSchema] = await Promise.all([
    readJson("schema/verification/test-catalog.schema.json"),
    readJson("schema/verification/ownership.schema.json"),
    readJson("schema/verification/evidence.schema.json"),
  ]);

  for (const schema of [catalogSchema, ownershipSchema, evidenceSchema]) {
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.equal(schema.additionalProperties, false);
  }

  assert.deepEqual(catalogSchema.$defs.catalogEntry.properties.requirements.required, ["network", "native", "secrets"]);
  assert.equal(ownershipSchema.properties.unknownProduction.properties.policy.const, "fail-closed");
  assert.ok(evidenceSchema.required.includes("security"));
  assert.ok(evidenceSchema.required.includes("commitSha"));

  const evidenceText = JSON.stringify(evidenceSchema);
  assert.doesNotMatch(evidenceText, /storyText|prompt|credentialValue|reasoning/iu);
});
