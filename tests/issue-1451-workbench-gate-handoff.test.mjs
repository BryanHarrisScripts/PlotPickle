import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { summarizeLocalGateEvidence } from "../Utilities/DeveloperWorkbench/local-gate-status.mjs";

const read = (relative) => readFile(new URL(`../${relative}`, import.meta.url), "utf8");
const [workbench, workbenchPath, buildScript, workflow, readme, preCommit] = await Promise.all([
  read("Utilities/DeveloperWorkbench/WorkbenchV2.cs"),
  read("Utilities/DeveloperWorkbench/WorkbenchPath.cs"),
  read("Utilities/DeveloperWorkbench/build.ps1"),
  read(".github/workflows/developer-workbench.yml"),
  read("Utilities/DeveloperWorkbench/README.md"),
  read("scripts/developer-diagnostics/gates/pre-commit.mjs"),
]);

function gate(overrides = {}) {
  return {
    schemaVersion: 1,
    gateId: "plotpickle-pre-commit",
    status: "fail",
    scope: "staged-files",
    indexTree: "a".repeat(40),
    stagedFiles: ["modules/story/example.ts"],
    completedSteps: ["staged-diff-integrity"],
    failure: {
      rule: "changed-test-selection",
      reason: "The staged paths have no safe focused test plan.",
      rerun: "node scripts/developer-diagnostics/test-changed.mjs --plan --files modules/story/example.ts",
      secret: "must-not-survive",
    },
    privatePrompt: "must-not-survive",
    ...overrides,
  };
}

test("#1451 exposes only current deterministic failures as repair-eligible evidence", () => {
  const report = summarizeLocalGateEvidence(gate(), { currentIndexTree: "a".repeat(40), hooksEnabled: true });
  assert.equal(report.state, "red");
  assert.equal(report.current, true);
  assert.equal(report.repairEligible, true);
  assert.equal(report.evidence.failure.rule, "changed-test-selection");
  assert.equal(JSON.stringify(report).includes("must-not-survive"), false);

  const stale = summarizeLocalGateEvidence(gate(), { currentIndexTree: "b".repeat(40), hooksEnabled: true });
  assert.equal(stale.state, "stale");
  assert.equal(stale.repairEligible, false);
  assert.equal(stale.evidence, null);
});

test("#1451 rejects unknown failure authority instead of handing it to Pi", () => {
  const report = summarizeLocalGateEvidence(gate({ failure: { rule: "ai-review-opinion", reason: "A model disliked the code." } }), {
    currentIndexTree: "a".repeat(40),
    hooksEnabled: true,
  });
  assert.equal(report.state, "blocked");
  assert.equal(report.repairEligible, false);
  assert.equal(report.evidence, null);
});

test("#1451 keeps deterministic local-gate status separate from AI reviewer status", () => {
  assert.match(workbench, /new ToolStripLabel\("LOCAL GATE UNKNOWN"\)/);
  assert.match(workbench, /Refresh local gate/);
  assert.match(workbench, /RefreshLocalGateAsync/);
  assert.match(workbench, /localGateEvidence/);
  assert.match(workbench, /RepairEligible/);
  assert.match(workbench, /Scan selected will pass this confirmed failure to the chosen local reviewer/);
  assert.match(workbench, /Local gate refreshed independently from AI reviewer readiness/);
  assert.doesNotMatch(workbench, /RepairEligible\s*=\s*report\.Pi\.Ready/);
});

test("#1451 packages the bounded gate reader and keeps heavy validation separate", () => {
  assert.match(workbenchPath, /local-gate-status\.mjs/);
  assert.match(buildScript, /local-gate-status\.mjs/);
  assert.match(workflow, /issue-1451-workbench-gate-handoff\.test\.mjs/);
  assert.match(readme, /LOCAL GATE/);
  assert.match(readme, /confirmed deterministic failure evidence/);
  assert.match(preCommit, /indexTree/);
  assert.doesNotMatch(workbench, /run-ben-code-quality|build-verified|repomix@/i);
});
