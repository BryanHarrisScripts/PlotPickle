import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildDiagnosticPacket,
  planChangedTests,
  summarizeFailureEvidence,
  validateAgentProposal,
} from "../scripts/developer-diagnostics/index.mjs";

const fixture = JSON.parse(await readFile(new URL("./fixtures/developer-diagnostics/pr-239-regression.json", import.meta.url), "utf8"));
const registry = JSON.parse(await readFile(new URL("../config/developer-diagnostics.json", import.meta.url), "utf8"));

function settingsEvidence() {
  return fixture.settingsFailures.map((testFile, index) => ({
    id: `pr239-settings-${index + 1}`,
    name: `PR #239 stale Settings contract in ${testFile}`,
    message: fixture.settingsFailureEvidence.normalizedMessage,
    classification: fixture.settingsFailureEvidence.classification,
    testFile,
    contracts: [fixture.settingsFailureEvidence.contract],
    evidenceSource: fixture.settingsFailureEvidence.source,
  }));
}

test("PR #239 is a read-only provenance-tagged regression subject", () => {
  assert.equal(fixture.readOnly, true);
  assert.equal(fixture.repository, "BryanHarrisScripts/PlotPickle");
  assert.equal(fixture.pullRequest, 239);
  assert.match(fixture.settingsCorrectionCommit, /^[a-f0-9]{40}$/);
  assert.match(fixture.windowsCorrectionCommit, /^[a-f0-9]{40}$/);
  assert.equal(fixture.windowsArtifactId, 8804877753);
  assert.equal(fixture.settingsFailures.length, 9);
});

test("PR #239 changed files select Settings and Windows diagnostics without a full-suite escape", () => {
  const plan = planChangedTests(fixture.changedFiles, registry, {
    source: "github-pr-fixture",
    base: fixture.baseCommit,
    head: fixture.windowsCorrectionCommit,
  });
  const areas = plan.areas.map((area) => area.id).sort();
  assert.deepEqual(areas, fixture.expected.areas);
  assert.equal(plan.safeFallback, null);
  assert.match(plan.commandText, /^node --test /);
  assert.doesNotMatch(plan.commandText, /npm test/);
  assert.ok(plan.suites.includes("tests/settings-menu.test.mjs"));
  assert.ok(plan.suites.includes("tests/windows-release-smoke.test.mjs"));
  assert.equal(plan.requiresHumanApprovalForFullSuite, true);
});

test("PR #239 Nine stale assertions collapse into one shared Settings contract cause", () => {
  const summary = summarizeFailureEvidence(settingsEvidence(), registry, {
    source: "github-pr-fixture",
    provenance: {
      pullRequest: fixture.pullRequest,
      commit: fixture.settingsCorrectionCommit,
      jobId: fixture.failedJobId,
    },
  });
  assert.equal(summary.counts.failures, fixture.expected.settingsFailureCount);
  assert.equal(summary.counts.affectedFiles, fixture.expected.settingsFailureCount);
  assert.equal(summary.counts.clusters, fixture.expected.settingsClusterCount);
  assert.equal(summary.clusters[0].classification, "test-contract");
  assert.equal(summary.clusters[0].sharedCause, true);
  assert.equal(summary.clusters[0].count, 9);
  assert.deepEqual(summary.clusters[0].contracts, ["settings.controls"]);
  assert.ok(summary.failures.every((failure) => failure.contracts[0].owners.some((owner) => owner.path === fixture.expected.settingsOwner)));
  assert.ok(summary.focusedCommand.every((part) => part !== "npm" && part !== "test"));
});

test("PR #239 Windows artifact keeps environment and stale smoke-contract failures separate", () => {
  const records = fixture.windowsFailureEvidence.map((failure) => ({
    ...failure,
    contracts: [failure.contract],
    evidenceSource: failure.source,
  }));
  const summary = summarizeFailureEvidence(records, registry, {
    source: "github-workflow-artifact",
    provenance: {
      pullRequest: fixture.pullRequest,
      jobId: fixture.windowsFailedJobId,
      artifactId: fixture.windowsArtifactId,
    },
  });
  assert.equal(summary.counts.failures, 2);
  assert.equal(summary.counts.clusters, 2);
  assert.equal(summary.failures.find((failure) => failure.id === "pr239-windows-interaction")?.classification, "environment");
  assert.equal(summary.failures.find((failure) => failure.id === "pr239-windows-settings-navigation")?.classification, "test-contract");
  assert.ok(summary.failures.every((failure) => failure.contracts.some((contract) => contract.id === "packaging.smoke")));
  assert.match(summary.failures[0].message, /Browser did not become ready within 8000 ms/);
  assert.match(summary.failures[1].message, /GitHub Story Repository item did not become true within 10000 ms/);
});

test("PR #239 evidence cannot push the diagnosis agent outside the matched path", () => {
  const plan = planChangedTests(fixture.changedFiles, registry, { source: "github-pr-fixture" });
  const summary = summarizeFailureEvidence(settingsEvidence(), registry, { source: "github-pr-fixture" });
  const packet = buildDiagnosticPacket(summary, plan, registry);
  const baseProposal = {
    action: "focused-test",
    decision: "continue",
    diagnosis: "Verify the registered Settings controls owner against the nine affected tests.",
    evidence: [summary.failures[0].id],
    paths: [],
    command: summary.focusedCommand,
  };
  assert.equal(validateAgentProposal(baseProposal, packet, registry, []).valid, true);

  const escaped = validateAgentProposal({
    ...baseProposal,
    paths: [fixture.expected.agentMustRejectPath],
  }, packet, registry, []);
  assert.match(escaped.errors.join("\n"), /outside the diagnosed scope/i);

  const broad = validateAgentProposal({
    ...baseProposal,
    command: ["npm", "test"],
  }, packet, registry, []);
  assert.match(broad.errors.join("\n"), /not one of the focused commands/i);
});
