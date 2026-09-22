import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { evaluateEvidenceUpdate } from "../build/dsdd/dsdd-evidence-contract.mjs";

const digest = "a".repeat(64);
const commit = "b".repeat(40);

function proof(overrides = {}) {
  return {
    ref: "artifact://architecture-run/123",
    summary: "Observed the locked requirement on the exact tested head.",
    proofType: "ci",
    finding: "supports",
    intentVersion: 4,
    intentDigest: digest,
    testedSource: "BryanHarrisScripts/PlotPickle",
    testedCommit: commit,
    observedResult: "The required behavior was observed.",
    ...overrides,
  };
}

test("#2331 PASS requires validated supporting evidence bound to the same locked intent and exact commit", () => {
  const result = evaluateEvidenceUpdate({
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
  const empty = evaluateEvidenceUpdate({ intentVersion: 4, intentDigest: digest, status: "PASS", evidence: [] });
  assert.equal(empty.status, "UNPROVEN");

  const wrongIntent = evaluateEvidenceUpdate({
    intentVersion: 4,
    intentDigest: digest,
    status: "PASS",
    evidence: [proof({ intentDigest: "c".repeat(64) })],
  });
  assert.equal(wrongIntent.status, "UNPROVEN");
  assert.equal(wrongIntent.evidence.length, 0);

  const invalidBuild = evaluateEvidenceUpdate({
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

  const claimedPass = evaluateEvidenceUpdate({
    intentVersion: 4,
    intentDigest: digest,
    status: "PASS",
    evidence: [proof(), contradiction],
  });
  assert.equal(claimedPass.status, "UNPROVEN");

  const fail = evaluateEvidenceUpdate({
    intentVersion: 4,
    intentDigest: digest,
    status: "FAIL",
    evidence: [contradiction],
  });
  assert.equal(fail.status, "FAIL");

  const unsupportedFail = evaluateEvidenceUpdate({
    intentVersion: 4,
    intentDigest: digest,
    status: "FAIL",
    evidence: [proof()],
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
