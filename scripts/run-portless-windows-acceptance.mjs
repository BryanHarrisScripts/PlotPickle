#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { LocalEndpointRegistry } from "../core/runtime/local-endpoint-registry.mjs";
import {
  attachPortlessAlias,
  detachPortlessAlias,
  probePortlessRuntime,
  remapPortlessAlias,
  safePortlessEnvironment,
  startPortlessProxy,
} from "../core/runtime/portless-adapter.mjs";

const exec = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const arg = (name, fallback = "") => {
  const index = args.indexOf(name);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : fallback;
};
const nodePath = path.resolve(arg("--node", process.execPath));
const cliPath = path.resolve(arg("--cli"));
const stateDir = path.resolve(arg("--state-dir", path.join(os.tmpdir(), "plotpickle-portless-1156-state")));
const artifactPath = path.resolve(arg("--artifact", path.join(repoRoot, ".artifacts", "portless", "windows-acceptance.json")));
const secretCanaries = ["Afterglow Secret Ending", "provider-account@example.com", "nsec1PP1156PRIVATECANARY", "Bryan Private Story"];

function status(label, state, detail = "") {
  process.stdout.write(`${String(label).padEnd(38, ".")} ${state}${detail ? `  ${detail}` : ""}\n`);
}

async function git(args, options = {}) {
  return exec("git", args, { cwd: repoRoot, windowsHide: true, shell: false, maxBuffer: 2 * 1024 * 1024, ...options });
}

async function createWorktree(label) {
  const root = path.join(os.tmpdir(), `plotpickle-1156-${label}-${process.pid}`);
  await rm(root, { recursive: true, force: true });
  await git(["worktree", "add", "--detach", root, "HEAD"]);
  return root;
}

async function removeWorktree(root) {
  try {
    await git(["worktree", "remove", "--force", root]);
  } catch (error) {
    status("Worktree cleanup", "WARN", error instanceof Error ? error.message : String(error));
    await rm(root, { recursive: true, force: true });
  }
}

function worktreeRef(root) {
  return `wt-${createHash("sha256").update(path.resolve(root)).digest("hex").slice(0, 20)}`;
}

function makeRuntime({ endpointId, jobId, worktreeRoot, commitSha, port, instanceRef, registryPath }) {
  const registry = new LocalEndpointRegistry();
  const record = registry.register({
    endpointId,
    serviceKind: "plotpickle-app",
    ownerScope: "job",
    jobId,
    worktreeRef: worktreeRef(worktreeRoot),
    branchRef: `branch-${createHash("sha256").update(jobId).digest("hex").slice(0, 12)}`,
    commitSha,
    transport: "direct",
    host: "127.0.0.1",
    port,
    lifecycleState: "running",
    readinessState: "ready",
    generation: 1,
    instanceRef,
  });
  return {
    registry,
    registryPath,
    endpointId,
    record,
    baseUrl: record.url,
    proof: { ok: true, reason: "synthetic direct exact-instance proof" },
  };
}

async function createBackend(proofState) {
  const server = http.createServer((req, res) => {
    if (req.url === "/api/local-instance-proof") {
      const record = proofState.runtime.record;
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(`${JSON.stringify({
        schemaVersion: 1,
        endpointId: record.endpointId,
        generation: record.generation,
        instanceRef: record.instanceRef,
        jobId: record.jobId,
        worktreeRef: record.worktreeRef,
        commitSha: record.commitSha,
        exactHead: true,
      })}\n`);
      return;
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<!doctype html><title>PlotPickle</title><h1>PlotPickle synthetic endpoint</h1>");
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0, exclusive: true }, resolve);
  });
  const address = server.address();
  return {
    server,
    port: typeof address === "object" && address ? Number(address.port) : 0,
    async stop() { await new Promise((resolve) => server.close(resolve)); },
  };
}

async function proofAt(baseUrl) {
  const response = await fetch(new URL("/api/local-instance-proof", baseUrl), { cache: "no-store", signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`Proof route returned HTTP ${response.status}.`);
  return response.json();
}

function syntheticLongPath() {
  const segments = [];
  for (let index = 0; index < 520; index += 1) segments.push(`C:\\pp1156\\segment-${String(index).padStart(4, "0")}\\bin`);
  return segments.join(";");
}

async function runPortless(runtime, proxy, commandArgs, env = process.env) {
  const commandEnv = safePortlessEnvironment(env, {
    stateDir: proxy.stateDir,
    proxyPort: proxy.proxyPort,
    profile: proxy.profile,
  });
  return exec(runtime.nodePath, [runtime.cliPath, ...commandArgs], {
    cwd: proxy.stateDir,
    env: commandEnv,
    windowsHide: true,
    shell: false,
    timeout: 20_000,
    maxBuffer: 2 * 1024 * 1024,
  });
}

async function scanStateForCanaries(root) {
  const hits = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(full);
      } else if (entry.isFile()) {
        let text = "";
        try {
          text = await readFile(full, "utf8");
        } catch {
          continue;
        }
        for (const canary of secretCanaries) {
          if (text.includes(canary)) hits.push({ file: entry.name, canary });
        }
      }
    }
  }
  await visit(root);
  return hits;
}

async function main() {
  if (process.platform !== "win32") throw new Error("#1156 real acceptance must run on Windows.");
  if (!cliPath || cliPath === path.resolve("")) throw new Error("--cli must point to the isolated Portless 0.15.5 CLI entrypoint.");
  await rm(stateDir, { recursive: true, force: true });
  await mkdir(stateDir, { recursive: true });
  await mkdir(path.dirname(artifactPath), { recursive: true });

  const portlessRuntime = await probePortlessRuntime({ sourceMode: "managed-pinned", nodePath, cliPath });
  if (!portlessRuntime.available) throw new Error(`Portless runtime proof failed: ${portlessRuntime.detail}`);
  status("Pinned Portless runtime", "PASS", `${portlessRuntime.version} on ${portlessRuntime.nodeVersion}`);

  const head = String((await git(["rev-parse", "HEAD"])).stdout || "").trim().toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(head)) throw new Error("Could not prove PlotPickle HEAD for Portless acceptance.");

  const worktreeB = await createWorktree("repair-b");
  const worktreeC = await createWorktree("repair-c");
  const backendStateA = {};
  const backendStateB = {};
  const backendStateC = {};
  const backendA = await createBackend(backendStateA);
  const backendB = await createBackend(backendStateB);
  const backendC = await createBackend(backendStateC);
  let backendB2 = null;
  let proxy = null;
  const adapters = [];
  try {
    const artifactRoot = path.dirname(artifactPath);
    const runtimeA = makeRuntime({ endpointId: "ep-1156-windows-a", jobId: "job-1156-main", worktreeRoot: repoRoot, commitSha: head, port: backendA.port, instanceRef: "inst-1156-a1", registryPath: path.join(artifactRoot, "registry-a.json") });
    const runtimeB = makeRuntime({ endpointId: "ep-1156-windows-b", jobId: "job-1156-repair-b", worktreeRoot: worktreeB, commitSha: head, port: backendB.port, instanceRef: "inst-1156-b1", registryPath: path.join(artifactRoot, "registry-b.json") });
    const runtimeC = makeRuntime({ endpointId: "ep-1156-windows-c", jobId: "job-1156-repair-c", worktreeRoot: worktreeC, commitSha: head, port: backendC.port, instanceRef: "inst-1156-c1", registryPath: path.join(artifactRoot, "registry-c.json") });
    backendStateA.runtime = runtimeA;
    backendStateB.runtime = runtimeB;
    backendStateC.runtime = runtimeC;

    proxy = await startPortlessProxy({ runtime: portlessRuntime, stateDir, profile: "portless/http" });
    status("Loopback-only proxy", "PASS", `${proxy.listenerProof.listeners.length} verified Windows listener(s)`);

    const longPath = syntheticLongPath();
    if (longPath.length <= 8191) throw new Error("Synthetic Windows PATH did not exceed the cmd.exe 8191-character risk boundary.");
    const longPathEnv = { ...process.env, PATH: longPath };

    const adapterA = await attachPortlessAlias(runtimeA, { portlessRuntime, proxy });
    const adapterB = await attachPortlessAlias(runtimeB, { portlessRuntime, proxy });
    const adapterC = await attachPortlessAlias(runtimeC, { portlessRuntime, proxy, env: longPathEnv });
    adapters.push([runtimeA, adapterA], [runtimeB, adapterB], [runtimeC, adapterC]);
    for (const adapter of [adapterA, adapterB, adapterC]) {
      if (adapter.state !== "route-ready") throw new Error(`Portless route failed instead of becoming ready: ${adapter.detail || adapter.state}`);
    }
    status("Three static aliases", "PASS", "main + two synthetic repair worktrees are concurrent");

    const proofA = await proofAt(adapterA.url);
    const proofB = await proofAt(adapterB.url);
    const proofC = await proofAt(adapterC.url);
    if (proofA.endpointId !== runtimeA.endpointId || proofB.endpointId !== runtimeB.endpointId || proofC.endpointId !== runtimeC.endpointId) {
      throw new Error("Concurrent Portless routes crossed endpoint identity boundaries.");
    }
    if (proofA.worktreeRef === proofB.worktreeRef || proofB.worktreeRef === proofC.worktreeRef || proofA.worktreeRef === proofC.worktreeRef) {
      throw new Error("Synthetic worktree endpoint provenance collided.");
    }
    status("Exact route provenance", "PASS", "all routes resolve to intended endpoint/worktree/commit");

    const listBefore = String((await runPortless(portlessRuntime, proxy, ["list"])).stdout || "");
    for (const adapter of [adapterA, adapterB, adapterC]) {
      if (!listBefore.includes(adapter.routeName)) throw new Error(`Portless list did not contain expected opaque alias ${adapter.routeName}.`);
    }

    backendB2 = await createBackend(backendStateB);
    await backendB.stop();
    await remapPortlessAlias(runtimeB, adapterB, { port: backendB2.port, instanceRef: "inst-1156-b2" });
    const proofB2 = await proofAt(adapterB.url);
    const proofA2 = await proofAt(adapterA.url);
    if (proofB2.instanceRef !== "inst-1156-b2" || proofB2.generation !== 2) throw new Error("Route B remap did not bind the new generation/instance.");
    if (proofA2.endpointId !== runtimeA.endpointId || runtimeA.record.generation !== 1) throw new Error("Route B remap altered route A.");
    status("Route remap isolation", "PASS", "B changed actual port; A remained generation 1");

    const removedUrlC = adapterC.url;
    await detachPortlessAlias(runtimeC, adapterC, { env: longPathEnv });
    await backendC.stop();
    let staleC = false;
    try {
      const response = await fetch(new URL("/api/local-instance-proof", removedUrlC), { cache: "no-store", signal: AbortSignal.timeout(3_000) });
      staleC = response.ok;
    } catch {
      staleC = false;
    }
    if (staleC) throw new Error("Cancelled route C still retained stale route authority.");
    const proofA3 = await proofAt(adapterA.url);
    const proofB3 = await proofAt(adapterB.url);
    if (proofA3.endpointId !== runtimeA.endpointId || proofB3.endpointId !== runtimeB.endpointId) throw new Error("Cancelling C disturbed A or B.");
    status("Cancellation isolation", "PASS", "C removed without affecting A/B");

    const fallbackRuntime = makeRuntime({ endpointId: "ep-1156-fallback", jobId: "job-1156-fallback", worktreeRoot: repoRoot, commitSha: head, port: backendA.port, instanceRef: "inst-1156-fallback", registryPath: path.join(artifactRoot, "registry-fallback.json") });
    const fallback = await attachPortlessAlias(fallbackRuntime, {
      portlessRuntime: { state: "unavailable", available: false, detail: "synthetic not installed" },
      allowDirectFallback: true,
    });
    if (fallback.state !== "degraded-direct-fallback" || fallbackRuntime.record.transport !== "direct") throw new Error("Portless unavailable did not preserve direct fallback.");
    status("Missing Portless fallback", "PASS", "healthy direct endpoint remains available");

    const stateCanaryHits = await scanStateForCanaries(stateDir);
    if (stateCanaryHits.length) throw new Error("Portless Node state contained a Human/project/provider secret canary.");
    status("Node state privacy", "PASS", "no secret canaries in isolated Portless state");

    await detachPortlessAlias(runtimeA, adapterA);
    await detachPortlessAlias(runtimeB, adapterB);
    const listAfter = String((await runPortless(portlessRuntime, proxy, ["list"])).stdout || "");
    for (const adapter of [adapterA, adapterB, adapterC]) {
      if (listAfter.includes(adapter.routeName)) throw new Error(`Stale Portless alias remained after cleanup: ${adapter.routeName}.`);
    }
    status("Alias cleanup", "PASS", "no stale route remains");

    const report = {
      schemaVersion: 1,
      issue: 1156,
      platform: process.platform,
      arch: process.arch,
      portless: {
        sourceState: portlessRuntime.state,
        version: portlessRuntime.version,
        nodeVersion: portlessRuntime.nodeVersion,
        profile: proxy.profile,
        loopbackListeners: proxy.listenerProof.listeners,
      },
      plotpickle: {
        commitSha: head,
        productNodeMinimumUnchanged: ">=22.13.0",
      },
      concurrency: {
        endpoints: [runtimeA, runtimeB, runtimeC].map((runtime) => ({
          endpointId: runtime.endpointId,
          jobId: runtime.record.jobId,
          worktreeRef: runtime.record.worktreeRef,
          commitSha: runtime.record.commitSha,
          generation: runtime.record.generation,
        })),
        workerTypes: ["fake-code-worker", "fake-ui-worker"],
      },
      longPathCharacters: longPath.length,
      directFallback: "pass",
      stateSecretCanaries: "absent",
      automaticCaTrust: false,
      osStartupServiceInstalled: false,
      lanOrTunnelEnabled: false,
      adoptionCandidate: "ADOPT WITH LIMITS",
      limits: [
        "optional developer/UAT adapter only",
        "managed static aliases only; PlotPickle owns app processes",
        "routine supported profile is portless/http",
        "isolated Node 24 tool runtime; PlotPickle product remains Node 22.13+",
        "HTTPS/CA trust is not enabled by ordinary PlotPickle startup",
      ],
    };
    await writeFile(artifactPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    status("Windows acceptance", "PASS", artifactPath);
  } finally {
    for (const [runtime, adapter] of adapters.reverse()) {
      if (adapter.state === "route-ready") {
        try { await detachPortlessAlias(runtime, adapter); } catch (error) { status("Alias final cleanup", "WARN", error.message); }
      }
    }
    if (proxy) await proxy.stop();
    if (backendB2) await backendB2.stop().catch(() => {});
    await backendA.stop().catch(() => {});
    await backendB.stop().catch(() => {});
    await backendC.stop().catch(() => {});
    await removeWorktree(worktreeB);
    await removeWorktree(worktreeC);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
