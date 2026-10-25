import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { gatewayAppSource, privateGatewayRoot } from "../scripts/engineering-team/gateway/gateway-host.mjs";
import { gatewayDigest, persistGatewayAnswer } from "../scripts/engineering-team/gateway/gateway-contract.mjs";
import { conversationMcpAction, conversationStatus,
  startConversationTest } from "../scripts/engineering-team/gateway/conversation-service.mjs";
import { dispatchOutboundObserveOnce,
  runOwnerOutboundObserveOnce } from "../scripts/engineering-team/gateway/outbound-openai-once.mjs";

const run = promisify(execFile);
const source = { head: "a".repeat(40), channel: "main" };
const Q = "b".repeat(32), GRANT = "c".repeat(32);
const TOKEN = "sk-test-placeholder-not-a-real-secret-000000";
const reply = "The build checks compilation, while an observed external answer and durable correlation receipt establish a real conversation.";
const fakeResponse = () => new Response(JSON.stringify({
  status: "completed", output: [
    { type: "message", status: "completed",
      content: [{ type: "output_text", text: reply }] },
  ],
}), { status: 200 });
const grant = (head = source.head, questionDigest = null) => ({
  schemaVersion: 1, kind: "outbound-observe-once", grantId: GRANT,
  questionId: Q, sourceHead: head, questionDigest, model: "gpt-5-mini",
  expiresAt: Date.now() + 300_000, maxOutputTokens: 128, maxRequests: 1,
  consent: "AUTHORIZE_ONE_OUTBOUND_AI_OBSERVE_REQUEST",
});
const context = (operation, at, head = source.head) => ({
  verified: true, principalId: "chatgpt-connection", level: "OBSERVE",
  sourceHead: head, sourceChannel: "main",
  expiresAt: at + 60_000, permittedOperations: [operation],
});
async function sandbox(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), "pp-outbound-3259-"));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
async function pending(root, s = source) {
  const now = Date.now();
  await startConversationTest({ root, source: s, requestId: Q, now });
  const result = await conversationMcpAction({
    action: "read", expectedHead: s.head, questionId: Q,
  }, { root, source: s, now: now + 1 });
  assert.equal(result.question.kind, "question");
  return result.question;
}
const writer = (root, s = source) => (envelope, now) => persistGatewayAnswer({
  root, envelope, now, authorization: context("answer.record", now, s.head),
});

test("#3259 outbound OBSERVE transport records one real gateway answer without source/merge authority", () => sandbox(async root => {
  const journal = path.join(root, "main", source.head);
  const question = await pending(root);
  let requests = 0;
  const result = await dispatchOutboundObserveOnce({
    root, source, question, grant: grant(source.head, gatewayDigest(question.payload)), credential: TOKEN,
    persistAnswer: writer(journal), fetchImpl: async (url, options) => {
      requests++;
      assert.equal(url, "https://api.openai.com/v1/responses");
      assert.equal(options.method, "POST");
      assert.equal(options.headers.Authorization, "Bearer " + TOKEN);
      const body = JSON.parse(options.body);
      assert.equal(body.store, false);
      assert.equal(body.max_output_tokens, 128);
      assert.equal(body.model, "gpt-5-mini");
      assert.equal(body.input[1].content, question.payload.text);
      assert.equal(Object.hasOwn(body, "tools"), false);
      return fakeResponse();
    },
  });
  assert.equal(result.state, "MODEL_REPLY_PERSISTED");
  assert.equal(result.autonomousCodingVerified, false);
  assert.equal(result.sourceMutationAuthorized, false);
  assert.equal(result.independentVerification, false);
  assert.equal(result.modelInvokedVerified, false);
  assert.equal(result.providerResponseValidated, true);
  assert.equal(requests, 1);
  const observed = await conversationStatus({ root, source });
  assert.equal(observed.code, "ANSWERED");
  assert.equal(observed.answer, reply);
  const completed = JSON.parse(await readFile(path.join(root, "outbound", GRANT + ".completed.json"), "utf8"));
  assert.equal(completed.state, "MODEL_REPLY_PERSISTED");
  assert.equal(completed.sourceHead, source.head);
  assert.equal(JSON.stringify(completed).includes(TOKEN), false);
  const replay = await dispatchOutboundObserveOnce({
    root, source, question, grant: grant(source.head, gatewayDigest(question.payload)), credential: TOKEN,
    persistAnswer: writer(journal), fetchImpl: async () => { requests++; return fakeResponse(); },
  });
  assert.equal(replay.code, "ALREADY_RESERVED_NO_REPLAY");
  assert.equal(requests, 1);
}));

test("#3259 missing consent, wrong SHA, invalid scope and credentials refuse before model/network/reservation", () => sandbox(async root => {
  const journal = path.join(root, "main", source.head);
  const question = await pending(root);
  let requests = 0;
  const invoke = patch => dispatchOutboundObserveOnce({
    root, source, question, grant: grant(source.head, gatewayDigest(question.payload)), credential: TOKEN,
    persistAnswer: writer(journal),
    fetchImpl: async () => { requests++; return fakeResponse(); }, ...patch,
  });
  assert.equal((await invoke({ grant: { ...grant(source.head, gatewayDigest(question.payload)), consent: "NOT_CONSENT" } })).code, "OUTBOUND_OWNER_GRANT_REQUIRED");
  assert.equal((await invoke({ grant: grant("f".repeat(40), gatewayDigest(question.payload)) })).code, "OUTBOUND_OWNER_GRANT_REQUIRED");
  assert.equal((await invoke({ credential: "" })).code, "OUTBOUND_CREDENTIAL_OR_WRITER_UNAVAILABLE");
  assert.equal((await invoke({ source: { ...source, channel: "candidate" } })).code, "OUTBOUND_QUESTION_UNVERIFIED");
  assert.equal((await invoke({ question: { ...question, taskId: "write-source" } })).code, "OUTBOUND_QUESTION_UNVERIFIED");
  assert.equal((await invoke({ grant: { ...grant(source.head, gatewayDigest(question.payload)), maxRequests: 5 } })).code, "OUTBOUND_OWNER_GRANT_REQUIRED");
  assert.equal(requests, 0);
  assert.deepEqual(await readdir(root), ["main"]);
}));

test("#3259 uncertain network or malformed provider output is write-once, never retried or falsely green", () => sandbox(async root => {
  const journal = path.join(root, "main", source.head);
  const question = await pending(root);
  let requests = 0;
  const invoke = fetchImpl => dispatchOutboundObserveOnce({
    root, source, question, grant: grant(source.head, gatewayDigest(question.payload)), credential: TOKEN,
    persistAnswer: writer(journal), fetchImpl,
  });
  const first = await invoke(async () => { requests++; throw Error("sensitive provider failure"); });
  assert.equal(first.state, "STARTED_UNCONFIRMED");
  assert.equal(first.code, "OUTBOUND_REQUEST_OUTCOME_UNKNOWN");
  const retry = await invoke(async () => { requests++; return fakeResponse(); });
  assert.equal(retry.code, "ALREADY_RESERVED_NO_REPLAY");
  assert.equal(requests, 1);
  assert.equal((await conversationStatus({ root, source })).code, "PENDING");
  const receipt = await readFile(path.join(root, "outbound", GRANT + ".json"), "utf8");
  assert.equal(receipt.includes(TOKEN), false);
  assert.equal(receipt.includes("sensitive provider failure"), false);
}));

test("#3259 malformed model reply is uncertain, never a fabricated completed answer", () => sandbox(async root => {
  const journal = path.join(root, "main", source.head);
  const question = await pending(root);
  const result = await dispatchOutboundObserveOnce({
    root, source, question, grant: grant(source.head, gatewayDigest(question.payload)), credential: TOKEN,
    persistAnswer: writer(journal),
    fetchImpl: async () => new Response(JSON.stringify({
      status: "completed", output: [{ type: "message", status: "completed",
        content: [{ type: "output_text", text: "sk-secretvalue01234567890123456789" }] }],
    }), { status: 200 }),
  });
  assert.equal(result.state, "STARTED_UNCONFIRMED");
  assert.equal(result.code, "OUTBOUND_REPLY_UNVERIFIABLE");
  assert.equal((await conversationStatus({ root, source })).code, "PENDING");
}));

test("#3259 local host adapter requires a private one-shot grant and real clean MAIN Git identity", () => sandbox(async root => {
  const repo = path.join(root, "repo");
  await mkdir(repo);
  const git = args => run("git", args, { cwd: repo });
  await git(["init", "-b", "main"]);
  await git(["config", "user.name", "Fixture"]);
  await git(["config", "user.email", "fixture@example.invalid"]);
  await git(["remote", "add", "origin", "https://github.com/BryanHarrisScripts/PlotPickle.git"]);
  await writeFile(path.join(repo, "source.txt"), "source\n");
  await git(["add", "source.txt"]);
  await git(["commit", "-m", "Fixture source"]);
  const s = await gatewayAppSource({ repoRoot: repo, env: {} });
  assert.equal(s.channel, "main");
  const env = { LOCALAPPDATA: path.join(root, "appdata"), OPENAI_API_KEY: TOKEN };
  const privateRoot = privateGatewayRoot(env);
  const journal = path.join(privateRoot, "main", s.head);
  await startConversationTest({ root: privateRoot, source: s, requestId: Q });
  let requests = 0;
  const invoke = () => runOwnerOutboundObserveOnce({
    questionId: Q, env, platform: "win32", repoRoot: repo,
    fetchImpl: async () => { requests++; return fakeResponse(); },
  });
  assert.equal((await invoke()).code, "OUTBOUND_OWNER_GRANT_REQUIRED");
  assert.equal(requests, 0);
  await writeFile(path.join(repo, "source.txt"), "dirty\n");
  assert.equal((await invoke()).code, "OUTBOUND_EXACT_CLEAN_MAIN_REQUIRED");
  await writeFile(path.join(repo, "source.txt"), "source\n");
  const pendingQuestion = await conversationStatus({ root: privateRoot, source: s });
  assert.equal(pendingQuestion.code, "PENDING");
  await writeFile(path.join(privateRoot, "owner-outbound-grant.json"),
    JSON.stringify(grant(s.head, gatewayDigest({ text: pendingQuestion.question }))) + "\n");
  const completed = await invoke();
  assert.equal(completed.state, "MODEL_REPLY_PERSISTED");
  assert.equal(requests, 1);
  assert.equal((await conversationStatus({ root: privateRoot, source: s })).code, "ANSWERED");
  assert.equal((await invoke()).code, "OUTBOUND_PENDING_QUESTION_REQUIRED");
  assert.equal(requests, 1);
  assert.equal((await readFile(path.join(journal, "answers", Q + ".json"), "utf8")).includes(TOKEN), false);
}));

test("#3259 incomplete, tool-bearing and oversized provider replies remain uncertain", async () => {
  const message = { type: "message", status: "completed",
    content: [{ type: "output_text", text: reply }] };
  const cases = [
    { status: "incomplete", output: [message] },
    { status: "completed", incomplete_details: { reason: "max_output_tokens" }, output: [message] },
    { status: "completed", output: [message, { type: "function_call", name: "unsafe" }] },
    { status: "completed", output: [{ ...message, status: "in_progress" }] },
    { status: "completed", output: [{ ...message, content: [
      { type: "output_text", text: reply }, { type: "refusal", refusal: "blocked" },
    ] }] },
    { status: "completed", output: [message], padding: "x".repeat(70_000) },
  ];
  for (const response of cases) {
    await sandbox(async root => {
      const question = await pending(root);
      let calls = 0;
      const result = await dispatchOutboundObserveOnce({
        root, source, question, grant: grant(source.head, gatewayDigest(question.payload)),
        credential: TOKEN, persistAnswer: writer(path.join(root, "main", source.head)),
        fetchImpl: async () => {
          calls++;
          return new Response(JSON.stringify(response), { status: 200 });
        },
      });
      assert.equal(result.state, "STARTED_UNCONFIRMED");
      assert.equal(result.code, "OUTBOUND_RESPONSE_UNVERIFIABLE");
      assert.equal(calls, 1);
      assert.equal((await conversationStatus({ root, source })).code, "PENDING");
      assert.equal((await readdir(path.join(root, "outbound"))).length, 1);
    });
  }
});
