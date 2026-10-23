import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  GATEWAY_KINDS, GATEWAY_LEVELS, GATEWAY_PROTOCOL,
  gatewayDigest, validateGatewayEnvelope,
  persistGatewayQuestion, persistGatewayAnswer, readGatewayReceipt,
} from "../scripts/engineering-team/gateway/gateway-contract.mjs";

const Q = "a".repeat(32), A = "b".repeat(32), C = "c".repeat(32);
const MAIN = "1".repeat(40), OTHER = "2".repeat(40);
const withRoot = async fn => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pp-gateway-3259-"));
  try { return await fn(root); } finally { await rm(root, {recursive: true, force: true}); }
};
function message(kind = "question", patch = {}, start = Date.now()) {
  const question = kind === "question";
  const payload = {text: question ? "What must be verified next?" : "Run the independent product proof."};
  const result = {
    protocolVersion: GATEWAY_PROTOCOL,
    messageId: question ? Q : A,
    correlationId: question ? null : Q,
    causationId: question ? null : Q,
    conversationId: C,
    createdAt: start + (question ? 0 : 1),
    expiresAt: start + 20_000,
    sender: {role: question ? "plotpickle" : "ai-worker", id: question ? "desktop1" : "worker1"},
    recipient: {role: question ? "ai-worker" : "plotpickle", id: question ? "worker1" : "desktop1"},
    projectId: null, taskId: "task-3259", kind,
    schemaId: "gateway." + kind + ".v1",
    payload, capabilityScope: "OBSERVE",
    expectedSourceHead: MAIN, sourceChannel: "main",
    idempotencyKey: question ? Q : A,
    evidenceRefs: ["test:3259"],
    integrity: {algorithm:"sha256", payloadDigest: gatewayDigest(payload)},
  };
  return {...result, ...patch};
}
function auth(id, op, now, patch = {}) {
  return {
    verified:true, principalId:id, level:"OBSERVE",
    sourceHead:MAIN, sourceChannel:"main", expiresAt:now + 60_000,
    permittedOperations:[op], ...patch,
  };
}

test("#3259 P1 supports a future typed vocabulary but executes only private question and answer records", () => {
  assert.equal(GATEWAY_KINDS.length, 10);
  assert.deepEqual(GATEWAY_LEVELS, ["OBSERVE", "ENGINEER", "ORCHESTRATE", "AUTONOMOUS_POLICY"]);
  const now = Date.now();
  assert.ok(validateGatewayEnvelope(message("question", {}, now), {now}));
  assert.ok(validateGatewayEnvelope(message("answer", {}, now), {now}));
  for (const kind of GATEWAY_KINDS.filter(x => !["question", "answer"].includes(x)))
    assert.equal(validateGatewayEnvelope(message(kind, {}, now), {now}), null);
  assert.equal(validateGatewayEnvelope(message("question", {shell:"rm -rf /"}, now), null);
  assert.equal(validateGatewayEnvelope(message("question",
    {protocolVersion:"2.0"}, now), {now}), null);
  assert.equal(validateGatewayEnvelope(message("question",
    {expectedSourceHead:"main"}, now), {now}), null);
  assert.equal(validateGatewayEnvelope(message("question",
    {conversationId:"chatgpt-live-conversation"}, now), {now}), null);
  assert.equal(validateGatewayEnvelope(message("question",
    {correlationId:A}, now), {now}), null);
  assert.equal(validateGatewayEnvelope(message("question",
    {idempotencyKey:BROKEN()}, now), {now}), null);
});
function BROKEN() { return "0".repeat(32); }

test("#3259 P1 rejects credential-like content, tampered payloads, excessive inputs and expiry", () => {
  const now = Date.now(), good = message("question", {}, now);
  const mutated = {...good, payload:{text:"Altered after signing"}};
  assert.equal(validateGatewayEnvelope(mutated, {now}), null);
  for (const text of ["Bearer top-secret", "ghp_AAAAAAAAAAAAAAAAAAAAAAAAA",
    "sk-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "x".repeat(2049)]) {
    const payload = {text};
    const envelope = message("question", {payload,
      integrity:{algorithm:"sha256",payloadDigest:gatewayDigest(payload)}}, now);
    assert.equal(validateGatewayEnvelope(envelope, {now}), null);
  }
  assert.equal(validateGatewayEnvelope(message("question",
    {evidenceRefs:["../owner-private"]}, now), {now}), null);
  assert.equal(validateGatewayEnvelope(message("question",
    {expiresAt:now - 1}, now), {now}), null);
  assert.equal(validateGatewayEnvelope(message("question",
    {createdAt:now + 90_000_000, expiresAt:now + 90_001_000}, now), {now}), null);
});

test("#3259 P1 durable question is write-once, idempotent, source-bound and produces a text-free receipt", () => withRoot(async root => {
  const now = Date.now(), q = message("question", {}, now);
  const context = auth("desktop1", "question.create", now);
  assert.equal((await persistGatewayQuestion({root,envelope:q,now,authorization:null})).state, "DENIED");
  assert.equal((await persistGatewayQuestion({root,envelope:q,now,authorization:
    auth("desktop1","question.create",now,{sourceHead:OTHER})})).state, "DENIED");
  assert.equal((await persistGatewayQuestion({root,envelope:q,now,authorization:
    auth("evil","question.create",now)})).state, "DENIED");
  assert.equal((await persistGatewayQuestion({root,envelope:q,now,authorization:
    auth("desktop1","receipt.read",now)})).state, "DENIED");
  const created = await persistGatewayQuestion({root,envelope:q,now,authorization:context});
  assert.equal(created.state, "CREATED");
  assert.equal(created.receipt.state, "PENDING");
  assert.equal(created.receipt.expectedSourceHead, MAIN);
  assert.equal(created.receipt.payloadExposed, false);
  assert.doesNotMatch(JSON.stringify(created), /What must be verified/);
  const fromDisk = JSON.parse(await readFile(path.join(root,"questions",Q + ".json"),"utf8"));
  assert.equal(fromDisk.envelope.payload.text, q.payload.text);
  const retry = await persistGatewayQuestion({root,envelope:{
    ...q, sender:{id:"desktop1",role:"plotpickle"},
  },now,authorization:context});
  assert.equal(retry.state, "REPLAY");
  const changedPayload = {text:"Surprise different instruction"};
  const collision = await persistGatewayQuestion({root,envelope:{
    ...q,payload:changedPayload,integrity:{algorithm:"sha256",
      payloadDigest:gatewayDigest(changedPayload)},
  },now,authorization:context});
  assert.equal(collision.state,"CONFLICT_OR_UNVERIFIABLE");
  assert.equal((await readGatewayReceipt({root,questionId:Q,
    authorization:auth("reader1","receipt.read",now),now})).state,"PENDING");
}));

test("#3259 P1 answer correlates exactly once and remains readable after fresh store invocation", () => withRoot(async root => {
  const now = Date.now(), q = message("question",{},now), a = message("answer",{},now);
  const questionAuth = auth("desktop1","question.create",now);
  const answerAuth = auth("worker1","answer.record",now);
  assert.equal((await persistGatewayAnswer({root,envelope:a,authorization:answerAuth,now:now+2})).state,
    "QUESTION_UNVERIFIABLE");
  assert.equal((await persistGatewayQuestion({root,envelope:q,authorization:questionAuth,now})).state,
    "CREATED");
  assert.equal((await persistGatewayAnswer({root,envelope:{
    ...a, expectedSourceHead:OTHER,
  },authorization:auth("worker1","answer.record",now,{sourceHead:OTHER}),
    now:now+2})).state,"CORRELATION_DENIED");
  assert.equal((await persistGatewayAnswer({root,envelope:{
    ...a,conversationId:"d".repeat(32),
  },authorization:answerAuth,now:now+2})).state,"CORRELATION_DENIED");
  const answer = await persistGatewayAnswer({root,envelope:a,authorization:answerAuth,now:now+2});
  assert.equal(answer.state,"CREATED");
  assert.equal(answer.receipt.answerId,A);
  assert.equal(answer.receipt.modelInvoked,false);
  assert.equal((await persistGatewayAnswer({root,envelope:a,authorization:answerAuth,now:now+2})).state,
    "REPLAY");
  const competing = message("answer",{messageId:"d".repeat(32),
    idempotencyKey:"d".repeat(32)},now);
  assert.equal((await persistGatewayAnswer({root,envelope:competing,
    authorization:answerAuth,now:now+2})).state,"CONFLICT_OR_UNVERIFIABLE");
  const reopened = await readGatewayReceipt({root,questionId:Q,now:now+3,
    authorization:auth("reader1","receipt.read",now)});
  assert.equal(reopened.state,"ANSWERED");
  assert.equal(reopened.receipt.answerId,A);
  assert.doesNotMatch(JSON.stringify(reopened), /Run the independent product proof/);
  assert.equal(reopened.receipt.independentVerification,false);
}));

test("#3259 P1 expiration and unreadable records do not turn into success or silently retry", () => withRoot(async root => {
  const now=Date.now(), q=message("question",{},now);
  await persistGatewayQuestion({root,envelope:q,now,
    authorization:auth("desktop1","question.create",now)});
  const readAuth=auth("reader1","receipt.read",now);
  const expired=await readGatewayReceipt({root,questionId:Q,
    authorization:readAuth,now:now+21_000});
  assert.equal(expired.state,"EXPIRED_UNANSWERED");
  assert.equal(expired.receipt.answerId,null);
  const late=await persistGatewayAnswer({root,envelope:message("answer",{},now),
    authorization:auth("worker1","answer.record",now),now:now+21_000});
  assert.equal(late.state,"CORRELATION_DENIED");
  const answers=path.join(root,"answers");
  await symlink(path.join(root,"questions",Q+".json"),path.join(answers,Q+".json"));
  const corrupt=await readGatewayReceipt({root,questionId:Q,
    authorization:readAuth,now:now+100});
  assert.equal(corrupt.state,"UNVERIFIABLE");
  assert.equal(await readFile(path.join(root,"questions",Q+".json"),"utf8") !== "",true);
}));

test("#3259 P1 invalid private storage and forged/read-only caller cannot mutate", () => withRoot(async root => {
  const now=Date.now(), q=message("question",{},now), outside=path.join(root,"outside");
  await writeFile(outside,"DO NOT OVERWRITE");
  await symlink(root,path.join(root,"symlink"));
  assert.equal((await persistGatewayQuestion({root:path.join(root,"symlink"),
    envelope:q,now,authorization:auth("desktop1","question.create",now)})).state,
    "STORAGE_UNVERIFIABLE");
  assert.equal((await persistGatewayQuestion({root:"../relative",
    envelope:q,now,authorization:auth("desktop1","question.create",now)})).state,
    "STORAGE_UNVERIFIABLE");
  assert.equal(await readFile(outside,"utf8"),"DO NOT OVERWRITE");
  const badRead=await readGatewayReceipt({root,questionId:"../etc/passwd",
    authorization:auth("reader1","receipt.read",now),now});
  assert.equal(badRead.state,"INVALID_SELECTION");
}));
