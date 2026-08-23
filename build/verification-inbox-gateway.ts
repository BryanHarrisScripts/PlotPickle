import { readFile, readdir } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { ViteDevServer } from "vite";
import { persistentHome } from "./local-credentials";

const API = "/api/verification-inbox";
const RECORDS_ROOT = () => path.join(persistentHome(), "verification-inbox", "records");
const SAFE_RUN_ID = /^verification-[A-Za-z0-9._-]{8,120}$/;

type Stage = { number: number; name: string; category: string; status: "PASS" | "FAIL" | "BLOCKED"; exitCode: number; detail: string };
type VerificationRecord = {
  schemaVersion: 1;
  runId: string;
  plotPickleVersion: string;
  git: { commit: string; ref: string };
  startedAt: string;
  completedAt: string;
  platformClass: string;
  deterministicResult: "PASS" | "FAIL";
  passCount: number;
  totalStages: number;
  headline: string;
  stages: Stage[];
  categoryResults: Array<{ category: string; status: string }>;
  evidenceReferences: Array<{ kind: string; ref: string }>;
  agentObservations: unknown[];
  failureSummaries: Array<{ stage: string; status: string; summary: string }>;
  repairAttempts: unknown[];
  retests: unknown[];
  integrity: { deterministicResultDerivedFromStages: boolean; agentMayOverrideResult: boolean; recordIsAppendOnly: boolean; storyCanon: boolean };
};

function isLocalRequest(request: IncomingMessage) {
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

function validRecord(value: unknown): value is VerificationRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Partial<VerificationRecord>;
  if (item.schemaVersion !== 1 || typeof item.runId !== "string" || !SAFE_RUN_ID.test(item.runId)) return false;
  if (!Array.isArray(item.stages) || item.stages.length !== 9) return false;
  const passCount = item.stages.filter((stage) => stage?.status === "PASS").length;
  const derived = passCount === 9 ? "PASS" : "FAIL";
  return item.deterministicResult === derived
    && item.passCount === passCount
    && item.totalStages === 9
    && item.integrity?.deterministicResultDerivedFromStages === true
    && item.integrity?.agentMayOverrideResult === false
    && item.integrity?.storyCanon === false;
}

async function readRecord(runId: string) {
  if (!SAFE_RUN_ID.test(runId)) return null;
  try {
    const source = JSON.parse(await readFile(path.join(RECORDS_ROOT(), `${runId}.json`), "utf8")) as unknown;
    return validRecord(source) ? source : null;
  } catch { return null; }
}

async function listRecords() {
  let names: string[] = [];
  try {
    names = (await readdir(RECORDS_ROOT())).filter((name) => /^verification-[A-Za-z0-9._-]{8,120}\.json$/.test(name));
  } catch { return []; }
  const records = (await Promise.all(names.slice(-100).map((name) => readRecord(name.slice(0, -5))))).filter((record): record is VerificationRecord => Boolean(record));
  return records
    .sort((left, right) => Date.parse(right.completedAt || right.startedAt) - Date.parse(left.completedAt || left.startedAt))
    .slice(0, 50)
    .map((record) => ({
      runId: record.runId,
      headline: record.headline,
      deterministicResult: record.deterministicResult,
      passCount: record.passCount,
      totalStages: record.totalStages,
      plotPickleVersion: record.plotPickleVersion,
      git: record.git,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      platformClass: record.platformClass,
      failureCount: record.failureSummaries.length,
      evidenceCount: record.evidenceReferences.length,
    }));
}

export function registerVerificationInboxGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const rawUrl = request.url;
    if (!rawUrl) { next(); return; }
    let url: URL;
    try { url = new URL(rawUrl, "http://127.0.0.1"); } catch { next(); return; }
    if (url.pathname !== API) { next(); return; }
    if (!isLocalRequest(request)) {
      send(response, 403, { ok: false, message: "Verification Inbox records are available only from the local PlotPickle application." });
      return;
    }
    if (request.method !== "GET") {
      send(response, 405, { ok: false, message: "Verification Inbox is read-only." });
      return;
    }
    void (async () => {
      const runId = url.searchParams.get("runId") || "";
      if (runId) {
        const record = await readRecord(runId);
        if (!record) { send(response, 404, { ok: false, message: "That verification record was not found." }); return; }
        send(response, 200, { ok: true, record });
        return;
      }
      send(response, 200, { ok: true, records: await listRecords() });
    })().catch(() => send(response, 500, { ok: false, message: "Verification Inbox records could not be read." }));
  });
}
