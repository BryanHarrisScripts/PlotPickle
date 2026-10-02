#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { LocalSidecarSupervisor } from "../core/sidecars/local-supervisor.ts";
import { createRuntimeServiceRegistry, registeredServiceLaunch } from "../core/sidecars/runtime/service-registry.mjs";
import { runtimeStatusDocument, writeRuntimeStatus } from "../core/sidecars/runtime/status-store.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(await readFile(path.join(repoRoot, "config", "runtime-sidecars.json"), "utf8"));
const registry = createRuntimeServiceRegistry(config);
const home = path.resolve(process.env.PLOTPICKLE_HOME || path.join(process.env.LOCALAPPDATA || process.env.USERPROFILE || repoRoot, "PlotPickle"));
const server = String(process.env.PLOTPICKLE_URL || "http://127.0.0.1:4173").replace(/\/$/u, "");
const shutdownSignal = path.resolve(process.env.PLOTPICKLE_SHUTDOWN_SIGNAL || path.join(home, "node", "runtime", "shutdown-request.json"));
const statusFile = path.resolve(home, registry.statusFile);
const startupMarker = String(process.env.PLOTPICKLE_STARTUP_CONTRACT || "");
const supervisor = new LocalSidecarSupervisor();
const reportedStates = new Map();
const timing = { supervisorStartedAt: new Date().toISOString(), coreReadyAt: null, servicesStartedAt: null, servicesConvergedAt: null, stoppedAt: null };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const exists = async (file) => access(file).then(() => true, () => false);

function evidence(kind, summary) {
  return Object.freeze({ kind, summary, observedAt: new Date().toISOString() });
}

async function coreReady() {
  try {
    const response = await fetch(`${server}/skin-v1`, {
      signal: AbortSignal.timeout(2500),
      headers: { "X-PlotPickle-Startup-Probe": "sidecar-supervisor" },
      cache: "no-store",
    });
    if (!response.ok) return false;
    if (!startupMarker) return true;
    const body = await response.text();
    return body.includes(startupMarker);
  } catch {
    return false;
  }
}

async function snapshot(supervisorState, coreState) {
  const services = registry.services.map((service) => ({
    id: service.id,
    label: service.label,
    ...supervisor.status(service.id),
  }));
  if (supervisorState === "ready" && timing.servicesStartedAt && !timing.servicesConvergedAt && services.every((service) => service.state !== "starting")) {
    timing.servicesConvergedAt = new Date().toISOString();
  }
  for (const service of services) {
    const previous = reportedStates.get(service.id);
    if (previous !== service.state && service.state !== "starting") {
      console.log(`[SIDECARS] ${service.label}: ${service.state}`);
    }
    reportedStates.set(service.id, service.state);
  }
  await writeRuntimeStatus(statusFile, runtimeStatusDocument({
    supervisor: { state: supervisorState, pid: process.pid },
    core: { state: coreState, url: server },
    services,
    timing: { ...timing },
  }));
}

async function waitForCore() {
  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    if (await exists(shutdownSignal)) return false;
    if (await coreReady()) return true;
    await sleep(500);
  }
  return false;
}

async function stopAll() {
  await Promise.all(registry.services.map((service) => supervisor.stopAndWait(service.id)));
  timing.stoppedAt = new Date().toISOString();
  await snapshot("stopped", "stopped").catch(() => {});
}

async function main() {
  console.log("[SIDECARS] Runtime supervisor starting; core PlotPickle remains independent.");
  await snapshot("starting", "starting");

  const ready = await waitForCore();
  if (!ready) {
    console.log("[SIDECARS] Supervisor stopped before core readiness; PlotPickle core was not terminated.");
    await stopAll();
    return;
  }

  console.log("[SIDECARS] Core ready. Starting registered runtime services asynchronously.");
  timing.coreReadyAt = new Date().toISOString();
  timing.servicesStartedAt = new Date().toISOString();
  for (const service of registry.services) {
    const launch = registeredServiceLaunch(registry, service.id, { repoRoot });
    if (!await exists(launch.entrypoint)) {
      supervisor.mark(service.id, "unavailable", [evidence("entrypoint-missing", `${service.label} is registered but its runtime entrypoint is not installed yet.`)]);
      console.log(`[SIDECARS] ${service.label}: unavailable (runtime entrypoint not installed yet)`);
      continue;
    }
    supervisor.start({
      id: launch.id,
      command: launch.command,
      args: [...launch.args, "--home", home, "--server", server, "--status-file", statusFile],
      enabled: launch.enabled,
      ipc: true,
    });
    console.log(`[SIDECARS] ${service.label}: starting`);
  }
  await sleep(150);
  await snapshot("ready", "ready");

  let unreachableSince = 0;
  while (true) {
    if (await exists(shutdownSignal)) break;
    if (await coreReady()) {
      unreachableSince = 0;
    } else if (!unreachableSince) {
      unreachableSince = Date.now();
    } else if (Date.now() - unreachableSince >= 12_000) {
      break;
    }
    await snapshot("ready", "ready").catch(() => {});
    await sleep(1000);
  }

  await stopAll();
}

let stopping = false;
async function requestStop() {
  if (stopping) return;
  stopping = true;
  await stopAll().catch(() => {});
  process.exit(0);
}
process.on("SIGINT", requestStop);
process.on("SIGTERM", requestStop);

main().catch(async (error) => {
  console.error(`[SIDECARS] Supervisor degraded: ${error instanceof Error ? error.message : String(error)}`);
  await stopAll().catch(() => {});
  await snapshot("degraded", "unknown").catch(() => {});
  process.exitCode = 0;
});
