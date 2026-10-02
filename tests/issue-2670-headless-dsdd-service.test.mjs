import assert from "node:assert/strict";
import test from "node:test";
import {
  applyDsddRequirementEvidence,
  evaluateDsddConvergence,
  normalizeDsddHeadlessContract,
  requestDsddVerificationJourney,
} from "../core/sidecars/dsdd-governance-service.ts";

function contract(overrides = {}) {
  return normalizeDsddHeadlessContract({
    intentId: "intent-2670",
    humanIntent: "Keep DSDD governance available without a dedicated UAT interface.",
    developerBrief: "Run deterministic checks and preserve Human authority.",
    affectedSurfaces: ["Learn", "Mind Map"],
    requirements: [
      { id: "r1", text: "Exact-head CI is green.", status: "UNPROVEN", requiredEvidence: ["ci:exact-head"], evidenceRefs: [] },
    ],
    ...overrides,
  });
}

test("#2670 headless DSDD normalizes intent without any UI dependency", () => {
  const value = contract();
  assert.equal(value.schemaVersion, 1);
  assert.equal(value.repositoryMutationAuthority, "unchanged");
  assert.equal(value.piAuthority, "advisory-read-only");
});

test("#2670 missing evidence prevents false convergence", () => {
  const value = normalizeDsddHeadlessContract({
    intentId: "i",
    humanIntent: "intent",
    developerBrief: "brief",
    requirements: [{ id: "r", text: "must pass", status: "PASS", requiredEvidence: ["ci:exact-head"], evidenceRefs: [] }],
    exactHeadVerified: true,
  });
  assert.equal(evaluateDsddConvergence(value).state, "unproven");
  assert.deepEqual(evaluateDsddConvergence(value).missingEvidence, [{ requirementId: "r", evidenceClass: "ci:exact-head" }]);
});

test("#2670 failed deterministic requirement cannot be painted green and Pi cannot decide", () => {
  const failed = normalizeDsddHeadlessContract({
    intentId: "i",
    humanIntent: "intent",
    developerBrief: "brief",
    requirements: [{ id: "r", text: "must pass", status: "FAIL" }],
  });
  assert.throws(() => applyDsddRequirementEvidence(failed, "r", { status: "PASS", source: "deterministic", evidenceRefs: [] }), /cannot be marked green/);
  assert.throws(() => applyDsddRequirementEvidence(contract(), "r1", { status: "PASS", source: "pi", evidenceRefs: ["ci:exact-head"] }), /advisory/);
});

test("#2670 DSDD can request a named browser verification journey through the local contract", () => {
  const request = requestDsddVerificationJourney(contract(), "mind-map-theme-learn");
  assert.equal(request.operation, "rendered-acceptance");
  assert.equal(request.target, "mind-map-theme-learn");
});
