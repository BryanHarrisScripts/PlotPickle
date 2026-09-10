import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  attachValidatorExplanation,
  createCreatorStoryGameDefinition,
  createCreatorStoryWorld,
  createFiveSceneCreatorStarterCollection,
  createGeneratedRuleFromMechanicsProposal,
  createNaturalLanguageMechanicsProposalRequest,
  createValidatorExplanationRequest,
  loadCreatorStoryWorldBundle,
  STORY_CREATOR_STARTER_PLAYABLE_TYPES,
} from "../modules/story-the-unwritten/creator/starter-world.mjs";
import { storyRuleIsAdmitted } from "../modules/story-the-unwritten/creator/authoring.mjs";

const creatorRef = "profile:creator";
const createdAt = "2026-09-04T20:00:00.000Z";

function starter() {
  return createFiveSceneCreatorStarterCollection({
    worldId: "world:lantern-workshop",
    gameDefinitionId: "game:lantern-workshop",
    ppfProjectRef: "ppf:project:creator-story",
    creatorRef,
    createdAt,
    checkedRevisionRef: "ppf:revision:12",
  });
}

test("#1675 Phase 3 creator Story World stays reference-only and inside existing PPF authority", () => {
  const world = createCreatorStoryWorld({
    id: "world:creator",
    title: "Creator World",
    description: "A small bounded world.",
    ppfProjectRef: "ppf:project:creator",
    graphIndexRef: "story:index:graph",
    pieceIndexRef: "story:index:pieces",
    ruleIndexRef: "story:index:rules",
    assetIndexRef: "story:index:assets",
    creatorRef,
  });

  assert.equal(world.schemaVersion, 1);
  assert.equal(world.visibility, "private");
  assert.equal(world.ppfProjectRef, "ppf:project:creator");
  assert.equal(world.provenance.authorship, "human");
  assert.deepEqual(world.compatibility.requiredCapabilityRefs, []);
  for (const forbidden of ["canon", "tools", "connectors", "credentials", "runtime", "agentInstances", "providerAuthority"]) {
    assert.equal(forbidden in world, false);
  }
});

test("#1675 Phase 3 creator game definition is explicitly five-scene and capability requirements remain declarative", () => {
  const game = createCreatorStoryGameDefinition({
    id: "game:creator",
    worldId: "world:creator",
    title: "Creator Game",
    startingPieceIds: ["piece:character"],
    ruleIds: ["rule:one"],
    endConditionRefs: ["ending:one"],
    requiredCapabilityRefs: ["capability:approved-template"],
    creatorRef,
  });

  assert.equal(game.sceneCount, 5);
  assert.deepEqual(game.compatibility.requiredCapabilityRefs, ["capability:approved-template"]);
  assert.equal(game.provenance.authorship, "human");
});

test("#1675 Phase 3 starter collection contains the six initial playable Story Piece types and passes deterministic preflight", () => {
  const bundle = starter();
  assert.equal(bundle.world.id, "world:lantern-workshop");
  assert.equal(bundle.gameDefinition.sceneCount, 5);
  assert.equal(bundle.validation.launchAllowed, true);
  assert.ok(bundle.validation.findings.some((finding) => finding.code === "STORY_PREFLIGHT_PASS"));
  assert.deepEqual(
    [...new Set(bundle.pieces.map((piece) => piece.type))].sort(),
    [...STORY_CREATOR_STARTER_PLAYABLE_TYPES].sort(),
  );
  assert.equal(bundle.pieces.length, 6);
  assert.equal(bundle.rules.length, 1);
  assert.equal(bundle.rules[0].provenance.authorship, "human");
  assert.equal(bundle.endConditions.length, 1);
});

test("#1675 Phase 3 loaded creator world re-runs deterministic validation and rejects cross-world Story Pieces", () => {
  const bundle = starter();
  const loaded = loadCreatorStoryWorldBundle(bundle, { checkedRevisionRef: "ppf:revision:13" });
  assert.equal(loaded.validation.launchAllowed, true);
  assert.equal(loaded.validation.checkedRevisionRef, "ppf:revision:13");

  const contaminated = structuredClone(bundle);
  contaminated.pieces[0].worldId = "world:other";
  assert.throws(
    () => loadCreatorStoryWorldBundle(contaminated),
    /another world/u,
  );
});

test("#1675 Phase 3 natural-language mechanics request remains untrusted until finite generated rule controls are admitted", () => {
  const request = createNaturalLanguageMechanicsProposalRequest({
    requestId: "creator-request:42",
    worldId: "world:lantern-workshop",
    creatorRef,
    prompt: "When the Keeper uses the key, open the gate.",
    targetPieceIds: ["world:lantern-workshop:piece:keeper", "world:lantern-workshop:piece:key"],
  });
  assert.equal(request.authoritative, false);
  assert.equal(request.allowedOutputContract, "story-rule-controls.v1");

  const proposal = createGeneratedRuleFromMechanicsProposal({
    request,
    agentRef: "agent:mechanics-proposer",
    proposedRuleControls: {
      id: "rule:generated-open-gate",
      title: "Open the gate",
      priority: 10,
      when: "action-accepted",
      conditions: [{ kind: "ref-exists", ref: "world:lantern-workshop:piece:key" }],
      costs: [],
      effects: [{ kind: "set-value", ref: "world:lantern-workshop:state:gate-open", value: true }],
      consequences: [],
      tools: ["shell"],
      connectors: ["github"],
    },
  });

  assert.equal(proposal.authoritative, false);
  assert.equal(proposal.rule.provenance.authorship, "generated-proposal");
  assert.deepEqual(proposal.rule.provenance.sourceRefs, ["creator-request:42"]);
  assert.equal(storyRuleIsAdmitted(proposal.rule), false);
  assert.equal("tools" in proposal.rule, false);
  assert.equal("connectors" in proposal.rule, false);
});

test("#1675 Phase 3 AI explanation can describe deterministic findings but cannot change launch authority", () => {
  const bundle = starter();
  const request = createValidatorExplanationRequest({
    requestId: "explain:starter:1",
    validationResult: bundle.validation,
  });
  assert.equal(request.authoritative, false);
  assert.equal(request.mayOverrideDeterministicResult, false);

  const explained = attachValidatorExplanation({
    request,
    explanation: "The starter passes because its required pieces, rule path and ending are deterministically connected.",
  });
  assert.equal(explained.explanationAuthoritative, false);
  assert.equal(explained.launchAllowed, bundle.validation.launchAllowed);
  assert.deepEqual(explained.deterministicResult.findings, bundle.validation.findings);
});

test("#1675 Phase 3 starter-world authoring introduces no provider call, arbitrary execution, connector or canon-write path", async () => {
  const source = await readFile(new URL("../modules/story-the-unwritten/creator/starter-world.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fetch\(|eval\(|new Function|child_process|OpenAI|Ollama|providerCredentials|connectorScopes|BUZZ_AUTH|ppf\.canon\.write|agent\.grant-authority/u);
});
