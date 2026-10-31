/**
 * #3259 P1: transport-independent, non-promoting gateway contract and private
 * write-once question/answer journal. This module has NO HTTP route, model,
 * command, queue, approval, spending, or merge authority.
 *
 * Authentication is deliberately an injected HOST-VERIFIED context: this
 * module cannot create or verify a session. P2 must bind it to the existing
 * authenticated profile/MCP owner before exposing any remotely callable tool.
 */
import { createHash } from "node:crypto";
import { open, lstat, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

export const GATEWAY_PROTOCOL = "1.0";
export const GATEWAY_KINDS = Object.freeze([
  "question", "answer", "command.request", "command.result",
  "status.event", "evidence.append", "human.decision.request",
  "human.decision.result", "ack", "error",
]);
export const GATEWAY_LEVELS = Object.freeze([
  "OBSERVE", "ENGINEER", "ORCHESTRATE", "AUTONOMOUS_POLICY",
]);
const ID = /^[a-f0-9]{32}$/;
const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const ACTOR = /^[a-z][a-z0-9-]{0,47}$/;
const REFERENCE = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,95}$/;
const FIELDS = Object.freeze([
  "protocolVersion", "messageId", "correlationId", "causationId",
  "conversationId", "createdAt", "expiresAt", "sender", "recipient",
  "projectId", "taskId", "kind", "schemaId", "payload",
  "capabilityScope", "expectedSourceHead", "sourceChannel",
  "idempotencyKey", "evidenceRefs", "integrity",
]);
const SECRET = /(?:sk-[a-zA-Z0-9_-]{12,}|ghp_[a-zA-Z0-9]{12,}|bearer\s+\S+|-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----)/i;
const isRecord = v => v !== null && typeof v === "object" &&
  !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const exact = (v, keys) => isRecord(v) &&
  Object.keys(v).length === keys.length &&
  keys.every(k => Object.hasOwn(v, k));
const safeRef = v => v === null || (typeof v === "string" && REFERENCE.test(v));
const actor = v => exact(v, ["role", "id"]) &&
  ["plotpickle", "ai-worker", "human", "mcp-client"].includes(v.role) &&
  typeof v.id === "string" && ACTOR.test(v.id);
export const gatewayDigest = value =>
  createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");

function normalizeEnvelope(value, now, allowExpired = false) {
  if (!exact(value, FIELDS) || value.protocolVersion !== GATEWAY_PROTOCOL ||
      !GATEWAY_KINDS.includes(value.kind) ||
      !["question", "answer"].includes(value.kind) || // P1 only; no commands yet
      !ID.test(value.messageId) || !ID.test(value.idempotencyKey) ||
      !ID.test(value.conversationId) ||
      (value.correlationId !== null && !ID.test(value.correlationId)) ||
      (value.causationId !== null && !ID.test(value.causationId)) ||
      !actor(value.sender) || !actor(value.recipient) ||
      !safeRef(value.projectId) || !safeRef(value.taskId) ||
      !GATEWAY_LEVELS.includes(value.capabilityScope) ||
      !SHA.test(value.expectedSourceHead) ||
      !["main", "candidate"].includes(value.sourceChannel) ||
      value.schemaId !== "gateway." + value.kind + ".v1" ||
      !Number.isSafeInteger(value.createdAt) ||
      !Number.isSafeInteger(value.expiresAt) ||
      value.createdAt < 0 || value.expiresAt <= value.createdAt ||
      value.expiresAt - value.createdAt > 86_400_000 ||
      value.createdAt > now + 300_000 ||
      (!allowExpired && value.expiresAt <= now) ||
      !Array.isArray(value.evidenceRefs) || value.evidenceRefs.length > 8 ||
      !value.evidenceRefs.every(x => typeof x === "string" && REFERENCE.test(x)) ||
      !exact(value.payload, ["text"]) ||
      typeof value.payload.text !== "string" ||
      value.payload.text.trim().length === 0 ||
      value.payload.text.length > 2048 ||
      SECRET.test(value.payload.text) ||
      !exact(value.integrity, ["algorithm", "payloadDigest"]) ||
      value.integrity.algorithm !== "sha256" ||
      !DIGEST.test(value.integrity.payloadDigest) ||
      gatewayDigest(value.payload) !== value.integrity.payloadDigest)
    return null;
  if (value.kind === "question" &&
      (value.correlationId !== null || value.causationId !== null ||
       value.messageId !== value.idempotencyKey ||
       value.sender.role !== "plotpickle" ||
       value.recipient.role !== "ai-worker")) return null;
  if (value.kind === "answer" &&
      (!value.correlationId || value.causationId !== value.correlationId ||
       value.messageId !== value.idempotencyKey ||
       value.sender.role !== "ai-worker" ||
       value.recipient.role !== "plotpickle")) return null;
  // Stable field and nested key order makes legitimate retries independent
  // of JS object-property insertion order.
  const out = Object.fromEntries(FIELDS.map(k => [k, value[k]]));
  out.sender = { role: value.sender.role, id: value.sender.id };
  out.recipient = { role: value.recipient.role, id: value.recipient.id };
  out.payload = { text: value.payload.text };
  out.integrity = { algorithm: "sha256", payloadDigest: value.integrity.payloadDigest };
  out.evidenceRefs = [...value.evidenceRefs];
  if (Buffer.byteLength(JSON.stringify(out), "utf8") > 8192) return null;
  return Object.freeze(out);
}

export function validateGatewayEnvelope(envelope, options = {}) {
  return normalizeEnvelope(envelope, options.now ?? Date.now(),
    options.allowExpired === true);
}

/** Only a trusted host may supply this authorization object. Never accept it
 * from an MCP argument, browser request, message payload, or AI response. */
function authorized(ctx, envelope, operation, now) {
  return exact(ctx, [
    "verified", "principalId", "level", "sourceHead", "sourceChannel",
    "expiresAt", "permittedOperations",
  ]) && ctx.verified === true &&
    typeof ctx.principalId === "string" && ACTOR.test(ctx.principalId) &&
    GATEWAY_LEVELS.includes(ctx.level) &&
    SHA.test(ctx.sourceHead) &&
    ctx.sourceHead === envelope.expectedSourceHead &&
    ctx.sourceChannel === envelope.sourceChannel &&
    Number.isSafeInteger(ctx.expiresAt) && ctx.expiresAt > now &&
    Array.isArray(ctx.permittedOperations) &&
    ctx.permittedOperations.length <= 3 &&
    ctx.permittedOperations.includes(operation) &&
    (operation === "receipt.read" || ctx.principalId === envelope.sender.id) &&
    (operation === "receipt.read" ||
      GATEWAY_LEVELS.indexOf(ctx.level) >= GATEWAY_LEVELS.indexOf(envelope.capabilityScope));
}

async function safeDirectory(dir) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const info = await lstat(dir);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw Error("GATEWAY_PRIVATE_STORAGE_UNVERIFIED");
}
async function storeFolder(root, name) {
  if (typeof root !== "string" || !path.isAbsolute(root))
    throw Error("GATEWAY_PRIVATE_STORAGE_UNVERIFIED");
  await safeDirectory(root);
  const folder = path.join(root, name);
  await safeDirectory(folder);
  return folder;
}

// Read paths must not create private directories or follow junctions.
async function observedFolder(root, name) {
  if (typeof root !== "string" || !path.isAbsolute(root))
    throw Error("GATEWAY_PRIVATE_STORAGE_UNVERIFIED");
  const target = path.join(root, name);
  for (const dir of [root, target]) {
    let info;
    try { info = await lstat(dir); }
    catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
    if (!info.isDirectory() || info.isSymbolicLink())
      throw Error("GATEWAY_PRIVATE_STORAGE_UNVERIFIED");
  }
  return target;
}

async function privateRecord(filename) {
  try {
    const stat = await lstat(filename);
    if (!stat.isFile() || stat.isSymbolicLink() ||
        stat.size < 2 || stat.size > 8192)
      return { state: "UNVERIFIABLE" };
    const value = JSON.parse(await readFile(filename, "utf8"));
    if (!exact(value, ["schemaVersion", "envelope"]) || value.schemaVersion !== 1)
      return { state: "UNVERIFIABLE" };
    const envelope = normalizeEnvelope(value.envelope, Date.now(), true);
    return envelope ? { state: "FOUND", envelope } : { state: "UNVERIFIABLE" };
  } catch (error) {
    return { state: error?.code === "ENOENT" ? "MISSING" : "UNVERIFIABLE" };
  }
}

async function writeOnce(filename, envelope) {
  const serialized = JSON.stringify({ schemaVersion: 1, envelope }) + "\n";
  let file;
  try {
    file = await open(filename, "wx", 0o600);
    await file.writeFile(serialized, "utf8");
    await file.sync();
    return "CREATED";
  } catch (error) {
    if (error?.code !== "EEXIST") return "UNKNOWN_WRITE";
    const previous = await privateRecord(filename);
    return previous.state === "FOUND" &&
      gatewayDigest(previous.envelope) === gatewayDigest(envelope)
      ? "REPLAY" : "CONFLICT_OR_UNVERIFIABLE";
  } finally { await file?.close().catch(() => {}); }
}

function receipt(question, answer, state) {
  return Object.freeze({
    protocolVersion: GATEWAY_PROTOCOL,
    questionId: question.messageId,
    answerId: answer?.messageId ?? null,
    correlationId: answer?.correlationId ?? question.messageId,
    conversationId: question.conversationId,
    expectedSourceHead: question.expectedSourceHead,
    sourceChannel: question.sourceChannel,
    questionCreatedAt: question.createdAt,
    answerCreatedAt: answer?.createdAt ?? null,
    state, payloadExposed: false, modelInvoked: false,
    independentVerification: false,
  });
}

function matchesQuestion(question, answer) {
  return question.kind === "question" && answer.kind === "answer" &&
    answer.correlationId === question.messageId &&
    answer.causationId === question.messageId &&
    question.conversationId === answer.conversationId &&
    question.projectId === answer.projectId && question.taskId === answer.taskId &&
    question.expectedSourceHead === answer.expectedSourceHead &&
    question.sourceChannel === answer.sourceChannel &&
    question.recipient.id === answer.sender.id &&
    question.sender.id === answer.recipient.id &&
    answer.createdAt >= question.createdAt && answer.createdAt < question.expiresAt;
}

export async function persistGatewayQuestion({
  root, envelope, authorization, now = Date.now(),
} = {}) {
  const question = normalizeEnvelope(envelope, now);
  if (!question || question.kind !== "question")
    return { state: "INVALID_ENVELOPE" };
  if (!authorized(authorization, question, "question.create", now))
    return { state: "DENIED" };
  try {
    const folder = await storeFolder(root, "questions");
    const state = await writeOnce(path.join(folder, question.messageId + ".json"), question);
    return state === "CREATED" || state === "REPLAY"
      ? { state, receipt: receipt(question, null, "PENDING") }
      : { state };
  } catch { return { state: "STORAGE_UNVERIFIABLE" }; }
}

export async function persistGatewayAnswer({
  root, envelope, authorization, now = Date.now(),
} = {}) {
  const answer = normalizeEnvelope(envelope, now);
  if (!answer || answer.kind !== "answer")
    return { state: "INVALID_ENVELOPE" };
  if (!authorized(authorization, answer, "answer.record", now))
    return { state: "DENIED" };
  try {
    const questions = await storeFolder(root, "questions");
    const found = await privateRecord(path.join(questions, answer.correlationId + ".json"));
    if (found.state !== "FOUND") return { state: "QUESTION_UNVERIFIABLE" };
    const question = found.envelope;
    if (question.expiresAt <= now || !matchesQuestion(question, answer))
      return { state: "CORRELATION_DENIED" };
    const folder = await storeFolder(root, "answers");
    const state = await writeOnce(path.join(folder, question.messageId + ".json"), answer);
    return state === "CREATED" || state === "REPLAY"
      ? { state, receipt: receipt(question, answer, "ANSWERED") }
      : { state };
  } catch { return { state: "STORAGE_UNVERIFIABLE" }; }
}

/** Never returns private text, model responses, credentials, or raw paths. */
export async function readGatewayReceipt({
  root, questionId, authorization, now = Date.now(),
} = {}) {
  if (typeof questionId !== "string" || !ID.test(questionId))
    return { state: "INVALID_SELECTION" };
  try {
    const questions = await observedFolder(root, "questions");
    if (!questions) return { state: "NOT_FOUND" };
    const q = await privateRecord(path.join(questions, questionId + ".json"));
    if (q.state === "MISSING") return { state: "NOT_FOUND" };
    if (q.state !== "FOUND") return { state: "UNVERIFIABLE" };
    const question = q.envelope;
    if (question.kind !== "question" ||
        !authorized(authorization, question, "receipt.read", now))
      return { state: "DENIED" };
    const answers = await observedFolder(root, "answers");
    const a = answers
      ? await privateRecord(path.join(answers, questionId + ".json"))
      : { state: "MISSING" };
    if (a.state === "UNVERIFIABLE") return { state: "UNVERIFIABLE" };
    if (a.state === "MISSING")
      return { state: question.expiresAt <= now ? "EXPIRED_UNANSWERED" : "PENDING",
        receipt: receipt(question, null,
          question.expiresAt <= now ? "EXPIRED_UNANSWERED" : "PENDING") };
    const answer = a.envelope;
    if (!matchesQuestion(question, answer))
      return { state: "UNVERIFIABLE" };
    return { state: "ANSWERED", receipt: receipt(question, answer, "ANSWERED") };
  } catch { return { state: "STORAGE_UNVERIFIABLE" }; }
}

/** Explicit conversation delivery, not telemetry. Only the host-authorized
 * sender or addressed recipient may read text; receipt-only readers cannot. */
export async function readGatewayMessages({
  root, questionId, authorization, now = Date.now(),
} = {}) {
  const observed = await readGatewayReceipt({ root, questionId, authorization, now });
  if (!observed.receipt) return observed;
  try {
    const q = await privateRecord(path.join(root, "questions", questionId + ".json"));
    if (q.state !== "FOUND" ||
        ![q.envelope.sender.id, q.envelope.recipient.id].includes(authorization?.principalId))
      return { state: "DENIED" };
    const a = await privateRecord(path.join(root, "answers", questionId + ".json"));
    if (a.state === "UNVERIFIABLE" ||
        (a.state === "FOUND" && !matchesQuestion(q.envelope, a.envelope)))
      return { state: "UNVERIFIABLE" };
    return { ...observed, question: q.envelope,
      answer: a.state === "FOUND" ? a.envelope : null };
  } catch { return { state: "STORAGE_UNVERIFIABLE" }; }
}
