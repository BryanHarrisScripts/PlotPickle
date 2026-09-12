import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildMigrationComparison } from "../scripts/verification-shadow.mjs";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const json = async (path) => JSON.parse(await source(path));

test("issue #1943 gives the provider registry one safe Layer 6 execution owner", async () => {
  const catalog = await json("config/verification/test-catalog.json");
  const entry = catalog.entries.find((candidate) => candidate.id === "provider.local-ai-plugin-registry");
  assert.ok(entry);
  assert.equal(entry.ownerLayer, "provider-runtime");
  assert.equal(entry.runner.kind, "node-test");
  assert.deepEqual(entry.runner.targets, ["tests/local-ai-plugin-registry.test.mjs"]);
  assert.ok(entry.modes.includes("baseline"));
  assert.equal(entry.cost, "fast");
  assert.deepEqual(entry.requirements, { network: false, native: false, secrets: false });
});

test("issue #1943 records the exact legacy executions removed and the duplicate groups still retained", async () => {
  const migration = await json("config/verification/phase-4-migration.json");
  assert.deepEqual(migration.authority.mergeAuthoritative, ["PR Gate", "Product Gate"]);
  assert.equal(migration.authority.shadowWorkflow, "Architecture Shadow Verification");
  assert.equal(migration.migrations.length, 1);

  const moved = migration.migrations[0];
  assert.equal(moved.catalogTestId, "provider.local-ai-plugin-registry");
  assert.equal(moved.ownerLayer, "provider-runtime");
  assert.deepEqual(
    moved.legacyExecutions.map((entry) => [entry.workflow, entry.step, entry.target, entry.action]),
    [
      ["PR Gate", "Validate bundled local video setup", "tests/local-ai-plugin-registry.test.mjs", "remove-target"],
      ["Product Gate", "Validate bundled local video setup", "tests/local-ai-plugin-registry.test.mjs", "remove-target"],
    ],
  );

  const retained = new Map(migration.remainingDuplicateGroups.map((entry) => [entry.id, entry]));
  assert.equal(retained.get("local-video-ltx-contract")?.status, "retained");
  assert.equal(retained.get("security-closeout")?.status, "retained");
});

test("issue #1943 removes only the migrated target from both legacy gates", async () => {
  const [prGate, productGate] = await Promise.all([
    source(".github/workflows/pr-gate.yml"),
    source(".github/workflows/product-gate.yml"),
  ]);

  assert.match(prGate, /^name: PR Gate$/m);
  assert.match(productGate, /^name: Product Gate$/m);
  assert.doesNotMatch(prGate, /tests\/local-ai-plugin-registry\.test\.mjs/u);
  assert.doesNotMatch(productGate, /tests\/local-ai-plugin-registry\.test\.mjs/u);
  assert.match(prGate, /tests\/ltx-bundled-default\.test\.mjs/u);
  assert.match(productGate, /tests\/ltx-bundled-default\.test\.mjs/u);
  assert.match(prGate, /Validate current security closeout/u);
  assert.match(productGate, /Validate current security closeout/u);
});

test("issue #1943 comparison evidence proves replacement only from an actual passing shadow result", async () => {
  const migration = await json("config/verification/phase-4-migration.json");
  const commitSha = "a".repeat(40);
  const pass = buildMigrationComparison({
    migration,
    layerId: "provider-runtime",
    commitSha,
    run: { results: [{ id: "provider.local-ai-plugin-registry", result: "pass" }] },
  });
  assert.equal(pass.commitSha, commitSha);
  assert.equal(pass.migrations[0].proofStatus, "replacement-proven");
  assert.equal(pass.migrations[0].shadowResult, "pass");
  assert.deepEqual(pass.authority.mergeAuthoritative, ["PR Gate", "Product Gate"]);

  const fail = buildMigrationComparison({
    migration,
    layerId: "provider-runtime",
    commitSha,
    run: { results: [{ id: "provider.local-ai-plugin-registry", result: "fail" }] },
  });
  assert.equal(fail.migrations[0].proofStatus, "replacement-failed");

  const missing = buildMigrationComparison({ migration, layerId: "provider-runtime", commitSha, run: { results: [] } });
  assert.equal(missing.migrations[0].proofStatus, "not-selected");
});

test("issue #1943 keeps seven lightweight shadow checks and uploads comparison evidence", async () => {
  const [shadow, prGate] = await Promise.all([
    source(".github/workflows/architecture-shadow.yml"),
    source(".github/workflows/pr-gate.yml"),
  ]);
  assert.equal((shadow.match(/^          - id: /gm) || []).length, 7);
  assert.match(shadow, /\.artifacts\/verification-shadow\/\$\{\{ matrix\.id \}\}\.comparison\.json/u);
  assert.doesNotMatch(shadow, /npm ci/u);
  assert.match(prGate, /tests\/issue-1943-shadow-equivalence\.test\.mjs/u);
});
