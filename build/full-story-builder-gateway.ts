import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename } from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { persistentHome } from "./local-credentials";

const API = "/api/full-story-builder";
const MAX_BODY = 5 * 1024 * 1024;
const MAX_JOBS = 20;
const STALE_RUNNING_MS = 5 * 60 * 1000;

type VisualMode = "prompts-only" | "local-if-available" | "paid-cloud";

type BuilderOptions = {
  visualMode: VisualMode;
  maximumVisuals: number;
  paidVisualConsent: null | {
    acknowledged: true;
    maximumRequests: number;
    confirmedAt: string;
    statement: string;
  };
};

type BuilderJob = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  brief: Record<string, unknown>;
  options: BuilderOptions;
  workToken: string;
  workerId: string;
  stage: string;
  progress: number;
  warnings: string[];
  error: string;
  fileName: string;
  result: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string;
  completedAt: string;
};

type BuilderStore = {
  version: 1;
  worker: { id: string; lastSeenAt: string } | null;
  jobs: BuilderJob[];
};

function storePath() {
  return path.join(persistentHome(), "full-story-builder", "jobs.json");
}
function isLoopback(value: string | undefined) {
  return value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1";
}

function isLocalRequest(request: IncomingMessage) {
  if (!isLoopback(request.socket.remoteAddress)) return false;
  const host = request.headers.host;
  if (!host) return false;
  try {
    const hostUrl = new URL(`http://${host}`);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(hostUrl.hostname)) return false;
    const origin = request.headers.origin;
    return !origin || new URL(origin).host === hostUrl.host;
  } catch {
    return false;
  }
}

function sendJson(response: ServerResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage, maximum = MAX_BODY) {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.length;
    if (length > maximum) throw new Error("The Full Story Builder request is too large.");
    chunks.push(bytes);
  }
  const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Enter a valid Full Story Builder request.");
  return body as Record<string, unknown>;
}

function text(value: unknown, maximum = 4_000) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.slice(0, 500)).slice(0, 50) : [];
}

function freshStore(): BuilderStore {
  return { version: 1, worker: null, jobs: [] };
}

async function readStore(): Promise<BuilderStore> {
  try {
    const value = JSON.parse(await readFile(storePath(), "utf8")) as Partial<BuilderStore>;
    return value.version === 1 && Array.isArray(value.jobs)
      ? { version: 1, worker: value.worker && typeof value.worker === "object" ? value.worker : null, jobs: value.jobs as BuilderJob[] }
      : freshStore();
  } catch {
    return freshStore();
  }
}

async function writeStore(store: BuilderStore) {
  const filePath = storePath();
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const handle = await open(temporary, "w", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(store, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporary, filePath);
}

function normalizeOptions(value: unknown): BuilderOptions {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const visualMode: VisualMode = source.visualMode === "local-if-available" || source.visualMode === "paid-cloud" ? source.visualMode : "prompts-only";
  const maximumVisuals = Math.min(4, Math.max(0, Math.round(Number(source.maximumVisuals) || (visualMode === "prompts-only" ? 0 : 4))));
  const consentSource = source.paidVisualConsent && typeof source.paidVisualConsent === "object" && !Array.isArray(source.paidVisualConsent)
    ? source.paidVisualConsent as Record<string, unknown>
    : null;
  const expectedStatement = `I authorize up to ${maximumVisuals} paid image requests for this Full Story Builder job.`;
  const paidVisualConsent = consentSource?.acknowledged === true
    && Number(consentSource.maximumRequests) === maximumVisuals
    && text(consentSource.confirmedAt, 100).length > 0
    && text(consentSource.statement, 300) === expectedStatement
    ? { acknowledged: true as const, maximumRequests: maximumVisuals, confirmedAt: text(consentSource.confirmedAt, 100), statement: expectedStatement }
    : null;
  if (visualMode === "paid-cloud" && (!paidVisualConsent || maximumVisuals < 1)) {
    throw new Error("Confirm the exact paid-image request limit before allowing a cloud visual route.");
  }
  return { visualMode, maximumVisuals, paidVisualConsent };
}

function publicJob(job: BuilderJob) {
  return {
    id: job.id,
    status: job.status,
    title: text(job.brief.title) || "New original story",
    options: { visualMode: job.options.visualMode, maximumVisuals: job.options.maximumVisuals, paidVisualConsent: Boolean(job.options.paidVisualConsent) },
    stage: job.stage,
    progress: job.progress,
    warnings: job.warnings,
    error: job.error,
    fileName: job.fileName,
    result: job.result,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  };
}

function activeWorker(store: BuilderStore) {
  if (!store.worker?.lastSeenAt) return null;
  const age = Date.now() - Date.parse(store.worker.lastSeenAt);
  return Number.isFinite(age) && age < 30_000 ? store.worker : null;
}

function authorizeJob(job: BuilderJob, body: Record<string, unknown>) {
  if (text(body.workerId, 200) !== job.workerId || text(body.workToken, 200) !== job.workToken) {
    throw new Error("This Full Story Builder update does not belong to the worker that claimed the job.");
  }
}

async function handleApi(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (!isLocalRequest(request)) {
    sendJson(response, 403, { ok: false, message: "Full Story Builder accepts requests only from this local PlotPickle server." });
    return;
  }
  const store = await readStore();
  const now = new Date().toISOString();

  if (request.method === "GET" && url.pathname === `${API}/status`) {
    sendJson(response, 200, { ok: true, available: true, worker: activeWorker(store), jobs: store.jobs.slice(0, 5).map(publicJob) });
    return;
  }

  if (request.method === "POST" && url.pathname === `${API}/worker/heartbeat`) {
    const body = await readBody(request, 2_048);
    const workerId = text(body.workerId, 200);
    if (!workerId) throw new Error("The Full Story Builder worker ID is missing.");
    store.worker = { id: workerId, lastSeenAt: now };
    await writeStore(store);
    sendJson(response, 200, { ok: true, waiting: !store.jobs.some((job) => job.status === "queued") });
    return;
  }

  if (request.method === "POST" && url.pathname === `${API}/jobs`) {
    const body = await readBody(request);
    if (store.jobs.some((job) => job.status === "queued" || job.status === "running")) throw new Error("A Full Story Builder job is already queued or running. Wait for it to finish before starting another.");
    const suppliedBrief = body.brief && typeof body.brief === "object" && !Array.isArray(body.brief) ? body.brief as Record<string, unknown> : {};
    const brief = Object.fromEntries(Object.entries(suppliedBrief).map(([key, value]) => [key, text(value)]));
    brief.originalitySeed = `${now}:${randomUUID()}:${text(brief.title)}`;
    const options = normalizeOptions(body.options);
    const job: BuilderJob = {
      id: `full-story-${randomUUID()}`,
      status: "queued",
      brief,
      options,
      workToken: randomUUID(),
      workerId: "",
      stage: "Waiting for the local Full Story Builder agent",
      progress: 0,
      warnings: [],
      error: "",
      fileName: "",
      result: null,
      createdAt: now,
      updatedAt: now,
      startedAt: "",
      completedAt: "",
    };
    store.jobs = [job, ...store.jobs].slice(0, MAX_JOBS);
    await writeStore(store);
    sendJson(response, 202, { ok: true, job: publicJob(job) });
    return;
  }

  if (request.method === "POST" && url.pathname === `${API}/jobs/claim`) {
    const body = await readBody(request, 2_048);
    const workerId = text(body.workerId, 200);
    if (!workerId) throw new Error("The Full Story Builder worker ID is missing.");
    for (const job of store.jobs) {
      if (job.status === "running" && Date.now() - Date.parse(job.updatedAt) > STALE_RUNNING_MS) {
        job.status = "queued";
        job.workerId = "";
        job.stage = "Recovered after the prior worker stopped";
        job.warnings = [...job.warnings, "The prior worker stopped before completion; the job was safely re-queued."].slice(-50);
      }
    }
    const job = store.jobs.find((item) => item.status === "queued");
    store.worker = { id: workerId, lastSeenAt: now };
    if (!job) {
      await writeStore(store);
      sendJson(response, 200, { ok: true, job: null });
      return;
    }
    job.status = "running";
    job.workerId = workerId;
    job.stage = "Preparing the Learn-guided story workflow";
    job.progress = 2;
    job.startedAt ||= now;
    job.updatedAt = now;
    await writeStore(store);
    sendJson(response, 200, { ok: true, job: { id: job.id, brief: job.brief, options: job.options, workToken: job.workToken } });
    return;
  }

  const match = new RegExp(`^${API}/jobs/([^/]+)(?:/(progress|complete|fail))?$`).exec(url.pathname);
  if (match) {
    const job = store.jobs.find((item) => item.id === decodeURIComponent(match[1]));
    if (!job) throw new Error("The Full Story Builder job was not found.");
    const action = match[2] || "status";
    if (request.method === "GET" && action === "status") {
      sendJson(response, 200, { ok: true, job: publicJob(job) });
      return;
    }
    if (request.method !== "POST" || action === "status") {
      sendJson(response, 405, { ok: false, message: "Full Story Builder operation not allowed." });
      return;
    }
    const body = await readBody(request, action === "complete" ? 256 * 1024 : 64 * 1024);
    authorizeJob(job, body);
    if (action === "progress") {
      job.progress = Math.min(99, Math.max(job.progress, Math.round(Number(body.progress) || 0)));
      job.stage = text(body.stage, 300) || job.stage;
      job.warnings = [...job.warnings, ...stringList(body.warnings)].slice(-50);
      job.updatedAt = now;
    } else if (action === "complete") {
      job.status = "completed";
      job.progress = 100;
      job.stage = "Saved locally and ready for human review";
      job.fileName = text(body.fileName, 200);
      job.result = body.result && typeof body.result === "object" && !Array.isArray(body.result) ? body.result as Record<string, unknown> : null;
      job.warnings = [...job.warnings, ...stringList(body.warnings)].slice(-50);
      job.completedAt = now;
      job.updatedAt = now;
      job.brief = { title: text(job.brief.title) };
      job.workToken = "";
    } else {
      job.status = "failed";
      job.stage = "Stopped safely";
      job.error = text(body.error, 1_000) || "The Full Story Builder agent stopped before saving the project.";
      job.warnings = [...job.warnings, ...stringList(body.warnings)].slice(-50);
      job.completedAt = now;
      job.updatedAt = now;
      job.workToken = "";
    }
    await writeStore(store);
    sendJson(response, 200, { ok: true, job: publicJob(job) });
    return;
  }

  sendJson(response, 404, { ok: false, message: "Full Story Builder operation not found." });
}

export function fullStoryBuilderGateway(): Plugin {
  return {
    name: "plotpickle-full-story-builder-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url) { next(); return; }
        const url = new URL(request.url, "http://127.0.0.1");
        if (!url.pathname.startsWith(API)) { next(); return; }
        void handleApi(request, response, url).catch((error) => {
          const message = error instanceof Error ? error.message.replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]") : "The Full Story Builder operation failed.";
          sendJson(response, 400, { ok: false, message });
        });
      });
    },
  };
}
