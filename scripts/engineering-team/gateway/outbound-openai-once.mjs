/**
 * #3259 P3: one-shot, locally owner-granted outbound OpenAI Responses transport
 * for the existing fixed OBSERVE conversation test. NOT an engineering
 * dispatcher, source editor, supervisor, job replay or autonomous merger.
 * No model call occurs merely by importing this module.
 */
import { randomBytes } from "node:crypto";
import { lstat, mkdir, open, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gatewayDigest, persistGatewayAnswer, readGatewayMessages,
  validateGatewayEnvelope } from "./gateway-contract.mjs";
import { gatewayAppSource, privateGatewayRoot } from "./gateway-host.mjs";

const ID = /^[a-f0-9]{32}$/;
const SHA = /^[a-f0-9]{40}$/;
const CONSENT = "AUTHORIZE_ONE_OUTBOUND_AI_OBSERVE_REQUEST";
const ENDPOINT = "https://api.openai.com/v1/responses";
const exact = (value, keys) => value !== null && typeof value === "object" &&
  !Array.isArray(value) && Object.keys(value).length === keys.length &&
  keys.every(key => Object.hasOwn(value, key));
const blocked = code => Object.freeze({ state: "BLOCKED", code,
  modelRequestAttempted: false, modelInvokedVerified: false,
  sourceMutationAuthorized: false, replayAuthorized: false });
const uncertain = code => Object.freeze({ state: "STARTED_UNCONFIRMED", code,
  modelRequestAttempted: true, modelInvokedVerified: false,
  sourceMutationAuthorized: false, replayAuthorized: false });

function validGrant(grant, source, question, now) {
  return exact(grant, ["schemaVersion", "kind", "grantId", "questionId",
    "sourceHead", "questionDigest", "model", "expiresAt", "maxOutputTokens", "maxRequests", "consent"]) &&
    grant.schemaVersion === 1 && grant.kind === "outbound-observe-once" &&
    grant.questionDigest === gatewayDigest(question.payload) &&
    ID.test(grant.grantId) && grant.questionId === question.messageId &&
    SHA.test(grant.sourceHead) && grant.sourceHead === source.head &&
    /^[a-z][a-z0-9.-]{1,47}$/.test(grant.model) &&
    Number.isSafeInteger(grant.expiresAt) && grant.expiresAt > now + 30_000 &&
    grant.expiresAt <= now + 3_600_000 &&
    Number.isInteger(grant.maxOutputTokens) &&
    grant.maxOutputTokens >= 64 && grant.maxOutputTokens <= 256 &&
    grant.maxRequests === 1 && grant.consent === CONSENT;
}
function validQuestion(question, source, now) {
  const q = validateGatewayEnvelope(question, { now });
  return !!q && q.kind === "question" && q.capabilityScope === "OBSERVE" &&
    q.expectedSourceHead === source.head && q.sourceChannel === "main" &&
    q.sender.role === "plotpickle" && q.sender.id === "desktop" &&
    q.recipient.role === "ai-worker" && q.recipient.id === "chatgpt-connection" &&
    q.taskId === "two-way-conversation-test" &&
    q.payload.text.startsWith("PlotPickle is testing its connected ChatGPT conversation") &&
    q.expiresAt > now + 30_000;
}
async function privateDirectory(dir) {
  if (!path.isAbsolute(dir)) throw Error("OUTBOUND_STORAGE_UNVERIFIABLE");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const info = await lstat(dir);
  if (!info.isDirectory() || info.isSymbolicLink()) throw Error("OUTBOUND_STORAGE_UNVERIFIABLE");
}
async function reserveOnce(root, grant, questionId, now) {
  await privateDirectory(root);
  const folder = path.join(root, "outbound");
  await privateDirectory(folder);
  const target = path.join(folder, grant.grantId + ".json");
  let file;
  try {
    file = await open(target, "wx", 0o600);
    await file.writeFile(JSON.stringify({ schemaVersion: 1, grantId: grant.grantId,
      questionId, sourceHead: grant.sourceHead, reservedAt: now,
      state: "EXTERNAL_REQUEST_OUTCOME_UNCERTAIN" }) + "\n", "utf8");
    await file.sync();
    return { state: "RESERVED", folder };
  } catch (error) {
    if (error?.code === "EEXIST") return { state: "ALREADY_RESERVED_NO_REPLAY" };
    return { state: "RESERVATION_UNVERIFIABLE" };
  } finally { await file?.close().catch(() => {}); }
}
async function completionOnce(folder, grant, questionId, answerId, now) {
  let file;
  try {
    file = await open(path.join(folder, grant.grantId + ".completed.json"), "wx", 0o600);
    await file.writeFile(JSON.stringify({ schemaVersion: 1, state: "MODEL_REPLY_PERSISTED",
      grantId: grant.grantId, questionId, answerId, sourceHead: grant.sourceHead,
      provider: "openai", model: grant.model, completedAt: now }) + "\n", "utf8");
    await file.sync();
    return true;
  } catch { return false; }
  finally { await file?.close().catch(() => {}); }
}
function outputText(response) {
  if (!response || !Array.isArray(response.output)) return null;
  const parts = response.output.flatMap(item => item?.type === "message" &&
    Array.isArray(item.content) ? item.content : [])
    .filter(part => part?.type === "output_text" && typeof part.text === "string")
    .map(part => part.text);
  if (parts.length !== 1) return null;
  const value = parts[0].trim();
  return value.length >= 12 && value.length <= 2048 ? value : null;
}

/**
 * Pure, injected transport boundary for deterministic tests. The ONLY native
 * caller below derives source from clean local Git, reads a private owner grant
 * and the existing gateway journal, and supplies its canonical answer writer.
 * A reservation is durable BEFORE the single paid request. No retry follows
 * an ambiguous response, timeout, crash or failed answer persistence.
 */
export async function dispatchOutboundObserveOnce({
  root, source, question, grant, credential, persistAnswer,
  fetchImpl = globalThis.fetch, now = Date.now,
} = {}) {
  const at = now();
  if (!source || source.channel !== "main" || !SHA.test(source.head || "") ||
      !validQuestion(question, source, at)) return blocked("OUTBOUND_QUESTION_UNVERIFIED");
  if (!validGrant(grant, source, question, at))
    return blocked("OUTBOUND_OWNER_GRANT_REQUIRED");
  if (typeof credential !== "string" || credential.length < 20 ||
      typeof persistAnswer !== "function" || typeof fetchImpl !== "function")
    return blocked("OUTBOUND_CREDENTIAL_OR_WRITER_UNAVAILABLE");
  let reserved;
  try { reserved = await reserveOnce(root, grant, question.messageId, at); }
  catch { return blocked("OUTBOUND_STORAGE_UNVERIFIABLE"); }
  if (reserved.state !== "RESERVED") return blocked(reserved.state);

  let answerText;
  try {
    const response = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { Authorization: "Bearer " + credential, "Content-Type": "application/json" },
      body: JSON.stringify({ model: grant.model, store: false,
        max_output_tokens: grant.maxOutputTokens,
        input: [
          { role: "developer", content: "Answer only the fixed, nonprivate PlotPickle test question in one sentence. No tools, code, commands or secrets." },
          { role: "user", content: question.payload.text },
        ] }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response?.ok) return uncertain("OUTBOUND_PROVIDER_REJECTED_UNCONFIRMED");
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 65_536)
      return uncertain("OUTBOUND_RESPONSE_UNVERIFIABLE");
    answerText = outputText(JSON.parse(raw));
    if (!answerText || answerText === question.payload.text)
      return uncertain("OUTBOUND_RESPONSE_UNVERIFIABLE");
  } catch { return uncertain("OUTBOUND_REQUEST_OUTCOME_UNKNOWN"); }

  const completedAt = now(), answerId = randomBytes(16).toString("hex");
  const payload = { text: answerText };
  const envelope = {
    protocolVersion: "1.0", messageId: answerId, idempotencyKey: answerId,
    correlationId: question.messageId, causationId: question.messageId,
    conversationId: question.conversationId, createdAt: completedAt,
    expiresAt: question.expiresAt, sender: question.recipient,
    recipient: question.sender, projectId: question.projectId, taskId: question.taskId,
    kind: "answer", schemaId: "gateway.answer.v1", payload,
    capabilityScope: "OBSERVE", expectedSourceHead: source.head,
    sourceChannel: "main", evidenceRefs: [],
    integrity: { algorithm: "sha256", payloadDigest: gatewayDigest(payload) },
  };
  if (!validateGatewayEnvelope(envelope, { now: completedAt }))
    return uncertain("OUTBOUND_REPLY_UNVERIFIABLE");
  try {
    const recorded = await persistAnswer(envelope, completedAt);
    if (!["CREATED", "REPLAY"].includes(recorded?.state))
      return uncertain("OUTBOUND_REPLY_NOT_PERSISTED");
  } catch { return uncertain("OUTBOUND_REPLY_NOT_PERSISTED"); }
  if (!await completionOnce(reserved.folder, grant, question.messageId, answerId, completedAt))
    return uncertain("OUTBOUND_COMPLETION_RECEIPT_UNVERIFIABLE");
  return Object.freeze({ state: "MODEL_REPLY_PERSISTED", code: "OUTBOUND_OBSERVE_ONLY",
    questionId: question.messageId, sourceHead: source.head,
    modelRequestAttempted: true, modelInvokedVerified: true,
    sourceMutationAuthorized: false, replayAuthorized: false,
    independentVerification: false, autonomousCodingVerified: false });
}
async function privateGrant(root) {
  const filename = path.join(root, "owner-outbound-grant.json");
  const info = await lstat(filename);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 2048)
    throw Error("OUTBOUND_GRANT_UNVERIFIABLE");
  return JSON.parse(await readFile(filename, "utf8"));
}

/** Local Windows CLI only. Never mounted as an MCP tool or scheduled by import. */
export async function runOwnerOutboundObserveOnce({
  questionId, env = process.env, platform = process.platform,
  repoRoot = process.cwd(), fetchImpl = globalThis.fetch, now = Date.now,
} = {}) {
  if (platform !== "win32" || !ID.test(questionId || ""))
    return blocked("OUTBOUND_LOCAL_WINDOWS_ONLY");
  const source = await gatewayAppSource({ repoRoot, env });
  if (!source || source.channel !== "main")
    return blocked("OUTBOUND_EXACT_CLEAN_MAIN_REQUIRED");
  const root = privateGatewayRoot(env);
  let grant;
  try { grant = await privateGrant(root); }
  catch { return blocked("OUTBOUND_OWNER_GRANT_REQUIRED"); }
  const context = (operation, at) => ({
    verified: true, principalId: "chatgpt-connection", level: "OBSERVE",
    sourceHead: source.head, sourceChannel: "main",
    expiresAt: at + 60_000, permittedOperations: [operation],
  });
  const at = now(), journal = path.join(root, "main", source.head);
  const found = await readGatewayMessages({ root: journal, questionId,
    authorization: context("receipt.read", at), now: at });
  if (found.state !== "PENDING" || !found.question || found.answer)
    return blocked("OUTBOUND_PENDING_QUESTION_REQUIRED");
  return dispatchOutboundObserveOnce({
    root, source, question: found.question, grant, credential: env.OPENAI_API_KEY,
    fetchImpl, now,
    persistAnswer: (envelope, recordedAt) => persistGatewayAnswer({
      root: journal, envelope, now: recordedAt,
      authorization: context("answer.record", recordedAt),
    }),
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const result = args.length === 2 && args[0] === "--once"
    ? await runOwnerOutboundObserveOnce({ questionId: args[1] })
    : blocked("OUTBOUND_EXACT_ARGUMENTS_REQUIRED");
  process.stdout.write(JSON.stringify(result) + "\n");
  if (result.state !== "MODEL_REPLY_PERSISTED") process.exitCode = 2;
}
