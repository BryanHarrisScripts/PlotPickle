import net from "node:net";
import { randomUUID } from "node:crypto";

const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{1,127}$/i;
const REF_PATTERN = /^[a-z0-9][a-z0-9._:/@+-]{0,239}$/i;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/i;
const OWNER_SCOPES = new Set(["node", "profile", "job", "worktree"]);
const LIFECYCLE_STATES = new Set(["starting", "running", "stopping", "stopped", "failed"]);
const READINESS_STATES = new Set(["unknown", "not_ready", "ready", "degraded"]);
const TRANSPORTS = new Set(["direct", "portless"]);
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1"]);
const BROWSER_BLOCKED_PORTS = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79,
  87, 95, 101, 102, 103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137, 139,
  143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532, 540, 548, 554,
  556, 563, 587, 601, 636, 993, 995, 1719, 1720, 1723, 2049, 3659, 4045, 5060, 5061,
  6000, 6566, 6665, 6666, 6667, 6668, 6669, 6697, 10080,
]);

function cleanId(value, label) {
  const normalized = String(value || "").trim();
  if (!ID_PATTERN.test(normalized)) throw new Error(`${label} must be a stable 2-128 character opaque identifier.`);
  return normalized;
}

function optionalRef(value, label) {
  if (value === undefined || value === null || value === "") return undefined;
  const normalized = String(value).trim();
  if (!REF_PATTERN.test(normalized)) throw new Error(`${label} contains unsupported characters.`);
  return normalized;
}

function optionalCommit(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (!COMMIT_PATTERN.test(normalized)) throw new Error("Endpoint commit SHA must be a full 40-character Git SHA.");
  return normalized;
}

function iso(value, label) {
  const parsed = new Date(value || Date.now());
  if (Number.isNaN(parsed.getTime())) throw new Error(`${label} must be a valid timestamp.`);
  return parsed.toISOString();
}

function normalizeHost(value) {
  const host = String(value || "127.0.0.1").trim();
  if (!LOOPBACK_HOSTS.has(host)) throw new Error("Managed local endpoints must bind to 127.0.0.1 or ::1.");
  return host;
}

function normalizePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Local endpoint port must be an integer from 1 to 65535.");
  if (BROWSER_BLOCKED_PORTS.has(port)) throw new Error(`Local endpoint port ${port} is browser-blocked and cannot be registered.`);
  return port;
}

function directUrl(host, port) {
  return `http://${host === "::1" ? `[${host}]` : host}:${port}`;
}

function normalizeGeneration(value) {
  const generation = Number(value ?? 1);
  if (!Number.isInteger(generation) || generation < 1) throw new Error("Endpoint generation must be a positive integer.");
  return generation;
}

function normalizeRecord(input, defaults = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Local endpoint registration must be an object.");
  const ownerScope = String(input.ownerScope || defaults.ownerScope || "job").trim();
  if (!OWNER_SCOPES.has(ownerScope)) throw new Error("Local endpoint owner scope is invalid.");
  const transport = String(input.transport || defaults.transport || "direct").trim();
  if (!TRANSPORTS.has(transport)) throw new Error("Local endpoint transport is invalid.");
  const lifecycleState = String(input.lifecycleState || defaults.lifecycleState || "starting").trim();
  if (!LIFECYCLE_STATES.has(lifecycleState)) throw new Error("Local endpoint lifecycle state is invalid.");
  const readinessState = String(input.readinessState || defaults.readinessState || "unknown").trim();
  if (!READINESS_STATES.has(readinessState)) throw new Error("Local endpoint readiness state is invalid.");
  const host = normalizeHost(input.host || defaults.host || "127.0.0.1");
  const port = normalizePort(input.port ?? defaults.port);
  if (transport !== "direct" && !input.routeName) throw new Error("Non-direct endpoint transports require a route name.");
  const routeName = optionalRef(input.routeName, "Endpoint route name");
  const url = transport === "direct" ? directUrl(host, port) : String(input.url || "").trim();
  if (!URL.canParse(url)) throw new Error("Local endpoint URL is invalid.");
  const parsed = new URL(url);
  if (!new Set(["127.0.0.1", "::1", "localhost"]).has(parsed.hostname)) throw new Error("Local endpoint URL must remain loopback-only.");

  const profileRef = optionalRef(input.profileRef, "Endpoint profile ref");
  const jobId = optionalRef(input.jobId, "Endpoint job id");
  const worktreeRef = optionalRef(input.worktreeRef, "Endpoint worktree ref");
  if (ownerScope === "profile" && !profileRef) throw new Error("Profile-scoped endpoint requires profileRef.");
  if (ownerScope === "job" && !jobId) throw new Error("Job-scoped endpoint requires jobId.");
  if (ownerScope === "worktree" && !worktreeRef) throw new Error("Worktree-scoped endpoint requires worktreeRef.");

  return {
    endpointId: cleanId(input.endpointId || defaults.endpointId, "Endpoint id"),
    serviceKind: cleanId(input.serviceKind || defaults.serviceKind, "Endpoint service kind"),
    ownerScope,
    ...(profileRef ? { profileRef } : {}),
    ...(jobId ? { jobId } : {}),
    ...(worktreeRef ? { worktreeRef } : {}),
    ...(optionalRef(input.branchRef, "Endpoint branch ref") ? { branchRef: optionalRef(input.branchRef, "Endpoint branch ref") } : {}),
    ...(optionalCommit(input.commitSha) ? { commitSha: optionalCommit(input.commitSha) } : {}),
    ...(optionalRef(input.processRef, "Endpoint process ref") ? { processRef: optionalRef(input.processRef, "Endpoint process ref") } : {}),
    transport,
    host,
    port,
    url,
    ...(routeName ? { routeName } : {}),
    lifecycleState,
    readinessState,
    generation: normalizeGeneration(input.generation ?? defaults.generation ?? 1),
    createdAt: iso(input.createdAt || defaults.createdAt || Date.now(), "Endpoint createdAt"),
    ...(input.lastVerifiedAt ? { lastVerifiedAt: iso(input.lastVerifiedAt, "Endpoint lastVerifiedAt") } : {}),
    ...(optionalRef(input.instanceRef, "Endpoint instance ref") ? { instanceRef: optionalRef(input.instanceRef, "Endpoint instance ref") } : {}),
    ...(input.readinessEvidence && typeof input.readinessEvidence === "object" ? { readinessEvidence: sanitizeReadinessEvidence(input.readinessEvidence) } : {}),
  };
}

function sanitizeReadinessEvidence(input) {
  const result = {};
  if (typeof input.kind === "string") result.kind = input.kind.slice(0, 80);
  if (typeof input.result === "string") result.result = input.result.slice(0, 80);
  if (typeof input.detail === "string") result.detail = input.detail.replace(/[\r\n]+/g, " ").slice(0, 500);
  if (typeof input.observedAt === "string") result.observedAt = iso(input.observedAt, "Readiness evidence timestamp");
  return result;
}

function authorized(record, context = {}) {
  if (context.admin === true || context.internal === true) return true;
  if (record.ownerScope === "node") return context.node === true;
  if (record.ownerScope === "profile") return Boolean(context.profileRef) && context.profileRef === record.profileRef;
  if (record.ownerScope === "job") {
    if (!context.jobId || context.jobId !== record.jobId) return false;
    return !record.profileRef || context.profileRef === record.profileRef;
  }
  if (record.ownerScope === "worktree") {
    if (context.worktreeRef && context.worktreeRef === record.worktreeRef) return !record.profileRef || context.profileRef === record.profileRef;
    if (record.jobId && context.jobId === record.jobId) return !record.profileRef || context.profileRef === record.profileRef;
  }
  return false;
}

function unavailable() {
  return new Error("Local endpoint is unavailable for this caller context.");
}

export class LocalEndpointRegistry {
  constructor({ idFactory = () => `ep-${randomUUID().replaceAll("-", "")}`, now = () => new Date().toISOString() } = {}) {
    this.idFactory = idFactory;
    this.now = now;
    this.records = new Map();
  }

  register(input) {
    const endpointId = input?.endpointId || this.idFactory();
    if (this.records.has(endpointId)) throw new Error(`Local endpoint ${endpointId} is already registered.`);
    const record = normalizeRecord({ ...input, endpointId, createdAt: input?.createdAt || this.now() });
    this.records.set(record.endpointId, record);
    return { ...record };
  }

  resolve(endpointId, context = {}, { expectedGeneration } = {}) {
    const id = cleanId(endpointId, "Endpoint id");
    const record = this.records.get(id);
    if (!record || !authorized(record, context)) throw unavailable();
    if (expectedGeneration !== undefined && record.generation !== normalizeGeneration(expectedGeneration)) {
      throw new Error(`Local endpoint ${id} generation changed from ${expectedGeneration} to ${record.generation}; the consumer run is invalid.`);
    }
    if (new Set(["stopped", "failed"]).has(record.lifecycleState)) throw new Error(`Local endpoint ${id} is ${record.lifecycleState}.`);
    return { ...record };
  }

  transition(endpointId, patch, context = { internal: true }) {
    const id = cleanId(endpointId, "Endpoint id");
    const current = this.records.get(id);
    if (!current || !authorized(current, context)) throw unavailable();
    const next = normalizeRecord({ ...current, ...patch, endpointId: id, createdAt: current.createdAt });
    if (next.generation < current.generation) throw new Error("Endpoint generation cannot move backwards.");
    this.records.set(id, next);
    return { ...next };
  }

  restart(endpointId, patch = {}, context = { internal: true }) {
    const current = this.resolve(endpointId, context);
    return this.transition(endpointId, {
      ...patch,
      generation: current.generation + 1,
      lifecycleState: "starting",
      readinessState: "not_ready",
      lastVerifiedAt: undefined,
      readinessEvidence: undefined,
    }, context);
  }

  markReadiness(endpointId, readinessState, evidence = {}, context = { internal: true }) {
    if (!READINESS_STATES.has(readinessState)) throw new Error("Local endpoint readiness state is invalid.");
    return this.transition(endpointId, {
      readinessState,
      lastVerifiedAt: this.now(),
      readinessEvidence: { ...evidence, observedAt: evidence.observedAt || this.now() },
    }, context);
  }

  revoke(endpointId, context = { internal: true }) {
    const id = cleanId(endpointId, "Endpoint id");
    const current = this.records.get(id);
    if (!current || !authorized(current, context)) throw unavailable();
    this.records.delete(id);
    return true;
  }

  enumerate(context = {}) {
    if (context.admin !== true && context.internal !== true) throw new Error("Local endpoint enumeration requires internal/admin authority.");
    return [...this.records.values()].map((record) => ({ ...record }));
  }

  garbageCollect({ activeJobIds = [], activeProcessRefs = [] } = {}) {
    const jobs = new Set(activeJobIds);
    const processes = new Set(activeProcessRefs);
    let removed = 0;
    for (const [id, record] of this.records) {
      const terminal = new Set(["stopped", "failed"]).has(record.lifecycleState);
      const inactiveJob = record.jobId ? !jobs.has(record.jobId) : true;
      const inactiveProcess = record.processRef ? !processes.has(record.processRef) : true;
      if (terminal && inactiveJob && inactiveProcess) {
        this.records.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  snapshot() {
    return {
      schemaVersion: 1,
      authority: "plotpickle-local-endpoint-registry",
      generatedAt: this.now(),
      endpoints: [...this.records.values()].map(publicEndpointRecord),
    };
  }
}

export function publicEndpointRecord(record) {
  const normalized = normalizeRecord(record);
  const {
    instanceRef: _instanceRef,
    readinessEvidence,
    ...safe
  } = normalized;
  return {
    ...safe,
    ...(readinessEvidence ? { readinessEvidence } : {}),
  };
}

export function endpointConsumerEvidence(record, proof = {}) {
  const safe = publicEndpointRecord(record);
  return {
    endpointId: safe.endpointId,
    jobId: safe.jobId || "",
    worktreeRef: safe.worktreeRef || "",
    commitSha: safe.commitSha || "",
    generation: safe.generation,
    resolvedUrl: safe.url,
    exactInstanceProof: proof.ok === true ? "pass" : proof.ok === false ? "fail" : "not-run",
  };
}

export async function reserveLoopbackPort({ host = "127.0.0.1", maxAttempts = 8, createServer = () => net.createServer() } = {}) {
  const bindHost = normalizeHost(host);
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const server = createServer();
    try {
      await new Promise((resolve, reject) => {
        const onError = (error) => { cleanup(); reject(error); };
        const onListening = () => { cleanup(); resolve(); };
        const cleanup = () => { server.off("error", onError); server.off("listening", onListening); };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen({ host: bindHost, port: 0, exclusive: true });
      });
      const address = server.address();
      const port = typeof address === "object" && address ? Number(address.port) : 0;
      if (!port || BROWSER_BLOCKED_PORTS.has(port)) {
        await new Promise((resolve) => server.close(() => resolve()));
        continue;
      }
      let released = false;
      return {
        host: bindHost,
        port,
        async release() {
          if (released) return;
          released = true;
          await new Promise((resolve) => server.close(() => resolve()));
        },
      };
    } catch (error) {
      lastError = error;
      try {
        server.close();
      } catch (closeError) {
        lastError = new AggregateError([error, closeError], "Loopback reservation failed and server cleanup also failed.");
      }
    }
  }
  throw new Error(`Could not reserve a safe loopback port after ${maxAttempts} attempts.${lastError ? ` ${lastError.message || lastError}` : ""}`);
}

export async function launchWithPortRetry({ launch, host = "127.0.0.1", maxAttempts = 5, reserve = reserveLoopbackPort } = {}) {
  if (typeof launch !== "function") throw new Error("Managed endpoint launch requires a launch function.");
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const reservation = await reserve({ host });
    const port = reservation.port;
    await reservation.release();
    try {
      const result = await launch({ host: reservation.host, port, attempt });
      return { ...result, host: reservation.host, port, attempt };
    } catch (error) {
      lastError = error;
      const code = String(error?.code || "");
      const message = String(error?.message || error || "");
      if (code !== "EADDRINUSE" && !/EADDRINUSE|address already in use/i.test(message)) throw error;
    }
  }
  throw new Error(`Managed endpoint lost the port race ${maxAttempts} times.${lastError ? ` ${lastError.message || lastError}` : ""}`);
}

export async function verifyExactLocalInstance(record, {
  fetchImpl = globalThis.fetch,
  expectedGeneration = record?.generation,
  expectedCommitSha = record?.commitSha,
  expectedInstanceRef = record?.instanceRef,
  timeoutMs = 3_000,
} = {}) {
  const normalized = normalizeRecord(record);
  const proofUrl = new URL("/api/local-instance-proof", normalized.url).toString();
  try {
    const response = await fetchImpl(proofUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return { ok: false, reason: `instance proof returned HTTP ${response.status}` };
    const body = await response.json();
    const checks = [
      [body?.endpointId === normalized.endpointId, "endpoint id"],
      [Number(body?.generation) === Number(expectedGeneration), "generation"],
      [!expectedCommitSha || String(body?.commitSha || "").toLowerCase() === String(expectedCommitSha).toLowerCase(), "commit"],
      [!expectedInstanceRef || body?.instanceRef === expectedInstanceRef, "instance"],
      [body?.exactHead === true, "exact head"],
    ];
    const failed = checks.find(([ok]) => !ok);
    if (failed) return { ok: false, reason: `instance proof mismatch: ${failed[1]}` };
    return { ok: true, reason: "exact endpoint/generation/worktree commit proof matched" };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
