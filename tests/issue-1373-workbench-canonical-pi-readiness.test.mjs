import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relative) => readFile(new URL(`../${relative}`, import.meta.url), "utf8");
const [bridge, direct, runtime, verify, localValidation] = await Promise.all([
  read("scripts/pi-work-item-review.mjs"),
  read("Utilities/DeveloperWorkbench/pi-managed-node-launch.mjs"),
  read("scripts/pi-worker-runtime.mjs"),
  read("scripts/verify-pi-repair-worker.mjs"),
  read("Utilities/DeveloperWorkbench/local-validation.mjs"),
]);

test("#1373 Workbench uses PlotPickle canonical provider identity and readiness marker", () => {
  assert.match(runtime, /defaultProvider: "plotpickle-local"/);
  assert.match(runtime, /const marker = "PLOTPICKLE_PI_READY"/);
  assert.match(direct, /WORKBENCH_CANONICAL_PROVIDER_ID = "plotpickle-local"/);
  assert.match(direct, /WORKBENCH_CANONICAL_SMOKE_MARKER = "PLOTPICKLE_PI_READY"/);
  assert.doesNotMatch(direct, /pi\.registerProvider|plotpickle-workbench-local-provider/);
});

test("#1373 Workbench aligns its real Pi cold-start budget with Full Verification", () => {
  assert.match(verify, /PI_SMOKE_TIMEOUT_MS = 4 \* 60_000/);
  assert.match(direct, /WORKBENCH_CANONICAL_SMOKE_TIMEOUT_MS = 4 \* 60_000/);
  assert.match(bridge, /smokeTimeout: WORKBENCH_CANONICAL_SMOKE_TIMEOUT_MS/);
  assert.doesNotMatch(bridge, /12_000|within 60 seconds|60-second local inference race/);
});

test("#1373 Workbench cannot report Pi GREEN from version discovery alone", () => {
  const install = bridge.indexOf("ensureManagedPiInstalled");
  const runtimeResolve = bridge.indexOf("resolvePiLocalRuntime");
  const inference = bridge.indexOf("const proof = await probeManagedPiReadiness");
  const green = bridge.indexOf("ready: true,\n      version: report.pi.version");
  assert.ok(install >= 0);
  assert.ok(runtimeResolve > install);
  assert.ok(inference > runtimeResolve);
  assert.ok(green > inference);
  assert.match(bridge, /is installed and executable; real local inference still must pass before Pi is GREEN/);
});

test("#1373 Windows transport stays direct Node while provider policy stays canonical", () => {
  assert.match(direct, /runPortableCommand\(process\.execPath/);
  assert.match(direct, /resolveManagedPiCliEntry/);
  assert.match(direct, /configurePiLocalRuntime/);
  assert.match(direct, /piLocalEnvironment/);
  assert.doesNotMatch(direct, /cmd\.exe|windowsBatchWrapper/);
});

test("#1373 local pre-CI gate runs changed tests, BEN, and verified production build", () => {
  assert.match(localValidation, /test-changed\.mjs/);
  assert.match(localValidation, /run-ben-code-quality\.mjs/);
  assert.match(localValidation, /build-verified\.mjs/);
  assert.match(localValidation, /LOCAL PRE-CI GREEN/);
  assert.match(localValidation, /GitHub Actions should now be used as the independent exact-head release gate/);
});
