import test from "node:test";
import assert from "node:assert/strict";
import { admitEngineeringCampaign } from "../scripts/engineering-team/contract.mjs";
import { executeEngineeringTeam } from "../scripts/engineering-team/execution.mjs";
const SHA = "c".repeat(40);
function campaign(mode = "structured", roles = ["scout", "tester", "challenger", "reporter"]) {
  return admitEngineeringCampaign({
    campaignId: "run-3096",
    taskRef: "pr-3096",
    repository: "BryanHarrisScripts/PlotPickle",
    exactSha: SHA,
    mode, roles,
    budget: { maxRoleRuns: 7, maxMessages: 12, maxSummaryChars: 250, maxDurationMs: 30000, maxCloudCostUsd: 0 },
  });
}
const ids = { scout: "pi-scout", tester: "autonomous-qa", challenger: "cline-review", reporter: "herald" };
function adapters(calls = []) {
  return Object.fromEntries(Object.entries(ids).map(([role, executorId]) => [role, {
    executorId,
    async run(request) {
      calls.push(request);
      return {
        observationId: "obs-" + role,
        findingRef: "finding-123",
        state: ["tester", "challenger"].includes(role) ? "reproduced" : "candidate",
        summary: role + " role observation",
        evidenceRefs: ["gate:exact-head"],
        // Attempting to attach elevated authority to an output does nothing.
        mergeAllowed: true,
        verified: true,
      };
    },
  }]));
}
test("read-only team calls admitted adapters in order and cannot self-certify", async () => {
  const calls = [];
  const result = await executeEngineeringTeam(campaign(), {
    getExactHead: async () => SHA,
    adapters: adapters(calls),
  });
  assert.equal(result.status, "observed");
  assert.equal(result.verified, false);
  assert.equal(result.mergeEligible, false);
  assert.equal(result.publishedExternally, false);
  assert.equal(result.roleResults.length, 4);
  assert.deepEqual(calls.map((item) => item.role), ["scout", "tester", "challenger", "reporter"]);
  assert.ok(calls.every((item) => item.permissions.mergeAllowed === false));
  assert.ok(result.observations.every((item) => item.verified === false && !("mergeAllowed" in item)));
  assert.equal(result.handoffs.length, 3);
  assert.deepEqual(result.handoffs[0].evidenceRefs, ["gate:exact-head"]);
});
test("lossy mode shares a compact summary but not evidence references", async () => {
  const result = await executeEngineeringTeam(campaign("lossy"), {
    getExactHead: async () => SHA,
    adapters: adapters(),
  });
  assert.equal(result.status, "observed");
  assert.deepEqual(result.handoffs[0].evidenceRefs, []);
  assert.equal(result.handoffs[0].evidenceReceiptCount, 1);
  assert.deepEqual(result.observations[0].evidenceRefs, ["gate:exact-head"]);
});
test("same model identity cannot count as independent test and challenge", async () => {
  const workers = adapters();
  workers.challenger.executorId = ids.tester;
  const result = await executeEngineeringTeam(campaign(), {
    getExactHead: async () => SHA, adapters: workers,
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.roleResults.find((item) => item.role === "challenger").reason, "independent-executor-required");
});
test("head moving during execution prevents an observed success", async () => {
  let calls = 0;
  const result = await executeEngineeringTeam(campaign(), {
    getExactHead: async () => (++calls < 2 ? SHA : "d".repeat(40)),
    adapters: adapters(),
  });
  assert.equal(result.status, "stale");
  assert.equal(result.verified, false);
  assert.equal(result.observations.length, 0);
});
test("missing providers, failed adapters and invalid role output are BLOCKED", async () => {
  const missing = await executeEngineeringTeam(campaign(), { getExactHead: async () => SHA, adapters: {} });
  assert.equal(missing.status, "blocked");
  assert.ok(missing.roleResults.every((entry) => entry.status === "blocked"));
  const broken = adapters();
  broken.scout.run = async () => { throw Error("deliberate failure"); };
  broken.tester.run = async () => ({ state: "reproduced", findingRef: "finding-123", summary: "No evidence", observationId: "obs-tester", evidenceRefs: [] });
  const result = await executeEngineeringTeam(campaign(), { getExactHead: async () => SHA, adapters: broken });
  assert.equal(result.roleResults[0].reason, "adapter-failed");
  assert.equal(result.roleResults[1].reason, "invalid-role-output");
  assert.equal(result.status, "blocked");
});
test("disallowed write role remains blocked even if an adapter exists", async () => {
  const team = campaign("structured", ["scout", "tester", "challenger", "repairer"]);
  const workers = adapters();
  workers.repairer = { executorId: "pi-repair", run: async () => { throw Error("must not run"); } };
  const result = await executeEngineeringTeam(team, { getExactHead: async () => SHA, adapters: workers });
  assert.equal(result.status, "blocked");
  assert.equal(result.roleResults.at(-1).reason, "adapter-unavailable-or-write-required");
});
test("caller cancellation does not invent output or retry work", async () => {
  const controller = new AbortController();
  controller.abort();
  const result = await executeEngineeringTeam(campaign(), {
    getExactHead: async () => SHA,
    adapters: adapters(), signal: controller.signal,
  });
  assert.equal(result.status, "cancelled");
  assert.equal(result.observations.length, 0);
});
