import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  MANAGED_PI_DURABLE_MINIMUM_NODE,
  MANAGED_PI_DURABLE_PACKAGE,
  MANAGED_PI_DURABLE_VERSION,
  ensureManagedPiDurable,
  inspectManagedPiDurable,
  managedPiDurableRoot,
  nodeSupportsPiDurable,
} from "../core/sidecars/runtime/pi-durable-managed.mjs";
import {
  executePiDurableRuntimeRequest,
  piDurableReadyDescriptor,
} from "../scripts/sidecars/pi-durable-service.mjs";

test("#2696 Pi Durable is default-active on the supported PlotPickle runtime floor", () => {
  assert.equal(MANAGED_PI_DURABLE_PACKAGE, "@earendil-works/pi-durable");
  assert.equal(MANAGED_PI_DURABLE_VERSION, "1.0.0");
  assert.equal(MANAGED_PI_DURABLE_MINIMUM_NODE, "22.19.0");
  assert.equal(nodeSupportsPiDurable("22.19.0"), true);
  assert.equal(nodeSupportsPiDurable("24.19.0"), true);
  assert.equal(nodeSupportsPiDurable("22.13.0"), false);
});

test("#2696 managed runtime installs exact reviewed Pi Durable into PlotPickle-owned storage", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "plotpickle-2696-"));
  let packageSpec = "";
  try {
    const inspection = await ensureManagedPiDurable(home, {
      install: async ({ root, packageSpec: spec }) => {
        packageSpec = spec;
        const folder = path.join(root, "node_modules", "@earendil-works", "pi-durable");
        await mkdir(folder, { recursive: true });
        await writeFile(path.join(folder, "package.json"), JSON.stringify({ name: MANAGED_PI_DURABLE_PACKAGE, version: MANAGED_PI_DURABLE_VERSION }), "utf8");
      },
    });
    assert.equal(packageSpec, "@earendil-works/pi-durable@1.0.0");
    assert.equal(inspection.ready, true);
    assert.equal(inspection.root, managedPiDurableRoot(home));
    const packageJson = JSON.parse(await readFile(path.join(inspection.root, "package.json"), "utf8"));
    assert.equal(packageJson.dependencies[MANAGED_PI_DURABLE_PACKAGE], "1.0.0");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("#2696 startup health proves durable runtime without granting model/canon/merge authority", async () => {
  const active = {
    version: "1.0.0",
    rootConversationId: "root-2696",
  };
  const descriptor = piDurableReadyDescriptor(active);
  assert.equal(descriptor.state, "ready");
  const summary = descriptor.evidence.map((item) => item.summary).join("\n");
  assert.match(summary, /zero|No model\/provider request/i);
  assert.match(summary, /execution\/recovery infrastructure only/i);

  const health = await executePiDurableRuntimeRequest(active, { requestId: "pi-health", operation: "health" });
  assert.equal(health.state, "ready");
  const rejected = await executePiDurableRuntimeRequest(active, { requestId: "pi-shell", operation: "verify-contract", target: "shell" });
  assert.equal(rejected.state, "failed");
});

test("#2696 persisted managed runtime is reused instead of reinstalled", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "plotpickle-2696-"));
  let installs = 0;
  try {
    const root = managedPiDurableRoot(home);
    const folder = path.join(root, "node_modules", "@earendil-works", "pi-durable");
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "package.json"), JSON.stringify({ version: "1.0.0" }), "utf8");
    const before = await inspectManagedPiDurable(home);
    assert.equal(before.ready, true);
    await ensureManagedPiDurable(home, { install: async () => { installs += 1; } });
    assert.equal(installs, 0);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("#2696 normal runtime registry keeps Pi Durable enabled out of the gate", async () => {
  const config = JSON.parse(await readFile(new URL("../config/runtime-sidecars.json", import.meta.url), "utf8"));
  const pi = config.services.find((item) => item.id === "pi-durable");
  assert.equal(pi.defaultEnabled, true);
  assert.equal(pi.entrypoint, "scripts/sidecars/pi-durable-service.mjs");
});
