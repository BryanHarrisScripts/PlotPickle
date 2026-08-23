import { execFile, spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import {
  endpointConsumerEvidence,
  opaquePortlessRouteName,
  reserveLoopbackPort,
  verifyExactLocalInstance,
} from "./local-endpoint-registry.mjs";

const exec = promisify(execFile);
export const PORTLESS_PINNED_VERSION = "0.15.5";
export const PORTLESS_SOURCE_STATES = new Set([
  "managed-pinned",
  "installed-compatible",
  "explicit-developer-override",
  "unavailable",
  "incompatible",
]);
const SAFE_PROFILES = new Set(["portless/http", "portless/https"]);
const SHARING_ENV_KEYS = [
  "PORTLESS_LAN",
  "PORTLESS_TAILSCALE",
  "PORTLESS_FUNNEL",
  "PORTLESS_NGROK",
  "PORTLESS_WILDCARD",
];
const TRUTHY = new Set(["1", "true", "yes", "on"]);

function localDataRoot() {
  const configured = String(process.env.LOCALAPPDATA || "").trim();
  if (configured) return configured;
  const home = os.homedir();
  if (process.platform === "win32") return path.join(home, "AppData", "Local");
  return path.join(home, ".local", "share");
}

export function defaultPortlessStateDirectory() {
  return path.join(localDataRoot(), "PlotPickle", "node", "runtime", "portless", PORTLESS_PINNED_VERSION);
}

function isTruthy(value) {
  return TRUTHY.has(String(value || "").trim().toLowerCase());
}

function absoluteFile(value, label) {
  const resolved = String(value || "").trim();
  if (!resolved || !path.isAbsolute(resolved)) throw new Error(`${label} must be an explicit absolute path.`);
  return path.normalize(resolved);
}

function nodeMajor(versionText) {
  const match = String(versionText || "").match(/v?(\d+)(?:\.\d+){0,2}/);
  return match ? Number(match[1]) : 0;
}

function normalizeProfile(profile) {
  const value = String(profile || "portless/http").trim().toLowerCase();
  if (!SAFE_PROFILES.has(value)) throw new Error("Portless profile must be portless/http or portless/https.");
  return value;
}

export function validatePortlessSecurityBoundary({
  env = process.env,
  profile = "portless/http",
  stateDir = defaultPortlessStateDirectory(),
  trustIntent = "none",
  proxyArgs = [],
} = {}) {
  const selectedProfile = normalizeProfile(profile);
  if (Array.isArray(proxyArgs) && proxyArgs.length) throw new Error("Arbitrary Portless proxy arguments are not allowed by PlotPickle.");
  for (const key of SHARING_ENV_KEYS) {
    if (isTruthy(env[key])) throw new Error(`${key} is not allowed for PlotPickle-managed Portless routing.`);
  }
  const tld = String(env.PORTLESS_TLD || "localhost").trim().toLowerCase();
  if (tld && tld !== "localhost") throw new Error("PlotPickle-managed Portless routing is restricted to the .localhost TLD.");
  const normalizedState = path.resolve(String(stateDir || ""));
  if (!normalizedState) throw new Error("Portless state directory is required.");
  if (/(^|[\\/])profiles([\\/]|$)/i.test(normalizedState)) {
    throw new Error("Portless state must be Node-scoped and cannot live inside a Human profile directory.");
  }
  if (selectedProfile === "portless/https" && trustIntent !== "explicit") {
    throw new Error("Portless HTTPS requires an explicit developer trust intent; PlotPickle never trusts a CA automatically.");
  }
  return { profile: selectedProfile, stateDir: normalizedState, trustIntent };
}

export function safePortlessEnvironment(baseEnv = process.env, {
  stateDir = defaultPortlessStateDirectory(),
  proxyPort,
  profile = "portless/http",
  trustIntent = "none",
} = {}) {
  const boundary = validatePortlessSecurityBoundary({ env: baseEnv, profile, stateDir, trustIntent });
  const result = { ...baseEnv };
  result.PORTLESS_STATE_DIR = boundary.stateDir;
  result.PORTLESS_TLD = "localhost";
  result.PORTLESS_SYNC_HOSTS = "0";
  result.PORTLESS_LAN = "0";
  result.PORTLESS_TAILSCALE = "0";
  result.PORTLESS_FUNNEL = "0";
  result.PORTLESS_NGROK = "0";
  result.PORTLESS_WILDCARD = "0";
  if (proxyPort) result.PORTLESS_PORT = String(proxyPort);
  if (boundary.profile === "portless/http") result.PORTLESS_HTTPS = "0";
  return result;
}

async function runFile(command, args, options = {}, execFileImpl = exec) {
  return execFileImpl(command, args, {
    windowsHide: true,
    shell: false,
    timeout: 15_000,
    maxBuffer: 2 * 1024 * 1024,
    ...options,
  });
}

export async function probePortlessRuntime({
  sourceMode = "unavailable",
  nodePath,
  cliPath,
  expectedVersion = PORTLESS_PINNED_VERSION,
  execFileImpl = exec,
} = {}) {
  if (sourceMode === "unavailable" || !nodePath || !cliPath) {
    return { state: "unavailable", available: false, detail: "Portless is not configured for this developer runtime." };
  }
  if (!new Set(["managed-pinned", "installed-compatible", "explicit-developer-override"]).has(sourceMode)) {
    return { state: "incompatible", available: false, detail: "Portless source mode is not recognized." };
  }
  let nodeExecutable;
  let cliExecutable;
  try {
    nodeExecutable = absoluteFile(nodePath, "Portless Node executable");
    cliExecutable = absoluteFile(cliPath, "Portless CLI entrypoint");
  } catch (error) {
    return { state: "incompatible", available: false, detail: error.message };
  }
  try {
    const nodeResult = await runFile(nodeExecutable, ["--version"], {}, execFileImpl);
    const nodeVersion = String(nodeResult.stdout || nodeResult.stderr || "").trim();
    if (nodeMajor(nodeVersion) < 24) {
      return { state: "incompatible", available: false, nodeVersion, detail: "Portless requires an isolated Node 24+ runtime." };
    }
    const cliResult = await runFile(nodeExecutable, [cliExecutable, "--version"], {}, execFileImpl);
    const versionText = String(cliResult.stdout || cliResult.stderr || "").trim();
    const match = versionText.match(/(\d+\.\d+\.\d+)/);
    const version = match?.[1] || "";
    if (sourceMode === "managed-pinned" && version !== expectedVersion) {
      return { state: "incompatible", available: false, nodeVersion, version, detail: `Managed Portless must be exactly ${expectedVersion}.` };
    }
    if (!version) return { state: "incompatible", available: false, nodeVersion, detail: "Portless version could not be verified." };
    return {
      state: sourceMode,
      available: true,
      nodeVersion,
      version,
      nodePath: nodeExecutable,
      cliPath: cliExecutable,
      detail: `${sourceMode} Portless ${version} on ${nodeVersion}`,
    };
  } catch (error) {
    return { state: "incompatible", available: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

async function waitForTcp(port, { host = "127.0.0.1", timeoutMs = 15_000, sleepMs = 100 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const open = await new Promise((resolve) => {
      const socket = net.createConnection({ host, port });
      socket.setTimeout(750);
      socket.once("connect", () => { socket.destroy(); resolve(true); });
      socket.once("timeout", () => { socket.destroy(); resolve(false); });
      socket.once("error", () => resolve(false));
    });
    if (open) return true;
    await new Promise((resolve) => setTimeout(resolve, sleepMs));
  }
  return false;
}

export function parseWindowsListenerEvidence(output, port) {
  const suffix = `:${Number(port)}`;
  const listeners = [];
  for (const line of String(output || "").split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4 || parts[0].toUpperCase() !== "TCP") continue;
    const localAddress = parts[1];
    const state = parts[3]?.toUpperCase();
    if (state !== "LISTENING" || !localAddress.endsWith(suffix)) continue;
    listeners.push(localAddress);
  }
  return listeners;
}

function listenerIsLoopback(address) {
  const value = String(address || "").toLowerCase();
  return value.startsWith("127.0.0.1:") || value.startsWith("[::1]:");
}

export async function verifyPortlessLoopbackListeners(proxyPort, {
  platform = process.platform,
  execFileImpl = exec,
  listenerOutput,
} = {}) {
  let listeners;
  if (listenerOutput !== undefined) {
    listeners = parseWindowsListenerEvidence(listenerOutput, proxyPort);
  } else if (platform === "win32") {
    const result = await runFile("netstat.exe", ["-ano", "-p", "tcp"], {}, execFileImpl);
    listeners = parseWindowsListenerEvidence(result.stdout, proxyPort);
  } else {
    return { ok: true, state: "loopback-probe-not-windows", listeners: [] };
  }
  if (!listeners.length) return { ok: false, state: "listener-not-observed", listeners };
  if (listeners.some((entry) => !listenerIsLoopback(entry))) return { ok: false, state: "non-loopback-listener", listeners };
  return { ok: true, state: "proxy-ready-loopback-only", listeners };
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
      killer.once("error", resolve);
      killer.once("exit", resolve);
    });
    return;
  }
  child.kill("SIGTERM");
}

export async function startPortlessProxy({
  runtime,
  stateDir = defaultPortlessStateDirectory(),
  profile = "portless/http",
  trustIntent = "none",
  env = process.env,
  deps = {},
} = {}) {
  if (!runtime?.available) throw new Error("Portless proxy cannot start without a compatible Portless runtime.");
  const boundary = validatePortlessSecurityBoundary({ env, profile, stateDir, trustIntent });
  if (boundary.profile !== "portless/http") {
    throw new Error("PlotPickle routine Portless integration is HTTP-only; HTTPS remains an explicit developer security-test profile.");
  }
  const reserve = deps.reservePort || reserveLoopbackPort;
  const spawnImpl = deps.spawn || spawn;
  const reservation = await reserve({ host: "127.0.0.1" });
  const proxyPort = reservation.port;
  await reservation.release();
  await mkdir(boundary.stateDir, { recursive: true, mode: 0o700 });
  const proxyEnv = safePortlessEnvironment(env, { stateDir: boundary.stateDir, proxyPort, profile: boundary.profile, trustIntent });
  const child = spawnImpl(runtime.nodePath, [
    runtime.cliPath,
    "proxy", "start",
    "--no-tls",
    "--port", String(proxyPort),
    "--foreground",
  ], {
    cwd: boundary.stateDir,
    env: proxyEnv,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    shell: false,
  });
  let outputTail = "";
  child.stdout?.setEncoding?.("utf8");
  child.stderr?.setEncoding?.("utf8");
  const capture = (chunk) => { outputTail = `${outputTail}${String(chunk || "")}`.slice(-8_000); };
  child.stdout?.on?.("data", capture);
  child.stderr?.on?.("data", capture);
  const ready = await (deps.waitForTcp || waitForTcp)(proxyPort, { timeoutMs: 20_000 });
  if (!ready || child.exitCode !== null || child.signalCode !== null) {
    await terminateOwnedProcess(child);
    throw new Error(`Portless proxy did not become ready on its isolated loopback port.${outputTail ? ` ${outputTail.slice(-1000)}` : ""}`);
  }
  const listenerProof = await verifyPortlessLoopbackListeners(proxyPort, {
    platform: deps.platform || process.platform,
    execFileImpl: deps.execFile || exec,
    listenerOutput: deps.listenerOutput,
  });
  if (!listenerProof.ok) {
    await terminateOwnedProcess(child);
    throw new Error(`Portless proxy listener verification failed: ${listenerProof.state}.`);
  }
  return {
    owned: true,
    child,
    proxyPort,
    stateDir: boundary.stateDir,
    profile: boundary.profile,
    env: proxyEnv,
    listenerProof,
    sourceState: runtime.state,
    version: runtime.version,
    outputTail: () => outputTail,
    async stop() { await terminateOwnedProcess(child); },
  };
}

async function runPortlessAlias(runtime, proxy, args, { env = process.env, execFileImpl = exec } = {}) {
  const commandEnv = safePortlessEnvironment(env, {
    stateDir: proxy.stateDir,
    proxyPort: proxy.proxyPort,
    profile: proxy.profile,
  });
  return runFile(runtime.nodePath, [runtime.cliPath, ...args], { env: commandEnv, cwd: proxy.stateDir }, execFileImpl);
}

function portlessUrl(routeName, proxyPort, profile = "portless/http") {
  const scheme = profile === "portless/https" ? "https" : "http";
  const defaultPort = profile === "portless/https" ? 443 : 80;
  return `${scheme}://${routeName}.localhost${Number(proxyPort) === defaultPort ? "" : `:${proxyPort}`}`;
}

export function createPortlessLoopbackFetch(proxy, { requestImpl = http.request } = {}) {
  const proxyPort = Number(proxy?.proxyPort);
  if (!Number.isInteger(proxyPort) || proxyPort < 1 || proxyPort > 65535) {
    throw new Error("Portless loopback fetch requires a verified proxy port.");
  }
  return async (input, init = {}) => {
    const target = new URL(input);
    if (target.protocol !== "http:" || !target.hostname.endsWith(".localhost")) {
      throw new Error("Portless loopback fetch accepts only HTTP .localhost route URLs.");
    }
    return new Promise((resolve, reject) => {
      const signal = init.signal;
      let request;
      const removeAbort = () => signal?.removeEventListener?.("abort", abortRequest);
      const abortRequest = () => request?.destroy(new Error("Portless route request aborted."));
      request = requestImpl({
        protocol: "http:",
        hostname: "127.0.0.1",
        port: proxyPort,
        method: String(init.method || "GET"),
        path: `${target.pathname}${target.search}`,
        headers: { ...(init.headers || {}), Host: target.host },
      }, (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        response.once("error", (error) => { removeAbort(); reject(error); });
        response.once("end", () => {
          removeAbort();
          const body = Buffer.concat(chunks).toString("utf8");
          const status = Number(response.statusCode || 0);
          resolve({
            ok: status >= 200 && status < 300,
            status,
            async json() { return JSON.parse(body); },
          });
        });
      });
      request.once("error", (error) => { removeAbort(); reject(error); });
      if (signal?.aborted) {
        abortRequest();
        return;
      }
      signal?.addEventListener?.("abort", abortRequest, { once: true });
      request.end();
    });
  };
}

async function waitForExactPortlessProof(record, {
  fetchImpl,
  expectedGeneration,
  expectedCommitSha,
  expectedInstanceRef,
  timeoutMs = 5_000,
  retryMs = 100,
} = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastProof = { ok: false, reason: "Portless route did not become ready before the bounded deadline." };
  while (Date.now() <= deadline) {
    lastProof = await verifyExactLocalInstance(record, {
      fetchImpl,
      expectedGeneration,
      expectedCommitSha,
      expectedInstanceRef,
      timeoutMs: Math.max(100, Math.min(1_000, deadline - Date.now() + 100)),
    });
    if (lastProof.ok) return lastProof;
    if (Date.now() >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, retryMs));
  }
  return lastProof;
}

async function persistRuntimeRegistry(runtime) {
  if (!runtime?.registry || !runtime?.registryPath) return;
  await mkdir(path.dirname(runtime.registryPath), { recursive: true, mode: 0o700 });
  await writeFile(runtime.registryPath, `${JSON.stringify(runtime.registry.snapshot(), null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

function restoreDirectRecord(runtime, evidenceDetail = "Portless unavailable; direct loopback retained.") {
  runtime.record = runtime.registry.transition(runtime.endpointId, {
    transport: "direct",
    transportProfile: "direct/http",
    routeName: undefined,
    url: undefined,
  });
  runtime.record = runtime.registry.markReadiness(runtime.endpointId, runtime.record.readinessState === "ready" ? "ready" : "not_ready", {
    kind: "portless-fallback",
    result: "direct",
    detail: evidenceDetail,
  });
  runtime.baseUrl = runtime.record.url;
  return runtime.record;
}

export async function attachPortlessAlias(runtime, {
  portlessRuntime,
  proxy,
  routeName = opaquePortlessRouteName(runtime?.endpointId),
  allowDirectFallback = true,
  env = process.env,
  execFileImpl = exec,
  fetchImpl,
} = {}) {
  if (!runtime?.registry || !runtime?.record || !runtime?.endpointId) throw new Error("Portless alias requires a live Local Endpoint Registry runtime.");
  if (runtime.record.transport !== "direct") throw new Error("Portless alias attachment requires a direct endpoint as its authority source.");
  const directRecord = { ...runtime.record };
  const directUrl = directRecord.url;
  try {
    if (!portlessRuntime?.available) throw new Error(portlessRuntime?.detail || "Portless is unavailable.");
    if (!proxy) throw new Error("Portless proxy is not ready.");
    await runPortlessAlias(portlessRuntime, proxy, ["alias", routeName, String(directRecord.port)], { env, execFileImpl });
    const routeUrl = portlessUrl(routeName, proxy.proxyPort, proxy.profile);
    runtime.record = runtime.registry.transition(runtime.endpointId, {
      transport: "portless",
      transportProfile: proxy.profile,
      routeName,
      url: routeUrl,
    });
    const proofFetch = fetchImpl || createPortlessLoopbackFetch(proxy);
    const proof = await waitForExactPortlessProof(runtime.record, {
      fetchImpl: proofFetch,
      expectedGeneration: runtime.record.generation,
      expectedCommitSha: runtime.record.commitSha,
      expectedInstanceRef: directRecord.instanceRef,
    });
    if (!proof.ok) throw new Error(`Portless route exact-instance proof failed: ${proof.reason}`);
    runtime.record = runtime.registry.markReadiness(runtime.endpointId, "ready", {
      kind: "portless-route",
      result: "pass",
      detail: proof.reason,
    });
    runtime.baseUrl = runtime.record.url;
    runtime.proof = proof;
    await persistRuntimeRegistry(runtime);
    return {
      state: "route-ready",
      routeName,
      url: runtime.record.url,
      directUrl,
      proxy,
      runtime: portlessRuntime,
      evidence: endpointConsumerEvidence(runtime.record, proof),
    };
  } catch (error) {
    try {
      if (portlessRuntime?.available && proxy) await runPortlessAlias(portlessRuntime, proxy, ["alias", "--remove", routeName], { env, execFileImpl });
    } catch (cleanupError) {
      error = new AggregateError([error, cleanupError], "Portless attachment failed and alias cleanup also failed.");
    }
    if (!allowDirectFallback) throw error;
    restoreDirectRecord(runtime, error instanceof Error ? error.message : String(error));
    await persistRuntimeRegistry(runtime);
    return {
      state: "degraded-direct-fallback",
      routeName,
      url: runtime.record.url,
      directUrl: runtime.record.url,
      proxy,
      runtime: portlessRuntime,
      detail: error instanceof Error ? error.message : String(error),
      evidence: endpointConsumerEvidence(runtime.record, runtime.proof || {}),
    };
  }
}

export async function remapPortlessAlias(runtime, adapter, {
  port,
  instanceRef,
  commitSha = runtime?.record?.commitSha,
  env = process.env,
  execFileImpl = exec,
  fetchImpl,
} = {}) {
  if (adapter?.state !== "route-ready") throw new Error("Only a ready Portless route can be remapped.");
  const nextPort = Number(port);
  if (!Number.isInteger(nextPort) || nextPort < 1 || nextPort > 65535) throw new Error("Portless remap requires a valid actual app port.");
  runtime.record = runtime.registry.restart(runtime.endpointId, {
    port: nextPort,
    instanceRef,
    commitSha,
    transport: "portless",
    transportProfile: adapter.proxy.profile,
    routeName: adapter.routeName,
    url: portlessUrl(adapter.routeName, adapter.proxy.proxyPort, adapter.proxy.profile),
  });
  await runPortlessAlias(adapter.runtime, adapter.proxy, ["alias", adapter.routeName, String(nextPort), "--force"], { env, execFileImpl });
  const proofFetch = fetchImpl || createPortlessLoopbackFetch(adapter.proxy);
  const proof = await waitForExactPortlessProof(runtime.record, {
    fetchImpl: proofFetch,
    expectedGeneration: runtime.record.generation,
    expectedCommitSha: runtime.record.commitSha,
    expectedInstanceRef: instanceRef,
  });
  if (!proof.ok) throw new Error(`Remapped Portless route exact-instance proof failed: ${proof.reason}`);
  runtime.record = runtime.registry.markReadiness(runtime.endpointId, "ready", {
    kind: "portless-route-remap",
    result: "pass",
    detail: proof.reason,
  });
  runtime.baseUrl = runtime.record.url;
  runtime.proof = proof;
  adapter.url = runtime.record.url;
  adapter.evidence = endpointConsumerEvidence(runtime.record, proof);
  await persistRuntimeRegistry(runtime);
  return adapter;
}

export async function detachPortlessAlias(runtime, adapter, {
  env = process.env,
  execFileImpl = exec,
} = {}) {
  if (!adapter?.routeName || !adapter?.runtime?.available || !adapter?.proxy) return;
  await runPortlessAlias(adapter.runtime, adapter.proxy, ["alias", "--remove", adapter.routeName], { env, execFileImpl });
  restoreDirectRecord(runtime, "Portless alias removed; direct endpoint remains authoritative.");
  await persistRuntimeRegistry(runtime);
  adapter.state = "removed";
  adapter.url = runtime.record.url;
  adapter.evidence = endpointConsumerEvidence(runtime.record, runtime.proof || {});
}

export async function probeOpenSslForHttps({ opensslPath, execFileImpl = exec } = {}) {
  if (!opensslPath) return { state: "openssl-unavailable", available: false, detail: "HTTPS profile requires an explicitly configured OpenSSL executable." };
  try {
    const executable = absoluteFile(opensslPath, "OpenSSL executable");
    const result = await runFile(executable, ["version"], {}, execFileImpl);
    return { state: "openssl-ready", available: true, version: String(result.stdout || "").trim() };
  } catch (error) {
    return { state: "openssl-unavailable", available: false, detail: error instanceof Error ? error.message : String(error) };
  }
}