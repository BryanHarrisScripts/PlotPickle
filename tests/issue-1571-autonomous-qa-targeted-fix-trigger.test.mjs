import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { resolveAutonomousQaTargetedFix } from "../scripts/autonomous-qa/resolve-targeted-fix.mjs";

const FAILING = "a".repeat(40);
const FIX = "b".repeat(40);
const FINGERPRINT = `qa-defect-${"c".repeat(32)}`;

function defectBody(role = "visual-production", route = "storyboard", fingerprint = FINGERPRINT) {
  return [
    `<!-- plotpickle-autonomous-qa:${fingerprint} -->`,
    "Reproducible autonomous QA defect",
    "",
    `- Fingerprint: \`${fingerprint}\``,
    "- Severity: `major`",
    `- Tester role: \`${role}\``,
    `- Route: \`${route || "route-independent"}\``,
    `- Exact failing commit: \`${FAILING}\``,
    "- Build: `build-1571`",
    "- Assertion: `assertion:route-ready`",
    "- Expected ref: `expected:ready`",
    "- Actual ref: `actual:blocked`",
    "",
    "Reproduction evidence:",
    "- `repro:first`",
    "- `repro:second`",
    "",
    "Machine evidence:",
    "- `artifact:qa-run`",
  ].join("\n");
}

function pullRequest(body = "Fixes #15710", head = FIX) {
  return { body, head: { sha: head }, base: { ref: "main" } };
}

function issue(number, body, extra = {}) {
  return { number, body, html_url: `https://github.com/BryanHarrisScripts/PlotPickle/issues/${number}`, ...extra };
}

function fetchFor(issues) {
  return async (url) => {
    const number = Number(String(url).match(/\/issues\/(\d+)$/)?.[1]);
    const value = issues.get(number);
    return {
      ok: Boolean(value),
      status: value ? 200 : 404,
      json: async () => value || {},
    };
  };
}

test("#1571 linked autonomous defect resolves to its existing tester adapter on the exact fix head", async () => {
  const result = await resolveAutonomousQaTargetedFix({
    pullRequest: pullRequest(),
    repository: "BryanHarrisScripts/PlotPickle",
    token: "test-token",
    fetchImpl: fetchFor(new Map([[15710, issue(15710, defectBody())]])),
  });

  assert.equal(result.matched, true);
  assert.equal(result.campaignType, "targeted-rerun");
  assert.equal(result.fingerprint, FINGERPRINT);
  assert.equal(result.testerRole, "visual-production");
  assert.equal(result.adapter, "autonomous-story-reference");
  assert.equal(result.failingCommitSha, FAILING);
  assert.equal(result.fixCommitSha, FIX);
  assert.deepEqual(result.reproductionRefs, ["repro:first", "repro:second"]);
  assert.equal(result.sourceMutationAllowed, false);
  assert.equal(result.repairAuthorityGranted, false);
  assert.equal(result.mergeAuthorityGranted, false);
  assert.equal(result.deterministicGateRequired, true);
  assert.equal(result.aiSelfCertified, false);
});

test("#1571 all six tester roles map only to their already-owned execution adapters", async () => {
  const roles = new Map([
    ["fresh-install", "windows-installer"],
    ["beginner-writer", "focused-uat"],
    ["full-story-journey", "autonomous-story-reference"],
    ["visual-production", "autonomous-story-reference"],
    ["persistence-recovery", "autonomous-story-reference"],
    ["adversarial-boundary", "deterministic-boundary"],
  ]);
  let number = 16000;
  for (const [role, adapter] of roles) {
    number += 1;
    const result = await resolveAutonomousQaTargetedFix({
      pullRequest: pullRequest(`Closes #${number}`),
      repository: "BryanHarrisScripts/PlotPickle",
      token: "test-token",
      fetchImpl: fetchFor(new Map([[number, issue(number, defectBody(role, role === "fresh-install" ? "" : "story-workbench"))]])),
    });
    assert.equal(result.testerRole, role);
    assert.equal(result.adapter, adapter);
  }
});

test("#1571 ordinary PRs and ordinary linked Issues do not invent targeted reruns", async () => {
  let calls = 0;
  const noReference = await resolveAutonomousQaTargetedFix({
    pullRequest: pullRequest("Refs #15710"),
    repository: "BryanHarrisScripts/PlotPickle",
    token: "",
    fetchImpl: async () => { calls += 1; throw new Error("should not fetch"); },
  });
  assert.equal(noReference.matched, false);
  assert.equal(noReference.reason, "no-closing-issue-reference");
  assert.equal(calls, 0);

  const ordinaryIssue = await resolveAutonomousQaTargetedFix({
    pullRequest: pullRequest(),
    repository: "BryanHarrisScripts/PlotPickle",
    token: "test-token",
    fetchImpl: fetchFor(new Map([[15710, issue(15710, "Normal product issue without autonomous QA evidence.")]])),
  });
  assert.equal(ordinaryIssue.matched, false);
  assert.equal(ordinaryIssue.reason, "no-autonomous-defect-reference");
});

test("#1571 targeted rerun fails closed on same-head, ambiguous or malformed autonomous defects", async () => {
  await assert.rejects(
    resolveAutonomousQaTargetedFix({
      pullRequest: pullRequest("Fixes #15710", FAILING),
      repository: "BryanHarrisScripts/PlotPickle",
      token: "test-token",
      fetchImpl: fetchFor(new Map([[15710, issue(15710, defectBody())]])),
    }),
    /different exact commit/,
  );

  await assert.rejects(
    resolveAutonomousQaTargetedFix({
      pullRequest: pullRequest("Fixes #15710\nCloses #15711"),
      repository: "BryanHarrisScripts/PlotPickle",
      token: "test-token",
      fetchImpl: fetchFor(new Map([
        [15710, issue(15710, defectBody())],
        [15711, issue(15711, defectBody("beginner-writer", "learn", `qa-defect-${"d".repeat(32)}`))],
      ])),
    }),
    /exactly one linked autonomous defect/,
  );

  await assert.rejects(
    resolveAutonomousQaTargetedFix({
      pullRequest: pullRequest(),
      repository: "BryanHarrisScripts/PlotPickle",
      token: "test-token",
      fetchImpl: fetchFor(new Map([[15710, issue(15710, defectBody("invented-tester"))]])),
    }),
    /unsupported tester role/,
  );
});

test("#1571 targeted workflow reuses exact-head adapters and preserves tester/repair separation", async () => {
  const [workflow, storyWorkflow, windowsWorkflow, focusedWrapper, journeys] = await Promise.all([
    readFile(new URL("../.github/workflows/autonomous-qa-targeted-fix.yml", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/autonomous-story-reference.yml", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/windows-installer.yml", import.meta.url), "utf8"),
    readFile(new URL("../scripts/autonomous-qa/run-focused-targeted-rerun.mjs", import.meta.url), "utf8"),
    readFile(new URL("../build/autonomous-guest/qa/tester-journeys.ts", import.meta.url), "utf8"),
  ]);

  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /issues: read/);
  assert.doesNotMatch(workflow, /issues: write|pull-requests: write|contents: write/);
  assert.match(workflow, /github\.event\.pull_request\.head\.sha/);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/windows-installer\.yml/);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/autonomous-story-reference\.yml/);
  assert.match(workflow, /run-focused-targeted-rerun\.mjs/);
  assert.match(workflow, /issue-1553-autonomous-story-decision-authority\.test\.mjs/);
  assert.match(workflow, /issue-1569-autonomous-guest-task-lifecycle\.test\.mjs/);
  assert.match(workflow, /reproductionPassed:true/);
  assert.match(workflow, /repairAuthorityGranted:false/);
  assert.match(workflow, /aiSelfCertified:false/);

  for (const reusable of [storyWorkflow, windowsWorkflow]) {
    assert.match(reusable, /exact_head:/);
    assert.match(reusable, /ref: \$\{\{ inputs\.exact_head \|\| github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
  }
  assert.match(focusedWrapper, /createManagedPlotPickleLifecycle/);
  assert.match(focusedWrapper, /run-uat-autopilot\.mjs/);
  assert.match(focusedWrapper, /lifecycle\.start\(\)/);
  assert.match(focusedWrapper, /lifecycle\.stop\(\)/);

  for (const role of ["fresh-install", "beginner-writer", "full-story-journey", "visual-production", "persistence-recovery", "adversarial-boundary"]) {
    assert.ok(journeys.includes(`role: "${role}"`), role);
  }
});
