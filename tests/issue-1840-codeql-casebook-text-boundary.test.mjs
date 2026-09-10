import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCasebookHumanInteractionAdapter, redactCaseEvidence } from "../scripts/casebook-evidence.mjs";
import { sanitizeEvidenceText } from "../scripts/evidence-text-boundary.mjs";
import {
  createSemanticExecution,
  recordSemanticObservation,
  safeSemanticExecutionRecord,
} from "../scripts/semantic-execution.mjs";

const SECRET_TEXT = "token=abc123456789 nsec1abcdefghijklmnop Bearer abcdefghijklmnop sk-abcdefghijklmnop C:\\Users\\bryan\\PlotPickle /home/bryan/project";

test("#1840 scanner redacts credentials and local-user paths in one evidence text boundary", () => {
  const safe = sanitizeEvidenceText(SECRET_TEXT);
  assert.doesNotMatch(safe, /abc123456789|nsec1abcdefghijklmnop|Bearer abcdefghijklmnop|sk-abcdefghijklmnop|\\Users\\bryan|\/home\/bryan/i);
  assert.match(safe, /REDACTED/);
  assert.match(safe, /local-user/);
  assert.match(safe, /\/home\/\[user\]/);
});

test("#1840 Casebook and semantic evidence both use the shared scanner boundary", async () => {
  const [casebookSource, semanticSource] = await Promise.all([
    readFile(new URL("../scripts/casebook-evidence.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/semantic-execution.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(casebookSource, /sanitizeEvidenceText/);
  assert.match(semanticSource, /sanitizeEvidenceText/);
  assert.doesNotMatch(casebookSource, /evidenceTextRedactions/);
  assert.doesNotMatch(semanticSource, /\.replace\(\/\\bnsec1/);

  const casebookSafe = redactCaseEvidence({
    note: SECRET_TEXT,
    reasoning: "hidden reasoning",
    nested: { password: "secret-value" },
  });
  const casebookSerialized = JSON.stringify(casebookSafe);
  assert.doesNotMatch(casebookSerialized, /abc123456789|hidden reasoning|secret-value|bryan/i);
  assert.equal(casebookSafe.nested.password, "[REDACTED]");

  const semantic = createSemanticExecution({
    taskId: "issue-1840",
    agentId: "security-repair",
    domain: "engineering",
    scope: { projectId: "plotpickle" },
    intent: { objective: "Verify the shared evidence boundary." },
  });
  recordSemanticObservation(semantic, {
    position: "state",
    source: "security-regression",
    summary: SECRET_TEXT,
    evidence: [{ kind: "note", summary: SECRET_TEXT }],
  });
  const semanticSerialized = JSON.stringify(safeSemanticExecutionRecord({ ...semantic, prompt: "hidden prompt", apiKey: "secret-value" }));
  assert.doesNotMatch(semanticSerialized, /abc123456789|nsec1abcdefghijklmnop|Bearer abcdefghijklmnop|sk-abcdefghijklmnop|hidden prompt|secret-value|bryan/i);
  assert.match(semanticSerialized, /REDACTED/);
});

test("#1840 Casebook scroll data never becomes browser-evaluate source", async () => {
  const calls = [];
  const client = {
    async call(name, args) {
      calls.push({ name, args });
      return { content: [{ type: "text", text: '{"x":0,"y":600}' }] };
    },
  };
  const tools = [{ name: "browser_evaluate", inputSchema: { properties: { function: { type: "string" } }, required: ["function"] } }];
  const creativeBrowser = {
    clickVisible: async () => true,
    fillByLabel: async () => ({ ok: true }),
    navigate: async () => ({ ok: true }),
    screenshot: async () => ({ ok: true }),
  };
  const adapter = createCasebookHumanInteractionAdapter({ client, tools, creativeBrowser });
  const attackerText = "600); globalThis.__casebookInjected = true; //";
  assert.equal((await adapter.scrollBy(attackerText)).ok, true);
  assert.equal((await adapter.scrollBy(1200)).ok, true);

  const evaluatedSources = calls.filter((call) => call.name === "browser_evaluate").map((call) => call.args.function);
  assert.equal(evaluatedSources.length, 3);
  assert.ok(evaluatedSources.every((source) => !source.includes("__casebookInjected")));
  assert.ok(evaluatedSources.every((source) => !source.includes(attackerText)));
  assert.ok(evaluatedSources.slice(1).every((source) => source.includes("window.scrollBy(0, 600)")));
});
