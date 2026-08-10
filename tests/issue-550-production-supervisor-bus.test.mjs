import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { latestAgentStates, normalizeAgentEvent, publishAgentEvent, readAgentEvents, sanitizeEvidence, supervisorSummary } from "../lib/production-supervisor-bus.mjs";

const root = new URL("../", import.meta.url);
const read = (name) => readFile(new URL(name, root), "utf8");

test("#550 normalizes typed agent lifecycle states and bounded job types", () => {
  const event = normalizeAgentEvent({
    timestamp: "2026-08-10T08:00:00.000Z",
    agentId: "ui-continuity",
    state: "working",
    capability: "ui-continuity",
    ready: true,
    acceptedJobTypes: ["ui-continuity", "follow-up", "arbitrary-command"],
    progress: 63.7,
    detail: "Inspecting rendered screens",
  });
  assert.equal(event.state, "working");
  assert.equal(event.progress, 64);
  assert.deepEqual(event.acceptedJobTypes, ["ui-continuity", "follow-up"]);
});

test("#550 strips secret-shaped keys and values from agent evidence", () => {
  const safe = sanitizeEvidence({
    endpoint: "http://127.0.0.1:8188",
    apiKey: "sk-secret-value",
    nested: { token: "abc123", detail: "api_key=private-value healthy" },
  });
  assert.equal(safe.apiKey, undefined);
  assert.equal(safe.nested.token, undefined);
  assert.doesNotMatch(JSON.stringify(safe), /sk-secret|private-value|abc123/);
  assert.match(safe.endpoint, /127\.0\.0\.1/);
});

test("#550 persists local typed events and keeps only the latest state per agent", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "plotpickle-supervisor-test-"));
  try {
    await publishAgentEvent({ agentId: "full-story-builder", state: "loaded", capability: "story-build" }, { directory });
    await publishAgentEvent({ agentId: "full-story-builder", state: "waiting", capability: "story-build", ready: true }, { directory });
    await publishAgentEvent({ agentId: "ui-continuity", state: "completed", capability: "ui-continuity", ready: true }, { directory });
    const events = await readAgentEvents({ directory });
    const latest = latestAgentStates(events);
    assert.equal(events.length, 3);
    assert.equal(latest.length, 2);
    assert.equal(latest.find((item) => item.agentId === "full-story-builder").state, "waiting");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("#550 supervisor summary never hides needs-attention states", () => {
  const summary = supervisorSummary([
    normalizeAgentEvent({ agentId: "production-supervisor", state: "waiting", capability: "coordination", ready: true }),
    normalizeAgentEvent({ agentId: "ui-continuity", state: "completed", capability: "ui-continuity", ready: true }),
    normalizeAgentEvent({ agentId: "creative-writer-uat", state: "needs-attention", capability: "uat", detail: "Browser unavailable" }),
  ]);
  assert.equal(summary.needsAttention.length, 1);
  assert.equal(summary.needsAttention[0].agentId, "creative-writer-uat");
  assert.equal(summary.counts["needs-attention"], 1);
});

test("#550 persistent supervisor window discovers current companions and preserves safety boundaries", async () => {
  const [script, launcher] = await Promise.all([read("scripts/production-supervisor-agent.mjs"), read("Start-Production-Supervisor.bat")]);
  for (const agent of ["full-story-builder", "ui-continuity", "creative-writer-uat"]) assert.match(script, new RegExp(agent));
  assert.match(script, /Production Supervisor accepts only a local PlotPickle server address/);
  assert.match(script, /The supervisor will not mark the production complete while blockers remain/);
  assert.match(launcher, /--stay-open/);
  assert.match(launcher, /does not approve canon, expose credentials, publish, install software, or authorize paid generation/i);
});
