import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAdequacyReport,
  loadCasebook,
} from "../scripts/casebook-contract.mjs";
import {
  CASEBOOK_REAL_INTEGRATION_IDS,
  CASEBOOK_REAL_INTEGRATION_SCHEMA_VERSION,
  assertCasebookFaultSafety,
  createCasebookFaultPlan,
  createRecordedRealMachineAdapter,
  evaluateCasebookFaultObservation,
  runCasebookRealIntegrationCase,
} from "../scripts/casebook-real-integrations.mjs";

function completeRecord(caseDefinition, options = {}) {
  const evidenceByStep = new Map(caseDefinition.humanJourney.map((step) => [step.id, []]));
  caseDefinition.requiredEvidence.forEach((proof, index) => {
    const step = caseDefinition.humanJourney[index % caseDefinition.humanJourney.length];
    evidenceByStep.get(step.id).push({
      id: proof.id,
      kind: proof.kind,
      status: "verified",
      source: `real-machine-${caseDefinition.id}-observer`,
      independent: false,
      ref: `artifact://${caseDefinition.id}/${proof.id}`,
      summary: `Observed required proof: ${proof.description}`,
    });
  });
  return {
    schemaVersion: CASEBOOK_REAL_INTEGRATION_SCHEMA_VERSION,
    caseId: caseDefinition.id,
    mode: "real-machine",
    steps: caseDefinition.humanJourney.map((step, index) => ({
      stepId: step.id,
      outcome: "pass",
      workerClaim: "pass",
      observed: `Real-machine observer confirmed ${step.action}`,
      interaction: index % 2 ? "pointer" : "observe",
      target: step.id,
      critical: true,
      beforeScreenshot: `${caseDefinition.id}-${step.id}-before.png`,
      afterScreenshot: `${caseDefinition.id}-${step.id}-after.png`,
      evidence: evidenceByStep.get(step.id),
    })),
    independentVerification: {
      id: `${caseDefinition.id}-independent-proof`,
      kind: "evaluation",
      status: "verified",
      source: caseDefinition.independentVerification.source,
      independent: true,
      ref: `observer://${caseDefinition.id}`,
      summary: caseDefinition.independentVerification.proves,
    },
    faults: [{
      label: caseDefinition.injectedFailureModes[0],
      outcome: options.faultOutcome || "fail",
      observed: `Injected fault was independently classified as ${options.faultOutcome || "fail"}.`,
    }],
  };
}

test("#1236 registers exactly the five P0 real-integration Case ids", async () => {
  const casebook = await loadCasebook();
  assert.deepEqual(CASEBOOK_REAL_INTEGRATION_IDS, casebook.cases.filter((item) => item.priority === "P0").map((item) => item.id));
});

test("#1236 all five P0 Cases can consume real-machine observations, independent proof and detected fault injection", async () => {
  const casebook = await loadCasebook();
  const results = [];
  for (const caseDefinition of casebook.cases.filter((item) => item.priority === "P0")) {
    const record = completeRecord(caseDefinition);
    const adapter = createRecordedRealMachineAdapter(caseDefinition, record);
    const run = await runCasebookRealIntegrationCase(caseDefinition, adapter, {
      runId: `${caseDefinition.id}:test-real-machine`,
      maxFaults: 1,
    });
    assert.equal(run.result.status, "pass", caseDefinition.id);
    assert.equal(run.result.realIntegrationVerified, true, caseDefinition.id);
    assert.equal(run.result.independentVerified, true, caseDefinition.id);
    assert.equal(run.faultResults.length, 1, caseDefinition.id);
    assert.equal(run.faultResults[0].detected, true, caseDefinition.id);
    results.push(run.result);
  }
  const report = buildAdequacyReport(casebook, results, { generatedAt: "2026-08-21T23:30:00.000Z" });
  assert.equal(report.metrics.realIntegrationCoverage, 1);
  assert.equal(report.metrics.independentVerificationCoverage, 1);
  assert.equal(report.metrics.injectedFailureDetectionRate, 1);
  assert.equal(report.metrics.journeyCompletionRate, 1);
  assert.equal(report.metrics.requiredOutcomeProofCoverage, 1);
});

test("#1236 an undetected injected fault keeps an otherwise green Case non-green", async () => {
  const casebook = await loadCasebook();
  const caseDefinition = casebook.cases.find((item) => item.id === "buzz-great-hall-signed-conversation");
  const record = completeRecord(caseDefinition, { faultOutcome: "pass" });
  const adapter = createRecordedRealMachineAdapter(caseDefinition, record);
  const run = await runCasebookRealIntegrationCase(caseDefinition, adapter, { maxFaults: 1 });
  assert.equal(run.faultResults[0].detected, false);
  assert.equal(run.result.realIntegrationVerified, false);
  assert.equal(run.result.status, "blocked");
  assert.match(run.result.blockers.join("\n"), /injected fault was not detected/i);
});

test("#1236 missing real-machine steps and missing independent proof cannot become PASS", async () => {
  const casebook = await loadCasebook();
  const caseDefinition = casebook.cases.find((item) => item.id === "comfyui-local-image-visible");
  const record = {
    schemaVersion: CASEBOOK_REAL_INTEGRATION_SCHEMA_VERSION,
    caseId: caseDefinition.id,
    mode: "real-machine",
    steps: [],
    faults: [{ label: caseDefinition.injectedFailureModes[0], outcome: "blocked", observed: "ComfyUI service intentionally stopped." }],
  };
  const adapter = createRecordedRealMachineAdapter(caseDefinition, record);
  const run = await runCasebookRealIntegrationCase(caseDefinition, adapter, { maxFaults: 1 });
  assert.notEqual(run.result.status, "pass");
  assert.equal(run.result.realIntegrationVerified, false);
  assert.ok(run.result.missingJourneySteps.length > 0);
  assert.equal(run.result.independentVerified, false);
});

test("#1236 fault injection is declared, reversible, test-scoped and only FAIL/BLOCKED counts as detected", async () => {
  const casebook = await loadCasebook();
  const caseDefinition = casebook.cases[0];
  const [fault] = createCasebookFaultPlan(caseDefinition, { maxFaults: 1 });
  assert.equal(assertCasebookFaultSafety(fault), true);
  assert.throws(() => assertCasebookFaultSafety({ ...fault, testScoped: false }), /test-scoped/i);
  assert.throws(() => assertCasebookFaultSafety({ ...fault, reversible: false }), /reversible/i);
  assert.equal(evaluateCasebookFaultObservation(fault, { outcome: "fail" }).detected, true);
  assert.equal(evaluateCasebookFaultObservation(fault, { outcome: "blocked" }).detected, true);
  assert.equal(evaluateCasebookFaultObservation(fault, { outcome: "uncertain" }).detected, false);
  assert.equal(evaluateCasebookFaultObservation(fault, { outcome: "pass" }).detected, false);
});

test("#1236 real-machine records redact private keys and hidden reasoning before evidence is retained", async () => {
  const casebook = await loadCasebook();
  const caseDefinition = casebook.cases.find((item) => item.id === "buzz-connect-existing-identity");
  const record = completeRecord(caseDefinition);
  record.steps[0].observed = "Connected nsec1abcdefghijklmnop with token=supersecret on C:\\Users\\realhuman\\PlotPickle";
  record.steps[0].evidence.push({
    id: "redaction-probe",
    kind: "trace",
    status: "verified",
    source: "test",
    summary: "apiKey=abcdefghi",
    metadata: { reasoning: "private hidden reasoning", prompt: "secret prompt" },
  });
  const adapter = createRecordedRealMachineAdapter(caseDefinition, record);
  const run = await runCasebookRealIntegrationCase(caseDefinition, adapter, { maxFaults: 1 });
  const serialized = JSON.stringify(run.manifest);
  assert.doesNotMatch(serialized, /nsec1abcdefghijklmnop|supersecret|realhuman|abcdefghi|private hidden reasoning|secret prompt/i);
  assert.match(serialized, /REDACTED|local-user/i);
});
