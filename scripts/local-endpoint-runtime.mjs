import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import {
  LocalEndpointRegistry,
  endpointConsumerEvidence,
  reserveLoopbackPort,
  verifyExactLocalInstance,
} from "../core/runtime/local-endpoint-registry.mjs";
import {
  cleanupVerificationSyntheticHome,
  establishVerificationSyntheticHuman,
  prepareVerificationSyntheticHome,
  verificationSyntheticRuntime,
} from "./full-verification-auth.mjs";

const exec = promisify(execFile);
const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_POLL_MS = 400;
const MAX_PORT_ATTEMPTS = 5;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function localDataRoot() {
  if (process.env.LOCALAPPDATA) return process.env.LOCALAPPDATA;
  return process.platform === "win32"
    ? path.join(os.homedir(), "AppData", "Local")
    : path.join(os.homedir(), ".local", "share");
}

function safeOpaque(value, prefix) {
  const raw = String(value || "").trim();
  if (/^[a-z0-9][a-z0-9._:-]{1,127}$/i.test(raw)) return raw;
  return `${prefix}-${createHash("sha256").update(raw || randomUUID()).digest("hex").slice(0, 20)}`;
}

function reportEndpointWarning(context, error) {
  const detail = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[local-endpoint] ${context}: ${detail.replace(/[\r\n]+/g, " ").slice(0, 500)}\n`);
}

async function gitValue(repoRoot, args) {
  const result = await exec("git", args, {
    cwd: repoRoot,
    env: process.env,
    windowsHide: true,
    shell: false,
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  });
  return String(result.stdout || "").trim();
}

export async function localEndpointProvenance(repoRoot) {
  const root = path.resolve(repoRoot);
  const [commitSha, branchRef] = await Promise.all([
    gitValue(root, ["rev-parse", "HEAD"]),
    gitValue(root, ["rev-parse", "--abbrev-ref", "HEAD"]),
  ]);
  if (!/^[a-f0-9]{40}$/i.test(commitSha)) throw new Error("Managed endpoint could not prove the exact Git commit before launch.");
  return {
    commitSha: commitSha.toLowerCase(),
    branchRef: safeOpaque(branchRef, "branch"),
    worktreeRef: `wt-${createHash("sha256").update(root).digest("hex").slice(0, 20)}`,
  };
}

export function localEndpointRegistryPath(jobId) {
  const safeJob = safeOpaque(jobId, "job");
  return path.join(localDataRoot(), "PlotPickle", "local-endpoints", `${safeJob}.json`);
}

async function persistRegistry(registry, registryPath) {
  await mkdir(path.dirname(registryPath), { recursive: true, mode: 0o700 });
  await writeFile(registryPath, `${JSON.stringify(registry.snapshot(), null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

export async function loadLocalEndpointSnapshot(registryPath) {
  const parsed = JSON.parse(await readFile(registryPath, "utf8"));
  if (parsed?.schemaVersion !== 1 || parsed?.authority !== "plotpickle-local-endpoint-registry" || !Array.isArray(parsed.endpoints)) {
    throw new Error("Local endpoint registry snapshot is invalid.");
  }
  return parsed;
}

export async function resolveEndpointSnapshot(registryPath, {
  endpointId,
  expectedGeneration,
  jobId,
  worktreeRef,
  profileRef,
} = {}) {
  const snapshot = await loadLocalEndpointSnapshot(registryPath);
  const record = snapshot.endpoints.find((item) => item?.endpointId === endpointId);
  if (!record) throw new Error("Local endpoint is unavailable for this job.");
  if (expectedGeneration !== undefined && Number(record.generation) !== Number(expectedGeneration)) {
    throw new Error(`Local endpoint generation changed from ${expectedGeneration} to ${record.generation}; browser/UAT evidence is invalid.`);
  }
  if (jobId && record.jobId !== jobId) throw new Error("Local endpoint job provenance does not match the requesting job.");
  if (worktreeRef && record.worktreeRef !== worktreeRef) throw new Error("Local endpoint worktree provenance does not match the requesting job.");
  if (record.profileRef && record.profileRef !== profileRef) throw new Error("Local endpoint profile provenance does not match the requesting Human context.");
  if (new Set(["stopped", "failed"]).has(record.lifecycleState)) throw new Error(`Local endpoint is ${record.lifecycleState}.`);
  return record;
}

function capture(runtime, chunk, stream, onOutput) {
  const text = String(chunk || "");
  if (!text) return;
  runtime.outputTail = `${runtime.outputTail || ""}${text}`.slice(-12_000);
  onOutput?.(text, stream);
}

async function terminateOwnedProcess(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
        shell: false,
      });
      killer.once("error", () => resolve());
      killer.once("exit", () => resolve());
    });
    return;
  }
  child.kill("SIGTERM");
  for (let index = 0; index < 10 && child.exitCode === null; index += 1) await sleep(100);
  if (child.exitCode === null) child.kill("SIGKILL");
}

async function rootReady(baseUrl, fetchImpl) {
  try {
    const response = await fetchImpl(baseUrl, {
      headers: { Accept: "text/html,application/xhtml+xml" },
      cache: "no-store",
      signal: AbortSignal.timeout(2_500),
    });
    const body = await response.text();
    return response.ok && /\bPlotPickle\b/i.test(body);
  } catch (error) {
    if (error?.name !== "AbortError" && error?.name !== "TimeoutError" && error?.cause?.code !== "ECONNREFUSED" && error?.code !== "ECONNREFUSED") {
      reportEndpointWarning("readiness root probe failed", error);
    }
    return false;
  }
}

async function cleanupSyntheticAuth(runtime) {
  if (!runtime?.verificationAuthHome) return;
  const home = runtime.verificationAuthHome;
  runtime.verificationAuthHome = "";
  runtime.verificationAuth = null;
  await cleanupVerificationSyntheticHome(home);
}

export function endpointRuntimeEnvironment(runtime) {
  if (!runtime?.record || !runtime?.registryPath) return {};
  const record = runtime.record;
  return {
    PLOTPICKLE_LOCAL_ENDPOINT_REGISTRY: runtime.registryPath,
    PLOTPICKLE_LOCAL_ENDPOINT_ID: record.endpointId,
    PLOTPICKLE_LOCAL_ENDPOINT_GENERATION: String(record.generation),
    PLOTPICKLE_LOCAL_ENDPOINT_JOB: record.jobId || "",
    PLOTPICKLE_LOCAL_ENDPOINT_WORKTREE: record.worktreeRef || "",
    PLOTPICKLE_LOCAL_ENDPOINT_COMMIT: record.commitSha || "",
    PLOTPICKLE_LOCAL_ENDPOINT_PROFILE: record.profileRef || "",
    PLOTPICKLE_ACCEPTANCE_URL: record.url,
    ...(runtime.verificationAuth?.environment || {}),
  };
}

export async function startManagedPlotPickleEndpoint({
  repoRoot,
  jobId = `job-${randomUUID().replaceAll("-", "")}`,
  profileRef,
  serviceKind = "plotpickle-app",
  startupContract = "plotpickle-managed-endpoint-v1",
  timeoutMs = DEFAULT_TIMEOUT_MS,
  pollMs = DEFAULT_POLL_MS,
  onStatus = () => {},
  onOutput = () => {},
  deps = {},
} = {}) {
  if (!repoRoot) throw new Error("Managed PlotPickle endpoint requires a repository root.");
  const root = path.resolve(repoRoot);
  const accessImpl = deps.access || access;
  const spawnImpl = deps.spawn || spawn;
  const fetchImpl = deps.fetch || globalThis.fetch;
  const reserve = deps.reservePort || reserveLoopbackPort;
  const sleepImpl = deps.sleep || sleep;
  const provenance = deps.provenance ? await deps.provenance(root) : await localEndpointProvenance(root);
  const viteCli = path.join(root, "node_modules", "vite", "bin", "vite.js");
  await accessImpl(viteCli);

  const syntheticAuth = serviceKind === "plotpickle-full-verification"
    ? verificationSyntheticRuntime(jobId)
    : null;
  if (syntheticAuth) await prepareVerificationSyntheticHome(syntheticAuth.home);

  const registry = new LocalEndpointRegistry();
  const registryPath = deps.registryPath || localEndpointRegistryPath(jobId);
  const endpointId = safeOpaque(`ep-${randomUUID().replaceAll("-", "")}`, "ep");
  let record = null;
  let child = null;
  const runtime = {
    owned: true,
    stopped: false,
    source: "local-endpoint-registry-direct",
    registry,
    registryPath,
    endpointId,
    record: null,
    child: null,
    outputTail: "",
    proof: null,
    stop: null,
    verificationAuthHome: syntheticAuth?.home || "",
    verificationAuth: null,
  };

  for (let attempt = 1; attempt <= MAX_PORT_ATTEMPTS; attempt += 1) {
    runtime.outputTail = "";
    const reservation = await reserve({ host: "127.0.0.1" });
    const instanceRef = `inst-${randomUUID().replaceAll("-", "")}`;
    if (!record) {
      record = registry.register({
        endpointId,
        serviceKind,
        ownerScope: "job",
        ...(profileRef ? { profileRef: safeOpaque(profileRef, "profile") } : {}),
        jobId: safeOpaque(jobId, "job"),
        worktreeRef: provenance.worktreeRef,
        branchRef: provenance.branchRef,
        commitSha: provenance.commitSha,
        transport: "direct",
        host: reservation.host,
        port: reservation.port,
        lifecycleState: "starting",
        readinessState: "not_ready",
        generation: 1,
        instanceRef,
      });
    } else {
      record = registry.restart(endpointId, {
        host: reservation.host,
        port: reservation.port,
        instanceRef,
        processRef: undefined,
      });
    }
    runtime.record = record;
    await persistRegistry(registry, registryPath);
    await reservation.release();

    onStatus("starting", `${record.endpointId} generation ${record.generation} on an allocated loopback port.`);
    child = spawnImpl(process.execPath, [
      viteCli,
      "--host", record.host,
      "--port", String(record.port),
      "--strictPort",
    ], {
      cwd: root,
      env: {
        ...process.env,
        ...(syntheticAuth?.runtimeEnv || {}),
        NODE_ENV: "development",
        VITE_CONFIG_NATIVE_IGNORE_WARNING: "true",
        PLOTPICKLE_STARTUP_CONTRACT: startupContract,
        PLOTPICKLE_INSTANCE_ID: instanceRef,
        PLOTPICKLE_EXPECTED_COMMIT: provenance.commitSha,
        PLOTPICKLE_ENDPOINT_ID: record.endpointId,
        PLOTPICKLE_ENDPOINT_GENERATION: String(record.generation),
        PLOTPICKLE_ENDPOINT_JOB: record.jobId,
        PLOTPICKLE_ENDPOINT_WORKTREE: record.worktreeRef,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: false,
    });
    runtime.child = child;
    child.stdout?.setEncoding?.("utf8");
    child.stderr?.setEncoding?.("utf8");
    child.stdout?.on?.("data", (chunk) => capture(runtime, chunk, "stdout", onOutput));
    child.stderr?.on?.("data", (chunk) => capture(runtime, chunk, "stderr", onOutput));
    if (child.pid) {
      record = registry.transition(endpointId, { processRef: `pid:${child.pid}`, lifecycleState: "running" });
      runtime.record = record;
      await persistRegistry(registry, registryPath);
    }

    const deadline = Date.now() + timeoutMs;
    let lostRace = false;
    while (Date.now() < deadline) {
      if (child.exitCode !== null || child.signalCode !== null) {
        const tail = runtime.outputTail.slice(-2_000);
        if (/EADDRINUSE|address already in use/i.test(tail)) {
          lostRace = true;
          onStatus("retry", "Allocated port was taken before bind; retrying without terminating the other process.");
          break;
        }
        record = registry.transition(endpointId, { lifecycleState: "failed", readinessState: "degraded" });
        runtime.record = record;
        await persistRegistry(registry, registryPath);
        await cleanupSyntheticAuth(runtime);
        throw new Error(`Managed PlotPickle endpoint exited before readiness.${tail ? ` ${tail}` : ""}`);
      }

      const proof = await verifyExactLocalInstance({ ...record, instanceRef }, {
        fetchImpl,
        expectedGeneration: record.generation,
        expectedCommitSha: provenance.commitSha,
        expectedInstanceRef: instanceRef,
        timeoutMs: 2_500,
      });
      if (proof.ok && await rootReady(record.url, fetchImpl)) {
        try {
          if (syntheticAuth && !runtime.verificationAuth) {
            runtime.verificationAuth = await establishVerificationSyntheticHuman({
              baseUrl: record.url,
              home: syntheticAuth.home,
              fetchImpl,
            });
          }
        } catch (error) {
          await terminateOwnedProcess(child);
          record = registry.transition(endpointId, { lifecycleState: "failed", readinessState: "degraded" });
          runtime.record = record;
          await persistRegistry(registry, registryPath);
          await cleanupSyntheticAuth(runtime);
          throw new Error(`Managed PlotPickle endpoint could not establish its isolated synthetic Human session: ${error instanceof Error ? error.message : String(error)}`);
        }
        record = registry.transition(endpointId, { lifecycleState: "running" });
        record = registry.markReadiness(endpointId, "ready", { kind: "exact-instance", result: "pass", detail: proof.reason });
        runtime.record = record;
        runtime.proof = proof;
        runtime.baseUrl = record.url;
        await persistRegistry(registry, registryPath);
        runtime.stop = () => stopManagedLocalEndpoint(runtime);
        onStatus("ready", `${record.endpointId} generation ${record.generation} exact-instance proof passed${runtime.verificationAuth ? "; isolated synthetic Human authenticated" : ""}.`);
        return runtime;
      }
      await sleepImpl(pollMs);
    }

    if (lostRace) continue;
    await terminateOwnedProcess(child);
    record = registry.transition(endpointId, { lifecycleState: "failed", readinessState: "degraded" });
    runtime.record = record;
    await persistRegistry(registry, registryPath);
    await cleanupSyntheticAuth(runtime);
    throw new Error(`Managed PlotPickle endpoint did not pass exact-instance readiness within ${Math.ceil(timeoutMs / 1000)} seconds.`);
  }

  record = registry.transition(endpointId, { lifecycleState: "failed", readinessState: "degraded" });
  runtime.record = record;
  await persistRegistry(registry, registryPath);
  await cleanupSyntheticAuth(runtime);
  throw new Error("Managed PlotPickle endpoint exhausted bounded port-race retries.");
}

export async function stopManagedLocalEndpoint(runtime, { removeRegistryFile = false } = {}) {
  if (!runtime?.owned || runtime.stopped) return;
  runtime.stopped = true;
  try {
    runtime.record = runtime.registry.transition(runtime.endpointId, { lifecycleState: "stopping" });
    await persistRegistry(runtime.registry, runtime.registryPath);
  } catch (error) {
    reportEndpointWarning("could not persist stopping state", error);
  }
  await terminateOwnedProcess(runtime.child);
  try {
    runtime.record = runtime.registry.transition(runtime.endpointId, { lifecycleState: "stopped", readinessState: "not_ready" });
    await persistRegistry(runtime.registry, runtime.registryPath);
  } catch (error) {
    reportEndpointWarning("could not persist stopped state", error);
  }
  try {
    await cleanupSyntheticAuth(runtime);
  } catch (error) {
    reportEndpointWarning("could not remove synthetic Human runtime state", error);
  }
  if (removeRegistryFile) {
    try {
      await unlink(runtime.registryPath);
    } catch (error) {
      if (error?.code !== "ENOENT") reportEndpointWarning("could not remove endpoint registry file", error);
    }
  }
}

export function managedEndpointEvidence(runtime) {
  return endpointConsumerEvidence(runtime.record, runtime.proof || {});
}
