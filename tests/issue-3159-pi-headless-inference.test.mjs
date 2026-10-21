import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { ensureManagedPiInstalled } from "../scripts/pi-managed-install.mjs";
import {
  resolveManagedPiCliEntry,
  runManagedPiProcess,
} from "../Utilities/DeveloperWorkbench/pi-managed-node-launch.mjs";
import {
  configurePiLocalRuntime,
  piLocalEnvironment,
  piDeveloperEnvironment,
  piDeveloperRouteProjection,
  piDeveloperVirtualArgs,
} from "../scripts/pi-worker-runtime.mjs";
import { summarizeFactoryPiWriteEvents } from "../scripts/engineering-team/windows/autonomous-issue-coder.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED_CONTENT = "PLOTPICKLE_NATIVE_PI_WRITE_TOOL_VERIFIED\n";
const FILE_NAME = "fixture.txt";
const MODEL = "plotpickle-pi-ci-fixture";

function streamChunk(res, delta, finishReason = null) {
  const payload = {
    id: "chatcmpl-plotpickle-fixture",
    object: "chat.completion.chunk",
    created: 1,
    model: MODEL,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  };
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function sendReply(res, { toolCall = false, stream = true }) {
  const call = {
    id: "call_plotpickle_fixture",
    type: "function",
    function: {
      name: "write",
      arguments: JSON.stringify({ path: FILE_NAME, content: EXPECTED_CONTENT }),
    },
  };
  const message = toolCall
    ? { role: "assistant", content: null, tool_calls: [call] }
    : { role: "assistant", content: "Completed." };
  const finishReason = toolCall ? "tool_calls" : "stop";
  if (!stream) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      id: "chatcmpl-plotpickle-fixture",
      object: "chat.completion",
      created: 1,
      model: MODEL,
      choices: [{ index: 0, message, finish_reason: finishReason }],
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    }));
    return;
  }
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
  });
  if (toolCall) {
    streamChunk(res, {
      role: "assistant",
      tool_calls: [{
        index: 0,
        id: call.id,
        type: "function",
        function: call.function,
      }],
    });
  } else {
    streamChunk(res, { role: "assistant", content: message.content });
  }
  streamChunk(res, {}, finishReason);
  res.end("data: [DONE]\n\n");
}

async function startMockModel() {
  let scenario = "text-only";
  const requests = [];
  const server = createServer(async (req, res) => {
    if (req.method !== "POST" || !req.url?.includes("/chat/completions")) {
      res.writeHead(404).end();
      return;
    }
    try {
      let body = "";
      for await (const chunk of req) {
        body += String(chunk);
        if (body.length > 262144) throw new Error("Mock request too large");
      }
      const payload = JSON.parse(body);
      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      const advertisedTools = (payload.tools || []).map(tool => tool?.function?.name).filter(Boolean);
      requests.push({ scenario, advertisedTools, messageRoles: messages.map(m => m.role) });
      const hasToolResult = messages.some(m => m.role === "tool");
      sendReply(res, {
        toolCall: scenario === "real-write" && !hasToolResult,
        stream: payload.stream !== false,
      });
    } catch {
      res.writeHead(400).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}/v1`,
    requests,
    setScenario(value) { scenario = value; },
    async close() { await new Promise(resolve => server.close(resolve)); },
  };
}

test("real managed Pi must execute a mock-model write tool rather than merely claim a fix", {
  skip: process.env.PLOTPICKLE_PI_MOCK_E2E !== "1" && "requires explicit hosted Windows fixture opt-in",
  timeout: 360000,
}, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-pi-ci-"));
  const originalLocalAppData = process.env.LOCALAPPDATA;
  let model;
  try {
    const pi = await ensureManagedPiInstalled();
    assert.equal(pi.version, "1.3.0", "Use the repository-locked managed Pi version");
    const cli = await resolveManagedPiCliEntry(pi);
    model = await startMockModel();
    process.env.LOCALAPPDATA = root;
    const runtime = { kind: "fixture", label: "Loopback CI fixture", model: MODEL, baseUrl: model.baseUrl };
    const configured = await configurePiLocalRuntime(runtime, { purpose: "ci-factory-write" });
    const directEnv = piLocalEnvironment(configured.agentDir);
    const routedEnv = {
      ...piDeveloperEnvironment(configured.agentDir, piDeveloperRouteProjection(runtime, { localOnly: true })),
      PLOTPICKLE_PI_ALLOW_CLOUD: "0",
      PLOTPICKLE_PI_ROUTE: "local",
    };
    const commonArgs = [
      cli, "--mode", "json", "-p", "--no-session",
      "--tools", "read,grep,find,ls,write,edit",
      "--no-skills", "--no-prompt-templates", "--no-themes", "--no-context-files",
    ];
    const run = async (name, { routed = false, scenario = "real-write" } = {}) => {
      const cwd = path.join(root, name);
      await mkdir(cwd);
      model.setScenario(scenario);
      const args = routed
        ? [...commonArgs, ...piDeveloperVirtualArgs(REPO_ROOT),
          "Write fixture.txt using the write tool, then finish."]
        : [...commonArgs, "--no-extensions", "--provider", "plotpickle-local",
          "--model", MODEL, "Write fixture.txt using the write tool, then finish."];
      const result = await runManagedPiProcess(args, {
        cwd, timeout: 90000, maxBuffer: 4 * 1024 * 1024,
        env: routed ? routedEnv : directEnv,
      });
      const events = summarizeFactoryPiWriteEvents(result.stdout);
      const scopedRequests = model.requests.filter(item => item.scenario === scenario);
      assert.ok(scopedRequests.length >= 1, "The real Pi process must call the local mock provider");
      assert.ok(scopedRequests[0].advertisedTools.includes("write"),
        "The Pi request must advertise its real filesystem write tool");
      return { cwd, events, scopedRequests };
    };

    const textOnly = await run("text-only", { scenario: "text-only" });
    assert.equal(textOnly.events.valid, true);
    assert.equal(textOnly.events.settled, true);
    assert.equal(textOnly.events.writeStarted, 0,
      "A model's completion text cannot count as a file write");
    await assert.rejects(readFile(path.join(textOnly.cwd, FILE_NAME), "utf8"), { code: "ENOENT" });

    model.requests.length = 0;
    const direct = await run("managed-direct", { scenario: "real-write" });
    assert.equal(direct.events.valid, true);
    assert.equal(direct.events.settled, true);
    assert.equal(direct.events.writeSucceeded, 1,
      "Managed Workbench-style Pi must execute one write tool");
    assert.equal(await readFile(path.join(direct.cwd, FILE_NAME), "utf8"), EXPECTED_CONTENT);

    model.requests.length = 0;
    const routed = await run("factory-virtual-model", { routed: true, scenario: "real-write" });
    assert.equal(routed.events.valid, true);
    assert.equal(routed.events.settled, true);
    assert.equal(routed.events.writeSucceeded, 1,
      "Factory virtual-model Pi must execute the same write tool");
    assert.equal(await readFile(path.join(routed.cwd, FILE_NAME), "utf8"), EXPECTED_CONTENT);
    console.log("Pi mock-model write proof PASS: negative text-only control, direct managed Pi, virtual-model route.");
  } finally {
    if (model) await model.close();
    if (originalLocalAppData === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = originalLocalAppData;
    await rm(root, { recursive: true, force: true });
  }
});
