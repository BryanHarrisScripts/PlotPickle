import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import {
  createStoryDecisionFromCouncilResult,
  createStoryDecisionResponse,
  markStoryDecisionStale,
  mergeStoryDecisionRecords,
  normalizeStoryDecisionRecord,
  rankStoryDecisions,
  storyDecisionAttentionCount,
  withdrawStoryDecision,
  type StoryDecisionRecord,
} from "../../core/story-workflow/story-decisions/core.mjs";
import { isLocalPlotPickleRequest } from "../projects/portable-ppf-reader";
import { currentProfileRequestContext } from "../auth/profile-request-context";

const API = "/api/story-decisions";
const STORE_OBJECT_ID = "story-decisions-v1";
const SAFE_DECISION_ID = /^story-decision-[a-z0-9]{7,20}$/i;
const MAX_BODY_BYTES = 128 * 1024;
const MAX_STORED_DECISIONS = 200;

type ProfileContext = NonNullable<ReturnType<typeof currentProfileRequestContext>>;
type DecisionStore = Readonly<{ version: 1; records: readonly StoryDecisionRecord[] }>;

function send(response: ServerResponse, status: number, value: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
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

async function readStore(profile: ProfileContext): Promise<DecisionStore> {
  const value = await profile.privateStorage.readPrivateJson(profile.authContext, {
    domain: "indexes",
    objectId: STORE_OBJECT_ID,
  });
  if (value === null) return { version: 1, records: [] };
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Encrypted Story Decision store is invalid.");
  const source = value as { readonly version?: unknown; readonly records?: unknown };
  if (source.version !== 1 || !Array.isArray(source.records)) throw new Error("Encrypted Story Decision store version is invalid.");
  return {
    version: 1,
    records: source.records.slice(-MAX_STORED_DECISIONS).map((record) => normalizeStoryDecisionRecord(record)),
  };
}

async function writeStore(profile: ProfileContext, records: readonly StoryDecisionRecord[]) {
  const unique = new Map<string, StoryDecisionRecord>();
  for (const input of records) {
    const record = normalizeStoryDecisionRecord(input);
    if (!unique.has(record.decisionId)) unique.set(record.decisionId, record);
  }
  const ranked = rankStoryDecisions([...unique.values()]).slice(0, MAX_STORED_DECISIONS);
  await profile.privateStorage.writePrivateJson(profile.authContext, {
    domain: "indexes",
    objectId: STORE_OBJECT_ID,
    value: { version: 1, records: ranked },
  });
  return ranked;
}

async function readRecord(profile: ProfileContext, decisionId: string) {
  if (!SAFE_DECISION_ID.test(decisionId)) return null;
  const store = await readStore(profile);
  return store.records.find((record) => record.decisionId === decisionId) ?? null;
}

async function writeRecord(profile: ProfileContext, recordInput: StoryDecisionRecord) {
  const record = normalizeStoryDecisionRecord(recordInput);
  const store = await readStore(profile);
  const next = store.records.filter((item) => item.decisionId !== record.decisionId);
  await writeStore(profile, [record, ...next]);
  return record;
}

async function listRecords(profile: ProfileContext, projectId = "") {
  const store = await readStore(profile);
  return rankStoryDecisions(store.records.filter((record) => !projectId || record.projectId === projectId)).slice(0, 100);
}

async function upsertRecord(profile: ProfileContext, candidateInput: unknown) {
  const candidate = normalizeStoryDecisionRecord(candidateInput);
  const store = await readStore(profile);

  const exact = store.records.find((record) => record.decisionId === candidate.decisionId);
  if (exact && ["answered", "superseded", "withdrawn", "stale"].includes(exact.status)) {
    return exact;
  }

  const existing = exact ?? store.records.find((record) =>
    record.projectId === candidate.projectId
    && record.problemKey === candidate.problemKey
    && ["new", "reviewing", "deferred"].includes(record.status));
  if (!existing) {
    await writeStore(profile, [candidate, ...store.records]);
    return candidate;
  }

  const result = mergeStoryDecisionRecords(existing, candidate);
  const withoutExistingOrIncoming = store.records.filter((record) =>
    record.decisionId !== existing.decisionId && record.decisionId !== candidate.decisionId);
  const next = result.incoming
    ? [result.incoming, result.existing, ...withoutExistingOrIncoming]
    : [result.existing, ...withoutExistingOrIncoming];
  await writeStore(profile, next);
  return result.incoming ?? result.existing;
}

function councilDecisionInput(body: Record<string, unknown>) {
  return {
    projectId: body.projectId,
    councilResult: body.councilResult,
    councilResultId: body.councilResultId,
    question: body.question,
    whyHuman: body.whyHuman,
    proposedChange: body.proposedChange,
    alternatives: body.alternatives,
    visualContext: body.visualContext,
    transcriptRef: body.transcriptRef,
    blockedByHuman: body.blockedByHuman,
    priority: body.priority,
    severity: body.severity,
    problemSignature: body.problemSignature,
    choiceFamily: body.choiceFamily,
  };
}

export function registerStoryDecisionGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const rawUrl = request.url;
    if (!rawUrl) { next(); return; }
    let url: URL;
    try { url = new URL(rawUrl, "http://127.0.0.1"); } catch { next(); return; }
    if (url.pathname !== API) { next(); return; }
    if (!isLocalPlotPickleRequest(request)) {
      send(response, 403, { ok: false, message: "Story Decisions are available only from the local PlotPickle application." });
      return;
    }
    const profile = currentProfileRequestContext();
    if (!profile?.profileId) {
      send(response, 401, { ok: false, message: "Unlock a PlotPickle Human profile before using Story Decisions." });
      return;
    }

    void (async () => {
      if (request.method === "GET") {
        const decisionId = url.searchParams.get("decisionId") || "";
        if (decisionId) {
          const record = await readRecord(profile, decisionId);
          if (!record) { send(response, 404, { ok: false, message: "That Story Decision was not found." }); return; }
          send(response, 200, { ok: true, decision: record });
          return;
        }
        const projectId = (url.searchParams.get("projectId") || "").trim().slice(0, 180);
        const decisions = await listRecords(profile, projectId);
        send(response, 200, { ok: true, decisions, attentionCount: storyDecisionAttentionCount(decisions) });
        return;
      }
      if (request.method !== "POST") {
        send(response, 405, { ok: false, message: "Story Decisions support GET and bounded local POST actions only." });
        return;
      }

      const body = await parseBody(request) as Record<string, unknown>;
      const action = String(body.action || "");
      if (action === "ingest-council") {
        const candidate = createStoryDecisionFromCouncilResult(councilDecisionInput(body));
        if (!candidate) {
          send(response, 200, { ok: true, created: false, reason: "human-judgment-not-required", writesCanon: false });
          return;
        }
        const decision = await upsertRecord(profile, candidate);
        send(response, 200, { ok: true, created: true, decision, attentionRequired: ["new", "reviewing", "deferred"].includes(decision.status), writesCanon: false });
        return;
      }
      if (action === "upsert") {
        const decision = await upsertRecord(profile, body.decision);
        send(response, 200, { ok: true, decision, writesCanon: false });
        return;
      }
      const decisionId = String(body.decisionId || "");
      const existing = await readRecord(profile, decisionId);
      if (!existing) { send(response, 404, { ok: false, message: "That Story Decision was not found." }); return; }

      if (action === "respond") {
        const supplied = (body.response && typeof body.response === "object" ? body.response : {}) as Record<string, unknown>;
        if (supplied.authorityClass === "delegated-autonomous-operator" || supplied.authority || supplied.autonomousPolicy) {
          send(response, 403, { ok: false, message: "The Human Story Decision route cannot claim delegated autonomous authority." });
          return;
        }
        const suppliedProfileId = String(supplied.humanProfileId || "");
        if (suppliedProfileId && suppliedProfileId !== profile.profileId) {
          send(response, 403, { ok: false, message: "Story Decision response profile does not match the active Human profile." });
          return;
        }
        try {
          const result = createStoryDecisionResponse(existing, {
            ...supplied,
            humanProfileId: profile.profileId,
            authority: { authorityClass: "authenticated-human", humanProfileId: profile.profileId },
          });
          await writeRecord(profile, result.decision);
          send(response, 200, { ok: true, decision: result.decision, response: result.response, writesCanon: false, next: "story-workbench-validation" });
        } catch (error) {
          if ((error as { code?: string }).code === "STORY_DECISION_STALE") {
            const currentRevision = String(supplied.currentRevision || "");
            const stale = await writeRecord(profile, markStoryDecisionStale(existing, currentRevision));
            send(response, 409, { ok: false, message: "Story changed since this question was created.", decision: stale, refreshRequired: true });
            return;
          }
          throw error;
        }
        return;
      }
      if (action === "withdraw") {
        const decision = await writeRecord(profile, withdrawStoryDecision(existing, String(body.currentRevision || existing.baseRevision)));
        send(response, 200, { ok: true, decision, writesCanon: false });
        return;
      }
      send(response, 400, { ok: false, message: "Unknown Story Decision action." });
    })().catch((error) => send(response, Number((error as { statusCode?: number }).statusCode) || 500, { ok: false, message: error instanceof Error ? error.message : "Story Decision request failed." }));
  });
}
