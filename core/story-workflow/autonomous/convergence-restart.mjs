import { normalizeStoryDecisionAuthority } from "../story-decisions/autonomous-authority.mjs";
import { evaluateStoryEditorialReadiness } from "../workbench/convergence.mjs";

export const AUTONOMOUS_CONVERGENCE_RESTART_VERSION = 1;

const REQUIRED_PORTS = Object.freeze([
  "inspectConvergenceState",
  "runAuditRound",
  "rerunAffectedWork",
  "captureResumeState",
  "persistCheckpoint",
  "restartApplication",
  "reopenProject",
]);

const RESUME_DIGEST_FIELDS = Object.freeze([
  "decisionStateDigest",
  "workflowStateDigest",
  "visualStateDigest",
  "productionStateDigest",
  "textStateDigest",
]);

function text(value, maximum = 1_200) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function strings(value, maximum = 128, itemMaximum = 360) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map((item) => text(item, itemMaximum))
    .filter(Boolean))].slice(0, maximum);
}

function count(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

function revision(value) {
  const normalized = text(value, 120);
  if (!normalized) throw new Error("Autonomous convergence requires a project revision.");
  return normalized;
}

function validatePorts(ports) {
  for (const name of REQUIRED_PORTS) {
    if (typeof ports?.[name] !== "function") throw new Error(`Autonomous convergence requires the ${name} port.`);
  }
}

function authorize(input, policyInput, projectId) {
  const authority = normalizeStoryDecisionAuthority(input);
  if (authority.authorityClass !== "delegated-autonomous-operator") {
    throw new Error("Autonomous convergence and restart require delegated autonomous authority.");
  }
  const policy = policyInput && typeof policyInput === "object" && !Array.isArray(policyInput) ? policyInput : {};
  if (policy.enabled !== true || policy.allowConvergenceRestart !== true) {
    throw new Error("Delegated autonomous convergence and restart are not enabled by run policy.");
  }
  if (text(policy.autonomousRunId, 180) !== authority.autonomousRunId) {
    throw new Error("Autonomous convergence authority does not match the enabled run policy.");
  }
  if (text(policy.projectId, 180) !== text(projectId, 180)) {
    throw new Error("Autonomous convergence authority is not enabled for this project.");
  }
  return { authority, policy };
}

function normalizeFinding(finding) {
  return {
    findingId: text(finding?.findingId, 180),
    severity: text(finding?.severity, 40),
    disposition: text(finding?.disposition, 60),
    targetRefs: strings(finding?.targetRefs),
    evidenceRefs: strings(finding?.evidenceRefs),
    resolutionRefs: strings(finding?.resolutionRefs, 64, 240),
    rationale: text(finding?.rationale, 1_200),
  };
}

function normalizeConvergenceState(input, expectedProjectId) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Autonomous convergence inspection must return a structured state.");
  }
  const projectId = text(input.projectId, 180);
  if (!projectId || projectId !== expectedProjectId) {
    throw new Error("Autonomous convergence inspection returned the wrong project identity.");
  }
  return {
    projectId,
    revision: revision(input.revision),
    telemetry: input.telemetry && typeof input.telemetry === "object" && !Array.isArray(input.telemetry) ? input.telemetry : {},
    findings: (Array.isArray(input.findings) ? input.findings : []).map(normalizeFinding),
    staleAcceptedChangeConflicts: count(input.staleAcceptedChangeConflicts),
    integrityErrors: strings(input.integrityErrors, 64, 360),
    affectedRefs: strings(input.affectedRefs),
  };
}

function normalizeAuditRound(input, round) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error(`Autonomous convergence audit round ${round} must return structured evidence.`);
  }
  return {
    round,
    completed: input.completed === true,
    newMaterialMediumHighFindings: count(input.newMaterialMediumHighFindings),
    changedRefs: strings(input.changedRefs),
  };
}

function normalizeResumeState(input, expectedProjectId) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Autonomous restart proof requires a structured resume state.");
  }
  const projectId = text(input.projectId, 180);
  if (projectId !== expectedProjectId) throw new Error("Autonomous restart proof returned the wrong project identity.");
  const normalized = { projectId, revision: revision(input.revision) };
  for (const field of RESUME_DIGEST_FIELDS) {
    const value = text(input[field], 180);
    if (!value) throw new Error(`Autonomous restart proof requires ${field}.`);
    normalized[field] = value;
  }
  return normalized;
}

function resumeStateMatches(before, after) {
  return before.projectId === after.projectId
    && before.revision === after.revision
    && RESUME_DIGEST_FIELDS.every((field) => before[field] === after[field]);
}

function evidenceBase(authority, projectId, startingRevision, rounds) {
  return {
    schemaVersion: AUTONOMOUS_CONVERGENCE_RESTART_VERSION,
    authorityClass: authority.authorityClass,
    autonomousRunId: authority.autonomousRunId,
    operatorId: authority.operatorId,
    modelRole: authority.modelRole,
    modelId: authority.modelId,
    provider: authority.provider,
    runtime: authority.runtime,
    projectId,
    startingRevision,
    auditRounds: rounds,
  };
}

function blocked(authority, projectId, startingRevision, rounds, code, message, extra = {}) {
  return {
    status: "blocked",
    blocker: { code, message: text(message, 600) },
    evidence: {
      ...evidenceBase(authority, projectId, startingRevision, rounds),
      status: "blocked",
      blockerCode: code,
      ...extra,
    },
  };
}

export async function runAutonomousConvergenceAndRestart(input, ports) {
  validatePorts(ports);
  const projectId = text(input?.projectId, 180);
  if (!projectId) throw new Error("Autonomous convergence requires projectId.");
  const startingRevision = revision(input?.currentRevision);
  const { authority, policy } = authorize(input?.authority, input?.autonomousPolicy, projectId);
  const maxAuditRounds = boundedInteger(policy.maxAuditRounds, 4, 2, 6);
  const rounds = [];
  let affectedWorkItemsRerun = 0;
  let state = normalizeConvergenceState(await ports.inspectConvergenceState({
    projectId,
    expectedRevision: startingRevision,
    phase: "initial",
  }), projectId);
  if (state.revision !== startingRevision) {
    return blocked(authority, projectId, startingRevision, rounds, "stale-revision", "Story state changed before convergence began.", {
      currentRevision: state.revision,
    });
  }
  if (state.integrityErrors.length) {
    return blocked(authority, projectId, startingRevision, rounds, "integrity-failure", "Integrity or provenance errors require fail-closed handling.", {
      currentRevision: state.revision,
      integrityErrorCount: state.integrityErrors.length,
    });
  }

  let readiness = null;
  for (let round = 1; round <= maxAuditRounds; round += 1) {
    const audit = normalizeAuditRound(await ports.runAuditRound({
      projectId,
      round,
      expectedRevision: state.revision,
      affectedRefs: [...state.affectedRefs],
    }), round);
    if (!audit.completed) {
      return blocked(authority, projectId, startingRevision, rounds, "audit-incomplete", `Autonomous audit round ${round} did not complete.`, {
        currentRevision: state.revision,
      });
    }

    if (audit.changedRefs.length) {
      const rerun = await ports.rerunAffectedWork({
        projectId,
        round,
        expectedRevision: state.revision,
        changedRefs: audit.changedRefs,
      });
      if (rerun?.unrelatedWorkItemsTouched === true) {
        return blocked(authority, projectId, startingRevision, rounds, "reevaluation-fanout", "Targeted re-evaluation touched unrelated work.", {
          currentRevision: state.revision,
        });
      }
      affectedWorkItemsRerun += count(rerun?.affectedWorkItemsRerun);
    }

    rounds.push({
      round,
      completed: true,
      newMaterialMediumHighFindings: audit.newMaterialMediumHighFindings,
    });
    state = normalizeConvergenceState(await ports.inspectConvergenceState({
      projectId,
      expectedRevision: state.revision,
      phase: "after-audit",
      round,
    }), projectId);
    if (state.integrityErrors.length) {
      return blocked(authority, projectId, startingRevision, rounds, "integrity-failure", "Integrity or provenance errors appeared during convergence.", {
        currentRevision: state.revision,
        integrityErrorCount: state.integrityErrors.length,
      });
    }

    readiness = evaluateStoryEditorialReadiness({
      telemetry: { ...state.telemetry, affectedWorkItemsRerun },
      findings: state.findings,
      auditRounds: rounds,
      staleAcceptedChangeConflicts: state.staleAcceptedChangeConflicts,
      integrityErrors: state.integrityErrors,
    });
    if (readiness.readyForEditorialReview) break;
  }

  if (!readiness?.readyForEditorialReview) {
    return blocked(authority, projectId, startingRevision, rounds, "convergence-limit", `Autonomous convergence did not reach the evidence-based stop condition within ${maxAuditRounds} audit rounds.`, {
      currentRevision: state.revision,
      readiness,
      affectedWorkItemsRerun,
    });
  }

  const beforeRestart = normalizeResumeState(await ports.captureResumeState({
    projectId,
    expectedRevision: state.revision,
    phase: "before-restart",
  }), projectId);
  if (beforeRestart.revision !== state.revision) {
    return blocked(authority, projectId, startingRevision, rounds, "restart-snapshot-stale", "Restart checkpoint did not match the converged project revision.", {
      currentRevision: state.revision,
    });
  }

  const checkpoint = await ports.persistCheckpoint({
    projectId,
    expectedRevision: state.revision,
    autonomousRunId: authority.autonomousRunId,
  });
  if (checkpoint?.persisted !== true || revision(checkpoint?.revision) !== state.revision) {
    return blocked(authority, projectId, startingRevision, rounds, "persistence-failure", "PlotPickle did not verify the autonomous persistence checkpoint.", {
      currentRevision: state.revision,
    });
  }

  const restart = await ports.restartApplication({
    projectId,
    autonomousRunId: authority.autonomousRunId,
  });
  if (restart?.restarted !== true) {
    return blocked(authority, projectId, startingRevision, rounds, "restart-failure", "PlotPickle did not complete the requested restart boundary.", {
      currentRevision: state.revision,
    });
  }

  const reopened = await ports.reopenProject({
    projectId,
    expectedRevision: state.revision,
  });
  if (text(reopened?.projectId, 180) !== projectId || revision(reopened?.revision) !== state.revision) {
    return blocked(authority, projectId, startingRevision, rounds, "reopen-mismatch", "PlotPickle reopened a different project or revision after restart.", {
      currentRevision: state.revision,
    });
  }

  const afterRestart = normalizeResumeState(await ports.captureResumeState({
    projectId,
    expectedRevision: state.revision,
    phase: "after-restart",
  }), projectId);
  if (!resumeStateMatches(beforeRestart, afterRestart)) {
    return blocked(authority, projectId, startingRevision, rounds, "resume-state-mismatch", "Decision, workflow, visual, production or text state changed across restart.", {
      currentRevision: state.revision,
      restartVerified: false,
    });
  }

  return {
    status: "completed",
    readiness,
    evidence: {
      ...evidenceBase(authority, projectId, startingRevision, rounds),
      status: "completed",
      endingRevision: state.revision,
      affectedWorkItemsRerun,
      readinessStatus: readiness.status,
      twoCleanAuditRounds: readiness.twoCleanAuditRounds,
      persistence: {
        checkpointVerified: true,
        restartVerified: true,
        reopenedProjectId: projectId,
        reopenedRevision: state.revision,
      },
      resumeState: {
        projectId,
        revision: state.revision,
        digestsVerified: true,
        digestFields: [...RESUME_DIGEST_FIELDS],
      },
      evidencePolicy: "No hidden reasoning, credentials or private story text is stored in autonomous convergence evidence.",
    },
  };
}
