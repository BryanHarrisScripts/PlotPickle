import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { LocalSidecarSupervisor } from "../core/sidecars/local-supervisor.ts";
import { createRuntimeServiceRegistry, registeredServiceLaunch } from "../core/sidecars/runtime-service-registry.mjs";
import { runtimeStatusDocument } from "../core/sidecars/runtime-status-store.mjs";

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
