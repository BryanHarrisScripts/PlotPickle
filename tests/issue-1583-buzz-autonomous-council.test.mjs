import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
      confidence: 0.85,
      changesCanon: false,
      explanation: "Signed specialist evidence.",
      proposal: "Clarify the motive without changing the ending.",
      alternatives: ["Keep the current ambiguity."],
      affectedDownstreamRefs: ["screenplay:afterglow-v9-block-17"],
    },
    provenance: {
      transport: "buzz",
      eventId: `event-${index}`,
      pubkey: String(index).padStart(64, "a").slice(0, 64),
      signatureVerified: true,
    },
    ...overrides,
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

test("#1583 runner integration must use the Story Bridge and never synthesize a live BUZZ proof", async () => {
  const runner = await readFile(new URL("../scripts/creative-uat/autonomous/run-autonomous-story-routes.mjs", import.meta.url), "utf8");
  for (const boundary of [
    "/api/story-workflow/buzz-bridge",
    "createAfterglowBuzzCouncilPlan",
    "createAfterglowBuzzCouncilProof",
    "genuineContributionCount",
    "degraded-local",
    "signatureVerified",
  ]) assert.match(runner, new RegExp(boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(runner, /fakeBuzz|simulateBuzz|fixtureContribution|signedContribution\(/i);
  assert.doesNotMatch(runner, /\/api\/local-buzz\/messages/);
});
