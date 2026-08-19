import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertNoOrphanableManagedLauncher,
  createRuntimeSupervisor,
  observeRuntimeComponent,
  planRuntimeStart,
  recordRuntimeRestart,
  runtimeSettingsProjection,
  validateRuntimeManifest,
} from "../core/runtime/managed-runtime-core.mjs";

const manifestUrl = new URL("../config/runtime-manifest.json", import.meta.url);

async function loadManifest() {
  return JSON.parse(await readFile(manifestUrl, "utf8"));
}

function readyObservation(overrides = {}) {
  return {
    installed: true,
    processRunning: true,
    healthOk: true,
    capabilityReady: true,
    updateState: "current",
    observedAt: "2026-08-19T18:30:00.000Z",
    ...overrides,
  };
}

test("#1079 has one PlotPickle-owned managed runtime manifest authority", async () => {
  const manifest = validateRuntimeManifest(await loadManifest());
  assert.equal(manifest.authority, "plotpickle-runtime-supervisor");
  assert.equal(manifest.productionPolicy.allowPathFallback, false);
  assert.equal(manifest.productionPolicy.developerOverrides, "explicit-only");
  assert.equal(manifest.productionPolicy.hideManagedConsoles, true);
  assert.equal(manifest.productionPolicy.preserveProjectAndIdentityState, true);
  assert.deepEqual(manifest.components.map((component) => component.id), [
    "plotpickle-app-runtime",
    "buzz-bridge",
    "comfyui-engine",
    "plotpickle-node-service",
  ]);
});

test("ComfyUI process-running and capability-ready remain distinct truthful states", async () => {
  let supervisor = createRuntimeSupervisor(await loadManifest());
  supervisor = observeRuntimeComponent(supervisor, "comfyui-engine", readyObservation({ capabilityReady: false }));
  assert.equal(supervisor.services["comfyui-engine"].processState, "running");
  assert.equal(supervisor.services["comfyui-engine"].readinessState, "degraded");
  assert.equal(supervisor.services["comfyui-engine"].summaryState, "degraded");

  supervisor = observeRuntimeComponent(supervisor, "comfyui-engine", readyObservation());
  assert.equal(supervisor.services["comfyui-engine"].readinessState, "ready");
  assert.equal(supervisor.services["comfyui-engine"].summaryState, "ready");
});

test("managed services cannot start before their declared dependencies are actually ready", async () => {
  let supervisor = createRuntimeSupervisor(await loadManifest());
  assert.throws(() => planRuntimeStart(supervisor, "comfyui-engine"), /dependency plotpickle-app-runtime is not ready/i);

  supervisor = observeRuntimeComponent(supervisor, "plotpickle-app-runtime", readyObservation());
  const plan = planRuntimeStart(supervisor, "comfyui-engine");
  assert.equal(plan.componentId, "comfyui-engine");
  assert.deepEqual(plan.dependencies, ["plotpickle-app-runtime"]);
  assert.equal(plan.hideConsole, true);
  assert.equal(plan.launcher, "scripts/start-comfyui-background.ps1");
});

test("developer overrides are explicit, developer-mode-only and cannot escape the app boundary", async () => {
  let supervisor = createRuntimeSupervisor(await loadManifest());
  supervisor = observeRuntimeComponent(supervisor, "plotpickle-app-runtime", readyObservation());

  assert.throws(
    () => planRuntimeStart(supervisor, "comfyui-engine", { developerOverridePath: "runtime/dev/comfy.ps1" }),
    /explicit developer mode/i,
  );
  const plan = planRuntimeStart(supervisor, "comfyui-engine", {
    developerOverridePath: "runtime/dev/comfy.ps1",
    developerMode: true,
  });
  assert.equal(plan.developerOverride, true);
  assert.equal(plan.launcher, "runtime/dev/comfy.ps1");
  assert.doesNotThrow(() => assertNoOrphanableManagedLauncher(plan));
  assert.throws(
    () => assertNoOrphanableManagedLauncher({ ...plan, launcher: "C:\\Users\\writer\\secret.ps1" }),
    /cannot escape/i,
  );
});

test("runtime manifest rejects arbitrary remote probes, absolute launchers and secret-like material", async () => {
  const source = await loadManifest();

  assert.throws(
    () => validateRuntimeManifest({
      ...source,
      components: source.components.map((component) => component.id === "comfyui-engine"
        ? { ...component, healthProbe: { kind: "http-loopback", target: "http://192.168.1.50:8188/system_stats" } }
        : component),
    }),
    /loopback-only/i,
  );

  assert.throws(
    () => validateRuntimeManifest({
      ...source,
      components: source.components.map((component) => component.id === "comfyui-engine"
        ? { ...component, launcher: "C:\\Users\\writer\\ComfyUI\\main.py" }
        : component),
    }),
    /repository\/package relative/i,
  );

  assert.throws(
    () => validateRuntimeManifest({
      ...source,
      components: source.components.map((component) => component.id === "comfyui-engine"
        ? { ...component, displayName: "PRIVATE KEY runtime" }
        : component),
    }),
    /secret material/i,
  );
});

test("restart policy is bounded and cannot become an infinite crash loop", async () => {
  let supervisor = createRuntimeSupervisor(await loadManifest());
  supervisor = observeRuntimeComponent(supervisor, "comfyui-engine", readyObservation({ failed: true, processRunning: false, healthOk: false, capabilityReady: false }));
  supervisor = recordRuntimeRestart(supervisor, "comfyui-engine");
  supervisor = recordRuntimeRestart(supervisor, "comfyui-engine");
  supervisor = recordRuntimeRestart(supervisor, "comfyui-engine");
  assert.equal(supervisor.services["comfyui-engine"].restartCount, 3);
  assert.throws(() => recordRuntimeRestart(supervisor, "comfyui-engine"), /bounded restart limit/i);
});

test("Settings projection reports product-readable state without exposing launch paths or credentials", async () => {
  let supervisor = createRuntimeSupervisor(await loadManifest());
  supervisor = observeRuntimeComponent(supervisor, "plotpickle-app-runtime", readyObservation());
  supervisor = observeRuntimeComponent(supervisor, "comfyui-engine", readyObservation({ capabilityReady: false }));
  const settings = runtimeSettingsProjection(supervisor);
  const comfy = settings.find((item) => item.componentId === "comfyui-engine");
  assert.equal(comfy.summaryState, "degraded");
  assert.equal(comfy.processState, "running");
  assert.equal(comfy.readinessState, "degraded");
  assert.equal("launcher" in comfy, false);
  assert.equal("stageLocation" in comfy, false);
  assert.equal(JSON.stringify(settings).includes("PRIVATE KEY"), false);
});

test("future PlotPickle Node service has a supervisor home but remains disabled until explicitly enabled", async () => {
  const supervisor = createRuntimeSupervisor(await loadManifest());
  assert.equal(supervisor.services["plotpickle-node-service"].enabled, false);
  assert.equal(supervisor.services["buzz-bridge"].enabled, true);
  assert.throws(() => planRuntimeStart(supervisor, "plotpickle-node-service"), /is disabled/i);
});

test("runtime dependency cycles and unknown dependencies are deterministic failures", async () => {
  const source = await loadManifest();
  assert.throws(
    () => validateRuntimeManifest({
      ...source,
      components: source.components.map((component) => component.id === "plotpickle-app-runtime"
        ? { ...component, startupDependencies: ["missing-runtime"] }
        : component),
    }),
    /depends on unknown component missing-runtime/i,
  );

  assert.throws(
    () => validateRuntimeManifest({
      ...source,
      components: source.components.map((component) => {
        if (component.id === "plotpickle-app-runtime") return { ...component, startupDependencies: ["buzz-bridge"] };
        if (component.id === "buzz-bridge") return { ...component, startupDependencies: ["plotpickle-app-runtime"] };
        return component;
      }),
    }),
    /dependency cycle/i,
  );
});
