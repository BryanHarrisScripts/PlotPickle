import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeStoryDecisionAuthority,
  storyDecisionAuthorityAudit,
} from "../core/story-workflow/story-decisions/autonomous-authority.mjs";

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

test("invalid or incomplete autonomous authority fails closed", () => {
  assert.throws(() => normalizeStoryDecisionAuthority(null), /must be an object/);
  assert.throws(() => normalizeStoryDecisionAuthority({ authorityClass: "system" }), /authority class is invalid/);
  assert.throws(
    () => normalizeStoryDecisionAuthority({
      authorityClass: "delegated-autonomous-operator",
      delegated: true,
      autonomousRunId: "autonomous-afterglow-1",
      operatorId: "plotpickle-autonomous-editor",
      provider: "local",
      runtime: "llama.cpp",
    }),
    /model ID is required/,
  );
});
