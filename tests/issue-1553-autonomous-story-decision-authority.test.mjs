import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeStoryDecisionAuthority,
  normalizeStoryDecisionAuthority,
  storyDecisionAuthorityAudit,
} from "../core/story-workflow/story-decisions/autonomous-authority.mjs";
import {
  createStoryDecisionFromCouncilResult,
  createStoryDecisionResponse,
} from "../core/story-workflow/story-decisions/core.mjs";
import {
  normalizeStoryChangePackage,
  reviewStoryChangePackage,
} from "../core/story-workflow/workbench/core.mjs";

const autonomousAuthority = {
  authorityClass: "delegated-autonomous-operator",
  delegated: true,
  autonomousRunId: "autonomous-afterglow-1",
  operatorId: "plotpickle-autonomous-editor",
  modelRole: "quality",
  modelId: "local-quality-model",
  provider: "local",
  runtime: "llama.cpp",
};

const autonomousPolicy = {
  enabled: true,
  allowStoryDecisionResponses: true,
  autonomousRunId: "autonomous-afterglow-1",
  projectId: "afterglow-v9",
};

test("Human Story Decision authority remains explicit and non-autonomous", () => {
  const authority = normalizeStoryDecisionAuthority({
    authorityClass: "authenticated-human",
    humanProfileId: "human-local-profile",
  });
  assert.equal(authority.authorityClass, "authenticated-human");
  assert.equal(authority.humanProfileId, "human-local-profile");
  assert.equal(authority.delegated, false);
  assert.equal(authority.autonomousRunId, "");
});

test("delegated autonomous authority requires explicit delegation and complete operator provenance", () => {
  assert.throws(
    () => normalizeStoryDecisionAuthority({
      authorityClass: "delegated-autonomous-operator",
      autonomousRunId: "autonomous-afterglow-1",
      operatorId: "plotpickle-autonomous-editor",
      modelId: "local-quality-model",
      provider: "local",
      runtime: "llama.cpp",
    }),
    /explicitly enabled/,
  );

  const authority = normalizeStoryDecisionAuthority({
    authorityClass: "delegated-autonomous-operator",
    delegated: true,
    autonomousRunId: "autonomous-afterglow-1",
    operatorId: "plotpickle-autonomous-editor",
    modelRole: "quality",
    modelId: "local-quality-model",
    provider: "local",
    runtime: "llama.cpp",
  });
  assert.equal(authority.authorityClass, "delegated-autonomous-operator");
  assert.equal(authority.delegated, true);
  assert.equal(authority.humanProfileId, "");
  assert.equal(authority.autonomousRunId, "autonomous-afterglow-1");
  assert.equal(authority.operatorId, "plotpickle-autonomous-editor");
});

test("delegated autonomous authority cannot impersonate an authenticated Human", () => {
  assert.throws(
    () => normalizeStoryDecisionAuthority({
      authorityClass: "delegated-autonomous-operator",
      delegated: true,
      humanProfileId: "human-local-profile",
      autonomousRunId: "autonomous-afterglow-1",
      operatorId: "plotpickle-autonomous-editor",
      modelId: "local-quality-model",
      provider: "local",
      runtime: "llama.cpp",
    }),
    /cannot impersonate an authenticated Human/,
  );
});

test("authenticated Human authority cannot carry autonomous operator identity", () => {
  assert.throws(
    () => normalizeStoryDecisionAuthority({
      authorityClass: "authenticated-human",
      humanProfileId: "human-local-profile",
      autonomousRunId: "autonomous-afterglow-1",
      operatorId: "plotpickle-autonomous-editor",
    }),
    /cannot carry autonomous operator identity/,
  );
});

test("authority audit remains non-canon and Workbench-bound", () => {
  const audit = storyDecisionAuthorityAudit({
    authorityClass: "delegated-autonomous-operator",
    delegated: true,
    autonomousRunId: "autonomous-afterglow-1",
    operatorId: "plotpickle-autonomous-editor",
    modelRole: "quality",
    modelId: "local-quality-model",
    provider: "local",
    runtime: "llama.cpp",
  });
  assert.equal(audit.writesCanon, false);
  assert.equal(audit.requiresWorkbenchValidation, true);
  assert.equal(audit.authorityClass, "delegated-autonomous-operator");
});

test("delegated authority must match an explicitly enabled project run policy", () => {
  assert.throws(
    () => authorizeStoryDecisionAuthority(autonomousAuthority, {}, "afterglow-v9"),
    /not enabled by run policy/,
  );
  assert.throws(
    () => authorizeStoryDecisionAuthority(autonomousAuthority, {
      enabled: true,
      allowStoryDecisionResponses: true,
      autonomousRunId: "another-run",
      projectId: "afterglow-v9",
    }, "afterglow-v9"),
    /does not match the enabled run policy/,
  );
  const enabled = authorizeStoryDecisionAuthority(autonomousAuthority, autonomousPolicy, "afterglow-v9");
  assert.equal(enabled.operatorId, "plotpickle-autonomous-editor");
});

test("delegated response remains non-canon and reaches Workbench with full authority provenance", () => {
  const decision = createStoryDecisionFromCouncilResult({
    projectId: "afterglow-v9",
    now: "2026-08-30T14:00:00.000Z",
    councilResult: {
      decisionClass: "bounded-proposal",
      requiresHuman: true,
      humanGate: "material-choice",
      workItemId: "work-afterglow-17",
      baseRevision: "9",
      targetRefs: ["ppf:foundations:lesson:answer"],
      evidenceRefs: ["evidence:block-17"],
      positions: [{ proposal: "Clarify Ren's choice in Block 17.", severity: "medium" }],
    },
  });
  assert.ok(decision);
  const answered = createStoryDecisionResponse(decision, {
    responseClass: "accept-proposal",
    currentRevision: "9",
    authority: autonomousAuthority,
    autonomousPolicy,
    rationale: "The proposal resolves the supported causal gap without changing the ending.",
    respondedAt: "2026-08-30T14:01:00.000Z",
  });
  assert.equal(answered.response.authorityClass, "delegated-autonomous-operator");
  assert.equal(answered.response.humanAuthority, "");
  assert.equal(answered.response.writesCanon, false);

  const storyPackage = normalizeStoryChangePackage({
    projectId: "afterglow-v9",
    decisionId: decision.decisionId,
    responseId: answered.response.responseId,
    responseClass: "accept-proposal",
    baseRevision: 9,
    targetRefs: decision.targetRefs,
    operation: {
      targetRef: decision.targetRefs[0],
      beforeValue: "",
      value: decision.proposedChange,
      author: "agent-proposed",
    },
    evidenceRefs: decision.evidenceRefs,
    provenance: {
      authority: answered.response.authority,
      rationale: answered.response.rationale,
    },
  });
  assert.equal(storyPackage.provenance.authorityClass, "delegated-autonomous-operator");
  assert.equal(storyPackage.provenance.humanProfileId, "");
  assert.equal(storyPackage.provenance.autonomousRunId, "autonomous-afterglow-1");
  const review = reviewStoryChangePackage({
    package: storyPackage,
    currentRevision: 9,
    projectMatches: true,
    targetOwned: true,
    frontierEditable: true,
  });
  assert.equal(review.canApply, true);
  assert.match(review.axes[0].summary, /delegated autonomous response/);
});

test("invalid or incomplete autonomous authority fails closed", () => {
  assert.throws(() => normalizeStoryDecisionAuthority(null), /must be an object/);
  assert.throws(() => normalizeStoryDecisionAuthority({ authorityClass: "system" }), /authority class is invalid/);
  assert.throws(
    () => normalizeStoryDecisionAuthority({
      authorityClass: "delegated-autonomous-operator",
      delegated: true,
      autonomousRunId: "autonomous-afterglow-1",
      operatorId: "plotpickle-autonomous-editor",
      modelRole: "quality",
      provider: "local",
      runtime: "llama.cpp",
    }),
    /model ID is required/,
  );
});
