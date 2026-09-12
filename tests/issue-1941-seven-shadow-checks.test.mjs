import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { emitEvidence, planVerification, runLayer } from "../lib/verification/verification-core.mjs";

const root = new URL("..", import.meta.url);
const source = (relative) => readFile(new URL(relative, root), "utf8");
const readJson = async (relative) => JSON.parse(await source(relative));

async function configuration() {
  const [architecture, phase0Inventory, vocabulary, catalog, ownership] = await Promise.all([
    readJson("architecture/plotpickle.architecture.json"),
    readJson("config/verification/phase-0-inventory.json"),
    readJson("config/verification/phase-1-vocabulary.json"),
    readJson("config/verification/test-catalog.json"),
    readJson("config/verification/ownership-map.json"),
  ]);
  return { architecture, phase0Inventory, vocabulary, catalog, ownership };
}

test("issue #1941 exposes exactly the seven approved architecture shadow check names", async () => {
  const [workflow, phase0] = await Promise.all([
    source(".github/workflows/architecture-shadow.yml"),
    readJson("config/verification/phase-0-inventory.json"),
  ]);
  const approved = phase0.displayChecks.map(({ id, name }) => ({ id, name }));
  assert.equal(approved.length, 7);

  const matrixIds = [...workflow.matchAll(/^\s+- id: ([a-z0-9-]+)$/gmu)].map((match) => match[1]);
  assert.deepEqual(matrixIds, approved.map((entry) => entry.id));
  for (const { name } of approved) assert.ok(workflow.includes(`name: ${name}`), `missing visible shadow check name: ${name}`);

  assert.match(workflow, /^name: Architecture Shadow Verification$/m);
  assert.match(workflow, /^    name: \$\{\{ matrix\.name \}\}$/m);
  assert.match(workflow, /fail-fast: false/);
  assert.doesNotMatch(workflow, /^\s+paths(?:-ignore)?:/m, "shadow checks must not disappear behind path filters");
  assert.doesNotMatch(workflow, /continue-on-error:/, "shadow checks should report their real result even though they are not required");
});

test("issue #1941 keeps selection below GitHub Actions and forbids risky shadow permissions", async () => {
  const [workflow, adapter] = await Promise.all([
    source(".github/workflows/architecture-shadow.yml"),
    source("scripts/verification-shadow.mjs"),
  ]);

  assert.match(workflow, /node scripts\/verification-shadow\.mjs/);
  assert.doesNotMatch(workflow, /if:.*matrix\.id.*experience-/i, "YAML must not contain layer-selection business logic");
  assert.doesNotMatch(workflow, /npm ci/, "Phase 3 shadow checks should remain lightweight");

  assert.match(adapter, /planVerification/);
  assert.match(adapter, /runLayer/);
  assert.match(adapter, /emitEvidence/);
  assert.match(adapter, /allowHeavy: false/);
  assert.match(adapter, /allowNetwork: false/);
  assert.match(adapter, /allowNative: false/);
  assert.match(adapter, /allowSecrets: false/);
  assert.match(adapter, /shell: false/);
  assert.match(adapter, /blockingFindings: plan\.blockingFindings/);
  assert.match(adapter, /baseline: "configuration-contracts-validated"/);
});

test("issue #1941 gives unaffected layers baseline evidence instead of hiding them", async () => {
  const config = await configuration();
  const plan = planVerification({ ...config, changedFiles: ["docs/developer-briefs/example.md"], platform: "linux" });
  assert.equal(plan.status, "ready");
  assert.equal(plan.layers.length, 7);

  const layer1 = plan.layers.find((layer) => layer.layerId === "experience-skins");
  const layer7 = plan.layers.find((layer) => layer.layerId === "verification");
  assert.equal(layer1.impacted, false);
  assert.equal(layer7.impacted, true);
  assert.deepEqual(layer7.selectedTests.map((entry) => entry.id), ["verification.phase2-core"]);

  const run = await runLayer({ plan, catalog: config.catalog, layerId: "experience-skins", runners: {} });
  assert.equal(run.result, "not-impacted-beyond-baseline");

  const evidence = emitEvidence({
    plan,
    catalog: config.catalog,
    architecture: config.architecture,
    layerId: "experience-skins",
    commitSha: "a".repeat(40),
    run,
    runtime: { platform: "linux", runner: "github-shadow", nodeVersion: process.version },
    durationMs: 1,
  });
  assert.equal(evidence.commitSha, "a".repeat(40));
  assert.equal(evidence.layerId, "experience-skins");
  assert.equal(evidence.result, "not-impacted-beyond-baseline");
  assert.deepEqual(evidence.selectedTestIds, []);
});

test("issue #1941 executes only the currently catalog-selected safe Layer 7 self-test", async () => {
  const config = await configuration();
  const plan = planVerification({ ...config, changedFiles: ["scripts/verification-shadow.mjs"], platform: "linux" });
  const layer7 = plan.layers.find((layer) => layer.layerId === "verification");
  assert.equal(layer7.impacted, true);
  assert.deepEqual(layer7.selectedTests.map((entry) => entry.id), ["verification.phase2-core"]);

  const run = await runLayer({
    plan,
    catalog: config.catalog,
    layerId: "verification",
    runners: {
      "node-test": async () => ({ result: "pass", durationMs: 2, artifacts: [], security: {} }),
    },
  });
  assert.equal(run.result, "pass");

  const evidence = emitEvidence({
    plan,
    catalog: config.catalog,
    architecture: config.architecture,
    layerId: "verification",
    commitSha: "b".repeat(40),
    run,
    runtime: { platform: "linux", runner: "github-shadow", nodeVersion: process.version },
    durationMs: 2,
  });
  assert.deepEqual(evidence.selectedTestIds, ["verification.phase2-core"]);
  assert.equal(evidence.result, "pass");
  assert.equal(evidence.security.networkUsed, false);
  assert.equal(evidence.security.nativeUsed, false);
  assert.equal(evidence.security.secretsAccessed, false);
});

test("issue #1941 keeps unknown production ownership fail-closed and visible", async () => {
  const [config, adapter] = await Promise.all([configuration(), source("scripts/verification-shadow.mjs")]);
  const plan = planVerification({ ...config, changedFiles: ["app/unregistered-phase3-example.mjs"], platform: "linux" });
  assert.equal(plan.status, "blocked");
  assert.deepEqual(plan.blockingFindings, [{
    path: "app/unregistered-phase3-example.mjs",
    evidenceCode: "unmapped-production-ownership",
    reason: "production ownership is unmapped",
  }]);
  assert.match(adapter, /if \(plan\.status === "blocked"\)/);
  assert.match(adapter, /process\.exitCode = 3/);
  assert.match(adapter, /\.summary\.json/);
});

test("issue #1941 leaves PR Gate and Product Gate authoritative during shadow observation", async () => {
  const [prGate, productGate, shadow] = await Promise.all([
    source(".github/workflows/pr-gate.yml"),
    source(".github/workflows/product-gate.yml"),
    source(".github/workflows/architecture-shadow.yml"),
  ]);
  assert.match(prGate, /^name: PR Gate$/m);
  assert.match(prGate, /^    name: PR Gate$/m);
  assert.match(productGate, /^name: Product Gate$/m);
  assert.match(productGate, /^    name: Product Gate$/m);
  assert.match(shadow, /^name: Architecture Shadow Verification$/m);
  assert.doesNotMatch(shadow, /^    name: PR Gate$/m);
  assert.doesNotMatch(shadow, /^    name: Product Gate$/m);
});
