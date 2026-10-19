import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { admitEngineeringCampaign, engineeringObservation } from "../scripts/engineering-team/contract.mjs";
import {
  createEngineeringEvidenceState, readEngineeringEvidenceState, writeEngineeringEvidenceState,
} from "../scripts/engineering-team/evidence-state.mjs";

const HEAD = "a".repeat(40);
const OTHER_HEAD = "b".repeat(40);
const fixture = () => admitEngineeringCampaign({
  campaignId: "engineering-case-3123", taskRef: "issue-3123",
  repository: "BryanHarrisScripts/PlotPickle", exactSha: HEAD,
  mode: "structured", roles: ["tester", "challenger"],
  budget: { maxRoleRuns: 2, maxMessages: 3, maxSummaryChars: 800,
    maxDurationMs: 60_000, maxCloudCostUsd: 0 },
});
const withDir = (fn) => async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pp-engineering-restart-"));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
};
const observedResult = (campaign) => {
  const observations = campaign.roles.map((role, index) => engineeringObservation(campaign, {
    exactSha: campaign.exactSha,
    observationId: "observation-" + index, executorId: "fixture-executor-" + index,
    role, state: "reproduced", findingRef: "outline-selection-missing-3123",
    summary: "PRIVATE STORY TEXT SHOULD NEVER ENTER THE NEXT AGENT CONTEXT",
    evidenceRefs: ["artifact:windows-exact-head-3123-" + index],
  }));
  return {
    campaignId: campaign.campaignId, exactSha: campaign.exactSha, scopeHash: campaign.scopeHash,
    status: "observed", observations,
    roleResults: campaign.roles.map((role) => ({ role, status: "observed" })),
    verified: false, mergeEligible: false,
  };
};

test("#3126 exact-head restart packet contains only reference evidence, no prior agent prose or authority", withDir(async (root) => {
  const campaign = fixture(), receipt = observedResult(campaign);
  const state = createEngineeringEvidenceState(campaign, { result: receipt });
  assert.equal(state.state, "observed-unverified");
  assert.equal(state.independentProductVerification, "unproven");
  assert.equal(state.mergeEligible, false);
  assert.equal(state.startedUncertainMayReplay, false);
  assert.equal(state.modelDispatchAuthorized, false);
  assert.equal(state.sourceMutationAllowed, false);
  assert.deepEqual(state.observations[0].evidenceRefs, ["artifact:windows-exact-head-3123-0"]);
  assert.equal(JSON.stringify(state).includes("PRIVATE STORY TEXT"), false);
  assert.equal(JSON.stringify(state).includes("fixture-executor"), false);
  await writeEngineeringEvidenceState(root, state);
  const loaded = await readEngineeringEvidenceState(root, { scopeHash: campaign.scopeHash, exactSha: HEAD });
  assert.deepEqual(loaded, state);
  await assert.rejects(writeEngineeringEvidenceState(root, state), /EEXIST/);
  await assert.rejects(readEngineeringEvidenceState(root, { scopeHash: campaign.scopeHash, exactSha: OTHER_HEAD }), /stale|untrusted/u);
  await assert.rejects(readEngineeringEvidenceState(root, { scopeHash: "c".repeat(64), exactSha: HEAD }), /stale|untrusted/u);
}));

test("#3126 interrupted agent invocation results in BLOCKED and no automatic provider replay", withDir(async (root) => {
  const campaign = fixture();
  const state = createEngineeringEvidenceState(campaign, { failure: {
    code: "UNCERTAIN_STEP_REPLAY_DENIED", stage: "role-started",
    message: "SECRET TOKEN / private story bytes must be dropped",
  } });
  assert.equal(state.state, "blocked");
  assert.deepEqual(state.failure, { code: "UNCERTAIN_STEP_REPLAY_DENIED", stage: "role-started" });
  assert.deepEqual(state.observations, []);
  assert.equal(JSON.stringify(state).includes("SECRET TOKEN"), false);
  await writeEngineeringEvidenceState(root, state, { resume: true });
  const recovered = await readEngineeringEvidenceState(root, {
    scopeHash: campaign.scopeHash, exactSha: HEAD, resume: true,
  });
  assert.equal(recovered.startedUncertainMayReplay, false);
  assert.equal(recovered.mergeEligible, false);
}));

test("#3126 tampered status or digest fails closed and cannot manufacture a product PASS", withDir(async (root) => {
  const campaign = fixture();
  const state = createEngineeringEvidenceState(campaign, { result: observedResult(campaign) });
  await writeEngineeringEvidenceState(root, state);
  const file = path.join(root, "evidence-state.json");
  const tampered = JSON.parse(await readFile(file, "utf8"));
  tampered.independentProductVerification = "pass";
  tampered.mergeEligible = true;
  await writeFile(file, JSON.stringify(tampered));
  await assert.rejects(readEngineeringEvidenceState(root, {
    scopeHash: campaign.scopeHash, exactSha: HEAD,
  }), /untrusted/);
  assert.throws(() => createEngineeringEvidenceState(campaign, {
    result: { ...observedResult(campaign), roleResults: [{ role: "tester", status: "blocked" }] },
  }), /false observed/u);
}));

test("#3126 rejects mismatched role/campaign evidence, arbitrary failure text, oversized or symlinked packets", withDir(async (root) => {
  const campaign = fixture();
  const sample = observedResult(campaign);
  assert.throws(() => createEngineeringEvidenceState(campaign, {
    result: { ...sample, observations: [{ ...sample.observations[0], exactSha: OTHER_HEAD }] },
  }), /outside the admitted/u);
  assert.throws(() => createEngineeringEvidenceState(campaign, { failure: {
    code: "raw exception with private story", stage: "role-started",
  } }), /classified/u);
  const state = createEngineeringEvidenceState(campaign, { result: sample });
  await writeFile(path.join(root, "outside.json"), JSON.stringify(state));
  await symlink(path.join(root, "outside.json"), path.join(root, "evidence-state.json"));
  await assert.rejects(readEngineeringEvidenceState(root, { scopeHash: campaign.scopeHash, exactSha: HEAD }), /ordinary private receipt/u);
  await rm(path.join(root, "evidence-state.json"));
  await writeFile(path.join(root, "evidence-state.json"), "x".repeat(32 * 1024 + 2));
  await assert.rejects(readEngineeringEvidenceState(root, { scopeHash: campaign.scopeHash, exactSha: HEAD }), /ordinary private receipt/u);
}));

test("#3126 existing Engineering Team saves evidence on every terminal branch and exposes read-only CLI only", async () => {
  const [runner, reporting] = await Promise.all([
    readFile(new URL("../scripts/engineering-team/run-local.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/engineering-team/operator-reporting.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(runner, /createEngineeringEvidenceState\(campaign, \{ failure: classified \}\)/u);
  assert.match(runner, /createEngineeringEvidenceState\(campaign, \{ result \}\)/u);
  assert.match(runner, /writeEngineeringEvidenceState\(runDir,/u);
  assert.match(reporting, /--fresh-restart/u);
  assert.match(reporting, /readEngineeringEvidenceState\(runDir/u);
  assert.doesNotMatch(reporting, /startWindowsUat\(|startComfyUi\(|merge_pull_request|adapter\.run\(/u);
});
