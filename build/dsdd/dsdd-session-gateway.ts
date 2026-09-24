import { createHash, randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { ViteDevServer } from "vite";
import { currentProfileRequestContext } from "../auth/profile-request-context";
import { persistentHome } from "../local-credentials";
import { publishDsddBrief } from "./dsdd-github-brief";
import { runDsddPiBrief } from "./dsdd-pi-brief";
import { evaluateEvidenceUpdate } from "./dsdd-evidence-contract.mjs";
import { assertDsddInterpretationIntegrity } from "../../scripts/dsdd-integrity.mjs";
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

type DsddInputMode = "typed" | "voice";

type DsddConversationEntry = {
  id: string;
  role: "human" | "dsdd";
  text: string;
  context: DsddContext | null;
  recordedAt: string;
  piEntryId: string;
  inputMode?: DsddInputMode;
};

type DsddEvidence = {
  ref: string;
  summary: string;
  proofType: "test" | "ci" | "runtime" | "artifact";
  finding: "supports" | "contradicts" | "insufficient";
  intentVersion: number;
  intentDigest: string;
  testedSource: string;
  testedCommit: string;
  observedResult: string;
};

type DsddRequirement = {
  id: string;
  text: string;
  status: "PASS" | "FAIL" | "UNPROVEN";
  evidence: DsddEvidence[];
};

type DsddDeveloperBrief = {
  state: "ready";
  generatedAt: string;
  reviewer: "pi";
  piVersion: string;
  model: string;
  runtime: string;
  tools: ["read", "grep", "find", "ls"];
  repositoryMutation: false;
  text: string;
};

type DsddPublishedIssue = {
  repository: "BryanHarrisScripts/PlotPickle";
  number: number;
  title: string;
  url: string;
  publishedAt: string;
};

type DsddIntent = {
  version: number;
  locked: true;
  lockedAt: string;
  humanEntryId: string;
  interpretationEntryId: string;
  humanStatement: string;
  inputMode?: DsddInputMode;
  understoodMeaning: string;
  context: DsddContext | null;
  requirements: DsddRequirement[];
  handoffPacket?: {
    id: string;
    intentVersion: number;
    intentDigest: string;
    createdAt: string;
    mutationAuthority: "none-dsdd";
    publicationAuthority: "human-publish-brief";
    implementationAuthority: "github-issue-downstream";
    mergeAuthority: "github-exact-head-green-only";
    repairMayMutateIntent: false;
  };
  developerBrief?: DsddDeveloperBrief;
  publishedIssue?: DsddPublishedIssue;
};

type DsddSession = {
  schemaVersion: 1;
  sessionId: string;
  piVersion: "0.87.1";
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
  const hostValue = `http://${host}`;
  if (!URL.canParse(hostValue)) return false;
  const hostUrl = new URL(hostValue);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(hostUrl.hostname)) return false;
  const origin = request.headers.origin;
  if (!origin) return true;
  if (!URL.canParse(origin)) return false;
  return new URL(origin).host === hostUrl.host;
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

function normalizeInputMode(value: unknown): DsddInputMode {
  return value === "voice" ? "voice" : "typed";
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
    piVersion: "0.87.1",
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
    piVersion: "0.87.1",
    piSessionId: typeof source.piSessionId === "string" ? source.piSessionId : "",
    piSessionFile: typeof source.piSessionFile === "string" ? source.piSessionFile : "",
    createdAt: typeof source.createdAt === "string" ? source.createdAt : new Date().toISOString(),
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : new Date().toISOString(),
    conversation: Array.isArray(source.conversation) ? source.conversation.slice(-80) : [],
    intents: Array.isArray(source.intents) ? source.intents.slice(-20) as DsddIntent[] : [],
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

function ensureHandoffPacket(intent: DsddIntent) {
  if (intent.handoffPacket) return intent.handoffPacket;
  const legacy = intent as DsddIntent & { buildPacket?: { intentDigest?: string } };
  const digest = text(legacy.buildPacket?.intentDigest, 128) || createHash("sha256").update(JSON.stringify({
    version: intent.version,
    human: intent.humanStatement,
    inputMode: intent.inputMode || "typed",
    interpretation: intent.understoodMeaning,
    context: intent.context,
    requirements: intent.requirements.map(({ id, text: requirement }) => ({ id, text: requirement })),
  })).digest("hex");
  intent.handoffPacket = {
    id: `dsdd-handoff-${randomUUID()}`,
    intentVersion: intent.version,
    intentDigest: digest,
    createdAt: new Date().toISOString(),
    mutationAuthority: "none-dsdd",
    publicationAuthority: "human-publish-brief",
    implementationAuthority: "github-issue-downstream",
    mergeAuthority: "github-exact-head-green-only",
    repairMayMutateIntent: false,
  };
  return intent.handoffPacket;
}

function lockedText(intent: DsddIntent) {
  return [
    `LOCKED DSDD INTENT v${intent.version}`,
    `Human statement: ${intent.humanStatement}`,
    `Input mode: ${intent.inputMode || "typed"}`,
    `Approved meaning: ${intent.understoodMeaning}`,
    "Requirements:",
    ...intent.requirements.map((requirement) => `${requirement.id} ${requirement.text}`),
    "This lock authorizes read-only Pi Draft analysis and later explicit Publish Brief only.",
    "DSDD itself has no source mutation, branch, commit, pull-request, or merge authority.",
    "A material meaning change requires a new Human-approved intent version.",
  ].join("\n");
}

async function appendHuman(body: Record<string, unknown>) {
  const { context, session } = await load();
  const narration = text(body.text);
  if (!narration) throw new Error("Narrate the DSDD workflow or problem first.");
  const inputMode = normalizeInputMode(body.inputMode);
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
    inputMode,
  };
  session.conversation.push(entry);
  await save(context, session);
  return { session, entry };
}

async function appendInterpretation(body: Record<string, unknown>) {
  const { context, session } = await load();
  const interpretation = text(body.text, 6000);
  if (!interpretation) throw new Error("DSDD interpretation is required.");
  const latestHuman = [...session.conversation].reverse().find((entry) => entry.role === "human");
  if (!latestHuman) throw new Error("DSDD needs Human narration before it can preserve an interpretation.");
  assertDsddInterpretationIntegrity({
    humanStatement: latestHuman.text,
    interpretation,
    inputMode: latestHuman.inputMode || "typed",
  });
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
  if (!human || !interpretation) throw new Error("DSDD needs both Human narration and a reflected interpretation before Pi Draft can lock intent.");
  if (session.conversation.indexOf(interpretation) < session.conversation.indexOf(human)) {
    throw new Error("DSDD must reflect the latest Human narration before Pi Draft.");
  }
  assertDsddInterpretationIntegrity({
    humanStatement: human.text,
    interpretation: interpretation.text,
    inputMode: human.inputMode || "typed",
  });
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
    inputMode: human.inputMode || "typed",
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
    inputMode: human.inputMode || "typed",
    understoodMeaning: interpretation.text,
    context: human.context,
    requirements,
    handoffPacket: {
      id: `dsdd-handoff-${randomUUID()}`,
      intentVersion: version,
      intentDigest: createHash("sha256").update(digestSource).digest("hex"),
      createdAt: new Date().toISOString(),
      mutationAuthority: "none-dsdd",
      publicationAuthority: "human-publish-brief",
      implementationAuthority: "github-issue-downstream",
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

function currentLockedIntent(session: DsddSession) {
  const latestHuman = [...session.conversation].reverse().find((entry) => entry.role === "human");
  const intent = session.intents.at(-1);
  if (!latestHuman || !intent?.locked || intent.humanEntryId !== latestHuman.id) return null;
  return intent;
}

async function draftDeveloperBrief() {
  const { context, session } = await load();
  const intent = currentLockedIntent(session);
  if (!intent) throw new Error("Choose Pi Draft only after the current Human narration has a reviewed locked intent.");
  ensureHandoffPacket(intent);
  if (intent.developerBrief?.state === "ready") return { session, intent };

  const draft = await runDsddPiBrief({
    humanStatement: intent.humanStatement,
    understoodMeaning: intent.understoodMeaning,
    context: intent.context,
    requirements: intent.requirements.map(({ id, text: requirement }) => ({ id, text: requirement })),
  });
  intent.developerBrief = {
    state: "ready",
    generatedAt: new Date().toISOString(),
    reviewer: "pi",
    piVersion: draft.piVersion,
    model: draft.model,
    runtime: draft.runtime,
    tools: draft.tools,
    repositoryMutation: false,
    text: draft.text,
  };
  await runDsddPiAction({
    action: "append-developer-brief",
    cwd: process.cwd(),
    sessionDir: piSessionDir(context.profileId),
    sessionId: session.piSessionId || session.sessionId,
    sessionFile: session.piSessionFile || undefined,
    text: draft.text,
    intentVersion: intent.version,
  });
  await save(context, session);
  return { session, intent };
}

function issueTitle(intent: DsddIntent) {
  const surface = text(intent.context?.surfaceLabel || "PlotPickle", 48).replace(/[^a-z0-9 _./-]+/gi, "").trim() || "PlotPickle";
  const summary = intent.understoodMeaning
    .split(/\r?\n/u)
    .map((line) => line.replace(/^#+\s*|^[-*]\s+/u, "").trim())
    .find(Boolean)
    ?.replace(/\s+/gu, " ")
    .slice(0, 110) || `Locked intent v${intent.version}`;
  return text(`[DSDD] ${surface} — ${summary}`, 180);
}

function issueBody(intent: DsddIntent) {
  if (!intent.developerBrief) throw new Error("Run Pi Draft before publishing the developer brief.");
  const packet = ensureHandoffPacket(intent);
  return [
    `<!-- plotpickle-dsdd-intent:${packet.intentDigest} -->`,
    "# DSDD Developer Brief",
    "",
    "This Issue was published explicitly from PlotPickle Conversational UAT after Human review.",
    "DSDD has not edited source, created a branch, committed, pushed, opened a PR, or merged code.",
    "",
    "## Human intent",
    intent.humanStatement,
    "",
    "## DSDD interpretation",
    intent.understoodMeaning,
    "",
    "## Surface context",
    intent.context
      ? `- Surface: ${intent.context.surfaceLabel}\n- Surface ID: ${intent.context.surfaceId}\n- Route: ${intent.context.route}\n- Captured: ${intent.context.capturedAt}`
      : "- No governed surface context was captured.",
    "",
    "## Locked requirements",
    ...intent.requirements.map((requirement) => `- ${requirement.id}: ${requirement.text} [${requirement.status}]`),
    "",
    "## Pi technical developer draft",
    intent.developerBrief.text,
    "",
    "## DSDD provenance",
    `- Intent version: ${intent.version}`,
    `- Input mode: ${intent.inputMode || "typed"}`,
    `- Intent digest: ${packet.intentDigest}`,
    "- Pi tools: read, grep, find, ls",
    "- Pi repository mutation: false",
    "- DSDD mutation authority: none",
    "- Implementation authority: downstream developer workflow against this Issue",
    "- Merge authority: GitHub exact-head green-only",
  ].join("\n").slice(0, 50_000);
}

async function publishBriefIssue() {
  const { context, session } = await load();
  const intent = currentLockedIntent(session);
  if (!intent) throw new Error("Publish Brief requires a locked intent for the current Human narration.");
  assertDsddInterpretationIntegrity({
    humanStatement: intent.humanStatement,
    interpretation: intent.understoodMeaning,
    inputMode: intent.inputMode || "typed",
  });
  if (!intent.developerBrief) throw new Error("Run Pi Draft before publishing the developer brief.");
  ensureHandoffPacket(intent);
  if (intent.publishedIssue) return { session, intent };

  const published = await publishDsddBrief({
    title: issueTitle(intent),
    body: issueBody(intent),
  });
  intent.publishedIssue = {
    repository: "BryanHarrisScripts/PlotPickle",
    number: published.number,
    title: published.title,
    url: published.url,
    publishedAt: new Date().toISOString(),
  };
  await save(context, session);
  await runDsddPiAction({
    action: "record-publication",
    cwd: process.cwd(),
    sessionDir: piSessionDir(context.profileId),
    sessionId: session.piSessionId || session.sessionId,
    sessionFile: session.piSessionFile || undefined,
    intentVersion: intent.version,
    publication: intent.publishedIssue,
  }).catch(() => {});
  return { session, intent };
}

async function recordEvidence(body: Record<string, unknown>) {
  const { context, session } = await load();
  const version = Number(body.intentVersion);
  const intent = session.intents.find((candidate) => candidate.version === version);
  if (!intent) throw new Error("The referenced locked DSDD intent version does not exist.");
  const packet = ensureHandoffPacket(intent);
  const updates = Array.isArray(body.requirements) ? body.requirements : [];
  for (const update of updates) {
    if (!update || typeof update !== "object") continue;
    const item = update as Record<string, unknown>;
    const requirement = intent.requirements.find((candidate) => candidate.id === text(item.id, 40));
    const status = item.status;
    if (!requirement || (status !== "PASS" && status !== "FAIL" && status !== "UNPROVEN")) continue;
    const evaluated = evaluateEvidenceUpdate({
      intentVersion: intent.version,
      intentDigest: packet.intentDigest,
      status,
      evidence: item.evidence,
    });
    requirement.status = evaluated.status as DsddRequirement["status"];
    requirement.evidence = evaluated.evidence as DsddEvidence[];
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
  if (action === "draft-brief") {
    replyDsdd(response, { status: 200, body: { ok: true, ...(await draftDeveloperBrief()) } });
    return;
  }
  if (action === "publish-brief") {
    replyDsdd(response, { status: 201, body: { ok: true, ...(await publishBriefIssue()) } });
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
