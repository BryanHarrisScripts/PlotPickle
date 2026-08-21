import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  CASEBOOK_P0_IDS,
  buildAdequacyReport,
  createCaseSemanticExecution,
  createExperienceRecord,
  evaluateCaseRun,
  loadCasebook,
  validateCaseDefinition,
  validateCasebook,
} from "../scripts/casebook-contract.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const casebookPath = path.join(repoRoot, "config", "casebook", "p0-cases.json");
const reportDir = path.join(repoRoot, "reports", "casebook-test");

function verifiedRun(caseDefinition, overrides = {}) {
  return {
    runId: `run:${caseDefinition.id}`,
    steps: caseDefinition.humanJourney.map((step) => ({ id: step.id, status: "pass" })),
    evidence: caseDefinition.requiredEvidence.map((item, index) => ({
      id: item.id,
      status: "verified",
      kind: item.kind,
      source: index === 0 ? caseDefinition.independentVerification.source : "casebook-observer",
      independent: index === 0,
    })),
    realIntegrationVerified: true,
    criticalInteractionsUnreached: 0,
    faultResults: [{ id: "known-fault", injected: true, detected: true }],
    ...overrides,
  };
}

test("#1234 Casebook loads exactly the five initial P0 Business Cases", async () => {
  const casebook = await loadCasebook(casebookPath);
  assert.equal(validateCasebook(casebook).valid, true);
  assert.deepEqual(casebook.cases.map((item) => item.id).sort(), [...CASEBOOK_P0_IDS].sort());
  assert.ok(casebook.cases.every((item) => item.priority === "P0"));
  assert.ok(casebook.cases.every((item) => item.independentVerification?.source));
});

test("#1234 incomplete Case definitions are rejected", async () => {
  const casebook = await loadCasebook(casebookPath);
  const broken = structuredClone(casebook.cases[0]);
  delete broken.expectedOutcome;
  broken.requiredEvidence = [];
  broken.independentVerification = {};
  const validation = validateCaseDefinition(broken);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join(" "), /expectedOutcome is required/i);
  assert.match(validation.errors.join(" "), /requiredEvidence must be a non-empty array/i);
  assert.match(validation.errors.join(" "), /independentVerification\.source is required/i);
});

test("#1234 a Case cannot PASS because a worker merely claims success", async () => {
  const casebook = await loadCasebook(casebookPath);
  const target = casebook.cases.find((item) => item.id === "buzz-connect-existing-identity");
  const result = evaluateCaseRun(target, {
    runId: "worker-claims-green",
    steps: target.humanJourney.map((step) => ({ id: step.id, status: "pass" })),
    evidence: target.requiredEvidence.map((item) => ({ id: item.id, status: "verified", source: "buzz-worker", independent: false })),
  });
  assert.notEqual(result.status, "pass");
  assert.equal(result.status, "uncertain");
  assert.equal(result.independentVerified, false);
});

test("#1234 missing named proof prevents PASS even when independent evidence exists", async () => {
  const casebook = await loadCasebook(casebookPath);
  const target = casebook.cases.find((item) => item.id === "comfyui-local-image-visible");
  const run = verifiedRun(target);
  run.evidence = run.evidence.filter((item) => item.id !== "visible-image");
  const result = evaluateCaseRun(target, run);
  assert.equal(result.status, "uncertain");
  assert.deepEqual(result.missingEvidence, ["visible-image"]);
});

test("#1234 contradictory observed outcome is FAIL, not green", async () => {
  const casebook = await loadCasebook(casebookPath);
  const target = casebook.cases.find((item) => item.id === "sage-local-text-usable-response");
  const run = verifiedRun(target, { outcomeContradicted: true });
  const result = evaluateCaseRun(target, run);
  assert.equal(result.status, "fail");
});

test("#1234 Semantic Execution is reused as the Case execution lifecycle", async () => {
  const casebook = await loadCasebook(casebookPath);
  const target = casebook.cases[0];
  const execution = createCaseSemanticExecution(target, { scope: { nodeId: "test-node" } });
  assert.equal(execution.phaseProfile.id, "casebook-business-verification-v1");
  assert.equal(execution.phaseProfile.initialPhase, "UNDERSTAND");
  assert.deepEqual(execution.phaseProfile.phases.VERIFY.transitions, ["COMPLETE", "REPAIR", "BLOCKED"]);
  assert.match(execution.intent.objective, /Human B cannot see or use Human A/i);
});

test("#1234 adequacy report is derived from Case results and does not fabricate unavailable rates", async () => {
  const casebook = await loadCasebook(casebookPath);
  const passCase = casebook.cases[0];
  const failCase = casebook.cases[1];
  const pass = evaluateCaseRun(passCase, verifiedRun(passCase));
  const fail = evaluateCaseRun(failCase, verifiedRun(failCase, { outcomeContradicted: true }));
  const report = buildAdequacyReport(casebook, [pass, fail], { generatedAt: "2026-08-21T22:00:00.000Z" });
  assert.equal(report.totals.p0CasesDefined, 5);
  assert.equal(report.totals.p0CasesWithResult, 2);
  assert.equal(report.totals.pass, 1);
  assert.equal(report.totals.fail, 1);
  assert.equal(report.metrics.journeyCompletionRate, 1 / 5);
  assert.equal(report.metrics.independentVerificationCoverage, 2 / 5);
  assert.equal(report.metrics.injectedFailureDetectionRate, 1);
  assert.equal(report.metrics.flakeRate, null);
  assert.equal(report.metrics.escapedDefectRate, null);
});

test("#1234 structured experience strips hidden reasoning and redacts secrets", () => {
  const record = createExperienceRecord({
    caseId: "buzz-connect-existing-identity",
    domain: "community",
    situation: "Connect an existing identity",
    expectedResult: "Connected",
    verifiedMismatch: "Signer did not persist",
    rootCause: "Persistence mapping",
    repair: "Bound identity to authenticated profile",
    regressionEvidence: ["tests/example.test.mjs"],
    failureSignature: "buzz-persist-mismatch",
    retrievalTags: ["buzz", "profile"],
    finalDisposition: "pass",
    evidence: [{ kind: "note", summary: "private_key=nsec1abcdefghijklmnop" }],
    reasoning: "private chain of thought",
    chainOfThought: "do not save this",
    privateKey: "nsec1abcdefghijklmnop",
    apiKey: "sk-supersecretvalue",
  });
  const text = JSON.stringify(record);
  assert.doesNotMatch(text, /private chain of thought|do not save this|nsec1abcdefghijklmnop|sk-supersecretvalue/);
  assert.equal("reasoning" in record, false);
  assert.equal("chainOfThought" in record, false);
  assert.equal(record.privateKey, "[REDACTED]");
  assert.equal(record.apiKey, "[REDACTED]");
});

test("#1234 CLI writes Human-readable and machine-readable adequacy reports", async () => {
  await rm(reportDir, { recursive: true, force: true });
  const result = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "run-casebook-adequacy.mjs"), "--casebook", casebookPath, "--output-dir", reportDir], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(await readFile(path.join(reportDir, "adequacy-report.json"), "utf8"));
  const markdown = await readFile(path.join(reportDir, "adequacy-report.md"), "utf8");
  assert.equal(report.totals.p0CasesDefined, 5);
  assert.equal(report.totals.p0CasesWithResult, 0);
  assert.equal(report.metrics.flakeRate, null);
  assert.match(markdown, /Critical business-case coverage: 100\.0%/);
  assert.match(markdown, /Flake rate: not measured/);
});
