import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { admitEngineeringCampaign } from "../scripts/engineering-team/contract.mjs";
import { executeEngineeringTeam } from "../scripts/engineering-team/execution.mjs";
import { readLocalBuzzActivity } from "../scripts/buzz-live-activity.mjs";
import {
  recordEngineeringLocalHandoffs,
  measureEngineeringCommunicationArms,
} from "../scripts/engineering-team/buzz-experiment.mjs";

const SHA = "f".repeat(40);
function campaign(mode) {
  return admitEngineeringCampaign({
    campaignId: "team-" + mode,
    taskRef: "pr-3099",
    exactSha: SHA,
    repository: "BryanHarrisScripts/PlotPickle",
    mode, roles: ["tester", "challenger"],
    budget: { maxRoleRuns: 2, maxMessages: 4, maxSummaryChars: 500, maxDurationMs: 30000, maxCloudCostUsd: 0 },
  });
}
async function runFor(team) {
  const adapters = Object.fromEntries(team.roles.map((role) => [role, {
    executorId: role === "tester" ? "test-fixture" : "challenge-fixture",
    async run() {
      return {
        observationId: "obs-" + role,
        findingRef: "candidate-1",
        state: "candidate",
        summary: role + " reviewer text must remain in the private source ledger: not posted to Buzz.",
        evidenceRefs: ["test-evidence:a", "test-evidence:b"],
      };
    },
  }]));
  return executeEngineeringTeam(team, { getExactHead: async () => SHA, adapters });
}
test("structured and lossy same-input arms measure actual serialised payload bytes, no winner or defect proof", async () => {
  const structured = campaign("structured"), lossy = campaign("lossy");
  const one = await runFor(structured), two = await runFor(lossy);
  const measured = measureEngineeringCommunicationArms(structured, one, lossy, two);
  assert.equal(measured.structured.handoffs, 1);
  assert.equal(measured.lossy.handoffs, 1);
  assert.ok(measured.structured.messageBytes > measured.lossy.messageBytes);
  assert.equal(measured.structured.roleObservations, 2);
  assert.equal(measured.defectDetectionEffect, null);
  assert.equal(measured.falsePositiveRate, null);
  assert.equal(measured.conclusion, "not-established");
  assert.equal(measured.independentlyVerified, false);
  assert.equal(measured.mergeEligible, false);
});
test("mismatched commit, task, roster/budget and stale/partial results are not comparable", async () => {
  const structured = campaign("structured"), lossy = campaign("lossy");
  const one = await runFor(structured), two = await runFor(lossy);
  const mismatch = admitEngineeringCampaign({
    ...lossy, campaignId: "different-campaign", taskRef: "another-task",
  });
  assert.throws(() => measureEngineeringCommunicationArms(structured, one, mismatch, two), /equal commit/);
  assert.throws(() => measureEngineeringCommunicationArms(structured, one, lossy, { ...two, status: "blocked" }), /blocked, stale or partial/);
  assert.throws(() => measureEngineeringCommunicationArms(structured, { ...one, exactSha: "1".repeat(40) }, lossy, two), /admitted campaign\/head/);
  assert.throws(() => measureEngineeringCommunicationArms(structured, one, lossy, { ...two, roleResults: [] }), /blocked, stale or partial/);
});
test("handoffs are recorded only to the local BUZZ journal and never post private model text", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-buzz-experiment-"));
  try {
    const team = campaign("lossy"), run = await runFor(team);
    const receipt = await recordEngineeringLocalHandoffs(team, run, { localRoot: root });
    assert.equal(receipt.localRecorded, 1);
    assert.equal(receipt.externalSigned, false);
    assert.equal(receipt.remoteBuzzDelivered, false);
    assert.equal(receipt.verificationGranted, false);
    const events = await readLocalBuzzActivity({ localRoot: root });
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "agent.note");
    assert.equal(events[0].actorId, "rook-ironquill");
    assert.equal(events[0].verified, false);
    assert.equal(events[0].actionable, false);
    assert.equal(events[0].route, "great-hall");
    assert.match(events[0].summary, /local lossy handoff/);
    assert.doesNotMatch(events[0].summary, /private source ledger|test-evidence/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test("privilege escalation, corrupted/cross-scope receipts, missing local path and external mirroring reject", async () => {
  const team = campaign("structured"), run = await runFor(team);
  const root = path.join(os.tmpdir(), "plotpickle-buzz-experiment-fixture");
  await assert.rejects(recordEngineeringLocalHandoffs(team, run, {}), /explicit local evidence/);
  await assert.rejects(recordEngineeringLocalHandoffs(team, { ...run, exactSha: "1".repeat(40) }, { localRoot: root }), /does not match/);
  await assert.rejects(recordEngineeringLocalHandoffs(team, {
    ...run, handoffs: [{ ...run.handoffs[0], grantsAuthority: true }],
  }, { localRoot: root }), /privilege-raising/);
  await assert.rejects(recordEngineeringLocalHandoffs(team, run, {
    localRoot: root, record: async () => ({ ok: true, buzzMirrored: true }),
  }), /strictly local/);
});
test("badly formed lossy copied evidence is rejected without local write", async () => {
  const team = campaign("lossy"), run = await runFor(team);
  let called = false;
  await assert.rejects(recordEngineeringLocalHandoffs(team, {
    ...run, handoffs: [{ ...run.handoffs[0], evidenceRefs: ["unauthorized:raw"] }],
  }, {
    localRoot: path.join(os.tmpdir(), "plotpickle-buzz-experiment-fixture"),
    record: async () => { called = true; return { ok: true }; },
  }), /privilege-raising/);
  assert.equal(called, false);
});
