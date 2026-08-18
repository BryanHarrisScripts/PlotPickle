import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { Plugin } from "vite";
import { persistentHome } from "./local-credentials";
import { appendRunTelemetryEvent, RUN_TELEMETRY_EVENT_TYPES, type RunTelemetryData, type RunTelemetryEventType } from "../lib/run-telemetry";
import type { ResponsibilityRun } from "../lib/responsibility-runs";

const API = "/api/responsibility-runs/telemetry";
const MAX_BODY = 64 * 1024;
const SAFE_RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{5,180}$/;
const writeQueues = new Map<string, Promise<unknown>>();

function root() {
  return path.join(persistentHome(), "responsibility-runs");
}

function runFile(runId: string) {
  if (!SAFE_RUN_ID.test(runId)) throw new Error("Choose a valid Responsibility Run ID.");
  return path.join(root(), `${runId}.json`);
}

function local(request: IncomingMessage) {
  const address = request.socket.remoteAddress || "";
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address)) return false;
  return /^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(request.headers.host || "");
}

function send(response: ServerResponse, status: number, value: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(value));
}

async function body(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += part.length;
    if (size > MAX_BODY) throw new Error("Run telemetry request is too large.");
    chunks.push(part);
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Enter a valid Run telemetry event.");
  return value as Record<string, unknown>;
}

function validRun(value: unknown): value is ResponsibilityRun {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const run = value as Partial<ResponsibilityRun>;
  return run.version === 1 && typeof run.runId === "string" && SAFE_RUN_ID.test(run.runId)
    && typeof run.profileId === "string" && typeof run.state === "string" && Array.isArray(run.events);
}

async function readRun(runId: string) {
  const value: unknown = JSON.parse(await readFile(runFile(runId), "utf8"));
  if (!validRun(value) || value.runId !== runId) throw new Error("Responsibility Run record failed telemetry integrity checks.");
  return value;
}

async function saveRun(run: ResponsibilityRun) {
  await mkdir(root(), { recursive: true, mode: 0o700 });
  const file = runFile(run.runId);
  const temporary = `${file}.${process.pid}.${Date.now()}.telemetry.tmp`;
  await writeFile(temporary, `${JSON.stringify(run, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, file);
  return run;
}

function enqueue<T>(runId: string, operation: () => Promise<T>) {
  const previous = writeQueues.get(runId) || Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  writeQueues.set(runId, next.finally(() => {
    if (writeQueues.get(runId) === next) writeQueues.delete(runId);
  }));
  return next;
}

function telemetryType(value: unknown): RunTelemetryEventType {
  if (typeof value === "string" && RUN_TELEMETRY_EVENT_TYPES.includes(value as RunTelemetryEventType)) return value as RunTelemetryEventType;
  throw new Error("Choose a supported Run telemetry event type.");
}

export async function appendPersistentRunTelemetry(input: {
  runId: string;
  type: RunTelemetryEventType;
  summary: string;
  data?: RunTelemetryData;
  at?: string;
}) {
  return enqueue(input.runId, async () => {
    const run = await readRun(input.runId);
    const updated = appendRunTelemetryEvent(run, input);
    await saveRun(updated);
    return updated;
  });
}

export function runTelemetryGateway(): Plugin {
  return {
    name: "plotpickle-run-telemetry-gateway",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
        if (url.pathname !== API) { next(); return; }
        if (!local(request)) { send(response, 403, { ok: false, message: "Run telemetry is available only inside this local PlotPickle Studio." }); return; }
        if (request.method !== "POST") { send(response, 405, { ok: false, message: "Use POST to append Run telemetry." }); return; }
        void (async () => {
          try {
            const input = await body(request);
            const runId = typeof input.runId === "string" ? input.runId : "";
            const type = telemetryType(input.type);
            const summary = typeof input.summary === "string" ? input.summary : "";
            const data = input.data && typeof input.data === "object" && !Array.isArray(input.data) ? input.data as RunTelemetryData : {};
            const run = await appendPersistentRunTelemetry({ runId, type, summary, data, at: typeof input.at === "string" ? input.at : undefined });
            send(response, 200, { ok: true, runId: run.runId, eventCount: run.events.length, updatedAt: run.updatedAt });
          } catch (error) {
            send(response, 400, { ok: false, message: error instanceof Error ? error.message : "Run telemetry append failed." });
          }
        })();
      });
    },
  };
}
