import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
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
  build?: {
    state: "queued" | "running" | "passed-pre-pr" | "failed";
    startedAt: string;
    completedAt?: string;
    reportPath: string;
    packetPath: string;
    summary: string;
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

function acceptsDsddLoopbackRequest(request: IncomingMessage, expectedApi = API) {
  const remote = request.socket.remoteAddress;
  if (remote !== "127.0.0.1" && remote !== "::1" && remote !== "::ffff:127.0.0.1") return false;
  if ((request.url?.split("?", 1)[0] || "") !== expectedApi) return false;
  const host = request.headers.host;
  if (!host) return false;
  let hostUrl: URL;
  try { hostUrl = new URL(`http://${host}`); } catch { return false; }
  if (!["127.0.0.1", "localhost", "[::1]"].includes(hostUrl.hostname)) return false;
  if (!request.headers.origin) return true;
  try { return new URL(request.headers.origin).host === hostUrl.host; } catch { return false; }
}

function replyDsdd(response: ServerResponse, payload: { status: number; body: Record<string, unknown> }) {
  response.statusCode = payload.status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(payload.body));
}

async function readDsddRequestBody(request: IncomingMessage, maximum = MAX_BODY) {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const rawChunk of request) {
    const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
    bytes += chunk.length;
    if (bytes > maximum) throw new Error("The DSDD session request is too large.");
    chunks.push(chunk);
  }
  const source = Buffer.concat(chunks).toString("utf8");
  const parsed: unknown = JSON.parse(source || "{}");
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Enter a valid DSDD session request.");
  }
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

type DsddProfileContext = NonNullable<ReturnType<typeof currentProfileRequestContext>>;

async function load() {
  const context = currentProfileRequestContext();
  if (!context) throw new Error("Unlock a PlotPickle Human profile before using DSDD.");
  const stored = await context.privateStorage.readPrivateJson(context.authContext, {
    domain: "memory",
    objectId: OBJECT_ID,
  });
  return { context, session: normalizeSession(stored) };
}

async function save(context: DsddProfileContext, session: DsddSession) {
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

async function startBuild() {
  const { context, session } = await load();
  const intent = session.intents.at(-1);
  if (!intent?.locked) throw new Error("Choose Build this to lock a DSDD intent before implementation starts.");
  if (!session.piSessionFile) throw new Error("The persistent Pi engineering session is not available.");
  if (intent.build?.state === "queued" || intent.build?.state === "running") {
    return { session, intent };
  }

  const root = path.join(persistentHome(), "developer-agent", "dsdd-builds", session.sessionId);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const safeVersion = `intent-v${intent.version}`;
  const packetPath = path.join(root, `${safeVersion}-packet.json`);
  const reportPath = path.join(root, `${safeVersion}-uat.json`);
  const fingerprint = `dsdd-${session.sessionId.slice(0, 12)}-v${intent.version}`;
  const packet = {
    schemaVersion: 1,
    locked: true,
    intentVersion: intent.version,
    intentDigest: intent.buildPacket.intentDigest,
    humanStatement: intent.humanStatement,
    understoodMeaning: intent.understoodMeaning,
    context: intent.context,
    requirements: intent.requirements.map(({ id, text: requirement }) => ({ id, text: requirement })),
    repairMayMutateIntent: false,
    isolation: intent.buildPacket.isolation,
    mergeAuthority: intent.buildPacket.mergeAuthority,
  };
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    findings: [{
      fingerprint,
      title: `DSDD locked intent v${intent.version}`,
      area: "dsdd-locked-intent",
      severity: "blocker",
      message: [
        `Implement the Human-approved DSDD locked intent v${intent.version}.`,
        `Approved meaning: ${intent.understoodMeaning}`,
        "Do not modify the locked meaning. Add or strengthen focused deterministic proof before changing product behavior.",
      ].join("\n"),
      evidence: {
        intentVersion: intent.version,
        intentDigest: intent.buildPacket.intentDigest,
        requirementIds: intent.requirements.map((requirement) => requirement.id),
      },
    }],
  };
  await Promise.all([
    writeFile(packetPath, `${JSON.stringify(packet, null, 2)}\n`, { encoding: "utf8", mode: 0o600 }),
    writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", mode: 0o600 }),
  ]);

  intent.build = {
    state: "running",
    startedAt: new Date().toISOString(),
    reportPath,
    packetPath,
    summary: "Existing local Pi developer worker is implementing the locked intent in an isolated git worktree.",
  };
  await save(context, session);

  const child = spawn(process.execPath, [
    path.resolve(process.cwd(), "scripts", "run-uat-repair-agent.mjs"),
    "--worker", "pi",
    "--report", reportPath,
    "--fingerprint", fingerprint,
    "--dsdd-session", session.piSessionFile,
    "--dsdd-packet", packetPath,
  ], {
    cwd: process.cwd(),
    env: process.env,
    windowsHide: true,
    stdio: "ignore",
  });
  child.unref();
  child.once("error", async (error) => {
    intent.build = {
      ...intent.build!,
      state: "failed",
      completedAt: new Date().toISOString(),
      summary: error.message,
    };
    await save(context, session).catch(() => {});
  });
  child.once("exit", async (code) => {
    intent.build = {
      ...intent.build!,
      state: code === 0 ? "passed-pre-pr" : "failed",
      completedAt: new Date().toISOString(),
      summary: code === 0
        ? "The isolated developer worker passed its pre-PR deterministic gates and produced its normal draft-PR handoff. Requirement proof remains PASS/FAIL/UNPROVEN evidence, not worker self-report."
        : `The isolated developer worker exited ${code}; locked intent remains unchanged.`,
    };
    const evidenceStatus = code === 0 ? "UNPROVEN" : "FAIL";
    for (const requirement of intent.requirements) {
      if (requirement.status !== "UNPROVEN") continue;
      requirement.status = evidenceStatus;
      requirement.evidence = [{
        ref: reportPath,
        summary: code === 0
          ? "Pre-PR build/validation completed, but this requirement still needs direct behavior evidence."
          : "The bounded implementation worker failed before requirement proof completed.",
      }];
    }
    await runDsddPiAction({
      action: "record-evidence",
      cwd: process.cwd(),
      sessionDir: piSessionDir(context.profileId),
      sessionId: session.piSessionId || session.sessionId,
      sessionFile: session.piSessionFile || undefined,
      intentVersion: intent.version,
      requirements: intent.requirements,
    }).catch(() => {});
    await save(context, session).catch(() => {});
  });

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
    replyDsdd(response, { status: 200, body: { ok: true, session } });
    return;
  }
  if (request.method !== "POST") {
    replyDsdd(response, { status: 405, body: { ok: false, message: "Method not allowed." } });
    return;
  }
  const body = await readDsddRequestBody(request);
  const action = text(body.action, 80);
  if (action === "append-human") {
    replyDsdd(response, { status: 200, body: { ok: true, ...(await appendHuman(body)) } });
    return;
  }
  if (action === "append-interpretation") {
    replyDsdd(response, { status: 200, body: { ok: true, ...(await appendInterpretation(body)) } });
    return;
  }
  if (action === "lock-intent") {
    replyDsdd(response, { status: 200, body: { ok: true, ...(await lockIntent()) } });
    return;
  }
  if (action === "build") {
    replyDsdd(response, { status: 202, body: { ok: true, ...(await startBuild()) } });
    return;
  }
  if (action === "record-evidence") {
    replyDsdd(response, { status: 200, body: { ok: true, ...(await recordEvidence(body)) } });
    return;
  }
  throw new Error("Unknown DSDD session action.");
}

export function registerDsddSessionGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    if (pathname !== API) { next(); return; }
    if (!acceptsDsddLoopbackRequest(request)) {
      replyDsdd(response, {
        status: 403,
        body: { ok: false, message: "DSDD engineering sessions are available only from this local PlotPickle application." },
      });
      return;
    }
    void handle(request, response).catch((error) => replyDsdd(response, {
      status: 400,
      body: {
        ok: false,
        message: error instanceof Error ? error.message : "The DSDD engineering session request failed.",
      },
    }));
  });
}
