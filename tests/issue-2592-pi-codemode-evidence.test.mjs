import assert from "node:assert/strict";
import test from "node:test";
import { DeveloperToolClass, authorizeDeveloperTool } from "../lib/agents/developer-tool-authorization.mjs";
import {
  authorizeCodemodeNestedTool,
  deriveCodemodeLoadout,
  runCodemodeReadEvidenceBatch,
} from "../lib/agents/pi-codemode-governance.mjs";
import { normalizePiNestedCallEvidence } from "../lib/agents/pi-nested-call-evidence.mjs";
import { AGENT_RUNTIME_SAFE_TRACE_FIELDS } from "../lib/agents/agent-runtime-vocabulary.mjs";

const availableTools = [
  { name: "plotpickle_status", toolClass: DeveloperToolClass.READ, exposure: "direct" },
  { name: "plotpickle_validate", toolClass: DeveloperToolClass.EVIDENCE, exposure: "codemode" },
  { name: "write", toolClass: DeveloperToolClass.SOURCE_MUTATION, exposure: "direct" },
  { name: "admin_delete", toolClass: DeveloperToolClass.DESTRUCTIVE_ADMIN, exposure: "deferred" },
];

test("#2592 derives a fail-closed task-scoped Codemode read/evidence loadout", () => {
  const task = {
    id: "task-2592",
    authorized: true,
    state: "verifying",
    allowedTools: ["plotpickle_status", "plotpickle_validate", "write", "admin_delete"],
    mutationAuthorized: true,
    destructiveAuthorized: true,
    readScopes: ["config/**", "tests/**"],
  };
  const loadout = deriveCodemodeLoadout({
    task,
    phase: "verify",
    availableTools,
    requiredSkillIds: ["uat-repair", "repository-inspection"],
  });

  assert.equal(loadout.enabled, true);
  assert.deepEqual(loadout.toolNames, ["plotpickle_status", "plotpickle_validate"]);
  assert.deepEqual(loadout.writeScopes, []);
  assert.equal(loadout.mutationAuthorized, false);
  assert.equal(loadout.destructiveAuthorized, false);
  assert.equal(loadout.verificationAuthority, "deterministic-contract-only");
  assert.deepEqual(loadout.readScopes, ["config/**", "tests/**"]);
});

test("#2592 wrapping a mutation in Codemode never expands task authority", () => {
  const task = {
    authorized: true,
    state: "building",
    allowedTools: ["write"],
    mutationAuthorized: true,
  };
  assert.equal(authorizeDeveloperTool({
    toolName: "write",
    toolClass: DeveloperToolClass.SOURCE_MUTATION,
    task,
  }).allowed, true);
  assert.deepEqual(authorizeCodemodeNestedTool({
    toolName: "write",
    toolClass: DeveloperToolClass.SOURCE_MUTATION,
    task,
  }), {
    allowed: false,
    reason: "phase3-codemode-read-evidence-only",
  });
});

test("#2592 runs independent read/evidence calls in parallel and returns bounded structured evidence", async () => {
  const started = [];
  let release;
  const barrier = new Promise((resolve) => { release = resolve; });
  const task = {
    authorized: true,
    state: "verifying",
    allowedTools: ["plotpickle_status", "plotpickle_validate"],
    readScopes: ["."],
  };

  const promise = runCodemodeReadEvidenceBatch({
    task,
    phase: "verify",
    availableTools,
    calls: [
      { name: "plotpickle_status", args: {} },
      { name: "plotpickle_validate", args: {} },
    ],
    executeTool: async (name) => {
      started.push(name);
      if (started.length === 2) release();
      await barrier;
      return { structuredContent: { status: "ok", evidenceRef: `evidence:${name}`, rawLog: "must-not-leak" } };
    },
  });

  await barrier;
  assert.deepEqual(started.sort(), ["plotpickle_status", "plotpickle_validate"]);
  const result = await promise;
  assert.equal(result.parallel, true);
  assert.equal(result.status, "ok");
  assert.equal(result.verificationAuthority, "deterministic-contract-only");
  assert.deepEqual(result.results.map((item) => item.result), [
    { status: "ok", evidenceRef: "evidence:plotpickle_status" },
    { status: "ok", evidenceRef: "evidence:plotpickle_validate" },
  ]);
});

test("#2592 maps Pi nestedCalls into canonical privacy-safe tool call/result evidence", () => {
  const normalized = normalizePiNestedCallEvidence({
    parentToolCallId: "codemode-1",
    sessionId: "session-1",
    turnId: "turn-1",
    agentRunId: "agent-run-1",
    providerId: "llama.cpp",
    modelId: "local-model",
    nestedCalls: {
      complete: true,
      calls: [
        { id: "codemode-1/1", name: "plotpickle_status", arguments: { secret: "omit" }, status: "ok", durationMs: 12 },
        { id: "codemode-1/2", name: "plotpickle_validate", arguments: { raw: "omit" }, status: "error", error: { code: "TEST_FAILED", message: "omit" }, durationMs: 25 },
      ],
    },
  });

  assert.equal(normalized.complete, true);
  assert.equal(normalized.events.length, 4);
  assert.equal(normalized.events[0].parentToolCallId, "codemode-1");
  assert.equal(normalized.events[0].parentId, "agent-run-1");
  assert.equal(normalized.events[1].parentId, "codemode-1/1");
  assert.equal(normalized.events[3].errorCode, "TEST_FAILED");
  assert.equal("arguments" in normalized.events[0], false);
  assert.equal("error" in normalized.events[3], false);
  assert.equal(AGENT_RUNTIME_SAFE_TRACE_FIELDS.includes("parentToolCallId"), true);
  for (const event of normalized.events) {
    assert.equal("prompt" in event, false);
    assert.equal("response" in event, false);
    assert.equal("reasoning" in event, false);
  }
});
