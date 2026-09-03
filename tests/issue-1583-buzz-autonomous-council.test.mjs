import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createAfterglowAutonomousCouncilResult } from "../scripts/creative-uat/autonomous/afterglow-autonomous-council.mjs";
import { collectAfterglowBuzzCouncilEvidence } from "../scripts/creative-uat/autonomous/afterglow-buzz-council-live.mjs";
import {
  AFTERGLOW_BUZZ_COUNCIL_SPECIALISTS,
  createAfterglowBuzzCouncilPlan,
  createAfterglowBuzzCouncilProof,
  storyBridgeContributionToCouncilPosition,
} from "../scripts/creative-uat/autonomous/afterglow-buzz-council.mjs";

function signedContribution(agentId, index, overrides = {}) {
  return {
    contributionId: `contribution:${index}`,
    requestId: `story-bridge:req-${index}`,
    workItemId: "story-work:afterglow-block-17:42",
    runId: `buzz-council:run-${index}:${agentId}`,
    baseRevision: "42",
    agentProfileId: agentId,
    agentActorId: agentId,
    state: "accepted",
    accepted: true,
    result: {
      resultId: `result:${index}`,
      workItemId: "story-work:afterglow-block-17:42",
      kind: "proposal",
      targetRefs: ["ppf:foundations:foundations-essentials-essential-aspects-2-md:output-2"],
      evidenceRefs: ["character:ren", "character:isobel", "afterglow-v9-block-17"],
      curriculumRequirementId: "foundations:foundations-essentials-essential-aspects-2-md:output-2",
      principleRef: "curriculum:foundations:character-motivation",
      severity: "medium",
      confidence: 0.85 + (index / 100),
      changesCanon: false,
      explanation: `Signed specialist evidence ${index}.`,
      proposal: index === 3 ? "Keep the current ambiguity." : "Clarify the motive without changing the ending.",
      alternatives: ["Keep the current story unchanged."],
      affectedDownstreamRefs: ["screenplay:afterglow-v9-block-17"],
    },
    provenance: {
      transport: "buzz",
      eventId: `event-${index}`,
      pubkey: `${index}`.repeat(64).slice(0, 64),
      signatureVerified: true,
    },
    ...overrides,
  };
}

function bridgeHarness({ unsignedAgentId = "" } = {}) {
  const indexByAgent = new Map(AFTERGLOW_BUZZ_COUNCIL_SPECIALISTS.map((agentId, index) => [agentId, index + 1]));
  return async ({ url, body }) => {
    if (url === "/api/story-workflow/buzz-bridge" && body?.action === "diagnostics") {
      return {
        ok: true,
        status: 200,
        payload: {
          storyBridge: { ready: true, message: "ready" },
          agentSigners: { bindings: AFTERGLOW_BUZZ_COUNCIL_SPECIALISTS.map((profileId) => ({ profileId, ready: true })) },
        },
      };
    }
    if (url === "/api/responsibility-runs" && body?.action === "create") {
      return { ok: true, status: 200, payload: { run: { ...body, state: "queued" } } };
    }
    if (url === "/api/responsibility-runs" && body?.action === "start") {
      return { ok: true, status: 200, payload: { run: { runId: body.runId, state: "working" } } };
    }
    if (url === "/api/story-workflow/buzz-bridge" && body?.action === "prepare") {
      const entry = body.workItem;
      return {
        ok: true,
        status: 200,
        payload: {
          request: {
            requestId: `story-bridge:${entry.assignedAgentId}`,
            state: "ready",
            stateReason: "ready",
            projectId: entry.projectId,
            workItemId: entry.workItemId,
            runId: entry.runId,
            baseRevision: entry.baseRevision,
            agentProfileId: entry.assignedAgentId,
            agentActorId: entry.assignedAgentId,
          },
        },
      };
    }
    if (url === "/api/story-workflow/buzz-bridge" && body?.action === "dispatch") {
      return { ok: true, status: 200, payload: { state: "sent", executionPath: "buzz" } };
    }
    if (url === "/api/story-workflow/buzz-bridge" && body?.action === "collect") {
      const agentId = body.request.agentProfileId;
      const index = indexByAgent.get(agentId);
      const contribution = signedContribution(agentId, index, {
        requestId: body.request.requestId,
        runId: body.request.runId,
        provenance: {
          transport: "buzz",
          eventId: `event-${index}`,
          pubkey: `${index}`.repeat(64).slice(0, 64),
          signatureVerified: agentId !== unsignedAgentId,
        },
      });
      return { ok: true, status: 200, payload: { contributions: [contribution] } };
    }
    throw new Error(`Unexpected request ${url} ${body?.action || ""}`);
  };
}

test("#1583 plans exactly three bounded approved specialist Story Bridge runs", () => {
  const plan = createAfterglowBuzzCouncilPlan({
    projectId: "afterglow-working-copy",
    revision: "42",
    generatedAt: "2026-09-03T18:40:00.000Z",
  });
  assert.deepEqual(plan.requiredAgentIds, AFTERGLOW_BUZZ_COUNCIL_SPECIALISTS);
  assert.equal(plan.entries.length, 3);
  assert.equal(new Set(plan.entries.map((entry) => entry.workItem.workItemId)).size, 1);
  assert.ok(plan.entries.every((entry) => entry.responsibilityRunCreate.kind === "creative-proposal"));
  assert.ok(plan.entries.every((entry) => entry.responsibilityRunCreate.limits.maxAttempts === 1));
  assert.ok(plan.entries.every((entry) => entry.responsibilityRunCreate.limits.maxCloudCostUsd === 0));
  assert.ok(plan.entries.every((entry) => entry.contextPacket.receipt.sources.length === 1));
  assert.ok(plan.entries.every((entry) => entry.contextPacket.items.every((item) => item.sourceType === "task-reference")));
});

test("#1583 live proof requires three distinct accepted signed approved Agent contributions", () => {
  const contributions = AFTERGLOW_BUZZ_COUNCIL_SPECIALISTS.map((agentId, index) => signedContribution(agentId, index + 1));
  const proof = createAfterglowBuzzCouncilProof(contributions);
  assert.equal(proof.liveSatisfied, true);
  assert.equal(proof.genuineContributionCount, 3);
  assert.deepEqual(proof.missingAgentIds, []);
  assert.ok(proof.contributions.every((item) => item.signatureVerified && item.transport === "buzz"));
});

test("#1583 duplicate, unsigned, stale or rejected contributions cannot satisfy live proof", () => {
  const [first, second, third] = AFTERGLOW_BUZZ_COUNCIL_SPECIALISTS.map((agentId, index) => signedContribution(agentId, index + 1));
  const unsigned = { ...third, provenance: { ...third.provenance, signatureVerified: false } };
  const stale = { ...second, state: "stale", accepted: false };
  const duplicateAgent = signedContribution(first.agentProfileId, 9);
  const proof = createAfterglowBuzzCouncilProof([first, stale, unsigned, duplicateAgent]);
  assert.equal(proof.liveSatisfied, false);
  assert.equal(proof.genuineContributionCount, 1);
  assert.deepEqual(proof.missingAgentIds.sort(), [second.agentProfileId, third.agentProfileId].sort());
});

test("#1583 accepted Story Bridge contribution becomes untrusted BUZZ Council evidence, never canon authority", () => {
  const contribution = signedContribution("tamsin-hearthquill", 1);
  const position = storyBridgeContributionToCouncilPosition(contribution);
  assert.equal(position.agentId, "tamsin-hearthquill");
  assert.equal(position.provenance.transport, "buzz");
  assert.equal(position.provenance.roomClass, "private-story-room");
  assert.equal(position.provenance.buzzSignatureVerified, true);
  assert.equal(position.provenance.buzzEventId, "event-1");
  assert.equal(position.changesCanon, false);
});

test("#1583 refuses to map unverified or stale BUZZ output into Council evidence", () => {
  const stale = signedContribution("mira-threadmere", 2, { state: "stale", accepted: false });
  const unsigned = signedContribution("critics-circle", 3, { provenance: { transport: "buzz", eventId: "event-3", pubkey: "b".repeat(64), signatureVerified: false } });
  assert.equal(storyBridgeContributionToCouncilPosition(stale), null);
  assert.equal(storyBridgeContributionToCouncilPosition(unsigned), null);
});

test("#1583 live collector dispatches three real bridge requests and accepts three signed results", async () => {
  const live = await collectAfterglowBuzzCouncilEvidence({
    projectId: "afterglow-working-copy",
    revision: "42",
    generatedAt: "2026-09-03T18:40:00.000Z",
    request: bridgeHarness(),
    pollAttempts: 1,
    pollIntervalMs: 250,
  });
  assert.equal(live.mode, "buzz-signed");
  assert.equal(live.liveSatisfied, true);
  assert.equal(live.genuineContributionCount, 3);
  assert.equal(live.bridgeRequests.length, 3);
  assert.ok(live.bridgeRequests.every((item) => item.dispatched));
});

test("#1583 configured BUZZ failure does not silently become degraded-local proof", async () => {
  const live = await collectAfterglowBuzzCouncilEvidence({
    projectId: "afterglow-working-copy",
    revision: "42",
    generatedAt: "2026-09-03T18:40:00.000Z",
    request: bridgeHarness({ unsignedAgentId: "critics-circle" }),
    pollAttempts: 1,
    pollIntervalMs: 250,
  });
  assert.equal(live.mode, "failed-live-proof");
  assert.equal(live.configured, true);
  assert.equal(live.liveSatisfied, false);
  assert.equal(live.genuineContributionCount, 2);
  assert.deepEqual(live.missingAgentIds, ["critics-circle"]);
});

test("#1583 unavailable profile-scoped BUZZ transport is truthful degraded-local and proves nothing live", async () => {
  const live = await collectAfterglowBuzzCouncilEvidence({
    projectId: "afterglow-working-copy",
    revision: "42",
    request: async () => ({ ok: false, status: 401, payload: { message: "PlotPickle Human profile required." } }),
  });
  assert.equal(live.mode, "degraded-local");
  assert.equal(live.configured, false);
  assert.equal(live.liveSatisfied, false);
  assert.equal(live.genuineContributionCount, 0);
});

test("#1583 signed BUZZ positions actually become the Story Decision Council evidence", () => {
  const contributions = AFTERGLOW_BUZZ_COUNCIL_SPECIALISTS.map((agentId, index) => signedContribution(agentId, index + 1));
  const council = createAfterglowAutonomousCouncilResult({
    projectId: "afterglow-working-copy",
    revision: "42",
    recordedAt: "2026-09-03T18:40:00.000Z",
    buzzContributions: contributions,
  });
  assert.equal(council.councilEvidence.mode, "buzz-signed");
  assert.equal(council.councilEvidence.genuineContributionCount, 3);
  assert.ok(council.councilEvidence.contributions.every((item) => item.affectedDecision));
  assert.match(council.problemSignature, /buzz-signed/);
  assert.deepEqual(council.councilResult.positions.map((item) => item.provenance.transport), ["buzz", "buzz", "buzz"]);
});

test("#1583 runner integration uses only Story Bridge and Responsibility Run APIs, never direct BUZZ messaging", async () => {
  const [runner, live] = await Promise.all([
    readFile(new URL("../scripts/creative-uat/autonomous/run-autonomous-story-routes.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/creative-uat/autonomous/afterglow-buzz-council-live.mjs", import.meta.url), "utf8"),
  ]);
  const combined = `${runner}\n${live}`;
  for (const boundary of [
    "/api/story-workflow/buzz-bridge",
    "/api/responsibility-runs",
    "createAfterglowBuzzCouncilPlan",
    "createAfterglowBuzzCouncilProof",
    "genuineContributionCount",
    "degraded-local",
    "signatureVerified",
    "failed-live-proof",
  ]) assert.match(combined, new RegExp(boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(combined, /fakeBuzz|simulateBuzz|fixtureContribution/i);
  assert.doesNotMatch(combined, /\/api\/local-buzz\/messages/);
  assert.doesNotMatch(combined, /cookie|private[_ -]?key|nsec1/i);
});
