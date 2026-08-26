import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normalizeStoryCouncilContribution,
  reduceStoryCouncilContributions,
  selectStoryCouncilSpecialists,
  STORY_COUNCIL_SPECIALISTS,
} from "../core/story-workflow/story-council-core.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function workItem(overrides = {}) {
  return {
    workItemId: "story-work:ren-motivation",
    projectId: "afterglow-working-copy",
    baseRevision: "9",
    curriculumRequirementId: "foundations:character:motivation",
    frontier: "Foundations",
    targetRefs: ["ppf:character:ren:motivation"],
    status: "queued",
    reason: "Ren's motivation and stakes need a bounded current-frontier review.",
    evidenceRefs: ["screenplay:scene-12"],
    assignedAgentId: "tamsin-hearthquill",
    runId: "",
    proposalIds: [],
    dependencyRefs: ["ppf:foundations:protagonist"],
    severity: "high",
    priority: "blocking",
    kind: "audit",
    ...overrides,
  };
}

function contribution(overrides = {}) {
  return {
    contributionId: "c-tamsin",
    workItemId: "story-work:ren-motivation",
    runId: "run-tamsin",
    agentId: "tamsin-hearthquill",
    baseRevision: "9",
    kind: "proposal",
    targetRefs: ["ppf:character:ren:motivation"],
    evidenceRefs: ["screenplay:scene-12"],
    curriculumRequirementId: "foundations:character:motivation",
    principleRef: "curriculum:motivation-drives-action",
    severity: "high",
    confidence: 0.86,
    changesCanon: true,
    explanation: "Ren's current choice needs a clearer motivational cause.",
    proposal: "Make Ren hide the device to protect Isobel.",
    alternatives: [],
    affectedDownstreamRefs: ["ppf:structure:block-6"],
    agreementRefs: [],
    disagreementRefs: [],
    provenance: {
      transport: "local-runtime",
      roomClass: "local-only",
      recordedAt: "2026-08-26T21:10:00.000Z",
    },
    ...overrides,
  };
}

test("#1417 maps only approved existing Agent Contracts into Story Council responsibilities", async () => {
  const registry = JSON.parse(await read("config/agent-profiles.json"));
  const profiles = new Map(registry.profiles.map((profile) => [profile.id, profile]));
  const ids = STORY_COUNCIL_SPECIALISTS.map((specialist) => specialist.agentId);

  for (const specialist of STORY_COUNCIL_SPECIALISTS) {
    const profile = profiles.get(specialist.agentId);
    assert.ok(profile, `missing Agent Contract for ${specialist.agentId}`);
    assert.equal(profile.buzzBinding.actorId, specialist.buzzActorId);
    assert.ok(profile.readScopes.includes(specialist.requiredReadScope), `${specialist.agentId} must already own ${specialist.requiredReadScope}`);
    assert.ok(!profile.requestedCapabilities.includes("ppf-direct-write"));
    assert.ok(!profile.requestedCapabilities.includes("canon-write"));
  }

  assert.ok(ids.includes("tamsin-hearthquill"));
  assert.ok(ids.includes("elowen-mapweaver"));
  assert.ok(ids.includes("mira-threadmere"));
  assert.ok(ids.includes("critics-circle"));
  assert.ok(ids.includes("orin-ledgerbark"));
  assert.ok(!ids.includes("ben"), "developer/code agents stay outside creative Story Council authorship");
  assert.ok(!ids.includes("avery-north"), "synthetic UAT agents stay outside creative Story Council authorship");
  assert.equal(STORY_COUNCIL_SPECIALISTS.some((specialist) => specialist.responsibility === "world-authority"), false,
    "Story Council must not invent a world authority that current Agent Contracts do not grant");
});

test("#1417 selects the minimum useful specialist set and keeps private evidence out of public BUZZ rooms", () => {
  const plan = selectStoryCouncilSpecialists(workItem(), {
    maxSpecialists: 3,
    buzzAvailable: true,
    allowPublicDiscussion: true,
  });

  assert.deepEqual(plan.specialists.map((specialist) => specialist.agentId), [
    "tamsin-hearthquill",
    "mira-threadmere",
    "elowen-mapweaver",
  ]);
  assert.equal(plan.specialists.length, 3);
  assert.equal(plan.maxParallelism, 2);
  assert.equal(plan.coordinatorAgentId, "sage-brinewick");
  assert.equal(plan.buzz.mode, "private-story-room");
  assert.equal(plan.buzz.privateEvidence, true);
  assert.equal(plan.buzz.transcriptRequired, false);

  const visual = selectStoryCouncilSpecialists(workItem({
    workItemId: "story-work:poster",
    baseRevision: "9",
    frontier: "Visual",
    curriculumRequirementId: "visual:key-art",
    targetRefs: ["visual:key-art"],
    evidenceRefs: ["approved-visual:poster-brief"],
    assignedAgentId: "marquee-director",
    reason: "Review the approved key-art direction.",
    severity: "medium",
    kind: "requirement",
  }), { buzzAvailable: true, allowPublicDiscussion: true, maxSpecialists: 2 });
  assert.equal(visual.buzz.mode, "marquee");
  assert.ok(visual.specialists.length <= 2);
});

test("#1417 structured contributions fail closed on BUZZ identity/signature and public leakage", () => {
  const local = normalizeStoryCouncilContribution(contribution());
  assert.equal(local.agentId, "tamsin-hearthquill");
  assert.equal(local.provenance.transport, "local-runtime");
  assert.equal(local.changesCanon, true);
  assert.equal(local.humanGate, "proposal-review");

  assert.throws(() => normalizeStoryCouncilContribution(contribution({
    provenance: {
      transport: "buzz",
      roomClass: "private-story-room",
      buzzActorId: "tamsin-hearthquill",
      buzzEventId: "event-1",
      buzzSignatureVerified: false,
    },
  })), /verified signed event/i);

  assert.throws(() => normalizeStoryCouncilContribution(contribution({
    provenance: {
      transport: "buzz",
      roomClass: "private-story-room",
      buzzActorId: "mira-threadmere",
      buzzEventId: "event-2",
      buzzSignatureVerified: true,
    },
  })), /does not match the approved Agent Contract binding/i);

  assert.throws(() => normalizeStoryCouncilContribution(contribution({
    provenance: {
      transport: "buzz",
      roomClass: "story-council",
      buzzActorId: "tamsin-hearthquill",
      buzzEventId: "event-3",
      buzzSignatureVerified: true,
    },
  })), /authorized private Story Room/i);

  const signedPrivate = normalizeStoryCouncilContribution(contribution({
    provenance: {
      transport: "buzz",
      roomClass: "private-story-room",
      buzzActorId: "tamsin-hearthquill",
      buzzActorPublicKey: "a".repeat(64),
      buzzEventId: "event-4",
      buzzSignatureVerified: true,
      recordedAt: "2026-08-26T21:10:00.000Z",
    },
  }));
  assert.equal(signedPrivate.provenance.buzzSignatureVerified, true);
});

test("#1417 deterministic council reduction preserves agreement and creative disagreement without voting", () => {
  const result = reduceStoryCouncilContributions([
    contribution(),
    contribution({
      contributionId: "c-mira",
      runId: "run-mira",
      agentId: "mira-threadmere",
      explanation: "Ren's later continuity supports protection, but the scene can also support a truth-driven choice.",
      proposal: "Make Ren expose the device to force the conflict into the open.",
      disagreementRefs: ["c-tamsin"],
    }),
    contribution({
      contributionId: "c-critics",
      runId: "run-critics",
      agentId: "critics-circle",
      explanation: "The protective version has the clearest causal support in the checked evidence.",
      proposal: "Make Ren hide the device to protect Isobel.",
      agreementRefs: ["c-tamsin"],
    }),
  ])[0];

  assert.equal(result.positions.length, 3, "all specialist positions remain inspectable");
  assert.equal(result.humanGate, "conflict");
  assert.equal(result.decisionClass, "unresolved-conflict");
  assert.equal(result.requiresHuman, true);
  assert.ok(result.agreements.length >= 1);
  assert.ok(result.disagreements.length >= 1);
  assert.match(result.summary, /Human judgment or approval is required/);
  assert.ok(result.positions.some((position) => position.agentId === "mira-threadmere"));
  assert.ok(result.positions.some((position) => position.agentId === "critics-circle"));
  assert.equal(Object.hasOwn(result, "winner"), false, "Story Council must never majority-vote a creative winner");
});

test("#1417 adapter reuses Responsibility Runs and current Agent Skills without making BUZZ or canon a worker authority", async () => {
  const adapter = await read("modules/story-workflow/story-council.ts");
  for (const contract of [
    "agentProfileById",
    "createResponsibilityRun",
    "profile.skillUris",
    'verificationMode: "writer-approval"',
    "maxParallelChildren: 0",
    "maxCloudCostUsd: 0",
    "selectStoryCouncilSpecialists",
    "assertStoryCouncilSpecialistContracts",
  ]) assert.ok(adapter.includes(contract), `Story Council adapter is missing reuse-first contract: ${contract}`);

  assert.doesNotMatch(adapter, /ppf-direct-write|saveActiveLibraryProject|canon-write\s*:/i,
    "Story Council workers must not gain direct canon mutation authority");
  assert.doesNotMatch(adapter, /LangGraph|Hermes|new Agent|createAgentIdentity/i,
    "Story Council must reuse the existing Agent/Responsibility architecture");
  assert.doesNotMatch(adapter, /provider:\s*["'](?:openai|minimax|anthropic)/i,
    "Story Council selection must not silently force paid cloud execution");
});
