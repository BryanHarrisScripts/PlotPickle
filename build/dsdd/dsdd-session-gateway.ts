import { createHash, randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { ViteDevServer } from "vite";
import { currentProfileRequestContext } from "../auth/profile-request-context";
import { persistentHome } from "../local-credentials";
import { runDsddPiAction } from "./dsdd-pi-session";

const API = "/api/dsdd/session";
const OBJECT_ID = "dsdd-engineering-session-v1";
const MAX_BODY = 128 * 1024;

type DsddContext = {
  route: string;
  surfaceId: string;
  surfaceLabel: string;
  capturedAt: string;
};

type DsddConversationEntry = {
  id: string;
  role: "human" | "dsdd";
  text: string;
  context: DsddContext | null;
  recordedAt: string;
  piEntryId: string;
};

type DsddRequirement = {
  id: string;
  text: string;
  status: "PASS" | "FAIL" | "UNPROVEN";
  evidence: Array<{ ref: string; summary: string }>;
};

type DsddIntent = {
  version: number;
  locked: true;
  lockedAt: string;
  humanEntryId: string;
  interpretationEntryId: string;
  humanStatement: string;
  understoodMeaning: string;
  context: DsddContext | null;
  requirements: DsddRequirement[];
  buildPacket: {
    id: string;
    intentVersion: number;
    intentDigest: string;
    createdAt: string;
    isolation: "git-worktree";
    mutationAuthority: "existing-local-developer-worker";
    mergeAuthority: "github-exact-head-green-only";
    repairMayMutateIntent: false;
  };
};

type DsddSession = {
  schemaVersion: 1;
  sessionId: string;
  piVersion: "0.87.0";
  piSessionId: string;
  piSessionFile: string;
  createdAt: string;
  updatedAt: string;
  conversation: DsddConversationEntry[];
  intents: DsddIntent[];
};

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

function send(response: ServerResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += value.length;
    if (bytes > MAX_BODY) throw new Error("The DSDD session request is too large.");
    chunks.push(value);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Enter a valid DSDD session request.");
  return parsed as Record<string, unknown>;
}

function text(value: unknown, max = 12000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeContext(value: unknown): DsddContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const route = text(source.route, 512);
  const surfaceId = text(source.surfaceId, 180);
  const surfaceLabel = text(source.surfaceLabel, 240);
  const capturedAt = text(source.capturedAt, 80);
  if (!route || !surfaceId) return null;
  return { route, surfaceId, surfaceLabel: surfaceLabel || surfaceId, capturedAt: capturedAt || new Date().toISOString() };
}

function emptySession(): DsddSession {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    sessionId: randomUUID(),
    piVersion: "0.87.0",
    piSessionId: "",
    piSessionFile: "",
    createdAt: now,
    updatedAt: now,
    conversation: [],
    intents: [],
  };
}

function normalizeSession(value: unknown): DsddSession {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptySession();
  const source = value as Partial<DsddSession>;
  if (source.schemaVersion !== 1 || typeof source.sessionId !== "string") return emptySession();
  return {
    schemaVersion: 1,
    sessionId: source.sessionId,
    piVersion: "0.87.0",
    piSessionId: typeof source.piSessionId === "string" ? source.piSessionId : "",
    piSessionFile: typeof source.piSessionFile === "string" ? source.piSessionFile : "",
    createdAt: typeof source.createdAt === "string" ? source.createdAt : new Date().toISOString(),
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : new Date().toISOString(),
    conversation: Array.isArray(source.conversation) ? source.conversation.slice(-80) : [],
    intents: Array.isArray(source.intents) ? source.intents.slice(-20) : [],
  };
}

function profile() {
  const context = currentProfileRequestContext();
  if (!context) throw new Error("Unlock a PlotPickle Human profile before using DSDD.");
  return context;
}

async function load() {
  const context = profile();
  const stored = await context.privateStorage.readPrivateJson(context.authContext, {
    domain: "memory",
    objectId: OBJECT_ID,
  });
  return { context, session: normalizeSession(stored) };
}

async function save(context: ReturnType<typeof profile>, session: DsddSession) {
  session.updatedAt = new Date().toISOString();
  await context.privateStorage.writePrivateJson(context.authContext, {
    domain: "memory",
    objectId: OBJECT_ID,
    value: session,
  });
}

function piSessionDir(profileId: string) {
  const opaque = createHash("sha256").update(profileId).digest("hex").slice(0, 24);
  return path.join(persistentHome(), "developer-agent", "dsdd-sessions", opaque);
}

function requirementTexts(interpretation: string) {
  const bullets = interpretation.split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+\S/u.test(line))
    .map((line) => line.replace(/^[-*]\s+/u, "").trim())
    .filter(Boolean)
    .slice(0, 12);
  return bullets.length ? bullets : [interpretation.slice(0, 4000)];
}

function lockedText(intent: DsddIntent) {
  return [
    `LOCKED DSDD INTENT v${intent.version}`,
    `Human statement: ${intent.humanStatement}`,
    `Approved meaning: ${intent.understoodMeaning}`,
    "Requirements:",
    ...intent.requirements.map((requirement) => `${requirement.id} ${requirement.text}`),
    "The locked meaning and requirements may not be changed by coding or repair workers. A material meaning change requires a new Human-approved intent version.",
  ].join("\n");
}

async function appendHuman(body: Record<string, unknown>) {
  const { context, session } = await load();
  const narration = text(body.text);
  if (!narration) throw new Error("Narrate the DSDD workflow or problem first.");
  const captured = normalizeContext(body.context);
  const pi = await runDsddPiAction({
    action: "append-human",
    cwd: process.cwd(),
    sessionDir: piSessionDir(context.profileId),
    sessionId: session.piSessionId || session.sessionId,
    sessionFile: session.piSessionFile || undefined,
    text: narration,
    context: captured,
  });
  session.piSessionId = pi.sessionId;
  session.piSessionFile = pi.sessionFile;
  const entry: DsddConversationEntry = {
    id: randomUUID(),
    role: "human",
    text: narration,
    context: captured,
    recordedAt: new Date().toISOString(),
    piEntryId: pi.entryId,
  };
  session.conversation.push(entry);
  await save(context, session);
  return { session, entry };
}

async function appendInterpretation(body: Record<string, unknown>) {
  const { context, session } = await load();
  const interpretation = text(body.text);
  if (!interpretation) throw new Error("DSDD interpretation is required.");
  const captured = normalizeContext(body.context);
  const pi = await runDsddPiAction({
    action: "append-interpretation",
    cwd: process.cwd(),
    sessionDir: piSessionDir(context.profileId),
    sessionId: session.piSessionId || session.sessionId,
    sessionFile: session.piSessionFile || undefined,
    text: interpretation,
    context: captured,
  });
  session.piSessionId = pi.sessionId;
  session.piSessionFile = pi.sessionFile;
  const entry: DsddConversationEntry = {
    id: randomUUID(),
    role: "dsdd",
    text: interpretation,
    context: captured,
    recordedAt: new Date().toISOString(),
    piEntryId: pi.entryId,
  };
  session.conversation.push(entry);
  await save(context, session);
  return { session, entry };
}

async function lockIntent() {
  const { context, session } = await load();
  const human = [...session.conversation].reverse().find((entry) => entry.role === "human");
  const interpretation = [...session.conversation].reverse().find((entry) => entry.role === "dsdd");
  if (!human || !interpretation) throw new Error("DSDD needs both Human narration and a reflected interpretation before Build this can lock intent.");
  if (session.conversation.indexOf(interpretation) < session.conversation.indexOf(human)) {
    throw new Error("DSDD must reflect the latest Human narration before Build this.");
  }
  const version = (session.intents.at(-1)?.version || 0) + 1;
  const requirements: DsddRequirement[] = requirementTexts(interpretation.text).map((value, index) => ({
    id: `R${index + 1}`,
    text: value,
    status: "UNPROVEN",
    evidence: [],
  }));
  const digestSource = JSON.stringify({
    version,
    human: human.text,
    interpretation: interpretation.text,
    context: human.context,
    requirements: requirements.map(({ id, text: requirement }) => ({ id, text: requirement })),
  });
  const intent: DsddIntent = {
    version,
    locked: true,
    lockedAt: new Date().toISOString(),
    humanEntryId: human.id,
    interpretationEntryId: interpretation.id,
    humanStatement: human.text,
    understoodMeaning: interpretation.text,
    context: human.context,
    requirements,
    buildPacket: {
      id: `dsdd-build-${randomUUID()}`,
      intentVersion: version,
      intentDigest: createHash("sha256").update(digestSource).digest("hex"),
      createdAt: new Date().toISOString(),
      isolation: "git-worktree",
      mutationAuthority: "existing-local-developer-worker",
      mergeAuthority: "github-exact-head-green-only",
      repairMayMutateIntent: false,
    },
  };
  const pi = await runDsddPiAction({
    action: "lock-intent",
    cwd: process.cwd(),
    sessionDir: piSessionDir(context.profileId),
    sessionId: session.piSessionId || session.sessionId,
    sessionFile: session.piSessionFile || undefined,
    targetEntryId: interpretation.piEntryId,
    lockedText: lockedText(intent),
    intent,
  });
  session.piSessionId = pi.sessionId;
  session.piSessionFile = pi.sessionFile;
  session.intents.push(intent);
  await save(context, session);
  return { session, intent };
}

async function recordEvidence(body: Record<string, unknown>) {
  const { context, session } = await load();
  const version = Number(body.intentVersion);
  const intent = session.intents.find((candidate) => candidate.version === version);
  if (!intent) throw new Error("The referenced locked DSDD intent version does not exist.");
  const updates = Array.isArray(body.requirements) ? body.requirements : [];
  for (const update of updates) {
    if (!update || typeof update !== "object") continue;
    const item = update as Record<string, unknown>;
    const requirement = intent.requirements.find((candidate) => candidate.id === text(item.id, 40));
    const status = item.status;
    if (!requirement || (status !== "PASS" && status !== "FAIL" && status !== "UNPROVEN")) continue;
    requirement.status = status;
    requirement.evidence = Array.isArray(item.evidence)
      ? item.evidence.flatMap((evidence) => {
          if (!evidence || typeof evidence !== "object") return [];
          const entry = evidence as Record<string, unknown>;
          const ref = text(entry.ref, 1000);
          const summary = text(entry.summary, 2000);
          return ref && summary ? [{ ref, summary }] : [];
        }).slice(0, 12)
      : [];
  }
  await runDsddPiAction({
    action: "record-evidence",
    cwd: process.cwd(),
    sessionDir: piSessionDir(context.profileId),
    sessionId: session.piSessionId || session.sessionId,
    sessionFile: session.piSessionFile || undefined,
    intentVersion: intent.version,
    requirements: intent.requirements,
  });
  await save(context, session);
  return { session, intent };
}

async function handle(request: IncomingMessage, response: ServerResponse) {
  if (request.method === "GET") {
    const { session } = await load();
    send(response, 200, { ok: true, session });
    return;
  }
  if (request.method !== "POST") {
    send(response, 405, { ok: false, message: "Method not allowed." });
    return;
  }
  const body = await readBody(request);
  const action = text(body.action, 80);
  if (action === "append-human") {
    send(response, 200, { ok: true, ...(await appendHuman(body)) });
    return;
  }
  if (action === "append-interpretation") {
    send(response, 200, { ok: true, ...(await appendInterpretation(body)) });
    return;
  }
  if (action === "lock-intent") {
    send(response, 200, { ok: true, ...(await lockIntent()) });
    return;
  }
  if (action === "record-evidence") {
    send(response, 200, { ok: true, ...(await recordEvidence(body)) });
    return;
  }
  throw new Error("Unknown DSDD session action.");
}

export function registerDsddSessionGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    if (pathname !== API) { next(); return; }
    if (!isLocalRequest(request)) {
      send(response, 403, { ok: false, message: "DSDD engineering sessions are available only from this local PlotPickle application." });
      return;
    }
    void handle(request, response).catch((error) => send(response, 400, {
      ok: false,
      message: error instanceof Error ? error.message : "The DSDD engineering session request failed.",
    }));
  });
}
