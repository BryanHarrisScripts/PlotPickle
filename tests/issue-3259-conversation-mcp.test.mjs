import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { conversationMcpAction, conversationStatus, startConversationTest } from "../scripts/engineering-team/gateway/conversation-service.mjs";
import { dispatchConversationRequest } from "../scripts/engineering-team/gateway/conversation-http.mjs";
import { gatewayAppSource } from "../scripts/engineering-team/gateway/gateway-host.mjs";
import { gatewayDigest } from "../scripts/engineering-team/gateway/gateway-contract.mjs";
import { createLocalMcpHttpServer, handleRpc, MCP_CONVERSATION_TOOLS } from "../scripts/engineering-team/mcp/factory-readonly-server.mjs";

const run = promisify(execFile), source = { head: "a".repeat(40), channel: "main" };
const Q = "b".repeat(32), A = "c".repeat(32);
const answer = "A green build checks compilation, while conversation acceptance requires observed delivery and a persisted reply from the connected client.";
async function sandbox(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), "pp-conversation-3259-"));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
const selection = action => ({ action, expectedHead: source.head, questionId: Q });
const response = (deliveryId, patch = {}) => ({ ...selection("answer"), deliveryId, answerId: A, answer, ...patch });

test("#3259 local test remains unproven until authenticated read and correlated reply, then survives a fresh process", () => sandbox(async root => {
  const now = Date.now();
  const started = await startConversationTest({ root, source, requestId: Q, now });
  assert.equal(started.code, "PENDING");
  assert.equal(started.plotpickleToChatgpt, "UNPROVEN");
  assert.equal(started.chatgptToPlotpickle, "UNPROVEN");
  const read = await conversationMcpAction(selection("read"), { root, source, now: now + 1 });
  assert.equal(read.question.expectedSourceHead, source.head);
  assert.match(read.question.payload.text, /green build/);
  const awaiting = await conversationStatus({ root, source, now: now + 2 });
  assert.equal(awaiting.plotpickleToChatgpt, "UNPROVEN", "writing a delivery record alone does not prove remote receipt");
  const completed = await conversationMcpAction(response(read.deliveryId), { root, source, now: now + 3 });
  assert.equal(completed.code, "ANSWERED");
  assert.equal(completed.plotpickleToChatgpt, "VERIFIED");
  assert.equal(completed.chatgptToPlotpickle, "VERIFIED");
  assert.equal(completed.answer, answer);
  assert.equal(completed.independentVerification, false);
  assert.equal(completed.backgroundDelivery, false);
  const moduleUrl = pathToFileURL(path.resolve("scripts/engineering-team/gateway/conversation-service.mjs")).href;
  const script = `import {conversationStatus} from ${JSON.stringify(moduleUrl)}; process.stdout.write(JSON.stringify(await conversationStatus({root:process.argv[1],source:JSON.parse(process.argv[2])})));`;
  const fresh = JSON.parse((await run(process.execPath, ["--input-type=module", "-e", script, root, JSON.stringify(source)])).stdout);
  assert.equal(fresh.receipt.answerId, A);
  assert.equal(fresh.answer, answer);
  assert.equal(fresh.deliveryAcknowledgedAt, now + 3);
  assert.equal(fresh.sourceHead, source.head);
}));

test("#3259 missing delivery, echo, wrong source and arbitrary capabilities cannot become a successful conversation", () => sandbox(async root => {
  const now = Date.now();
  await startConversationTest({ root, source, requestId: Q, now });
  assert.equal((await conversationMcpAction(response("d".repeat(32)), { root, source, now })).code, "GATEWAY_DELIVERY_UNVERIFIED");
  const read = await conversationMcpAction(selection("read"), { root, source, now });
  assert.equal((await conversationMcpAction(response(read.deliveryId, { answer: read.question.payload.text }), { root, source, now })).code, "GATEWAY_ECHO_REJECTED");
  assert.equal((await conversationMcpAction(response(read.deliveryId), { root, source: { ...source, head: "f".repeat(40) }, now })).code, "GATEWAY_SOURCE_UNVERIFIED");
  assert.equal((await conversationMcpAction({ ...selection("read"), root: "/private", verified: true }, { root, source, now })).code, "GATEWAY_ARGUMENTS_INVALID");
  assert.equal((await conversationMcpAction({ ...selection("read"), questionId: "../private" }, { root, source, now })).code, "GATEWAY_ARGUMENTS_INVALID");
  const view = await conversationStatus({ root, source, now });
  assert.equal(view.plotpickleToChatgpt, "UNPROVEN");
  assert.equal(view.chatgptToPlotpickle, "UNPROVEN");
}));

test("#3259 replay and reconnect retain exactly one answer; collision cannot overwrite it", () => sandbox(async root => {
  const now = Date.now(), options = { root, source, now };
  await startConversationTest({ ...options, requestId: Q });
  await startConversationTest({ ...options, requestId: Q, now: now + 100 });
  const first = await conversationMcpAction(selection("read"), options);
  const reread = await conversationMcpAction(selection("read"), { ...options, now: now + 101 });
  assert.equal(reread.deliveryId, first.deliveryId);
  await conversationMcpAction(response(first.deliveryId), options);
  const filename = path.join(root, "main", source.head, "answers", Q + ".json");
  const before = await readFile(filename, "utf8");
  const retry = await conversationMcpAction(response(first.deliveryId), { ...options, now: now + 200 });
  assert.equal(retry.receipt.answerCreatedAt, now);
  const conflict = await conversationMcpAction(response(first.deliveryId, { answerId: "e".repeat(32), answer: "A competing response must never replace the first persisted answer." }), { ...options, now: now + 201 });
  assert.equal(conflict.code, "CONFLICT_OR_UNVERIFIABLE");
  assert.equal(await readFile(filename, "utf8"), before);
  const expiredRetry = await conversationMcpAction(response(first.deliveryId), { ...options, now: now + 16 * 60_000 });
  assert.equal(expiredRetry.code, "ANSWERED", "reconciliation of a completed operation does not execute it again after expiry");
}));

test("#3259 offline expiry, credential-shaped content and corrupt acknowledgements remain visibly unverified", () => sandbox(async root => {
  const now = Date.now();
  await startConversationTest({ root, source, requestId: Q, now });
  const read = await conversationMcpAction(selection("read"), { root, source, now });
  const invalid = await conversationMcpAction(response(read.deliveryId, { answer: "Bearer fixture-private-do-not-store" }), { root, source, now });
  assert.equal(invalid.code, "INVALID_ENVELOPE");
  // Rejected content must not leave an ACK implying remote delivery was
  // independently completed. The original delivery marker alone is unproven.
  await assert.rejects(readFile(path.join(root, "main", source.head, Q + ".ack.json"), "utf8"), { code: "ENOENT" });
  const pending = await conversationStatus({ root, source, now });
  assert.equal(pending.plotpickleToChatgpt, "UNPROVEN");
  assert.equal(pending.chatgptToPlotpickle, "UNPROVEN");
  assert.equal(pending.answer, null);
  const expired = await conversationStatus({ root, source, now: now + 16 * 60_000 });
  assert.equal(expired.code, "EXPIRED_UNANSWERED");
  assert.equal(expired.chatgptToPlotpickle, "UNPROVEN");
  assert.equal((await conversationMcpAction(response(read.deliveryId), { root, source, now: now + 16 * 60_000 })).code, "GATEWAY_TEST_EXPIRED");
  await writeFile(path.join(root, "main", source.head, Q + ".ack.json"), "partial");
  assert.equal((await conversationStatus({ root, source, now })).code, "GATEWAY_STORAGE_UNVERIFIABLE");
}));

test("#3259 corrupted stored answer cannot fabricate a verified source or return uncorrelated content", () => sandbox(async root => {
  const now = Date.now();
  await startConversationTest({ root, source, requestId: Q, now });
  const read = await conversationMcpAction(selection("read"), { root, source, now });
  await conversationMcpAction(response(read.deliveryId), { root, source, now });
  const filename = path.join(root, "main", source.head, "answers", Q + ".json");
  const saved = JSON.parse(await readFile(filename, "utf8"));
  saved.envelope.sourceChannel = "candidate";
  saved.envelope.payload = { text: "unrelated response" };
  saved.envelope.integrity.payloadDigest = gatewayDigest(saved.envelope.payload);
  await writeFile(filename, JSON.stringify(saved));
  const observed = await conversationStatus({ root, source, now });
  assert.equal(observed.code, "GATEWAY_STORAGE_UNVERIFIABLE");
  assert.equal(observed.answer, undefined);
}));

test("#3259 real HTTP MCP authentication hides conversation tools and refuses forged host capabilities", () => sandbox(async root => {
  const token = "T".repeat(64), now = Date.now();
  await startConversationTest({ root, source, requestId: Q, now });
  const server = createLocalMcpHttpServer({ root, gatewayRoot: root, controlToken: token,
    gatewaySource: async head => head === source.head ? source : null, now: () => now });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/mcp`;
  async function call(method, params, credential) {
    const headers = { "content-type": "application/json", accept: "application/json, text/event-stream" };
    if (credential) headers["x-plotpickle-factory-control-token"] = credential;
    return (await fetch(url, { method: "POST", headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json();
  }
  const invoke = (args, credential) => call("tools/call", { name: "factory_conversation", arguments: args }, credential);
  try {
    assert.equal((await call("tools/list", {})).result.tools.some(x => x.name === "factory_conversation"), false);
    assert.equal((await call("tools/list", {}, token)).result.tools.some(x => x.name === "factory_conversation"), true);
    for (const credential of [undefined, "wrong"])
      assert.equal((await invoke(selection("read"), credential)).error.code, -32001);
    assert.equal((await invoke({ ...selection("read"), verified: true }, token)).error.code, -32602);
    const read = (await invoke(selection("read"), token)).result.structuredContent;
    const done = (await invoke(response(read.deliveryId), token)).result.structuredContent;
    assert.equal(done.code, "ANSWERED");
    assert.equal(done.independentVerification, false, "local HTTP fixture does not certify real ChatGPT delivery");
    const receipt = (await invoke(selection("receipt"), token)).result.structuredContent;
    assert.deepEqual(receipt.receipt, done.receipt);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}));

test("#3259 GUI adapter requires local Human session, origin and bounded action before creating a question", () => sandbox(async root => {
  let called = 0;
  const options = { root, platform: "win32", source: async () => source,
    authorize: async (_request, mutation) => { called++; assert.equal(typeof mutation, "boolean"); } };
  const request = (body = { action: "test", requestId: Q }, origin = "http://127.0.0.1:4173") => new Request("http://127.0.0.1:4173/api/factory/conversation", {
    method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
  });
  assert.equal((await dispatchConversationRequest({ ...options, request: request(), authorize: async () => { throw Error("locked"); } })).status, 403);
  assert.equal((await dispatchConversationRequest({ ...options, request: request(undefined, "https://elsewhere.invalid") })).status, 403);
  assert.equal(called, 0);
  assert.equal((await dispatchConversationRequest({ ...options, request: request({ action: "test", requestId: Q, root: "/private" }) })).status, 400);
  assert.equal((await dispatchConversationRequest({ ...options, request: request({ action: "test", requestId: "x".repeat(200) }) })).status, 400);
  const started = await dispatchConversationRequest({ ...options, request: request() });
  assert.equal(started.status, 202);
  assert.equal((await started.json()).chatgptToPlotpickle, "UNPROVEN");
  const get = await dispatchConversationRequest({ ...options, request: new Request("http://127.0.0.1:4173/api/factory/conversation") });
  assert.equal((await get.json()).questionId, Q);
}));

test("#3259 source identity checks actual clean Git and pins PR TEST to its launcher head", () => sandbox(async root => {
  const git = args => run("git", args, { cwd: root });
  await git(["init", "-b", "main"]);
  await git(["config", "user.name", "Fixture"]);
  await git(["config", "user.email", "fixture@example.invalid"]);
  await git(["remote", "add", "origin", "https://github.com/BryanHarrisScripts/PlotPickle.git"]);
  await writeFile(path.join(root, "source.txt"), "source\n");
  await git(["add", "source.txt"]);
  await git(["commit", "-m", "Fixture source"]);
  const main = await gatewayAppSource({ repoRoot: root, env: {} });
  assert.equal(main.channel, "main");
  assert.match(main.head, /^[a-f0-9]{40}$/);
  await git(["checkout", "-b", "test-candidate"]);
  assert.equal(await gatewayAppSource({ repoRoot: root, env: {} }), null);
  const env = { PLOTPICKLE_LAUNCH_SOURCE_HEAD: main.head, PLOTPICKLE_LAUNCH_CHANNEL: "pr-test", PLOTPICKLE_LAUNCH_PR_NUMBER: "3273" };
  assert.deepEqual(await gatewayAppSource({ repoRoot: root, env }), { head: main.head, channel: "candidate" });
  assert.equal(await gatewayAppSource({ repoRoot: root, env: { ...env, PLOTPICKLE_LAUNCH_SOURCE_HEAD: "f".repeat(40) } }), null);
  await writeFile(path.join(root, "source.txt"), "dirty\n");
  assert.equal(await gatewayAppSource({ repoRoot: root, env }), null);
}));


test("#3259 split MCP tools provide truthful roles, owner-authenticated receipt observation and a correlated reply", () => sandbox(async root => {
  const now=Date.now();
  const unused=path.join(root,"empty");
  const blank=await conversationStatus({root:unused,source,now});
  assert.equal(blank.code,"NO_TEST");
  await assert.rejects(readFile(path.join(unused,"main",source.head,"questions",Q+".json")),{code:"ENOENT"});
  await startConversationTest({root,source,requestId:Q,now});
  assert.deepEqual(MCP_CONVERSATION_TOOLS.map(tool=>tool.name),[
    "factory_conversation","factory_conversation_observe",
    "factory_conversation_receive","factory_conversation_reply"
  ]);
  assert.deepEqual(MCP_CONVERSATION_TOOLS.map(tool=>tool.annotations.readOnlyHint),[
    false,true,false,false
  ]);
  const services={controlAuthenticated:true,gatewayRoot:root,
    gatewaySource:async head=>head===source.head?source:null,now:()=>now};
  const call=(name,args,authenticated=true)=>handleRpc({
    jsonrpc:"2.0",id:42,method:"tools/call",params:{name,arguments:args}
  },{...services,controlAuthenticated:authenticated});
  const pending={action:"pending",expectedHead:source.head};
  assert.equal((await call("factory_conversation_observe",pending,false)).error.code,-32001);
  const observed=(await call("factory_conversation_observe",pending)).result.structuredContent;
  assert.equal(observed.code,"PENDING");
  assert.equal(Object.hasOwn(observed,"question"),false,
    "receipt polling must not expose question text before acknowledged delivery");
  assert.equal(Object.hasOwn(observed,"answer"),false);
  assert.equal((await call("factory_conversation_observe",{
    ...pending,action:"read",questionId:Q
  })).error.code,-32602);
  assert.equal((await call("factory_conversation_receive",{
    expectedHead:source.head,questionId:Q,action:"read"
  })).error.code,-32602);
  const delivered=(await call("factory_conversation_receive",{
    expectedHead:source.head,questionId:Q
  })).result.structuredContent;
  assert.equal(delivered.question.expectedSourceHead,source.head);
  assert.match(delivered.deliveryId,/^[a-f0-9]{32}$/);
  assert.equal((await call("factory_conversation_observe",pending))
    .result.structuredContent.plotpickleToChatgpt,"UNPROVEN",
    "delivery marker alone is never a verified external delivery");
  const reply={expectedHead:source.head,questionId:Q,
    deliveryId:delivered.deliveryId,answerId:A,answer};
  assert.equal((await call("factory_conversation_reply",{...reply,shell:"cmd.exe"})).error.code,-32602);
  assert.equal((await call("factory_conversation_reply",{
    ...reply,expectedHead:"f".repeat(40)
  })).result.structuredContent.code,"GATEWAY_SOURCE_UNVERIFIED");
  assert.equal((await call("factory_conversation_reply",{
    ...reply,deliveryId:"d".repeat(32)
  })).result.structuredContent.code,"GATEWAY_DELIVERY_UNVERIFIED");
  const completed=(await call("factory_conversation_reply",reply)).result.structuredContent;
  assert.equal(completed.code,"ANSWERED");
  assert.equal(completed.plotpickleToChatgpt,"VERIFIED");
  assert.equal(completed.chatgptToPlotpickle,"VERIFIED");
  const saved=(await call("factory_conversation_observe",{
    action:"receipt",expectedHead:source.head,questionId:Q
  })).result.structuredContent;
  assert.equal(saved.receipt.answerId,A);
  assert.equal(Object.hasOwn(saved,"question"),false);
  assert.equal(Object.hasOwn(saved,"answer"),false);
  assert.equal(saved.independentVerification,false);
  assert.equal(saved.backgroundDelivery,false);
  const replay=(await call("factory_conversation_reply",reply)).result.structuredContent;
  assert.equal(replay.receipt.answerCreatedAt,now);
}));
