import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  DEVELOPMENT_RUN_LEDGER_MARKER,
  renderDevelopmentRunLedger,
  validateDevelopmentRunLedger,
} from "../scripts/development-run-ledger.mjs";

const root = process.cwd();
const read = (file) => readFile(path.join(root, file), "utf8");
const HEAD = "0123456789abcdef0123456789abcdef01234567";
const OTHER_HEAD = "89abcdef0123456789abcdef0123456789abcdef";

function run(overrides = {}) {
  return {
    issue: 1903,
    pr: 9999,
    branch: "issue-1903-development-run-ledger",
    headSha: HEAD,
    state: "WORKING",
    currentStep: "Rendering the persistent PR ledger",
    gates: {
      pr: { status: "PENDING", headSha: null },
      product: { status: "PENDING", headSha: null },
    },
    changedFiles: ["scripts/development-run-ledger.mjs"],
    nextActions: ["Run the focused regression"],
    lastAction: "Added the deterministic renderer.",
    updatedAt: "2026-09-11T17:30:00Z",
    ...overrides,
  };
}

test("#1903 renders one stable Human-visible development ledger", () => {
  const markdown = renderDevelopmentRunLedger(run());
  assert.match(markdown, new RegExp(DEVELOPMENT_RUN_LEDGER_MARKER.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  assert.match(markdown, /## PlotPickle Development Run/u);
  assert.match(markdown, /🔵 \*\*WORKING\*\*/u);
  assert.match(markdown, /\| PR Gate \| ⚪ PENDING/u);
  assert.match(markdown, /\| Product Gate \| ⚪ PENDING/u);
  assert.match(markdown, /single Human-visible execution ledger/u);
  assert.match(markdown, /Update it in place/u);
});

test("#1903 READY requires both required gates green on the exact current head", () => {
  const valid = validateDevelopmentRunLedger(run({
    state: "READY",
    currentStep: "Both required gates are green on the current head",
    gates: {
      pr: { status: "SUCCESS", headSha: HEAD },
      product: { status: "SUCCESS", headSha: HEAD },
    },
  }));
  assert.equal(valid.valid, true);

  const stale = validateDevelopmentRunLedger(run({
    state: "READY",
    currentStep: "Stale gate result must not authorize merge",
    gates: {
      pr: { status: "SUCCESS", headSha: OTHER_HEAD },
      product: { status: "SUCCESS", headSha: HEAD },
    },
  }));
  assert.equal(stale.valid, false);
  assert.match(stale.errors.join("\n"), /READY requires PR Gate SUCCESS on the current head SHA/u);

  const failed = validateDevelopmentRunLedger(run({
    state: "READY",
    currentStep: "Failed gate must not authorize merge",
    gates: {
      pr: { status: "SUCCESS", headSha: HEAD },
      product: { status: "FAILURE", headSha: HEAD },
    },
  }));
  assert.equal(failed.valid, false);
  assert.match(failed.errors.join("\n"), /READY requires Product Gate SUCCESS on the current head SHA/u);
});

test("#1903 MERGED requires GitHub-confirmed merge evidence", () => {
  const missingEvidence = validateDevelopmentRunLedger(run({
    state: "MERGED",
    currentStep: "Merge claimed without GitHub evidence",
    gates: {
      pr: { status: "SUCCESS", headSha: HEAD },
      product: { status: "SUCCESS", headSha: HEAD },
    },
  }));
  assert.equal(missingEvidence.valid, false);
  assert.match(missingEvidence.errors.join("\n"), /merge\.confirmed=true/u);
  assert.match(missingEvidence.errors.join("\n"), /merge\.sha/u);

  const confirmed = validateDevelopmentRunLedger(run({
    state: "MERGED",
    currentStep: "GitHub confirmed the merge",
    gates: {
      pr: { status: "SUCCESS", headSha: HEAD },
      product: { status: "SUCCESS", headSha: HEAD },
    },
    merge: { confirmed: true, sha: OTHER_HEAD },
  }));
  assert.equal(confirmed.valid, true);
  assert.match(renderDevelopmentRunLedger({
    ...run(),
    state: "MERGED",
    currentStep: "GitHub confirmed the merge",
    gates: {
      pr: { status: "SUCCESS", headSha: HEAD },
      product: { status: "SUCCESS", headSha: HEAD },
    },
    merge: { confirmed: true, sha: OTHER_HEAD },
  }), /Confirmed by GitHub/u);
});

test("#1903 WAITING and BLOCKED states require visible reasons", () => {
  const invalidWaiting = validateDevelopmentRunLedger(run({
    state: "WAITING",
    currentStep: "Waiting without an active gate",
    gates: {
      pr: { status: "SUCCESS", headSha: HEAD },
      product: { status: "SUCCESS", headSha: HEAD },
    },
  }));
  assert.equal(invalidWaiting.valid, false);
  assert.match(invalidWaiting.errors.join("\n"), /WAITING requires at least one required gate/u);

  const invalidBlocked = validateDevelopmentRunLedger(run({
    state: "BLOCKED",
    currentStep: "Blocked without explanation",
  }));
  assert.equal(invalidBlocked.valid, false);
  assert.match(invalidBlocked.errors.join("\n"), /BLOCKED requires blocker/u);
});

test("#1903 repository rules define observable build-test-fix-merge semantics", async () => {
  const [agents, loop, brief, workflow] = await Promise.all([
    read("AGENTS.md"),
    read("docs/architecture/PLOTPICKLE-DEVELOPMENT-LOOP.md"),
    read("docs/developer-briefs/1903-development-run-ledger.md"),
    read(".github/workflows/pr-gate.yml"),
  ]);

  assert.match(agents, /PlotPickle Development Run/u);
  assert.match(agents, /WORKING.*WAITING.*FIXING.*BLOCKED.*READY.*MERGED/su);
  assert.match(agents, /build, test, fix and merge when green/u);
  assert.match(agents, /same current head SHA/u);
  assert.match(agents, /single persistent PR comment/u);
  assert.match(agents, /hidden reasoning/u);

  assert.match(loop, /Observable execution ledger/u);
  assert.match(loop, /plotpickle-development-run-ledger:v1/u);
  assert.match(loop, /update the existing ledger comment/u);
  assert.match(loop, /PR Gate and Product Gate/u);

  assert.match(brief, /No product UI or runtime dependency/u);
  assert.match(brief, /READY.*same current head SHA/su);
  assert.match(brief, /MERGED.*GitHub/su);

  assert.match(workflow, /Validate development run ledger contract/u);
  assert.match(workflow, /issue-1903-development-run-ledger\.test\.mjs/u);
});
