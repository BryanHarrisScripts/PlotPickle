import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { admitEngineeringCampaign, engineeringObservation } from "../scripts/engineering-team/contract.mjs";
import {
  readEngineeringOperatorStatus,
  draftEngineeringGithubCandidate,
} from "../scripts/engineering-team/operator-reporting.mjs";

const SHA = "e".repeat(40);
function campaign() {
  return admitEngineeringCampaign({
    campaignId: "eng-3100", taskRef: "pr-3100",
    exactSha: SHA, repository: "BryanHarrisScripts/PlotPickle",
    mode: "structured", roles: ["tester", "challenger"],
    budget: { maxRoleRuns: 2, maxMessages: 3, maxSummaryChars: 500, maxDurationMs: 60000, maxCloudCostUsd: 0 },
  });
}
function roles(team, state = "reproduced") {
  return team.roles.map((role) => engineeringObservation(team, {
    exactSha: SHA, role,
    observationId: "obs-" + role,
    executorId: "real-" + role,
    findingRef: "candidate-123",
    state,
    summary: "Private model text sk-AAAAAAAAAAAAAAAAAAAAAAAA is not a public Github report.",
    evidenceRefs: ["private:repro-one"],
  }));
}
function verifier(team) {
  return {
    exactSha: SHA, scopeHash: team.scopeHash, findingRef: "candidate-123",
    executorId: "independent-deterministic-ci",
    passed: true, evidenceRefs: ["ci:confirmed-reproduction"],
  };
}
test("read-only operator status reads private run receipts without provider probes or fictional green", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-engineering-status-"));
  try {
    const one = "1".repeat(64), two = "2".repeat(64);
    for (const name of [one, two]) await mkdir(path.join(root, "engineering-team", "runs", name), { recursive: true });
    await writeFile(path.join(root, "engineering-team", "runs", one, "receipt.json"), JSON.stringify({
      schemaVersion: 1, exactSha: SHA, scopeHash: one, status: "observed",
      roleResults: [{ role: "tester", status: "observed" }, { role: "challenger", status: "observed" }],
      localBuzz: { localRecorded: 1, externalSigned: false },
      verified: true, mergeEligible: true, // even malicious/stale metadata never grants authority
    }));
    await writeFile(path.join(root, "engineering-team", "runs", two, "receipt.json"), JSON.stringify({
      schemaVersion: 1, exactSha: "bad", scopeHash: two, status: "observed", roleResults: [],
    }));
    const result = await readEngineeringOperatorStatus({ appRoot: root });
    assert.equal(result.totalIndexed, 2);
    assert.equal(result.statuses.observed, 1);
    assert.equal(result.statuses.unknown, 1);
    assert.equal(result.providerReadiness, "not-probed");
    assert.equal(result.remoteBuzzAgentSigner, "unproven");
    assert.equal(result.independentFindingVerification, "not-inferred");
    assert.equal(result.continuousScheduler, "not-enabled");
    assert.equal(result.mergeEligible, false);
    assert.equal(result.runs.find((run) => run.status === "observed").evidenceAuthority, "advisory-local-run");
  } finally { await rm(root, { recursive: true, force: true }); }
});
test("empty private root is unknown, not a working live team", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-engineering-empty-"));
  try {
    const result = await readEngineeringOperatorStatus({ appRoot: root });
    assert.equal(result.totalIndexed, 0);
    assert.equal(result.last, null);
    assert.equal(result.mergeEligible, false);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test("positive independent evidence yields only a duplicate-safe, unpublishable GitHub draft", () => {
  const team = campaign();
  const finding = draftEngineeringGithubCandidate(team, "candidate-123", roles(team), verifier(team));
  assert.equal(finding.state, "candidate-only");
  assert.equal(finding.githubPublished, false);
  assert.equal(finding.mergeEligible, false);
  assert.equal(finding.draft.authorizedToPublish, false);
  assert.match(finding.fingerprint, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(finding.draft), /sk-AAA|Private model text|private:repro-one/);
  const duplicate = draftEngineeringGithubCandidate(team, "candidate-123", roles(team), verifier(team), [finding.fingerprint]);
  assert.equal(duplicate.state, "duplicate");
  assert.equal(duplicate.draft, null);
});
test("missing independent corroboration, stale verifier, shared identity and disputed claims never propose publication", () => {
  const team = campaign(), items = roles(team);
  const noReviewer = draftEngineeringGithubCandidate(team, "candidate-123", items.slice(0, 1), verifier(team));
  assert.equal(noReviewer.state, "blocked");
  const staleVerifier = draftEngineeringGithubCandidate(team, "candidate-123", items, { ...verifier(team), exactSha: "f".repeat(40) });
  assert.equal(staleVerifier.draft, null);
  const sameExecutor = draftEngineeringGithubCandidate(team, "candidate-123", [{ ...items[0], executorId: "same" }, { ...items[1], executorId: "same" }], verifier(team));
  assert.equal(sameExecutor.draft, null);
  const disputed = draftEngineeringGithubCandidate(team, "candidate-123", [
    ...items, { ...items[0], observationId: "counterevidence", state: "disproved" },
  ], verifier(team));
  assert.equal(disputed.state, "blocked");
});
