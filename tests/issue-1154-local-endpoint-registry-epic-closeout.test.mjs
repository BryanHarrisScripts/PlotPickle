import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const EXPECTED_INTEGRITY = "sha512-zmJu4Q8/fY54oVUT/5NnmF4Ih8wTdCvCf6JCN783dRYl9mXkJBzXSckX2lztGCLIbM70varDjCudAbGKT73XPg==";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("#1154 final Portless pin records measured Windows evidence and ADOPT WITH LIMITS", async () => {
  const pin = JSON.parse(await read("config/portless-runtime.json"));
  assert.equal(pin.version, "0.15.5");
  assert.equal(pin.npmPackage, "portless@0.15.5");
  assert.equal(pin.npmIntegrity, EXPECTED_INTEGRITY);
  assert.equal(pin.license, "Apache-2.0");
  assert.equal(pin.nodeEngine, ">=24");
  assert.equal(pin.plotpickleNodeStrategy, "isolated-developer-tool-runtime");
  assert.equal(pin.adoptionDecision, "ADOPT WITH LIMITS");
  assert.deepEqual(pin.windowsAcceptance, {
    status: "passed",
    nodeVersion: "24.19.0",
    workflowRunId: 32437045317,
    artifactId: 9431151950,
    testedHead: "8cc93adb18240596023fee7e601af2e9e42dd24f",
  });
});

test("#1154 architecture closeout contains no pending Portless acceptance state", async () => {
  const architecture = await read("docs/architecture/PLOTPICKLE-PORTLESS-ADAPTER.md");
  assert.match(architecture, /Final decision: \*\*ADOPT WITH LIMITS\*\*/u);
  assert.match(architecture, /Workflow run `32437045317`/u);
  assert.match(architecture, /Node `24\.19\.0`/u);
  assert.match(architecture, new RegExp(EXPECTED_INTEGRITY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"));
  assert.doesNotMatch(architecture, /pending-real-package-metadata-capture|pending-real-windows-acceptance|acceptance in progress|Candidate pending/u);
});

test("#1154 keeps Portless optional and subordinate to the Local Endpoint Registry", async () => {
  const pkg = JSON.parse(await read("package.json"));
  const registry = await read("core/runtime/local-endpoint-registry.mjs");
  const adapter = await read("core/runtime/portless-adapter.mjs");
  const architecture = await read("docs/architecture/PLOTPICKLE-PORTLESS-ADAPTER.md");

  assert.equal(pkg.engines.node, ">=22.13.0");
  assert.equal(pkg.dependencies?.portless, undefined);
  assert.equal(pkg.devDependencies?.portless, undefined);
  assert.match(registry, /transportProfile/u);
  assert.match(adapter, /alias/u);
  assert.match(architecture, /Local Endpoint Registry remains the authority/u);
  assert.match(architecture, /Portless is only a replaceable local transport adapter/u);
  assert.match(architecture, /direct mode remains fully supported/u);
  assert.match(architecture, /no LAN, tunnel, public-domain, service-at-boot or automatic CA-trust behavior/u);
});
