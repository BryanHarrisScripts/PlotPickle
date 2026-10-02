import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { LocalSidecarSupervisor } from "../core/sidecars/local-supervisor.ts";
import { waitForOwnedShutdown } from "../core/sidecars/runtime/shutdown-wait.mjs";

async function waitForState(supervisor, id, state) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (supervisor.status(id).state === state) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`${id} did not reach ${state}`);
}

test("#2698 shutdown waits for actual owned process exit", async () => {
  const supervisor = new LocalSidecarSupervisor();
  supervisor.start({ id: "owned", command: process.execPath, ipc: true, args: ["-e", "process.send({kind:'status',state:'ready'}); setInterval(()=>{},1000)"] });
  try {
    await waitForState(supervisor, "owned", "ready");
    assert.equal((await supervisor.stopAndWait("owned")).state, "stopped");
    assert.equal(supervisor.status("owned").state, "stopped");
    assert.equal((await supervisor.stopAndWait("owned")).state, "stopped");
  } finally { supervisor.stop("owned"); }
});

test("#2698 launcher retains the shutdown handshake until services and browser release ownership", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "plotpickle-shutdown-"));
  const runtime = path.join(home, "node", "runtime");
  const status = path.join(runtime, "sidecars", "status.json");
  const browser = path.join(runtime, "browser-owner.json");
  try {
    await mkdir(path.dirname(status), { recursive: true });
    await writeFile(status, JSON.stringify({ supervisor: { state: "ready" } }));
    await writeFile(browser, "{}");
    let finished = false;
    const waiting = waitForOwnedShutdown(home, { timeoutMs: 2000 }).then(() => { finished = true; });
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(finished, false);
    await writeFile(status, JSON.stringify({ supervisor: { state: "stopped" } }));
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(finished, false);
    await rm(browser);
    await waiting;
    assert.equal(finished, true);
    await writeFile(status, JSON.stringify({ supervisor: { state: "failed" } }));
    await assert.rejects(waitForOwnedShutdown(home), /did not confirm shutdown/);
  } finally { await rm(home, { recursive: true, force: true }); }
});

test("#2698 failed service does not prevent a healthy service from running or stopping", async () => {
  const supervisor = new LocalSidecarSupervisor();
  supervisor.start({ id: "failed", command: process.execPath, ipc: true, args: ["-e", "process.exit(1)"] });
  supervisor.start({ id: "healthy", command: process.execPath, ipc: true, args: ["-e", "process.send({kind:'status',state:'ready'}); setInterval(()=>{},1000)"] });
  try {
    await waitForState(supervisor, "failed", "degraded");
    await waitForState(supervisor, "healthy", "ready");
    const stopped = await Promise.all(["failed", "healthy"].map((id) => supervisor.stopAndWait(id)));
    assert.ok(stopped.every((status) => status.state === "stopped"));
  } finally { supervisor.stop("failed"); supervisor.stop("healthy"); }
});


test("#2698 managed Pi runtime uses native import-only package exports", async () => {
  const { importPiDurableModule } = await import("../core/sidecars/pi-durable-adapter.mjs");
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-pi-esm-"));
  const folder = path.join(root, "node_modules", "@earendil-works", "chord");
  try {
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "package.json"), JSON.stringify({ name: "@earendil-works/chord", type: "module", exports: { "./context": { import: "./context.mjs" } } }));
    await writeFile(path.join(folder, "context.mjs"), "export const BACKGROUND_CONTEXT = 'managed-context';\n");
    const module = await importPiDurableModule(root, "@earendil-works/chord/context");
    assert.equal(module.BACKGROUND_CONTEXT, "managed-context");
  } finally { await rm(root, { recursive: true, force: true }); }
});
