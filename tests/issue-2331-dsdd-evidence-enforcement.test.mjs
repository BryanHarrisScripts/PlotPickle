import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { evaluateEvidenceUpdate } from "../build/dsdd/dsdd-evidence-contract.mjs";

const digest = "a".repeat(64);
const commit = "b".repeat(40);
const verification = {requirementId: "R1", promise: "The required behavior", testedCommit: commit,
  environment: "test-environment", configuration: "test-configuration", verifierSource: "independent-observer",
  verifiedArtifactRefs: ["artifact://architecture-run/123"]};

function proof(overrides = {}) {
  return {
    ref: "artifact://architecture-run/123",
    summary: "Observed the locked requirement on the exact tested head.",
    proofType: "runtime",
    finding: "supports",
    intentVersion: 4,
    intentDigest: digest,
    testedSource: "BryanHarrisScripts/PlotPickle",
    testedCommit: commit,
    observedResult: "The required behavior was observed.",
    requirementId: "R1", promise: "The required behavior", action: "Exercise the workflow",
    environment: "test-environment", configuration: "test-configuration", source: "independent-observer",
    independent: true, simulated: false, scope: "real-product-observation",
    ...overrides,
  };
}

test("#2331 PASS requires validated supporting evidence bound to the same locked intent and exact commit", () => {
  const result = evaluateEvidenceUpdate({ ...verification,
    intentVersion: 4,
    intentDigest: digest,
    status: "PASS",
    evidence: [proof()],
  });
  assert.equal(result.status, "PASS");
  assert.equal(result.evidence.length, 1);
  assert.equal(result.evidence[0].testedCommit, commit);
});

test("#2331 empty, mismatched, or stale proof cannot become PASS", () => {
  const empty = evaluateEvidenceUpdate({ ...verification, intentVersion: 4, intentDigest: digest, status: "PASS", evidence: [] });
  assert.equal(empty.status, "UNPROVEN");

  const wrongIntent = evaluateEvidenceUpdate({ ...verification,
    intentVersion: 4,
    intentDigest: digest,
    status: "PASS",
    evidence: [proof({ intentDigest: "c".repeat(64) })],
  });
  assert.equal(wrongIntent.status, "UNPROVEN");
  assert.equal(wrongIntent.evidence.length, 0);

  const invalidBuild = evaluateEvidenceUpdate({ ...verification,
    intentVersion: 4,
    intentDigest: digest,
    status: "PASS",
    evidence: [proof({ testedCommit: "not-an-exact-head" })],
  });
  assert.equal(invalidBuild.status, "UNPROVEN");
  assert.equal(invalidBuild.evidence.length, 0);
});

test("#2331 contradictory evidence prevents PASS and is required for FAIL", () => {
  const contradiction = proof({ finding: "contradicts", observedResult: "The observed behavior contradicted the locked requirement." });

  const claimedPass = evaluateEvidenceUpdate({ ...verification,
    intentVersion: 4,
    intentDigest: digest,
    status: "PASS",
    evidence: [proof(), contradiction],
  });
  assert.equal(claimedPass.status, "FAIL");

  const fail = evaluateEvidenceUpdate({ ...verification,
    intentVersion: 4,
    intentDigest: digest,
    status: "FAIL",
    evidence: [contradiction],
  });
  assert.equal(fail.status, "FAIL");

  const unsupportedFail = evaluateEvidenceUpdate({ ...verification,
    intentVersion: 4,
    intentDigest: digest,
    status: "FAIL",
    evidence: [proof({ proofType: "ci" })],
  });
  assert.equal(unsupportedFail.status, "UNPROVEN");
});

test("#2331 gateway delegates status resolution to the deterministic evidence contract", async () => {
  const gateway = await readFile(new URL("../build/dsdd/dsdd-session-gateway.ts", import.meta.url), "utf8");
  assert.match(gateway, /evaluateEvidenceUpdate/u);
  assert.match(gateway, /intentDigest: packet\.intentDigest/u);
  assert.doesNotMatch(gateway, /requirement\.status = status/u);
  assert.doesNotMatch(gateway, /intent\.understoodMeaning\s*=/u);
});
