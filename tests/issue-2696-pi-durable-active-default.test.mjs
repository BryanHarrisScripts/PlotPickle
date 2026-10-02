import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  inspectPiDurableRecoveryCandidates,
  PI_DURABLE_MINIMUM_NODE,
  PI_DURABLE_RUNTIME_VERSION,
} from "../core/sidecars/pi-durable-adapter.mjs";
import {
  ensureManagedPiDurableInstalled,
  managedPiDurableRoot,
  PLOTPICKLE_PI_DURABLE_PACKAGE,
  PLOTPICKLE_PI_DURABLE_VERSION,
} from "../scripts/pi-durable-managed-install.mjs";
import {
  executePiDurableRuntimeRequest,
  initializePiDurableRuntime,
} from "../scripts/sidecars/pi-durable-service.mjs";

test("#2696 Pi Durable remains the exact reviewed active-default runtime", () => {
  assert.equal(PLOTPICKLE_PI_DURABLE_PACKAGE, "@earendil-works/pi-durable@1.0.0");
  assert.equal(PLOTPICKLE_PI_DURABLE_VERSION, "1.0.0");
  assert.equal(PI_DURABLE_RUNTIME_VERSION, "1.0.0");
  assert.equal(PI_DURABLE_MINIMUM_NODE, "22.19.0");
});

test("#2696 managed runtime installs exact Pi Durable into PlotPickle-owned storage", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "plotpickle-2696-"));
  const root = managedPiDurableRoot({ home });
  const calls = [];
  try {
    const result = await ensureManagedPiDurableInstalled({
      home,
      root,
      nodeVersion: "24.19.0",
      npmCommand: "npm",
      runPortableCommand: async (command, args) => {
        calls.push([command, ...args]);
        const folder = path.join(root, "node_modules", "@earendil-works", "pi-durable");
        await mkdir(folder, { recursive: true });
        await writeFile(path.join(folder, "package.json"), JSON.stringify({ version: "1.0.0" }), "utf8");
        return { stdout: "installed", stderr: "" };
      },
    });
    assert.equal(result.ready, true);
    assert.equal(result.version, "1.0.0");
    assert.equal(result.installed, true);
    const install = calls[0];
    assert.deepEqual(install.slice(0, 4), ["npm", "install", "--prefix", root]);
    assert.ok(install.includes("--ignore-scripts"));
    assert.ok(install.includes("--package-lock=false"));
    assert.equal(install.at(-1), "@earendil-works/pi-durable@1.0.0");
    const manifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
    assert.equal(manifest.dependencies["@earendil-works/pi-durable"], "1.0.0");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("#2696 managed runtime is reused and unsupported Node fails without touching core", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "plotpickle-2696-"));
  const root = managedPiDurableRoot({ home });
  try {
    const folder = path.join(root, "node_modules", "@earendil-works", "pi-durable");
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "package.json"), JSON.stringify({ version: "1.0.0" }), "utf8");
    let installs = 0;
    const reused = await ensureManagedPiDurableInstalled({
      home,
      root,
      nodeVersion: "24.19.0",
      npmCommand: "npm",
      runPortableCommand: async () => { installs += 1; return { stdout: "", stderr: "" }; },
    });
    assert.equal(reused.installed, false);
    assert.equal(installs, 0);
    await assert.rejects(
      ensureManagedPiDurableInstalled({ home, root, nodeVersion: "22.13.0", allowInstall: false }),
      /22\.19\.0/,
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("#2696 interrupted durable metadata preserves Human approval and replay classification", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-2696-recovery-"));
  try {
    for (const [id, replayPolicy] of [["safe-task", "safe"], ["mutating-task", "non-replayable"]]) {
      const folder = path.join(root, id);
      await mkdir(folder, { recursive: true });
      await writeFile(path.join(folder, "plotpickle-task.json"), JSON.stringify({
        state: "running",
        task: { id, replayPolicy, humanApprovalRef: `human:${id}` },
      }), "utf8");
    }
    const recovery = await inspectPiDurableRecoveryCandidates(root);
    assert.deepEqual(recovery.safeResume.map((item) => item.taskId), ["safe-task"]);
    assert.deepEqual(recovery.humanReauthorizationRequired.map((item) => item.taskId), ["mutating-task"]);
    assert.equal(recovery.humanReauthorizationRequired[0].humanApprovalRef, "human:mutating-task");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("#2696 active startup opens durable state but issues zero model/provider work", async () => {
  const descriptor = await initializePiDurableRuntime("C:\\PlotPickle", {
    ensure: async () => ({ root: "C:\\PlotPickle\\runtimes\\pi-durable-1.0.0", version: "1.0.0", ready: true }),
    probe: async () => ({
      state: "ready",
      rootId: "root-2696",
      providerRequestIssued: false,
      modelRequestIssued: false,
    }),
    inspectRecovery: async () => ({ safeResume: [], humanReauthorizationRequired: [] }),
  });
  assert.equal(descriptor.state, "ready");
  assert.equal(descriptor.rootConversationId, "root-2696");
  const summary = descriptor.evidence.map((item) => item.summary).join("\n");
  assert.match(summary, /No model\/provider request/);
  assert.match(summary, /execution\/recovery infrastructure only/);

  const health = await executePiDurableRuntimeRequest(descriptor, { requestId: "pi-health", operation: "health" });
  assert.equal(health.state, "ready");
  const rejected = await executePiDurableRuntimeRequest(descriptor, { requestId: "pi-nope", operation: "verify-contract", target: "anything" });
  assert.equal(rejected.state, "failed");
});

test("#2696 normal runtime registry starts Pi Durable out of the gate through the PlotPickle seam", async () => {
  const [configText, serviceSource] = await Promise.all([
    readFile(new URL("../config/runtime-sidecars.json", import.meta.url), "utf8"),
    readFile(new URL("../scripts/sidecars/pi-durable-service.mjs", import.meta.url), "utf8"),
  ]);
  const config = JSON.parse(configText);
  const pi = config.services.find((item) => item.id === "pi-durable");
  assert.equal(pi.defaultEnabled, true);
  assert.equal(pi.entrypoint, "scripts/sidecars/pi-durable-service.mjs");
  assert.match(serviceSource, /probePiDurableRuntime/);
  assert.match(serviceSource, /ensureManagedPiDurableInstalled/);
  assert.doesNotMatch(serviceSource, /resolvePiLocalRuntime|\/chat\/completions|\/responses/);
});
