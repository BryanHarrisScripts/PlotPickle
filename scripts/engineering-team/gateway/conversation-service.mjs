import { randomBytes } from "node:crypto";
import { lstat, mkdir, open, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { gatewayDigest, persistGatewayQuestion, persistGatewayAnswer,
  readGatewayMessages } from "./gateway-contract.mjs";

const ID = /^[a-f0-9]{32}$/;
const TTL = 15 * 60_000;
const DESKTOP = "desktop", CLIENT = "chatgpt-connection";
const nonce = () => randomBytes(16).toString("hex");
const exact = (v, keys) => v && typeof v === "object" && !Array.isArray(v) &&
  Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const validSource = s => s && /^[a-f0-9]{40}$/.test(s.head || "") &&
  ["main", "candidate"].includes(s.channel);
const context = (source, principalId, operation, now) => ({
  verified: true, principalId, level: "OBSERVE", sourceHead: source.head,
  sourceChannel: source.channel, expiresAt: now + 60_000, permittedOperations: [operation],
});

async function folder(root, source) {
  if (!path.isAbsolute(root) || !validSource(source)) throw Error("GATEWAY_SOURCE_UNVERIFIED");
  const target = path.join(root, source.channel, source.head);
  for (const dir of [root, path.join(root, source.channel), target]) {
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const info = await lstat(dir);
    if (!info.isDirectory() || info.isSymbolicLink()) throw Error("GATEWAY_STORAGE_UNVERIFIABLE");
  }
  return target;
}
// Read-only observation must never create folders or follow a redirected
// gateway source path. Writers continue using the existing folder() routine.
async function existingFolder(root, source) {
  if (typeof root !== "string" || !path.isAbsolute(root) || !validSource(source))
    throw Error("GATEWAY_SOURCE_UNVERIFIED");
  const channel = path.join(root, source.channel);
  const target = path.join(channel, source.head);
  for (const dir of [root, channel, target]) {
    let info;
    try { info = await lstat(dir); }
    catch (error) { if (error?.code === "ENOENT") return null; throw error; }
    if (!info.isDirectory() || info.isSymbolicLink())
      throw Error("GATEWAY_STORAGE_UNVERIFIABLE");
  }
  return target;
}
async function marker(root, id, suffix, value) {
  const filename = path.join(root, id + suffix + ".json");
  if (value) {
    let handle;
    try {
      handle = await open(filename, "wx", 0o600);
      await handle.writeFile(JSON.stringify(value) + "\n", "utf8");
      await handle.sync();
    } catch (error) { if (error?.code !== "EEXIST") throw error; }
    finally { await handle?.close(); }
  }
  try {
    const info = await lstat(filename);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 512) throw Error("GATEWAY_RECEIPT_UNVERIFIABLE");
    const saved = JSON.parse(await readFile(filename, "utf8"));
    if (!exact(saved, ["questionId", "deliveryId", "at"]) || saved.questionId !== id ||
        !ID.test(saved.deliveryId) || !Number.isSafeInteger(saved.at) || saved.at < 0)
      throw Error("GATEWAY_RECEIPT_UNVERIFIABLE");
    return saved;
  } catch (error) { if (error?.code === "ENOENT") return null; throw error; }
}
const textFor = source => `PlotPickle is testing its connected ChatGPT conversation on ${source.channel === "main" ? "MAIN" : "PR TEST"} commit ${source.head}. Explain in one sentence why a green build alone cannot prove that this two-way conversation works. Answer the question; do not repeat or merely acknowledge it.`;
function envelope(kind, source, id, text, now, question) {
  const q = kind === "question", payload = { text };
  return { protocolVersion: "1.0", messageId: id, idempotencyKey: id,
    correlationId: q ? null : question.messageId, causationId: q ? null : question.messageId,
    conversationId: q ? id : question.conversationId, createdAt: now,
    expiresAt: q ? now + TTL : question.expiresAt,
    sender: { role: q ? "plotpickle" : "ai-worker", id: q ? DESKTOP : CLIENT },
    recipient: { role: q ? "ai-worker" : "plotpickle", id: q ? CLIENT : DESKTOP },
    projectId: null, taskId: "two-way-conversation-test", kind,
    schemaId: `gateway.${kind}.v1`, payload, capabilityScope: "OBSERVE",
    expectedSourceHead: source.head, sourceChannel: source.channel,
    evidenceRefs: [], integrity: { algorithm: "sha256", payloadDigest: gatewayDigest(payload) } };
}
async function exchange(root, source, questionId, principal, now) {
  return readGatewayMessages({ root, questionId, now,
    authorization: context(source, principal, "receipt.read", now) });
}
async function view(root, source, id, now) {
  const stored = await exchange(root, source, id, DESKTOP, now);
  if (!stored.receipt) return { code: stored.state };
  const delivery = await marker(root, id, ".delivery"), ack = await marker(root, id, ".ack");
  if (ack && (!delivery || ack.deliveryId !== delivery.deliveryId))
    return { code: "GATEWAY_RECEIPT_UNVERIFIABLE" };
  return { code: stored.state, questionId: id, sourceHead: source.head, sourceChannel: source.channel,
    question: stored.question.payload.text, answer: stored.answer?.payload.text ?? null,
    plotpickleToChatgpt: ack ? "VERIFIED" : "UNPROVEN",
    chatgptToPlotpickle: ack && stored.state === "ANSWERED" ? "VERIFIED" : "UNPROVEN",
    deliveryAcknowledgedAt: ack?.at ?? null, answerReceivedAt: stored.answer?.createdAt ?? null,
    receipt: stored.receipt, clientIdentity: "authenticated-mcp-client",
    independentVerification: false, backgroundDelivery: false };
}

/** Local authenticated profile only; never called as an MCP mutation. */
export async function startConversationTest({ root, source, requestId, now = Date.now() } = {}) {
  if (!ID.test(requestId || "") || !validSource(source)) return { code: "GATEWAY_SOURCE_UNVERIFIED" };
  try {
    const dir = await folder(root, source);
    const before = await exchange(dir, source, requestId, DESKTOP, now);
    if (before.state === "NOT_FOUND") {
      const result = await persistGatewayQuestion({ root: dir, now,
        envelope: envelope("question", source, requestId, textFor(source), now),
        authorization: context(source, DESKTOP, "question.create", now) });
      if (!["CREATED", "REPLAY"].includes(result.state)) return { code: result.state };
    } else if (!before.receipt) return { code: before.state };
    return await view(dir, source, requestId, now);
  } catch { return { code: "GATEWAY_STORAGE_UNVERIFIABLE" }; }
}

export async function conversationStatus({ root, source, now = Date.now() } = {}) {
  if (!validSource(source)) return { code: "GATEWAY_SOURCE_UNVERIFIED" };
  try {
    const dir = await existingFolder(root, source);
    if (!dir) return { code: "NO_TEST", sourceHead: source.head, sourceChannel: source.channel, count: 0 };
    const questions = path.join(dir, "questions");
    try {
      const info = await lstat(questions);
      if (!info.isDirectory() || info.isSymbolicLink())
        throw Error("GATEWAY_STORAGE_UNVERIFIABLE");
    } catch (error) {
      if (error?.code === "ENOENT")
        return { code: "NO_TEST", sourceHead: source.head, sourceChannel: source.channel, count: 0 };
      throw error;
    }
    let newest = null, count = 0;
    try {
      const entries = await readdir(questions);
      if (entries.length > 200) return { code: "GATEWAY_INVENTORY_LIMIT" };
      for (const name of entries) {
        if (!/^[a-f0-9]{32}\.json$/.test(name)) continue;
        const stored = await exchange(dir, source, name.slice(0, 32), DESKTOP, now);
        if (!stored.receipt) return { code: "GATEWAY_STORAGE_UNVERIFIABLE" };
        count++;
        if (!newest || stored.question.createdAt > newest.createdAt)
          newest = stored.question;
      }
    } catch (error) { if (error?.code !== "ENOENT") throw error; }
    return newest ? await view(dir, source, newest.messageId, now)
      : { code: "NO_TEST", sourceHead: source.head, sourceChannel: source.channel, count };
  } catch { return { code: "GATEWAY_STORAGE_UNVERIFIABLE" }; }
}

export function validConversationArgs(args) {
  if (!args || !/^[a-f0-9]{40}$/.test(args.expectedHead || "")) return false;
  if (args.action === "pending") return exact(args, ["action", "expectedHead"]);
  if (!ID.test(args.questionId || "")) return false;
  if (["read", "receipt"].includes(args.action))
    return exact(args, ["action", "expectedHead", "questionId"]);
  return args.action === "answer" && exact(args,
    ["action", "expectedHead", "questionId", "deliveryId", "answerId", "answer"]) &&
    ID.test(args.deliveryId) && ID.test(args.answerId) &&
    typeof args.answer === "string" && args.answer.trim().length >= 12 && args.answer.length <= 2048;
}

/** Called only after existing MCP transport authentication; source is resolved
 * by the host, never accepted from an answer or from user-controlled paths. */
export async function conversationMcpAction(args, { root, source, now = Date.now() } = {}) {
  if (!validConversationArgs(args)) return { code: "GATEWAY_ARGUMENTS_INVALID" };
  if (!validSource(source) || source.head !== args.expectedHead) return { code: "GATEWAY_SOURCE_UNVERIFIED" };
  try {
    if (args.action === "pending") return conversationStatus({ root, source, now });
    if (args.action === "receipt") {
      const readonlyDir = await existingFolder(root, source);
      return readonlyDir ? await view(readonlyDir, source, args.questionId, now)
        : { code: "NOT_FOUND" };
    }
    const dir = await folder(root, source);
    const stored = await exchange(dir, source, args.questionId, CLIENT, now);
    if (!stored.receipt) return { code: stored.state };
    if (stored.state === "EXPIRED_UNANSWERED") return { code: "GATEWAY_TEST_EXPIRED" };
    if (args.action === "read") {
      const delivery = await marker(dir, args.questionId, ".delivery",
        { questionId: args.questionId, deliveryId: nonce(), at: now });
      return { code: stored.state, question: stored.question,
        deliveryId: delivery.deliveryId, answer: stored.answer, independentVerification: false };
    }
    const delivery = await marker(dir, args.questionId, ".delivery");
    if (!delivery || delivery.deliveryId !== args.deliveryId) return { code: "GATEWAY_DELIVERY_UNVERIFIED" };
    if (args.answer.trim() === stored.question.payload.text.trim()) return { code: "GATEWAY_ECHO_REJECTED" };
    // Only acknowledge externally delivered work after its exact answer has
    // actually been persisted. Otherwise a denied/failed answer could leave
    // a misleading PlotPickle-to-ChatGPT VERIFIED marker.
    if (stored.answer?.messageId === args.answerId && stored.answer.payload.text === args.answer) {
      await marker(dir, args.questionId, ".ack", { questionId: args.questionId, deliveryId: args.deliveryId, at: now });
      return await view(dir, source, args.questionId, now);
    }
    const answer = envelope("answer", source, args.answerId, args.answer, now, stored.question);
    const recorded = await persistGatewayAnswer({ root: dir, envelope: answer, now,
      authorization: context(source, CLIENT, "answer.record", now) });
    if (!["CREATED", "REPLAY"].includes(recorded.state)) return { code: recorded.state };
    // A lost reply can be reconciled using the same answer ID; never forge
    // an ACK for an answer the journal rejected.
    await marker(dir, args.questionId, ".ack", { questionId: args.questionId, deliveryId: args.deliveryId, at: now });
    return await view(dir, source, args.questionId, now);
  } catch { return { code: "GATEWAY_STORAGE_UNVERIFIABLE" }; }
}
