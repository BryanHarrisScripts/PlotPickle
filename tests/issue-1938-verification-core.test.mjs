import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  VerificationConfigurationError,
  emitEvidence,
  explainPlan,
  pathMatches,
  planVerification,
  resolveChangedFile,
  runLayer,
} from "../lib/verification/verification-core.mjs";

const root = process.cwd();
const readJson = async (relative) => JSON.parse(await readFile(path.join(root, relative), "utf8"));
const read = (relative) => readFile(path.join(root, relative), "utf8");

async function loadLiveConfiguration() {
  const [architecture, phase0Inventory, vocabulary, catalog, ownership] = await Promise.all([
    readJson("architecture/plotpickle.architecture.json"),
    readJson("config/verification/phase-0-inventory.json"),
    readJson("config/verification/phase-1-vocabulary.json"),
    readJson("config/verification/test-catalog.json"),
    readJson("config/verification/ownership-map.json"),
  ]);
  return { architecture, phase0Inventory, vocabulary, catalog, ownership };
}

function entry({ id, ownerLayer, triggerTokens, modes = ["impact"], cost = "fast", requirements = {} }) {
  return {
    id,
    ownerLayer,
    architectureComponents: [ownerLayer],
    triggerTokens,
    runner: { kind: "node-test", targets: [`tests/${id}.test.mjs`] },
    cost,
    modes,
    platforms: ["any"],
    requirements: {
      network: Boolean(requirements.network),
      native: Boolean(requirements.native),
      secrets: Boolean(requirements.secrets),
    },
    evidence: { types: ["test-result"], artifactPaths: [] },
  };
}

async function syntheticConfiguration() {
  const live = await loadLiveConfiguration();
  const ownership = {
    ...live.ownership,
    rules: [
      {
        id: "layer2-navigation",
        classification: "production",
        include: ["app/skin-v1/dashboard-bbs-panel.tsx"],
        ownerLayer: "experience-contract",
        riskTokens: ["surface", "navigation"],
      },
      {
        id: "layer1-skin",
        classification: "production",
        include: ["app/skin-v1/**"],
        ownerLayer: "experience-skins",
        riskTokens: ["skin", "visual", "navigation"],
      },
      {
        id: "layer6-provider",
        classification: "production",
        include: ["lib/providers/**"],
        ownerLayer: "provider-runtime",
        riskTokens: ["provider", "native"],
      },
      {
        id: "layer7-docs",
        classification: "docs",
        include: ["docs/**"],
        ownerLayer: "verification",
        riskTokens: ["docs"],
      },
    ],
  };
  const catalog = {
    ...live.catalog,
    entries: [
      entry({ id: "layer1.skin-baseline", ownerLayer: "experience-skins", triggerTokens: ["skin"], modes: ["baseline"] }),
      entry({ id: "layer2.navigation-impact", ownerLayer: "experience-contract", triggerTokens: ["navigation"] }),
      entry({
        id: "layer6.native-smoke",
        ownerLayer: "provider-runtime",
        triggerTokens: ["native"],
        cost: "heavy",
        requirements: { network: true, native: true },
      }),
      entry({ id: "layer7.docs", ownerLayer: "verification", triggerTokens: ["docs"] }),
    ],
  };
  return { ...live, ownership, catalog };
}

test("#1938 glob matching is deterministic and path-normalized", () => {
  assert.equal(pathMatches("app/skin-v1/**", "app/skin-v1/dashboard-bbs-panel.tsx"), true);
  assert.equal(pathMatches("app/skin-v1/*.tsx", "app/skin-v1/dashboard-bbs-panel.tsx"), true);
  assert.equal(pathMatches("app/skin-v1/*.tsx", "app/skin-v1/nested/panel.tsx"), false);
  assert.equal(pathMatches("tests/**", ".\\tests\\issue-1938-verification-core.test.mjs"), true);
});

test("#1938 a changed file may deterministically impact multiple canonical layers", async () => {
  const configuration = await syntheticConfiguration();
  const plan = planVerification({
    ...configuration,
    changedFiles: ["app/skin-v1/dashboard-bbs-panel.tsx"],
    platform: "linux",
  });

  assert.equal(plan.status, "ready");
  assert.deepEqual(plan.impactedLayers, ["experience-contract", "experience-skins"]);
  const resolved = plan.changedFiles[0];
  assert.deepEqual(resolved.ruleIds, ["layer1-skin", "layer2-navigation"]);
  assert.deepEqual(resolved.ownerLayers, ["experience-contract", "experience-skins"]);
  assert.deepEqual(resolved.riskTokens, ["navigation", "skin", "surface", "visual"]);

  const layer1 = plan.layers.find((layer) => layer.layerId === "experience-skins");
  const layer2 = plan.layers.find((layer) => layer.layerId === "experience-contract");
  assert.deepEqual(layer1.selectedTests.map((item) => item.id), ["layer1.skin-baseline"]);
  assert.deepEqual(layer2.selectedTests.map((item) => item.id), ["layer2.navigation-impact"]);
  assert.deepEqual(layer2.selectedTests[0].reasons, [{ kind: "risk-token", value: "navigation" }]);
});

test("#1938 unknown production ownership fails closed with the stable evidence code", async () => {
  const configuration = await loadLiveConfiguration();
  const resolved = resolveChangedFile("app/new-unregistered-production.tsx", configuration.ownership);
  assert.equal(resolved.status, "blocked");
  assert.equal(resolved.evidenceCode, "unmapped-production-ownership");

  const plan = planVerification({ ...configuration, changedFiles: ["app/new-unregistered-production.tsx"], platform: "linux" });
  assert.equal(plan.status, "blocked");
  assert.deepEqual(plan.blockingFindings, [{
    path: "app/new-unregistered-production.tsx",
    evidenceCode: "unmapped-production-ownership",
    reason: "production ownership is unmapped",
  }]);
  assert.match(explainPlan(plan), /BLOCKED app\/new-unregistered-production\.tsx -> unmapped-production-ownership/u);
});

test("#1938 docs-only and verification-only changes remain cheap and mapped", async () => {
  const configuration = await loadLiveConfiguration();
  const plan = planVerification({
    ...configuration,
    changedFiles: [
      "docs/developer-briefs/1938-phase-2-verification-core.md",
      "lib/verification/verification-core.mjs",
      "scripts/verification-core.mjs",
    ],
    platform: "linux",
  });
  assert.equal(plan.status, "ready");
  assert.deepEqual(plan.impactedLayers, ["verification"]);
  const layer7 = plan.layers.find((layer) => layer.layerId === "verification");
  assert.deepEqual(layer7.selectedTests.map((item) => item.id), ["verification.phase2-core"]);
  assert.equal(layer7.skippedTests.length, 0);
});

test("#1938 heavy/native/network verification requires explicit authorization and records skip reasons", async () => {
  const configuration = await syntheticConfiguration();
  const defaultPlan = planVerification({ ...configuration, changedFiles: ["lib/providers/local-runtime.mjs"], platform: "windows" });
  const defaultLayer6 = defaultPlan.layers.find((layer) => layer.layerId === "provider-runtime");
  assert.equal(defaultLayer6.selectedTests.length, 0);
  assert.deepEqual(defaultLayer6.skippedTests.map(({ id, reasonCode }) => ({ id, reasonCode })), [
    { id: "layer6.native-smoke", reasonCode: "heavy-not-authorized" },
  ]);

  const heavyPlan = planVerification({
    ...configuration,
    changedFiles: ["lib/providers/local-runtime.mjs"],
    platform: "windows",
    allowHeavy: true,
  });
  assert.equal(heavyPlan.layers.find((layer) => layer.layerId === "provider-runtime").skippedTests[0].reasonCode, "network-not-authorized");

  const authorizedPlan = planVerification({
    ...configuration,
    changedFiles: ["lib/providers/local-runtime.mjs"],
    platform: "windows",
    allowHeavy: true,
    allowNetwork: true,
    allowNative: true,
  });
  assert.deepEqual(authorizedPlan.layers.find((layer) => layer.layerId === "provider-runtime").selectedTests.map((item) => item.id), ["layer6.native-smoke"]);
});

test("#1938 planning output is stable regardless of changed-file input ordering", async () => {
  const configuration = await syntheticConfiguration();
  const files = ["docs/z.md", "app/skin-v1/dashboard-bbs-panel.tsx", "docs/a.md"];
  const left = planVerification({ ...configuration, changedFiles: files, platform: "linux" });
  const right = planVerification({ ...configuration, changedFiles: [...files].reverse(), platform: "linux" });
  assert.deepEqual(left, right);
});

test("#1938 invalid catalog or ownership configuration blocks planning before execution", async () => {
  const configuration = await loadLiveConfiguration();
  const duplicate = configuration.catalog.entries[0];
  const invalidCatalog = { ...configuration.catalog, entries: [duplicate, { ...duplicate }] };
  assert.throws(
    () => planVerification({ ...configuration, catalog: invalidCatalog, changedFiles: [], platform: "linux" }),
    (error) => error instanceof VerificationConfigurationError && /duplicate catalog id/u.test(error.message),
  );
});

test("#1938 runLayer uses injected typed runners and emitEvidence produces exact-head normalized evidence", async () => {
  const configuration = await syntheticConfiguration();
  const plan = planVerification({
    ...configuration,
    changedFiles: ["app/skin-v1/dashboard-bbs-panel.tsx"],
    platform: "linux",
  });
  const calls = [];
  const run = await runLayer({
    plan,
    catalog: configuration.catalog,
    layerId: "experience-contract",
    runners: {
      "node-test": async ({ entry, context }) => {
        calls.push({ id: entry.id, context });
        return { result: "pass", durationMs: 7, artifacts: [{ kind: "report", path: ".artifacts/verification/layer2.json" }], security: {} };
      },
    },
    context: { caller: "unit-test" },
  });
  assert.deepEqual(calls, [{ id: "layer2.navigation-impact", context: { caller: "unit-test" } }]);
  assert.equal(run.result, "pass");

  const sha = "a".repeat(40);
  const evidence = emitEvidence({
    plan,
    catalog: configuration.catalog,
    architecture: configuration.architecture,
    layerId: "experience-contract",
    commitSha: sha,
    run,
    runtime: { platform: "linux", runner: "unit-test", nodeVersion: process.version },
    durationMs: 9,
  });
  assert.equal(evidence.commitSha, sha);
  assert.equal(evidence.layerId, "experience-contract");
  assert.deepEqual(evidence.selectedTestIds, ["layer2.navigation-impact"]);
  assert.ok(evidence.triggerReasons.some((reason) => reason.kind === "changed-file"));
  assert.ok(evidence.triggerReasons.some((reason) => reason.kind === "risk-token" && reason.value === "navigation"));
  assert.deepEqual(evidence.security, { networkUsed: false, nativeUsed: false, secretsAccessed: false });
});

test("#1938 local CLI exposes plan, explain and run-layer without embedding workflow selection logic", async () => {
  const cli = await read("scripts/verification-core.mjs");
  assert.match(cli, /\["plan", "explain", "run-layer"\]/u);
  assert.match(cli, /planVerification\(/u);
  assert.match(cli, /runLayer\(/u);
  assert.match(cli, /emitEvidence\(/u);
  assert.match(cli, /shell: false/u);
  assert.doesNotMatch(cli, /pull_request\.body|issue\.body|agentResponse|modelResponse/u);
});
