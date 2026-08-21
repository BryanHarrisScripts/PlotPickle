import {
  appendCaseEvidenceArtifact,
  appendCaseEvidenceStep,
  completeCaseEvidenceManifest,
  createCaseEvidenceManifest,
  evaluateCaseEvidenceManifest,
  redactCaseEvidence,
} from "./casebook-evidence.mjs";
import { CASEBOOK_P0_IDS, validateCaseDefinition } from "./casebook-contract.mjs";

const detectedFaultStatuses = new Set(["fail", "blocked"]);
const observationStatuses = new Set(["pass", "fail", "blocked", "uncertain"]);
const artifactStatuses = new Set(["verified", "contradicted", "unverified"]);

export const CASEBOOK_REAL_INTEGRATION_SCHEMA_VERSION = 1;
export const CASEBOOK_REAL_INTEGRATION_IDS = Object.freeze([...CASEBOOK_P0_IDS]);

function cleanId(value, fallback = "item") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function observationStatus(value) {
  const status = String(value || "uncertain").toLowerCase();
  return observationStatuses.has(status) ? status : "uncertain";
}

function artifactStatus(value) {
  const status = String(value || "unverified").toLowerCase();
  return artifactStatuses.has(status) ? status : "unverified";
}

function safeObservation(input = {}) {
  return redactCaseEvidence({
    outcome: observationStatus(input.outcome),
    observed: String(input.observed || "No observation supplied."),
    workerClaim: observationStatus(input.workerClaim || input.outcome),
    interaction: String(input.interaction || "observe"),
    target: String(input.target || ""),
    critical: input.critical !== false,
    beforeScreenshot: String(input.beforeScreenshot || ""),
    afterScreenshot: String(input.afterScreenshot || ""),
    evidence: Array.isArray(input.evidence) ? input.evidence : [],
  });
}

function safeArtifact(input = {}) {
  return redactCaseEvidence({
    id: cleanId(input.id, "evidence"),
    kind: String(input.kind || "state"),
    status: artifactStatus(input.status),
    source: String(input.source || "casebook-real-machine-observer"),
    independent: input.independent === true,
    ref: String(input.ref || ""),
    summary: String(input.summary || ""),
    phase: String(input.phase || "state"),
    metadata: input.metadata || {},
  });
}

export function createCasebookFaultPlan(caseDefinition, options = {}) {
  const validation = validateCaseDefinition(caseDefinition);
  if (!validation.valid) throw new Error(`Cannot create fault plan for invalid Case: ${validation.errors.join(" ")}`);
  const requested = Array.isArray(options.faults) && options.faults.length
    ? options.faults
    : caseDefinition.injectedFailureModes.slice(0, Math.max(1, Number(options.maxFaults || 1)));
  const available = new Set(caseDefinition.injectedFailureModes);
  return requested.map((label, index) => {
    if (!available.has(label)) throw new Error(`Fault '${label}' is not declared by Case ${caseDefinition.id}.`);
    return {
      id: `${caseDefinition.id}:${cleanId(label, `fault-${index + 1}`)}`,
      label,
      testScoped: true,
      reversible: true,
    };
  });
}

export function assertCasebookFaultSafety(fault = {}) {
  if (fault.testScoped !== true) throw new Error("Casebook fault injection must be test-scoped.");
  if (fault.reversible !== true) throw new Error("Casebook fault injection must be reversible.");
  if (!String(fault.id || "").trim()) throw new Error("Casebook fault injection requires an id.");
  return true;
}

export function evaluateCasebookFaultObservation(fault, observation = {}) {
  assertCasebookFaultSafety(fault);
  const outcome = observationStatus(observation.outcome);
  return redactCaseEvidence({
    id: fault.id,
    label: fault.label || fault.id,
    injected: true,
    detected: detectedFaultStatuses.has(outcome),
    outcome,
    observed: String(observation.observed || "No fault observation supplied."),
  });
}

function requireAdapter(caseDefinition, adapter, injectFaults) {
  if (!adapter || typeof adapter !== "object") throw new Error(`Case ${caseDefinition.id} requires a real-machine adapter.`);
  if (adapter.caseId !== caseDefinition.id) throw new Error(`Adapter ${adapter.caseId || "<missing>"} does not match Case ${caseDefinition.id}.`);
  if (adapter.mode !== "real-machine") throw new Error(`Case ${caseDefinition.id} adapter must declare mode=real-machine.`);
  if (typeof adapter.performStep !== "function") throw new Error(`Case ${caseDefinition.id} adapter must implement performStep().`);
  if (typeof adapter.verifyOutcome !== "function") throw new Error(`Case ${caseDefinition.id} adapter must implement verifyOutcome().`);
  if (injectFaults && typeof adapter.injectFault !== "function") throw new Error(`Case ${caseDefinition.id} adapter must implement injectFault() when fault injection is enabled.`);
}

function appendArtifacts(manifest, artifacts = []) {
  for (const item of artifacts) appendCaseEvidenceArtifact(manifest, safeArtifact(item));
}

export async function runCasebookRealIntegrationCase(caseDefinition, adapter, options = {}) {
  const validation = validateCaseDefinition(caseDefinition);
  if (!validation.valid) throw new Error(`Cannot run invalid Case: ${validation.errors.join(" ")}`);
  const injectFaults = options.injectFaults !== false;
  requireAdapter(caseDefinition, adapter, injectFaults);
  const manifest = createCaseEvidenceManifest(caseDefinition, {
    runId: options.runId || `${caseDefinition.id}:real-machine:${Date.now()}`,
    startedAt: options.startedAt,
  });

  let allJourneyStepsPassed = true;
  for (const step of caseDefinition.humanJourney) {
    let observation;
    try {
      observation = safeObservation(await adapter.performStep({ caseDefinition, step }));
    } catch (error) {
      observation = safeObservation({
        outcome: "fail",
        workerClaim: "fail",
        observed: `Real-machine step error: ${error instanceof Error ? error.message : String(error)}`,
        critical: false,
      });
    }
    appendArtifacts(manifest, observation.evidence);
    appendCaseEvidenceStep(manifest, caseDefinition, {
      stepId: step.id,
      interaction: observation.interaction,
      target: observation.target,
      expected: step.action,
      observed: observation.observed,
      workerClaim: observation.workerClaim,
      outcome: observation.outcome,
      critical: observation.critical,
      beforeScreenshot: observation.beforeScreenshot,
      afterScreenshot: observation.afterScreenshot,
      evidenceIds: observation.evidence.map((item) => item.id).filter(Boolean),
    });
    if (observation.outcome !== "pass") allJourneyStepsPassed = false;
  }

  let independentObservation;
  try {
    independentObservation = safeArtifact(await adapter.verifyOutcome({ caseDefinition, manifest }));
  } catch (error) {
    independentObservation = safeArtifact({
      id: `${caseDefinition.id}-independent-verifier-error`,
      kind: "evaluation",
      status: "contradicted",
      source: caseDefinition.independentVerification.source,
      independent: true,
      summary: `Independent verifier error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
  independentObservation.source = caseDefinition.independentVerification.source;
  independentObservation.independent = true;
  appendCaseEvidenceArtifact(manifest, independentObservation);

  const faultResults = [];
  if (injectFaults) {
    const faultPlan = createCasebookFaultPlan(caseDefinition, options);
    for (const fault of faultPlan) {
      assertCasebookFaultSafety(fault);
      let observation;
      try {
        observation = await adapter.injectFault({ caseDefinition, fault });
      } catch (error) {
        observation = {
          outcome: "fail",
          observed: `Fault-injection execution error: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
      faultResults.push(evaluateCasebookFaultObservation(fault, observation));
    }
  }

  const faultDetectionComplete = faultResults.length > 0 && faultResults.every((item) => item.detected);
  const independentVerified = independentObservation.status === "verified";
  completeCaseEvidenceManifest(manifest, {
    realIntegrationVerified: allJourneyStepsPassed && independentVerified && (!injectFaults || faultDetectionComplete),
    criticalInteractionsUnreached: Number(options.criticalInteractionsUnreached || 0),
    blockers: options.blockers || [],
    faultResults,
  });
  const result = evaluateCaseEvidenceManifest(caseDefinition, manifest);
  return { manifest, result, faultResults };
}

export function createRecordedRealMachineAdapter(caseDefinition, record = {}) {
  const validation = validateCaseDefinition(caseDefinition);
  if (!validation.valid) throw new Error(`Cannot create adapter for invalid Case: ${validation.errors.join(" ")}`);
  if (record.schemaVersion !== CASEBOOK_REAL_INTEGRATION_SCHEMA_VERSION) {
    throw new Error(`Recorded real-machine evidence schemaVersion must equal ${CASEBOOK_REAL_INTEGRATION_SCHEMA_VERSION}.`);
  }
  if (record.caseId !== caseDefinition.id) throw new Error(`Recorded evidence caseId does not match ${caseDefinition.id}.`);
  if (record.mode !== "real-machine") throw new Error(`Recorded evidence for ${caseDefinition.id} is not marked real-machine.`);
  const steps = new Map((record.steps || []).map((item) => [item.stepId, item]));
  const faults = new Map((record.faults || []).map((item) => [item.label, item]));
  return {
    caseId: caseDefinition.id,
    mode: "real-machine",
    async performStep({ step }) {
      const observation = steps.get(step.id);
      if (!observation) return { outcome: "blocked", observed: `No real-machine observation was recorded for ${step.id}.`, critical: false };
      return observation;
    },
    async verifyOutcome() {
      return record.independentVerification || {
        id: `${caseDefinition.id}-independent-proof-missing`,
        kind: "evaluation",
        status: "unverified",
        source: caseDefinition.independentVerification.source,
        independent: true,
        summary: "No independent verifier observation was recorded.",
      };
    },
    async injectFault({ fault }) {
      const observation = faults.get(fault.label);
      if (!observation) return { outcome: "uncertain", observed: `Fault '${fault.label}' was not exercised on the real machine.` };
      return observation;
    },
  };
}
