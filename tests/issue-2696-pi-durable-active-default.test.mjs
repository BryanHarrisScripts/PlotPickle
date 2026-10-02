import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  PI_DURABLE_MINIMUM_NODE,
  PI_DURABLE_RUNTIME_VERSION,
} from "../core/sidecars/pi-durable-adapter.mjs";
import {
  PLOTPICKLE_PI_DURABLE_PACKAGE,
  PLOTPICKLE_PI_DURABLE_VERSION,
  ensureManagedPiDurableInstalled,
  managedPiDurableRoot,
  probeManagedPiDurable,
} from "../scripts/pi-durable-managed-install.mjs";
import {
  executePiDurableRuntimeRequest,
  initializePiDurableRuntime,
} from "../scripts/sidecars/pi-durable-service.mjs";

test("#2696 Pi Durable is pinned and enabled for supported hosts", async () => {
  assert.equal(PLOTPICKLE_PI_DURABLE_PACKAGE, "@earendil-works/pi-durable@1.0.0");
  assert.equal(PLOTPICKLE_PI_DURABLE_VERSION, "1.0.0");
  assert.equal(PI_DURABLE_RUNTIME_VERSION, "1.0.0");
  assert.equal(PI_DURABLE_MINIMUM_NODE, "22.19.0");

  const config = JSON.parse(await readFile(new URL("../config/pi-durable-adapter.json", import.meta.url), "utf8"));
  assert.equal(config.defaultEnabled, true);
  assert.equal(config.decision, "active-by-default-supported-host-with-degraded-fallback");
});

test("#2696 reviewed managed installer places exact Pi Durable in PlotPickle-owned storage", async () => {
  const home = await import("node:fs/promises").then(({ mkdtemp }) => mkdtemp(path.join(os.tmpdir(), "plotpickle-2696-")));
  try {
    const root = managedPiDurableRoot({ home });
    let invoked = null;
    const installed = await ensureManagedPiDurableInstalled({
      home,
      root,
      nodeVersion: "24.19.0",
      npmCommand: "npm",
      runPortableCommand: async (command, args) => {
        invoked = { command, args };
        const folder = path.join(root, "node_modules", "@earendil-works", "pi-durable");
        await mkdir(folder, { recursive: true });
        await writeFile(path.join(folder, "package.json"), JSON.stringify({ version: "1.0.0" }), "utf8");
        return { stdout: "", stderr: "" };
      },
    });
    assert.equal(installed.ready, true);
    assert.equal(installed.version, "1.0.0");
    assert.equal(installed.root, root);
    assert.equal(invoked.command, "npm");
    assert.ok(invoked.args.includes("--ignore-scripts"));
    assert.ok(invoked.args.includes("@earendil-works/pi-durable@1.0.0"));
    const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
    assert.equal(packageJson.dependencies["@earendil-works/pi-durable"], "1.0.0");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("#2696 existing exact managed runtime is reused without reinstall", async () => {
  const home = await import("node:fs/promises").then(({ mkdtemp }) => mkdtemp(path.join(os.tmpdir(), "plotpickle-2696-")));
  try {
    const root = managedPiDurableRoot({ home });
    const folder = path.join(root, "node_modules", "@earendil-works", "pi-durable");
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "package.json"), JSON.stringify({ version: "1.0.0" }), "utf8");
    assert.equal((await probeManagedPiDurable({ home, root })).ready, true);
    let installs = 0;
    const result = await ensureManagedPiDurableInstalled({
      home,
      root,
      nodeVersion: "24.19.0",
      runPortableCommand: async () => { installs += 1; },
      npmCommand: "npm",
    });
    assert.equal(result.ready, true);
    assert.equal(result.installed, false);
    assert.equal(installs, 0);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("#2696 live sidecar initializes persistent readiness without a model/provider request", async () => {
  const descriptor = await initializePiDurableRuntime("C:/PlotPickle-Test", {
    ensure: async () => ({ root: "C:/PlotPickle-Test/runtimes/pi-durable-1.0.0", version: "1.0.0" }),
    probe: async () => ({
      runtime: "pi-durable",
      version: "1.0.0",
      state: "ready",
      storage: "jsonl",
      rootId: "root-2696",
      persistedReopen: true,
      providerRequestIssued: false,
      modelRequestIssued: false,
      canApproveCanon: false,
      canMergeCode: false,
      canOverrideDeterministicFailure: false,
    }),
    inspectRecovery: async () => ({
      safeResume: Object.freeze([{ taskId: "safe-1", humanApprovalRef: "human:safe-1", replayPolicy: "safe", state: "interrupted" }]),
      humanReauthorizationRequired: Object.freeze([{ taskId: "mutating-1", humanApprovalRef: "human:mutating-1", replayPolicy: "non-replayable", state: "interrupted" }]),
    }),
  });

  assert.equal(descriptor.state, "ready");
  assert.equal(descriptor.rootConversationId, "root-2696");
  assert.equal(descriptor.recovery.safeResume.length, 1);
  assert.equal(descriptor.recovery.humanReauthorizationRequired.length, 1);
  const summary = descriptor.evidence.map((item) => item.summary).join("\n");
  assert.match(summary, /No model\/provider request/i);
  assert.match(summary, /fresh Human authorization/i);
  assert.match(summary, /execution\/recovery infrastructure only/i);

  const health = await executePiDurableRuntimeRequest(descriptor, { requestId: "pi-health", operation: "health" });
  assert.equal(health.state, "ready");
  const rejected = await executePiDurableRuntimeRequest(descriptor, { requestId: "pi-not-health", operation: "verify-contract", target: "anything" });
  assert.equal(rejected.state, "failed");
});

test("#2696 normal runtime registry starts Pi Durable out of the gate", async () => {
  const config = JSON.parse(await readFile(new URL("../config/runtime-sidecars.json", import.meta.url), "utf8"));
  const pi = config.services.find((item) => item.id === "pi-durable");
  assert.equal(pi.defaultEnabled, true);
  assert.equal(pi.requiredForCore, false);
  assert.equal(pi.entrypoint, "scripts/sidecars/pi-durable-service.mjs");
});
