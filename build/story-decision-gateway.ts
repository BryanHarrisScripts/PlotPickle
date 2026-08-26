import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { ViteDevServer } from "vite";
import {
  createStoryDecisionResponse,
  markStoryDecisionStale,
  mergeStoryDecisionRecords,
  normalizeStoryDecisionRecord,
  rankStoryDecisions,
  storyDecisionAttentionCount,
  withdrawStoryDecision,
  type StoryDecisionRecord,
} from "../core/story-workflow/story-decisions/core.mjs";
import { persistentHome } from "./local-credentials";

const API = "/api/story-decisions";
const RECORDS_ROOT = () => path.join(persistentHome(), "story-decisions", "records");
const SAFE_DECISION_ID = /^story-decision-[a-z0-9]{7,20}$/i;
const MAX_BODY_BYTES = 128 * 1024;

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

async function parseBody(request: IncomingMessage) {
  const declared = Number(request.headers["content-length"] || 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw Object.assign(new Error("Story Decision request is too large."), { statusCode: 413 });
  let text = "";
  for await (const chunk of request) {
    text += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) throw Object.assign(new Error("Story Decision request is too large."), { statusCode: 413 });
  }
  try { return JSON.parse(text || "{}"); } catch { throw Object.assign(new Error("Story Decision request must be valid JSON."), { statusCode: 400 }); }
}

async function readRecord(decisionId: string): Promise<StoryDecisionRecord | null> {
  if (!SAFE_DECISION_ID.test(decisionId)) return null;
  try {
    const source = JSON.parse(await readFile(path.join(RECORDS_ROOT(), `${decisionId}.json`), "utf8"));
    return normalizeStoryDecisionRecord(source);
  } catch { return null; }
}

async function writeRecord(recordInput: StoryDecisionRecord) {
  const record = normalizeStoryDecisionRecord(recordInput);
  await mkdir(RECORDS_ROOT(), { recursive: true });
  const target = path.join(RECORDS_ROOT(), `${record.decisionId}.json`);
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, target);
  return record;
}

async function listRecords(projectId = "") {
  let names: string[] = [];
  try { names = (await readdir(RECORDS_ROOT())).filter((name) => /^story-decision-[a-z0-9]{7,20}\.json$/i.test(name)); } catch { return []; }
  const records = (await Promise.all(names.slice(-250).map((name) => readRecord(name.slice(0, -5))))).filter((record): record is StoryDecisionRecord => Boolean(record));
  return rankStoryDecisions(records.filter((record) => !projectId || record.projectId === projectId)).slice(0, 100);
}

async function upsertRecord(candidateInput: unknown) {
  const candidate = normalizeStoryDecisionRecord(candidateInput);
  const records = await listRecords(candidate.projectId);
  const existing = records.find((record) => record.problemKey === candidate.problemKey && ["new", "reviewing", "deferred", "stale"].includes(record.status));
  if (!existing) return writeRecord(candidate);
  const result = mergeStoryDecisionRecords(existing, candidate);
  await writeRecord(result.existing);
  if (result.incoming) return writeRecord(result.incoming);
  return result.existing;
}

export function registerStoryDecisionGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const rawUrl = request.url;
    if (!rawUrl) { next(); return; }
    let url: URL;
    try { url = new URL(rawUrl, "http://127.0.0.1"); } catch { next(); return; }
    if (url.pathname !== API) { next(); return; }
    if (!isLocalRequest(request)) {
      send(response, 403, { ok: false, message: "Story Decisions are available only from the local PlotPickle application." });
      return;
    }

    void (async () => {
      if (request.method === "GET") {
        const decisionId = url.searchParams.get("decisionId") || "";
        if (decisionId) {
          const record = await readRecord(decisionId);
          if (!record) { send(response, 404, { ok: false, message: "That Story Decision was not found." }); return; }
          send(response, 200, { ok: true, decision: record });
          return;
        }
        const projectId = (url.searchParams.get("projectId") || "").trim().slice(0, 180);
        const decisions = await listRecords(projectId);
        send(response, 200, { ok: true, decisions, attentionCount: storyDecisionAttentionCount(decisions) });
        return;
      }

      if (request.method !== "POST") {
        send(response, 405, { ok: false, message: "Story Decisions support GET and bounded local POST actions only." });
        return;
      }

      const body = await parseBody(request) as Record<string, unknown>;
      const action = String(body.action || "");
      if (action === "upsert") {
        const decision = await upsertRecord(body.decision);
        send(response, 200, { ok: true, decision, writesCanon: false });
        return;
      }
      const decisionId = String(body.decisionId || "");
      const existing = await readRecord(decisionId);
      if (!existing) { send(response, 404, { ok: false, message: "That Story Decision was not found." }); return; }

      if (action === "respond") {
        try {
          const result = createStoryDecisionResponse(existing, body.response as Readonly<Record<string, unknown>>);
          await writeRecord(result.decision);
          send(response, 200, { ok: true, decision: result.decision, response: result.response, writesCanon: false, next: "story-workbench-validation" });
        } catch (error) {
          if ((error as { code?: string }).code === "STORY_DECISION_STALE") {
            const currentRevision = String((body.response as Record<string, unknown> | undefined)?.currentRevision || "");
            const stale = await writeRecord(markStoryDecisionStale(existing, currentRevision));
            send(response, 409, { ok: false, message: "Story changed since this question was created.", decision: stale, refreshRequired: true });
            return;
          }
          throw error;
        }
        return;
      }

      if (action === "withdraw") {
        const decision = await writeRecord(withdrawStoryDecision(existing, String(body.currentRevision || existing.baseRevision)));
        send(response, 200, { ok: true, decision, writesCanon: false });
        return;
      }

      send(response, 400, { ok: false, message: "Unknown Story Decision action." });
    })().catch((error) => send(response, Number((error as { statusCode?: number }).statusCode) || 500, { ok: false, message: error instanceof Error ? error.message : "Story Decision request failed." }));
  });
}
