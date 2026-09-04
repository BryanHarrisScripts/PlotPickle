import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  admitGeneratedStoryRuleProposal,
  createCreatorStoryPiece,
  createGeneratedStoryRuleProposal,
  createHumanStoryRuleFromControls,
  describeStoryRuleMechanics,
  editCreatorStoryPiece,
  storyRuleIsAdmitted,
} from "../modules/story-the-unwritten/creator/authoring.mjs";
import { validateCreatorGameForLaunch } from "../modules/story-the-unwritten/creator/preflight.mjs";

const now = "2026-09-04T18:00:00.000Z";
const creatorRef = "profile:creator";

function humanRule() {
  return createHumanStoryRuleFromControls({
    id: "rule:open-gate",
    title: "Open the gate when Mara has the key",
    priority: 10,
    when: "action-accepted",
    conditions: [{ kind: "ref-exists", ref: "object:key" }],
    costs: [],
    effects: [{ kind: "set-value", ref: "state:gate-open", value: true }],
    consequences: [],
    creatorRef,
  });
}

function generatedRuleProposal() {
  return createGeneratedStoryRuleProposal({
    id: "rule:open-gate",
    title: "Open the gate when Mara has the key",
    priority: 10,
    when: "action-accepted",
    conditions: [{ kind: "ref-exists", ref: "object:key" }],
    costs: [],
    effects: [{ kind: "set-value", ref: "state:gate-open", value: true }],
    consequences: [],
    creatorRef: "agent:mechanics-proposer",
    sourceRefs: ["creator-request:17"],
  });
}

function characterPiece() {
  return createCreatorStoryPiece({
    id: "piece:mara",
    type: "character",
    title: "Mara",
    description: "A traveler carrying an old brass key.",
    worldId: "world:lantern",
    schools: ["character"],
    tags: ["traveler"],
    ruleIds: ["rule:open-gate"],
    creatorRef,
    createdAt: now,
  });
}

function game(ruleIds = ["rule:open-gate"]) {
  return {
    id: "game:lantern",
    schemaVersion: 1,
    worldId: "world:lantern",
    title: "Lantern Game",
    sceneCount: 5,
    startingPieceIds: ["piece:mara", "object:key"],
    ruleIds,
    endConditionRefs: ["end:gate-open"],
    resolutionLimits: {
      maximumTriggerDepth: 4,
      maximumOperationsPerScene: 24,
      maximumAgentCallsPerTurn: 2,
    },
    compatibility: {
      storySchemaVersion: 1,
      minimumEngineVersion: "1",
      featureIds: [],
      requiredCapabilityRefs: [],
    },
    provenance: {
      authorship: "human",
      creatorRef,
      sourceRefs: [],
      admittedByRef: null,
      admittedAt: null,
    },
  };
}

function objectPiece() {
  return createCreatorStoryPiece({
    id: "object:key",
    type: "object",
    title: "Brass Key",
    description: "Opens the gate.",
    worldId: "world:lantern",
    schools: ["plot"],
    tags: ["key"],
    creatorRef,
    createdAt: now,
  });
}

function ending() {
  return {
    ref: "end:gate-open",
    definition: {
      id: "end:gate-open",
      schemaVersion: 1,
      priority: 10,
      outcome: "victory",
      if: [{ kind: "value-equals", ref: "state:gate-open", value: true }],
      enabled: true,
    },
  };
}

function state() {
  return {
    revision: 0,
    values: {},
    characterLocations: { "piece:mara": "location:gate" },
    objectCustody: { "object:key": "piece:mara" },
    knowledgeByCharacter: { "piece:mara": [] },
    relationships: {},
    openThreads: [],
  };
}

test("#1675 Phase 3 creator controls create one of the six supported Story Piece types without JSON authority fields", () => {
  const piece = characterPiece();
  assert.equal(piece.type, "character");
  assert.equal(piece.title, "Mara");
  assert.equal(piece.provenance.authorship, "human");
  assert.equal(piece.agentBinding, null);
  for (const forbidden of ["tools", "connectors", "credentials", "runtime", "ppfWriteAuthority"]) {
    assert.equal(forbidden in piece, false);
  }
  assert.throws(
    () => createCreatorStoryPiece({
      id: "piece:world-rule",
      type: "world-rule",
      title: "Too early",
      worldId: "world:lantern",
      creatorRef,
      createdAt: now,
    }),
    /do not support Story Piece type/u,
  );
});

test("#1675 Phase 3 direct piece editing changes story-facing fields but not identity, world, type or provenance", () => {
  const original = characterPiece();
  const updated = editCreatorStoryPiece(original, {
    title: "Mara Vale",
    description: "A traveler who has decided to use the key.",
    tags: ["traveler", "key-bearer"],
  }, { creatorRef, updatedAt: "2026-09-04T18:10:00.000Z" });

  assert.equal(updated.id, original.id);
  assert.equal(updated.worldId, original.worldId);
  assert.equal(updated.type, original.type);
  assert.equal(updated.createdAt, original.createdAt);
  assert.equal(updated.provenance.creatorRef, original.provenance.creatorRef);
  assert.equal(updated.title, "Mara Vale");
  assert.throws(
    () => editCreatorStoryPiece(original, { id: "piece:other" }, { creatorRef, updatedAt: now }),
    /cannot change id/u,
  );
});

test("#1675 Phase 3 ordinary creator rule controls compile only into the existing finite rule grammar", () => {
  const rule = humanRule();
  assert.deepEqual(Object.keys(rule).sort(), ["cost", "do", "enabled", "id", "if", "priority", "provenance", "schemaVersion", "then", "title", "when"].sort());
  assert.equal(rule.when, "action-accepted");
  assert.equal(rule.if[0].kind, "ref-exists");
  assert.equal(rule.do[0].kind, "set-value");
  assert.equal(storyRuleIsAdmitted(rule), true);

  const injected = createHumanStoryRuleFromControls({
    id: "rule:safe",
    title: "Safe",
    when: "action-accepted",
    effects: [],
    creatorRef,
    arbitraryCode: "process.exit()",
    tools: ["shell"],
  });
  assert.equal("arbitraryCode" in injected, false);
  assert.equal("tools" in injected, false);
});

test("#1675 Phase 3 AI mechanics remain a non-authoritative proposal until explicit Human admission", () => {
  const proposal = generatedRuleProposal();
  assert.equal(proposal.kind, "story-rule-proposal");
  assert.equal(proposal.authoritative, false);
  assert.equal(proposal.rule.provenance.authorship, "generated-proposal");
  assert.equal(proposal.rule.provenance.admittedByRef, null);
  assert.equal(storyRuleIsAdmitted(proposal.rule), false);
  assert.throws(
    () => admitGeneratedStoryRuleProposal({ proposal, approved: false, approvedByRef: creatorRef, approvedAt: now }),
    /explicit Human approval/u,
  );

  const admitted = admitGeneratedStoryRuleProposal({
    proposal,
    approved: true,
    approvedByRef: creatorRef,
    approvedAt: "2026-09-04T18:20:00.000Z",
  });
  assert.equal(admitted.provenance.authorship, "generated-proposal");
  assert.equal(admitted.provenance.admittedByRef, creatorRef);
  assert.equal(storyRuleIsAdmitted(admitted), true);
});

test("#1675 Phase 3 creator launch preflight rejects a structurally valid generated rule until admission", () => {
  const proposal = generatedRuleProposal();
  const input = {
    gameDefinition: game(),
    pieces: [characterPiece(), objectPiece()],
    rules: [proposal.rule],
    endConditions: [ending()],
    initialState: state(),
    hostCapabilityRefs: [],
    checkedRevisionRef: "ppf:revision:9",
  };
  const pending = validateCreatorGameForLaunch(input);
  assert.equal(pending.launchAllowed, false);
  assert.ok(pending.findings.some((finding) => finding.code === "STORY_RULE_NOT_ADMITTED"));
  assert.ok(!pending.findings.some((finding) => finding.code === "STORY_PREFLIGHT_PASS"));

  const admitted = admitGeneratedStoryRuleProposal({
    proposal,
    approved: true,
    approvedByRef: creatorRef,
    approvedAt: "2026-09-04T18:20:00.000Z",
  });
  const accepted = validateCreatorGameForLaunch({ ...input, rules: [admitted] });
  assert.equal(accepted.launchAllowed, true);
  assert.ok(accepted.findings.some((finding) => finding.code === "STORY_PREFLIGHT_PASS"));
});

test("#1675 Phase 3 visible rule meaning is deterministic and never hidden only in an AI prompt", () => {
  const description = describeStoryRuleMechanics(humanRule());
  assert.equal(description.authoritative, true);
  assert.deepEqual(description.rows.map((row) => row.stage), ["WHEN", "IF", "COST", "DO", "THEN"]);
  assert.deepEqual(description.rows[0].items, ["action-accepted"]);
  assert.deepEqual(description.rows[1].items, ["object:key exists"]);
  assert.deepEqual(description.rows[3].items, ["set state:gate-open to true"]);
});

test("#1675 Phase 3 creator authoring has no AI provider, arbitrary execution, connector or direct canon-write dependency", async () => {
  const [authoring, preflight] = await Promise.all([
    readFile(new URL("../modules/story-the-unwritten/creator/authoring.mjs", import.meta.url), "utf8"),
    readFile(new URL("../modules/story-the-unwritten/creator/preflight.mjs", import.meta.url), "utf8"),
  ]);
  const source = `${authoring}\n${preflight}`;
  assert.doesNotMatch(source, /fetch\(|eval\(|new Function|child_process|OpenAI|Ollama|providerCredentials|connectorScopes|BUZZ_AUTH|ppf\.canon\.write|agent\.grant-authority/u);
});
