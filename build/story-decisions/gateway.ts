import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import type { AutonomousGuestAuthority } from "../../core/auth/autonomous-guest/guest-authority";
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
import {
  currentAutonomousGuestRequestContext,
  currentProfileRequestContext,
} from "../auth/profile-request-context";
import { isLocalPlotPickleRequest } from "../projects/portable-ppf-reader";
import {
  readAutonomousGuestDecisionStore,
  writeAutonomousGuestDecisionStore,
} from "./autonomous-guest-store";

const API = "/api/story-decisions";
const STORE_OBJECT_ID = "story-decisions-v1";
const SAFE_DECISION_ID = /^story-decision-[a-z0-9]{7,20}$/i;
const MAX_BODY_BYTES = 128 * 1024;
const MAX_STORED_DECISIONS = 200;

type ProfileContext = NonNullable<ReturnType<typeof currentProfileRequestContext>>;
type AutonomousGuestContext = NonNullable<ReturnType<typeof currentAutonomousGuestRequestContext>>;
type DecisionStore = Readonly<{ version: 1; records: readonly StoryDecisionRecord[] }>;
type DecisionStorageScope = Readonly<{
  kind: "human" | "autonomous-guest";
  profile: ProfileContext | null;
  guestAuthority: AutonomousGuestAuthority | null;
  read: () => Promise<unknown | null>;
  write: (value: unknown) => Promise<void>;
}>;

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

function humanStorageScope(profile: ProfileContext): DecisionStorageScope {
  return Object.freeze({
    kind: "human" as const,
    profile,
    guestAuthority: null,
    read: () => profile.privateStorage.readPrivateJson(profile.authContext, {
      domain: "indexes",
      objectId: STORE_OBJECT_ID,
    }),
    write: (value: unknown) => profile.privateStorage.writePrivateJson(profile.authContext, {
      domain: "indexes",
      objectId: STORE_OBJECT_ID,
      value,
    }),
  });
}

function autonomousGuestStorageScope(context: AutonomousGuestContext | AutonomousGuestAuthority): DecisionStorageScope {
  const authority = "authority" in context ? context.authority : context;
  return Object.freeze({
    kind: "autonomous-guest" as const,
    profile: null,
    guestAuthority: authority,
    read: () => readAutonomousGuestDecisionStore(authority),
    write: (value: unknown) => writeAutonomousGuestDecisionStore(authority, value),
  });
}

function currentDecisionStorageScope() {
  const profile = currentProfileRequestContext();
  if (profile?.profileId) return humanStorageScope(profile);
  const guest = currentAutonomousGuestRequestContext();
  if (guest?.authority.active) return autonomousGuestStorageScope(guest);
  return null;
}

async function readStore(scope: DecisionStorageScope): Promise<DecisionStore> {
  const value = await scope.read();
  if (value === null) return { version: 1, records: [] };
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Story Decision store is invalid.");
  const source = value as { readonly version?: unknown; readonly records?: unknown };
  if (source.version !== 1 || !Array.isArray(source.records)) throw new Error("Story Decision store version is invalid.");
  return {
    version: 1,
    records: source.records.slice(-MAX_STORED_DECISIONS).map((record) => normalizeStoryDecisionRecord(record)),
  };
}

async function writeStore(scope: DecisionStorageScope, records: readonly StoryDecisionRecord[]) {
  const unique = new Map<string, StoryDecisionRecord>();
  for (const input of records) {
    const record = normalizeStoryDecisionRecord(input);
    if (!unique.has(record.decisionId)) unique.set(record.decisionId, record);
  }
  const ranked = rankStoryDecisions([...unique.values()]).slice(0, MAX_STORED_DECISIONS);
  await scope.write({ version: 1, records: ranked });
  return ranked;
}

async function readRecord(scope: DecisionStorageScope, decisionId: string) {
  if (!SAFE_DECISION_ID.test(decisionId)) return null;
  const store = await readStore(scope);
  return store.records.find((record) => record.decisionId === decisionId) ?? null;
}

async function writeRecord(scope: DecisionStorageScope, recordInput: StoryDecisionRecord) {
  const record = normalizeStoryDecisionRecord(recordInput);
  const store = await readStore(scope);
  const next = store.records.filter((item) => item.decisionId !== record.decisionId);
  await writeStore(scope, [record, ...next]);
  return record;
}

async function listRecords(scope: DecisionStorageScope, projectId = "") {
  const store = await readStore(scope);
  return rankStoryDecisions(store.records.filter((record) => !projectId || record.projectId === projectId)).slice(0, 100);
}

async function upsertRecord(scope: DecisionStorageScope, candidateInput: unknown) {
  const candidate = normalizeStoryDecisionRecord(candidateInput);
  const store = await readStore(scope);

  const exact = store.records.find((record) => record.decisionId === candidate.decisionId);
  if (exact && ["answered", "superseded", "withdrawn", "stale"].includes(exact.status)) {
    return exact;
  }

  const existing = exact ?? store.records.find((record) =>
    record.projectId === candidate.projectId
    && record.problemKey === candidate.problemKey
    && ["new", "reviewing", "deferred"].includes(record.status));
  if (!existing) {
    await writeStore(scope, [candidate, ...store.records]);
    return candidate;
  }

  const result = mergeStoryDecisionRecords(existing, candidate);
  const withoutExistingOrIncoming = store.records.filter((record) =>
    record.decisionId !== existing.decisionId && record.decisionId !== candidate.decisionId);
  const next = result.incoming
    ? [result.incoming, result.existing, ...withoutExistingOrIncoming]
    : [result.existing, ...withoutExistingOrIncoming];
  await writeStore(scope, next);
  return result.incoming ?? result.existing;
}

export async function respondAutonomousStoryDecisionThroughGateway(input: Readonly<{
  guestAuthority: AutonomousGuestAuthority;
  decisionId: string;
  response: Readonly<Record<string, unknown>>;
  authority: Readonly<Record<string, unknown>>;
  serverPolicy: Readonly<Record<string, unknown>>;
}>) {
  if (input.authority.authorityClass !== "delegated-autonomous-operator") {
    throw new Error("Autonomous Story Decision gateway requires delegated autonomous authority.");
  }
  const scope = autonomousGuestStorageScope(input.guestAuthority);
  const existing = await readRecord(scope, input.decisionId);
  if (!existing) throw Object.assign(new Error("That Story Decision was not found."), { statusCode: 404 });
  try {
    const result = createStoryDecisionResponse(existing, {
      ...input.response,
      authority: input.authority,
      autonomousPolicy: input.serverPolicy,
    });
    await writeRecord(scope, result.decision);
    return {
      ok: true,
      decision: result.decision,
      response: result.response,
      writesCanon: false as const,
      next: "story-workbench-validation" as const,
    };
  } catch (error) {
    if ((error as { code?: string }).code === "STORY_DECISION_STALE") {
      const currentRevision = String(input.response.currentRevision || "");
      await writeRecord(scope, markStoryDecisionStale(existing, currentRevision));
    }
    throw error;
  }
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
    const scope = currentDecisionStorageScope();
    if (!scope) {
      send(response, 401, { ok: false, message: "Story Decisions require either an unlocked Human profile or an explicitly delegated autonomous Guest run." });
      return;
    }

    void (async () => {
      if (request.method === "GET") {
        const decisionId = url.searchParams.get("decisionId") || "";
        if (decisionId) {
          const record = await readRecord(scope, decisionId);
          if (!record) { send(response, 404, { ok: false, message: "That Story Decision was not found." }); return; }
          send(response, 200, { ok: true, decision: record, authorityScope: scope.kind });
          return;
        }
        const projectId = (url.searchParams.get("projectId") || "").trim().slice(0, 180);
        const decisions = await listRecords(scope, projectId);
        send(response, 200, { ok: true, decisions, attentionCount: storyDecisionAttentionCount(decisions), authorityScope: scope.kind });
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
          send(response, 200, { ok: true, created: false, reason: "human-judgment-not-required", writesCanon: false, authorityScope: scope.kind });
          return;
        }
        const decision = await upsertRecord(scope, candidate);
        send(response, 200, { ok: true, created: true, decision, attentionRequired: ["new", "reviewing", "deferred"].includes(decision.status), writesCanon: false, authorityScope: scope.kind });
        return;
      }
      if (action === "upsert") {
        const decision = await upsertRecord(scope, body.decision);
        send(response, 200, { ok: true, decision, writesCanon: false, authorityScope: scope.kind });
        return;
      }
      const decisionId = String(body.decisionId || "");
      const existing = await readRecord(scope, decisionId);
      if (!existing) { send(response, 404, { ok: false, message: "That Story Decision was not found." }); return; }

      if (action === "respond") {
        if (scope.kind !== "human" || !scope.profile) {
          send(response, 403, { ok: false, message: "Autonomous Guest cannot use the Human Story Decision response route." });
          return;
        }
        const profile = scope.profile;
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
          await writeRecord(scope, result.decision);
          send(response, 200, { ok: true, decision: result.decision, response: result.response, writesCanon: false, next: "story-workbench-validation" });
        } catch (error) {
          if ((error as { code?: string }).code === "STORY_DECISION_STALE") {
            const currentRevision = String(supplied.currentRevision || "");
            const stale = await writeRecord(scope, markStoryDecisionStale(existing, currentRevision));
            send(response, 409, { ok: false, message: "Story changed since this question was created.", decision: stale, refreshRequired: true });
            return;
          }
          throw error;
        }
        return;
      }
      if (action === "withdraw") {
        if (scope.kind !== "human") {
          send(response, 403, { ok: false, message: "Autonomous Guest lifecycle changes must use the delegated Story Decision operator." });
          return;
        }
        const decision = await writeRecord(scope, withdrawStoryDecision(existing, String(body.currentRevision || existing.baseRevision)));
        send(response, 200, { ok: true, decision, writesCanon: false });
        return;
      }
      send(response, 400, { ok: false, message: "Unknown Story Decision action." });
    })().catch((error) => send(response, Number((error as { statusCode?: number }).statusCode) || 500, { ok: false, message: error instanceof Error ? error.message : "Story Decision request failed." }));
  });
}
