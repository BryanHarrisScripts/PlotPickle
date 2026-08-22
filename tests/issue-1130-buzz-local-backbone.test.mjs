import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  bestEffortLiveBuzzActivity,
  deriveLocalBuzzBackboneHealth,
  normalizeLocalBuzzActivity,
  readLocalBuzzActivity,
} from "../scripts/buzz-live-activity.mjs";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

async function withTempBackbone(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-buzz-backbone-"));
  try { return await run(root); }
  finally { await rm(root, { recursive: true, force: true }); }
}

test("#1130 records bounded local operational evidence without falling back to the Human signer", async () => {
  await withTempBackbone(async (localRoot) => {
    const result = await bestEffortLiveBuzzActivity({
      type: "agent.presence",
      actorId: "bram-gatewick",
      summary: "Gatewarden is checking focused UAT evidence.",
      healthStatus: "working",
      runId: "uat-run-1130",
      nodeId: "local-node",
      verified: true,
      evidence: [{ label: "uat", ref: "artifacts/uat/report.json" }],
    }, {
      localRoot,
      fetchImpl: async () => { throw new Error("relay offline"); },
    });

    assert.equal(result.ok, true);
    assert.equal(result.localRecorded, true);
    assert.equal(result.buzzMirrored, false);
    assert.equal(result.reason, "agent-signer-required");

    const events = await readLocalBuzzActivity({ localRoot });
    assert.equal(events.length, 1);
    assert.equal(events[0].actorId, "bram-gatewick");
    assert.equal(events[0].healthStatus, "working");
    assert.equal(events[0].runId, "uat-run-1130");
    assert.equal(events[0].route, "gatehouse");
  });
});

test("#1130 keeps Human, Node, project, session and agent provenance as separate fields", () => {
  const event = normalizeLocalBuzzActivity({
    type: "agent.presence",
    actorId: "sage-brinewick",
    summary: "Sage is ready for a scoped curriculum turn.",
    healthStatus: "ready",
    nodeId: "node-a",
    profileId: "human-a",
    projectId: "project-a",
    sessionId: "session-a",
    runId: "run-a",
  });
  assert.equal(event.actorId, "sage-brinewick");
  assert.deepEqual(event.scope, {
    nodeId: "node-a",
    profileId: "human-a",
    projectId: "project-a",
    sessionId: "session-a",
  });
  assert.equal(event.runId, "run-a");
  assert.notEqual(event.actorId, event.scope.profileId);
  assert.notEqual(event.actorId, event.scope.nodeId);
});

test("#1130 derives truthful health and turns expired presence into unknown", () => {
  const ready = normalizeLocalBuzzActivity({
    type: "agent.presence",
    actorId: "sage-brinewick",
    summary: "Sage ready.",
    healthStatus: "ready",
    occurredAt: "2026-08-21T17:00:00.000Z",
    presenceTtlMs: 60_000,
  });
  const degraded = normalizeLocalBuzzActivity({
    type: "system.health",
    actorId: "bram-gatewick",
    summary: "UAT provider degraded.",
    healthStatus: "degraded",
    occurredAt: "2026-08-21T17:00:50.000Z",
    presenceTtlMs: 5 * 60_000,
    verified: true,
    evidence: [{ label: "probe", ref: "provider-check:1" }],
  });
  const health = deriveLocalBuzzBackboneHealth([ready, degraded], { now: "2026-08-21T17:02:00.000Z" });
  assert.equal(health.overall, "degraded");
  assert.equal(health.actors.find((actor) => actor.actorId === "sage-brinewick")?.status, "unknown");
  assert.equal(health.actors.find((actor) => actor.actorId === "sage-brinewick")?.stale, true);
  assert.equal(health.actors.find((actor) => actor.actorId === "bram-gatewick")?.status, "degraded");
  assert.equal(health.verifiedEvidenceCount, 1);
});

test("#1130 redacts credentials and hidden identity material before local or remote evidence", () => {
  const secretHex = "a".repeat(64);
  const event = normalizeLocalBuzzActivity({
    type: "runtime.alert",
    actorId: "bram-gatewick",
    summary: `privateKey=nsec1supersecretvalue token=abc123456789 ${secretHex}`,
    healthStatus: "degraded",
    evidence: [{ label: "secret", ref: secretHex }],
  });
  const serialized = JSON.stringify(event);
  assert.doesNotMatch(serialized, /nsec1supersecretvalue/);
  assert.doesNotMatch(serialized, new RegExp(secretHex));
  assert.match(serialized, /redacted/i);
});

test("#1130 accepts improvement candidates only when verified evidence exists", () => {
  assert.throws(() => normalizeLocalBuzzActivity({
    type: "improvement.candidate",
    actorId: "rook-ironquill",
    summary: "Maybe change the repair workflow.",
    verified: false,
  }), /verified evidence/);

  const candidate = normalizeLocalBuzzActivity({
    type: "improvement.candidate",
    actorId: "rook-ironquill",
    summary: "Repeated verified timeout suggests a bounded retry-policy review.",
    verified: true,
    actionable: true,
    evidence: [{ label: "verified-runs", ref: "runs:101,102,103" }],
  });
  const health = deriveLocalBuzzBackboneHealth([candidate], { now: candidate.occurredAt });
  assert.equal(health.improvementCandidateCount, 1);
});

test("#1130 wires semantic execution into the existing BUZZ activity owner without making BUZZ an execution engine", async () => {
  const [semanticRepair, activity, config, gateway, card] = await Promise.all([
    read("scripts/run-semantic-uat-repair.mjs"),
    read("scripts/buzz-live-activity.mjs"),
    read("config/buzz-guildhall.json"),
    read("build/buzz-live-health-gateway.ts"),
    read("app/buzz-live-health-card.tsx"),
  ]);

  assert.match(semanticRepair, /bestEffortLiveBuzzActivity/);
  assert.match(semanticRepair, /type: "semantic\.execution"/);
  assert.match(semanticRepair, /healthStatus,?/);
  assert.match(semanticRepair, /Semantic repair completed/);
  assert.match(semanticRepair, /Semantic repair blocked/);
  assert.doesNotMatch(activity, /executeSemantic|transitionSemanticExecution|beginSemanticAction/);

  const parsed = JSON.parse(config);
  assert.equal(parsed.eventRoutes["agent.presence"], "gatehouse");
  assert.equal(parsed.eventRoutes["system.health"], "gatehouse");
  assert.equal(parsed.eventRoutes["semantic.execution"], "forge");
  assert.equal(parsed.eventRoutes["improvement.candidate"], "archive");

  assert.match(gateway, /getLocalBuzzBackboneHealth/);
  assert.match(gateway, /request\.method === "GET"/);
  assert.match(gateway, /Local coordination health is derived from bounded PlotPickle evidence/);
  assert.match(card, /data-buzz-local-backbone="true"/);
  assert.match(card, /Stale presence is shown as unknown rather than online/);
});

test("#1130 keeps authority boundaries explicit: PPF, GitHub and deterministic gates remain authoritative", async () => {
  const config = JSON.parse(await read("config/buzz-guildhall.json"));
  assert.match(config.authority.creative, /PPF remains the canonical creative record/);
  assert.match(config.authority.code, /GitHub remains the canonical code/);
  assert.match(config.authority.agentRuntime, /Mastra remains the PlotPickle product-agent runtime/);
  assert.equal(config.privacy.automaticPpfWrites, false);
  assert.equal(config.privacy.automaticGithubMerge, false);
});
