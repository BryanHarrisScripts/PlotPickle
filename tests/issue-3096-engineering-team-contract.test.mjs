import test from "node:test";
import assert from "node:assert/strict";
import {
  ENGINEERING_ROLES,
  admitEngineeringCampaign,
  engineeringObservation,
  engineeringHandoff,
  adjudicateEngineeringFinding,
  compareEngineeringArms,
} from "../scripts/engineering-team/contract.mjs";

const HEAD = "a".repeat(40);
const OTHER = "b".repeat(40);
function input(mode = "structured") {
  return {
    campaignId: "qa-campaign-1",
    taskRef: "pr-123",
    repository: "BryanHarrisScripts/PlotPickle",
    exactSha: HEAD,
    mode,
    roles: ["scout", "tester", "challenger", "reporter", "performance"],
    budget: { maxRoleRuns: 10, maxMessages: 12, maxSummaryChars: 400, maxDurationMs: 60000, maxCloudCostUsd: 0 },
  };
}
function observation(campaign, role, executorId, state = "reproduced", overrides = {}) {
  return engineeringObservation(campaign, {
    observationId: "obs-" + role,
    executorId,
    role,
    exactSha: HEAD,
    findingRef: "finding-001",
    state,
    summary: role + " observed the same reproducible regression",
    evidenceRefs: ["test:affected-contract", "log:reproduction"],
    ...overrides,
  });
}
function verifier(campaign, overrides = {}) {
  return {
    scopeHash: campaign.scopeHash,
    findingRef: "finding-001",
    exactSha: HEAD,
    passed: true,
    executorId: "deterministic-harness",
    evidenceRefs: ["ci:exact-head-regression"],
    ...overrides,
  };
}
test("admission reuses known roles, exact SHA, bounded non-mutating authority", () => {
  const admitted = admitEngineeringCampaign(input());
  assert.equal(admitted.exactSha, HEAD);
  assert.equal(admitted.sourceMutationAllowed, false);
  assert.equal(admitted.publicBuzzPostingAllowed, false);
  assert.equal(ENGINEERING_ROLES.length, 7);
  assert.equal(admitted.budget.maxCloudCostUsd, 0);
  assert.match(admitted.scopeHash, /^[a-f0-9]{64}$/);
  assert.throws(() => admitEngineeringCampaign({ ...input(), exactSha: "main" }), /exact commit SHA/);
  assert.throws(() => admitEngineeringCampaign({ ...input(), roles: ["scout", "tester"] }), /independent test and challenge/);
  assert.throws(() => admitEngineeringCampaign({ ...input(), sourceMutationAllowed: true }), /cannot grant write/);
  assert.throws(() => admitEngineeringCampaign({ ...input(), mergeAllowed: true }), /cannot grant write/);
  assert.throws(() => admitEngineeringCampaign({ ...input(), publicBuzzPostingAllowed: true }), /cannot grant write/);
  assert.throws(() => admitEngineeringCampaign({ ...input(), humanCredentialAccessAllowed: true }), /cannot grant write/);
  assert.throws(() => admitEngineeringCampaign({ ...input(), roles: ["scout", "tester", "challenger", "unknown"] }), /unknown role/);
});
test("paid work cannot activate unless separately approved", () => {
  const billable = input();
  billable.budget = { ...billable.budget, maxCloudCostUsd: 1.25 };
  assert.throws(() => admitEngineeringCampaign(billable), /explicit approval/);
  assert.equal(admitEngineeringCampaign({ ...billable, paidDispatchApproved: true }).budget.maxCloudCostUsd, 1.25);
});
test("observations remain unverified suggestions, stale heads and roles fail closed", () => {
  const admitted = admitEngineeringCampaign(input());
  const candidate = observation(admitted, "scout", "pi-scout", "candidate");
  assert.equal(candidate.verified, false);
  assert.throws(() => observation(admitted, "tester", "tester", "reproduced", { exactSha: OTHER }), /another commit/);
  assert.throws(() => observation(admitted, "repairer", "pi-repairer"), /role not admitted/);
  assert.throws(() => observation(admitted, "tester", "tester", "reproduced", { evidenceRefs: [] }), /requires actual evidence/);
  assert.throws(() => engineeringObservation(admitted, { ...candidate, state: "approved" }), /state invalid/);
});
test("lossy handoffs omit source refs, but carry scope, finding provenance and no authority", () => {
  const structured = admitEngineeringCampaign(input("structured"));
  const lossy = admitEngineeringCampaign(input("lossy"));
  const full = engineeringHandoff(structured, observation(structured, "scout", "pi-scout"), "challenger");
  const reduced = engineeringHandoff(lossy, observation(lossy, "scout", "pi-scout"), "challenger");
  assert.deepEqual(full.evidenceRefs, ["test:affected-contract", "log:reproduction"]);
  assert.deepEqual(reduced.evidenceRefs, []);
  assert.equal(reduced.evidenceReceiptCount, 2);
  assert.equal(reduced.trust, "untrusted-suggestion");
  assert.equal(reduced.grantsAuthority, false);
  assert.notEqual(structured.scopeHash, lossy.scopeHash);
  assert.throws(() => engineeringHandoff(lossy, observation(structured, "scout", "pi-scout"), "tester"), /outside its admitted scope/);
});
test("independent tester/challenger plus different deterministic verifier required for publishability", () => {
  const campaign = admitEngineeringCampaign(input());
  const tester = observation(campaign, "tester", "pi-test");
  const challenger = observation(campaign, "challenger", "cline-review");
  const noChallenge = adjudicateEngineeringFinding(campaign, {
    findingRef: "finding-001", observations: [tester], verifier: verifier(campaign),
  });
  assert.equal(noChallenge.status, "unverified");
  const sameExecutor = adjudicateEngineeringFinding(campaign, {
    findingRef: "finding-001",
    observations: [tester, observation(campaign, "challenger", "pi-test")],
    verifier: verifier(campaign),
  });
  assert.equal(sameExecutor.publishable, false);
  const noGate = adjudicateEngineeringFinding(campaign, {
    findingRef: "finding-001", observations: [tester, challenger], verifier: verifier(campaign, { exactSha: OTHER }),
  });
  assert.equal(noGate.publishable, false);
  const selfGate = adjudicateEngineeringFinding(campaign, {
    findingRef: "finding-001", observations: [tester, challenger], verifier: verifier(campaign, { executorId: "pi-test" }),
  });
  assert.equal(selfGate.publishable, false);
  const accepted = adjudicateEngineeringFinding(campaign, {
    findingRef: "finding-001", observations: [tester, challenger], verifier: verifier(campaign),
  });
  assert.equal(accepted.status, "verified");
  assert.equal(accepted.publishable, true);
  assert.equal(accepted.mergeEligible, false);
  const disputed = adjudicateEngineeringFinding(campaign, {
    findingRef: "finding-001",
    observations: [tester, challenger, observation(campaign, "scout", "scout-2", "disproved")],
    verifier: verifier(campaign),
  });
  assert.equal(disputed.status, "disputed");
  assert.equal(disputed.publishable, false);
  assert.throws(() => adjudicateEngineeringFinding(campaign, {
    findingRef: "finding-001", observations: [{ ...tester, exactSha: OTHER }], verifier: verifier(campaign),
  }), /stale or cross-campaign/);
});
test("message body redacts common secrets and truncates bounds", () => {
  const campaign = admitEngineeringCampaign(input());
  const value = observation(campaign, "scout", "pi-scout", "candidate", {
    summary: "Found credential sk-AAAAAAAAAAAAAAAAAAAA in output and ghp_12345678901234567890",
  });
  assert.doesNotMatch(value.summary, /sk-AAA|ghp_123/);
  assert.match(value.summary, /\[redacted\]/);
});
test("matched experimental arms compare measured outputs without deciding success", () => {
  const structured = admitEngineeringCampaign(input("structured"));
  const lossy = admitEngineeringCampaign(input("lossy"));
  const metrics = {
    structured: { messageBytes: 400, verifiedFindings: 2, falsePositives: 0 },
    lossy: { messageBytes: 180, verifiedFindings: 1, falsePositives: 1 },
  };
  const comparison = compareEngineeringArms(structured, lossy, metrics);
  assert.equal(comparison.superiorityProven, false);
  assert.equal(comparison.lossy.messageBytes, 180);
  assert.throws(() => compareEngineeringArms(structured, admitEngineeringCampaign({ ...input("lossy"), taskRef: "other" }), metrics), /share exact work/);
  assert.throws(() => compareEngineeringArms(structured, lossy, {
    ...metrics, lossy: { ...metrics.lossy, verifiedFindings: -1 },
  }), /independently measured/);
});
