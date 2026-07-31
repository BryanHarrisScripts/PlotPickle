import { createHash } from "node:crypto";
import { matchesAnyPattern, normalizeRepositoryPath } from "./registry.mjs";

function redact(value, keys, key = "") {
  if (keys.some((item) => key.toLowerCase().includes(String(item).toLowerCase()))) return "[REDACTED]";
  if (Array.isArray(value)) return value.map((item) => redact(item, keys));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, redact(child, keys, childKey)]));
  }
  return value;
}

export function buildDiagnosticPacket(summary, plan, registry) {
  const keys = registry.agentPolicy?.redactKeys || [];
  const packet = {
    version: 1,
    mode: registry.agentPolicy?.mode || "diagnosis-only",
    generatedAt: new Date().toISOString(),
    result: summary.passed ? "pass" : "fail",
    counts: summary.counts,
    failures: summary.failures.map((failure) => ({
      id: failure.id,
      name: failure.name,
      message: failure.message,
      classification: failure.classification,
      testFile: failure.testFile,
      line: failure.line,
      contracts: failure.contracts.map((contract) => ({
        id: contract.id,
        owners: contract.owners.map((owner) => owner.path),
      })),
    })),
    clusters: summary.clusters,
    scope: {
      areas: plan?.areas?.map((area) => area.id) || [],
      allowedPaths: plan?.allowedPaths || [],
      allowedCommands: [
        ...(plan?.command?.length ? [plan.command] : []),
        ...(summary.focusedCommand?.length ? [summary.focusedCommand] : []),
      ],
    },
    policy: {
      allowedProposalActions: registry.agentPolicy?.allowedProposalActions || [],
      forbiddenActions: registry.agentPolicy?.forbiddenActions || [],
      maxAttempts: registry.defaults?.maxAttempts || 1,
      stopOnAmbiguity: registry.defaults?.stopOnAmbiguity !== false,
      humanApproval: registry.defaults?.requireHumanApprovalFor || [],
    },
  };
  return redact(packet, keys);
}

function fingerprintProposal(proposal) {
  return createHash("sha256").update(JSON.stringify({
    action: proposal.action,
    command: proposal.command || null,
    paths: [...(proposal.paths || [])].sort(),
    diagnosis: proposal.diagnosis || "",
  })).digest("hex");
}

export function validateAgentProposal(proposal, packet, registry, history = []) {
  const errors = [];
  const policy = registry.agentPolicy || {};
  const allowedActions = new Set(policy.allowedProposalActions || []);
  const forbidden = new Set(policy.forbiddenActions || []);

  if (!proposal || typeof proposal !== "object") errors.push("Proposal must be an object.");
  if (!allowedActions.has(proposal?.action)) errors.push(`Action ${proposal?.action || "<missing>"} is not allowed.`);
  if (forbidden.has(proposal?.action)) errors.push(`Action ${proposal.action} is forbidden in diagnosis mode.`);
  if (!proposal?.decision || !["continue", "stop", "escalate"].includes(proposal.decision)) errors.push("Proposal decision must be continue, stop or escalate.");
  if (!Array.isArray(proposal?.evidence) || proposal.evidence.length === 0) errors.push("Proposal must cite structured evidence.");

  const evidenceIds = new Set(packet.failures.map((failure) => failure.id));
  for (const evidence of proposal?.evidence || []) {
    if (!evidenceIds.has(evidence)) errors.push(`Unknown evidence reference: ${evidence}.`);
  }

  for (const file of proposal?.paths || []) {
    const normalized = normalizeRepositoryPath(file);
    if (!matchesAnyPattern(normalized, packet.scope.allowedPaths)) errors.push(`Path is outside the diagnosed scope: ${normalized}.`);
  }

  if (proposal?.command) {
    const command = Array.isArray(proposal.command) ? proposal.command : [];
    const allowed = packet.scope.allowedCommands.some((item) => JSON.stringify(item) === JSON.stringify(command));
    if (!allowed) errors.push("Command is not one of the focused commands in the diagnostic packet.");
  }

  const fingerprint = fingerprintProposal(proposal || {});
  if (history.some((item) => item.fingerprint === fingerprint)) errors.push("Identical proposal already ran; repetition is blocked.");
  if (history.length >= packet.policy.maxAttempts) errors.push("Maximum diagnostic attempts reached.");

  return {
    valid: errors.length === 0,
    errors,
    fingerprint,
    requiresHumanApproval: proposal?.decision === "escalate" || (proposal?.paths || []).length > 0,
  };
}

export function createDiagnosticLoop(packet) {
  return {
    version: 1,
    state: "observe",
    attempts: 0,
    result: null,
    audit: [{
      at: new Date().toISOString(),
      state: "observe",
      event: "packet-created",
      counts: packet.counts,
    }],
  };
}

export function advanceDiagnosticLoop(loop, event, packet) {
  const next = structuredClone(loop);
  const record = { at: new Date().toISOString(), state: next.state, event: event.type };

  if (event.type === "ambiguous") {
    next.state = "stop";
    next.result = "review-required";
  } else if (next.state === "observe" && event.type === "evidence-ready") {
    next.state = "classify";
  } else if (next.state === "classify" && event.type === "classification-ready") {
    next.state = "propose";
  } else if (next.state === "propose" && event.type === "proposal-accepted") {
    next.state = "verify";
    next.attempts += 1;
  } else if (next.state === "verify" && event.type === "verification-passed") {
    next.state = "stop";
    next.result = "verified";
  } else if (next.state === "verify" && event.type === "verification-failed") {
    if (next.attempts >= packet.policy.maxAttempts) {
      next.state = "stop";
      next.result = "attempt-limit";
    } else {
      next.state = "classify";
    }
  } else if (event.type === "stop") {
    next.state = "stop";
    next.result = event.result || "stopped";
  } else {
    throw new Error(`Invalid diagnostic transition: ${next.state} + ${event.type}.`);
  }

  record.nextState = next.state;
  next.audit.push(record);
  return next;
}
