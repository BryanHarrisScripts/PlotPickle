import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { LocalSidecarSupervisor } from "../core/sidecars/local-supervisor.ts";
import { createRuntimeServiceRegistry, registeredServiceLaunch } from "../core/sidecars/runtime/service-registry.mjs";
import { runtimeStatusDocument } from "../core/sidecars/runtime/status-store.mjs";

const config = JSON.parse(await readFile(new URL("../config/runtime-sidecars.json", import.meta.url), "utf8"));

test("#2694 runtime registry is product-first and contains the intended governed services", () => {
  const registry = createRuntimeServiceRegistry(config);
  assert.equal(registry.startupPolicy, "after-core-ready");
  assert.deepEqual(registry.services.map((service) => service.id), [
    "dsdd",
    "browser-verification",
    "pi-durable",
    "craft-runtime",
    "media-runtime",
    "chatgpt-mcp-gateway",
  ]);
  assert.ok(registry.services.every((service) => service.requiredForCore === false));
});

test("#2694 unknown services cannot be launched through the registered runtime contract", () => {
  const registry = createRuntimeServiceRegistry(config);
  assert.throws(() => registeredServiceLaunch(registry, "arbitrary-shell", { repoRoot: process.cwd() }), /not registered/);
  const dsdd = registeredServiceLaunch(registry, "dsdd", { repoRoot: process.cwd(), node: "node" });
  assert.equal(dsdd.command, "node");
  assert.match(dsdd.entrypoint.replaceAll("\\", "/"), /scripts\/sidecars\/dsdd-service\.mjs$/);
});

test("#2694 sidecar supervisor can record bounded unavailable evidence without throwing", () => {
  const supervisor = new LocalSidecarSupervisor();
  supervisor.mark("pi-durable", "unavailable", [{
    kind: "not-installed",
    summary: "candidate runtime absent",
    observedAt: new Date(0).toISOString(),
  }]);
  assert.equal(supervisor.status("pi-durable").state, "unavailable");
  assert.equal(supervisor.status("pi-durable").evidence[0].kind, "not-installed");
});

test("#2694 normal launcher starts the supervisor asynchronously without making it a Vite prerequisite", async () => {
  const launcher = await readFile(new URL("../Start-PlotPickle.bat", import.meta.url), "utf8");
  assert.match(launcher, /call :open_when_ready[\s\S]*call :start_runtime_sidecar_supervisor[\s\S]*call :start_deferred_companion_maintenance/);
  assert.match(launcher, /start "" \/b node --experimental-strip-types "%RUNTIME_SIDECAR_SUPERVISOR%"/);
  assert.match(launcher, /Runtime sidecars will initialize asynchronously after core readiness|Governed runtime sidecars will initialize asynchronously after core readiness/);
  assert.ok(launcher.indexOf('call :start_runtime_sidecar_supervisor') < launcher.lastIndexOf('call "%VITE_CMD%"'));
});

test("#2694 status evidence separates product core from sidecar convergence", () => {
  const document = runtimeStatusDocument({
    supervisor: { state: "starting", pid: 10 },
    core: { state: "ready", url: "http://127.0.0.1:4173" },
    services: [{ id: "dsdd", state: "starting", evidence: [] }],
    observedAt: new Date(0).toISOString(),
  });
  assert.equal(document.core.state, "ready");
  assert.equal(document.supervisor.state, "starting");
});
