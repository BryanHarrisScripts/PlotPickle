import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildRuntimeWeightInventory } from "../scripts/runtime-weight/inventory-runtime-weight.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function json(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

test("#1626 inventory covers every direct package declaration and current shipped top-level payload", async () => {
  const [policy, packageJson, report] = await Promise.all([
    json("scripts/runtime-weight/runtime-weight-policy.json"),
    json("package.json"),
    buildRuntimeWeightInventory({ platform: "windows" }),
  ]);

  const directPackageNames = new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
  ]);
  assert.deepEqual(new Set(Object.keys(policy.packageDeclarations)), directPackageNames);
  assert.equal(report.directPackages.length, directPackageNames.size);
  assert.ok(report.directPackages.every((entry) => entry.declaredVersion && entry.lockedVersion));

  const shipped = new Map(report.release.payload.map((entry) => [entry.id, entry]));
  for (const id of ["app", "build", "core", "docs", "runtime", "scripts", "tests", "Utilities", "package.json", "package-lock.json", "vite.config.ts", "platform-launcher"]) {
    assert.ok(shipped.has(id), `expected shipped payload classification for ${id}`);
    assert.equal(shipped.get(id).exists, true, `expected current shipped payload ${id} to exist`);
  }
  assert.ok(report.release.sourcePayloadFiles > 0);
  assert.ok(report.release.sourcePayloadBytes > 0);
});

test("#1626 preserves evidence-first classifications for the first reduction candidates", async () => {
  const policy = await json("scripts/runtime-weight/runtime-weight-policy.json");
  const payload = new Map(policy.releasePayload.map((entry) => [entry.id, entry]));
  const packages = policy.packageDeclarations;

  assert.equal(payload.get("tests").role, "developer-test-only");
  assert.equal(payload.get("tests").disposition, "requires-reachability-proof");
  assert.equal(payload.get("docs").role, "developer-test-only");
  assert.equal(payload.get("scripts").role, "core-maintenance-runtime-tooling");
  assert.equal(payload.get("scripts").disposition, "requires-finer-split");
  assert.equal(payload.get("runtime").role, "optional-integration-runtime");
  assert.equal(payload.get("runtime").disposition, "requires-finer-split");

  assert.equal(packages["@mastra/core"].role, "core-runtime");
  assert.equal(packages["libsodium-wrappers-sumo"].role, "core-runtime");
  assert.equal(packages["@cloudflare/vite-plugin"].role, "core-maintenance-runtime-tooling");
  assert.equal(packages["drizzle-kit"].disposition, "requires-reachability-proof");
  assert.equal(packages.eslint.role, "developer-test-only");
  assert.equal(packages["@types/node"].role, "developer-test-only");
});

test("#1626 records the current full dev-inclusive persistent runtime without changing it", async () => {
  const report = await buildRuntimeWeightInventory({ platform: "windows" });
  assert.equal(report.baseline.performanceIssue, 1411);
  assert.equal(report.baseline.performanceGatePr, 1625);
  assert.equal(report.baseline.performanceBaselineVersion, "1411-2026-09-02-a7741f4");
  assert.equal(report.persistentRuntime.includeDev, true);
  assert.deepEqual(
    new Set(report.persistentRuntime.currentReadinessPackages),
    new Set(["vite", "next", "react", "vinext", "rolldown", "drizzle-kit"]),
  );
  assert.match(report.persistentRuntime.nativeBindingPolicy, /@rolldown Windows binding/);
});

test("#1626 role and disposition vocabulary stays bounded", async () => {
  const policy = await json("scripts/runtime-weight/runtime-weight-policy.json");
  assert.deepEqual(policy.roles, [
    "core-runtime",
    "core-maintenance-runtime-tooling",
    "optional-integration-runtime",
    "reference-example-payload",
    "developer-test-only",
  ]);
  assert.deepEqual(policy.dispositions, [
    "keep-current",
    "requires-reachability-proof",
    "requires-finer-split",
  ]);
  for (const entry of [...policy.releasePayload, ...Object.values(policy.packageDeclarations)]) {
    assert.ok(policy.roles.includes(entry.role));
    assert.ok(policy.dispositions.includes(entry.disposition));
    assert.ok(Array.isArray(entry.evidence) && entry.evidence.length > 0);
  }
});
