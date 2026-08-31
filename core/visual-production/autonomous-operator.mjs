import { normalizeStoryDecisionAuthority } from "../story-workflow/story-decisions/autonomous-authority.mjs";

const REQUIRED_PORTS = Object.freeze([
  "inspectAnchor",
  "listStoryboardCandidates",
  "evaluateStoryboardCandidate",
  "keepStoryboardCandidate",
  "createProductionShot",
  "evaluatePrevisTiming",
  "authorPrevisTiming",
]);

const BUNDLED_PROVIDER = "bundled-reference";
const RENDER_MINI_BLOCK_SECONDS = 75;

function text(value, maximum = 2_000) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function strings(value, maximum = 128, itemMaximum = 360) {
  return [...new Set((Array.isArray(value) ? value : []).map((item) => text(item, itemMaximum)).filter(Boolean))].slice(0, maximum);
}

function confidence(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0;
}

function boundedInteger(value, fallback, minimum = 1, maximum = 4) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

function iso(value) {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function revision(value) {
  const normalized = text(value, 120);
  if (!normalized) throw new Error("Autonomous visual production requires a project revision.");
  return normalized;
}

function validatePorts(ports) {
  for (const name of REQUIRED_PORTS) {
    if (typeof ports?.[name] !== "function") throw new Error(`Autonomous visual production requires the ${name} port.`);
  }
}

function authorizeVisualProductionAuthority(input, policyInput, projectId) {
  const authority = normalizeStoryDecisionAuthority(input);
  if (authority.authorityClass !== "delegated-autonomous-operator") {
    throw new Error("Autonomous visual production requires delegated autonomous authority.");
  }
  const policy = policyInput && typeof policyInput === "object" && !Array.isArray(policyInput) ? policyInput : {};
  if (policy.enabled !== true || policy.allowVisualProduction !== true) {
    throw new Error("Delegated autonomous visual production is not enabled by run policy.");
  }
  if (text(policy.autonomousRunId, 180) !== authority.autonomousRunId) {
    throw new Error("Delegated autonomous visual production authority does not match the enabled run policy.");
  }
  if (text(policy.projectId, 180) !== text(projectId, 180)) {
    throw new Error("Delegated autonomous visual production authority is not enabled for this project.");
  }
  const configuredProviders = strings(policy.configuredProviders, 32, 120);
  if (configuredProviders.length && !configuredProviders.includes(authority.provider)) {
    throw new Error("Autonomous visual evaluation provider is not enabled by run policy.");
  }
  return { authority, policy, configuredProviders };
}

function normalizeCandidate(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Storyboard candidate must be a structured object.");
  }
  const candidate = {
    candidateId: text(input.candidateId ?? input.id, 180),
    provider: text(input.provider, 120) || BUNDLED_PROVIDER,
    costClass: text(input.costClass, 80) || "bundled",
    confidence: confidence(input.confidence ?? 1),
    rationale: text(input.rationale, 1_000),
  };
  if (!candidate.candidateId) throw new Error("Storyboard candidate ID is required.");
  return candidate;
}

function candidatePolicyBlock(candidate, policy, configuredProviders) {
  if (candidate.provider !== BUNDLED_PROVIDER && configuredProviders.length && !configuredProviders.includes(candidate.provider)) {
    return `Storyboard candidate provider ${candidate.provider} is not enabled by run policy.`;
  }
  if (candidate.costClass === "paid-cloud" && policy.allowPaidCloud !== true) {
    return "Paid-cloud Storyboard generation is not enabled by run policy.";
  }
  return "";
}

function normalizeTimingCandidate(input, shotId, remainingDurationSeconds) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Previs timing evaluation must return a structured candidate.");
  }
  const durationSeconds = Number(input.durationSeconds);
  const candidate = {
    shotId: text(input.shotId ?? shotId, 180),
    confidence: confidence(input.confidence),
    durationSeconds,
    shotSize: text(input.shotSize, 80),
    angle: text(input.angle, 80),
    movement: text(input.movement, 120),
    lens: text(input.lens, 120),
    visualIntent: text(input.visualIntent, 2_000),
    transitionIn: text(input.transitionIn, 120),
    transitionOut: text(input.transitionOut, 120),
    rationale: text(input.rationale, 1_000),
  };
  if (!candidate.shotId || candidate.shotId !== shotId) throw new Error("Previs timing candidate targeted the wrong production shot.");
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > remainingDurationSeconds + 0.01) {
    throw new Error("Previs timing candidate exceeds the remaining Mini-Block duration.");
  }
  if (!candidate.rationale) throw new Error("Previs timing evaluation requires a concise audit rationale.");
  return candidate;
}

function normalizeInspection(input, expectedProjectId, expectedTargetId, expectedMiniBlockNumber) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Visual production inspection is invalid.");
  const anchor = input.anchor && typeof input.anchor === "object" && !Array.isArray(input.anchor) ? input.anchor : {};
  if (text(input.projectId, 180) !== expectedProjectId) throw new Error("Visual production inspection returned the wrong project.");
  if (text(anchor.targetId, 180) !== expectedTargetId || Number(anchor.miniBlockNumber) !== expectedMiniBlockNumber) {
    throw new Error("Visual production inspection returned the wrong canonical anchor.");
  }
  return {
    projectId: expectedProjectId,
    projectRevision: revision(input.projectRevision),
    anchor: {
      id: text(anchor.id, 240),
      targetId: expectedTargetId,
      miniBlockNumber: expectedMiniBlockNumber,
      storyboardAllowed: anchor.storyboardAllowed === true,
      missingPrerequisites: strings(anchor.missingPrerequisites),
      staleBecause: strings(anchor.staleBecause),
      storyboardArtifactId: text(anchor.storyboardArtifactId, 200),
      storyboardDependencyKey: text(anchor.storyboardDependencyKey, 360),
      timingAllowed: anchor.timingAllowed === true,
      renderPlanReady: anchor.renderPlanReady === true,
      shots: Array.isArray(anchor.shots) ? anchor.shots.map((shot) => ({
        id: text(shot?.id, 180),
        durationSeconds: Number(shot?.durationSeconds) || 0,
        reviewState: text(shot?.reviewState, 40),
      })).filter((shot) => shot.id) : [],
      staleShotIds: strings(anchor.staleShotIds, 128, 180),
      authoredDurationSeconds: Math.max(0, Number(anchor.authoredDurationSeconds) || 0),
    },
  };
}

function receiptBase(input, authority, recordedAt) {
  return {
    autonomousRunId: authority.autonomousRunId,
    authorityClass: authority.authorityClass,
    operatorId: authority.operatorId,
    modelRole: authority.modelRole,
    modelId: authority.modelId,
    provider: authority.provider,
    runtime: authority.runtime,
    projectId: text(input.projectId, 180),
    targetId: text(input.targetId, 180),
    miniBlockNumber: Number(input.miniBlockNumber),
    baseRevision: revision(input.currentRevision),
    currentRevision: revision(input.currentRevision),
    resultingRevision: revision(input.currentRevision),
    storyboardCandidateId: "",
    storyboardArtifactId: "",
    productionShotIds: [],
    evidenceRefs: strings(input.evidenceRefs),
    targetRefs: strings(input.targetRefs),
    rationales: [],
    affectedRefs: [],
    staleProjectionRefs: [],
    validationResult: "blocked",
    storyCanonChanged: false,
    renderPlanReady: false,
    recordedAt,
  };
}

function blocked(receipt, code, message) {
  return {
    status: "blocked",
    blocker: { code, message: text(message, 800) },
    receipt: { ...receipt, validationResult: "blocked" },
  };
}

function mergeOperationReceipt(receipt, operation) {
  return {
    ...receipt,
    affectedRefs: [...new Set([...receipt.affectedRefs, ...strings(operation?.affectedRefs)])],
    staleProjectionRefs: [...new Set([...receipt.staleProjectionRefs, ...strings(operation?.staleProjectionRefs)])],
  };
}

async function inspect(ports, input, expectedRevision = "") {
  const value = normalizeInspection(await ports.inspectAnchor({
    projectId: input.projectId,
    targetId: input.targetId,
    miniBlockNumber: input.miniBlockNumber,
    expectedRevision,
  }), input.projectId, input.targetId, input.miniBlockNumber);
  if (expectedRevision && value.projectRevision !== expectedRevision) {
    throw new Error("Visual production inspection revision does not match the completed canonical operation.");
  }
  return value;
}

async function chooseStoryboardCandidate(candidatesInput, ports, context) {
  const candidates = (Array.isArray(candidatesInput) ? candidatesInput : []).map(normalizeCandidate);
  if (!candidates.length) return { candidate: null, attempts: 0, rationale: "" };
  if (candidates.length === 1) {
    return {
      candidate: { ...candidates[0], confidence: 1 },
      attempts: 0,
      rationale: "The anchor has one eligible existing Storyboard candidate, so no model tie-break is required.",
    };
  }

  let attempts = 0;
  let last = null;
  while (attempts < context.maxEvaluationAttempts) {
    attempts += 1;
    const evaluated = normalizeCandidate(await ports.evaluateStoryboardCandidate({
      projectId: context.projectId,
      targetId: context.targetId,
      miniBlockNumber: context.miniBlockNumber,
      candidates,
      attempt: attempts,
      maxAttempts: context.maxEvaluationAttempts,
      minimumConfidence: context.minimumConfidence,
    }));
    if (!candidates.some((candidate) => candidate.candidateId === evaluated.candidateId)) {
      throw new Error("Storyboard evaluation selected a candidate outside the inspected anchor.");
    }
    last = evaluated;
    if (evaluated.confidence >= context.minimumConfidence) {
      return { candidate: evaluated, attempts, rationale: evaluated.rationale };
    }
  }
  return { candidate: null, attempts, rationale: last?.rationale || "Storyboard evaluation remained below the configured confidence threshold." };
}

export async function operateAutonomousVisualAnchor(input, ports) {
  validatePorts(ports);
  const projectId = text(input?.projectId, 180);
  const targetId = text(input?.targetId, 180);
  const miniBlockNumber = Number(input?.miniBlockNumber);
  if (!projectId || !targetId || !Number.isInteger(miniBlockNumber) || miniBlockNumber < 1 || miniBlockNumber > 4) {
    throw new Error("Autonomous visual production requires a project, target and Mini-Block 1-4.");
  }

  const { authority, policy, configuredProviders } = authorizeVisualProductionAuthority(input?.authority, input?.autonomousPolicy, projectId);
  const recordedAt = iso(input?.recordedAt);
  let receipt = receiptBase({ ...input, projectId, targetId, miniBlockNumber }, authority, recordedAt);
  const evidence = input?.evidence && typeof input.evidence === "object" && !Array.isArray(input.evidence) ? input.evidence : {};
  if (evidence.securityFailure === true || evidence.integrityFailure === true) {
    return blocked(receipt, "integrity-failure", "Security or integrity evidence requires fail-closed visual production handling.");
  }

  const minimumConfidence = Math.max(0.5, Math.min(1, Number(policy.minimumConfidence) || 0.75));
  const maxEvaluationAttempts = boundedInteger(policy.maxEvaluationAttempts, 2);
  let state = await inspect(ports, { projectId, targetId, miniBlockNumber });
  if (state.projectRevision !== receipt.currentRevision) {
    return blocked(receipt, "stale-revision", "Story state changed before autonomous visual production began.");
  }
  if (!state.anchor.storyboardAllowed) {
    return blocked(receipt, "missing-prerequisite", state.anchor.missingPrerequisites.join(" · ") || "Storyboard readiness has not been earned for this anchor.");
  }
  if (state.anchor.staleBecause.length) {
    return blocked(receipt, "stale-storyboard", state.anchor.staleBecause.join(" "));
  }

  if (!state.anchor.storyboardArtifactId) {
    const selection = await chooseStoryboardCandidate(await ports.listStoryboardCandidates({
      projectId,
      targetId,
      miniBlockNumber,
      expectedRevision: state.projectRevision,
    }), ports, { projectId, targetId, miniBlockNumber, minimumConfidence, maxEvaluationAttempts });
    if (!selection.candidate) {
      return blocked(receipt, "storyboard-evaluation-incomplete", selection.rationale || "No eligible Storyboard candidate is available for this anchor.");
    }
    const policyBlock = candidatePolicyBlock(selection.candidate, policy, configuredProviders);
    if (policyBlock) return blocked(receipt, "provider-policy", policyBlock);

    receipt = {
      ...receipt,
      storyboardCandidateId: selection.candidate.candidateId,
      rationales: [...receipt.rationales, selection.rationale || selection.candidate.rationale].filter(Boolean),
    };
    const kept = await ports.keepStoryboardCandidate({
      projectId,
      targetId,
      miniBlockNumber,
      candidateId: selection.candidate.candidateId,
      expectedRevision: state.projectRevision,
      authority,
      autonomousPolicy: policy,
      rationale: selection.rationale || selection.candidate.rationale,
    });
    if (kept?.applied !== true) return blocked(receipt, "storyboard-keep-failed", kept?.reason || "Storyboard candidate was not kept through the canonical visual path.");
    const resultingRevision = revision(kept.projectRevision);
    if (resultingRevision === state.projectRevision) throw new Error("Storyboard Keep reported a canonical visual change without a resulting revision.");
    receipt = mergeOperationReceipt({ ...receipt, resultingRevision, currentRevision: resultingRevision }, kept);
    state = await inspect(ports, { projectId, targetId, miniBlockNumber }, resultingRevision);
  }

  receipt = { ...receipt, storyboardArtifactId: state.anchor.storyboardArtifactId };
  if (!state.anchor.timingAllowed || !state.anchor.storyboardArtifactId || !state.anchor.storyboardDependencyKey) {
    return blocked(receipt, "previs-locked", "A current kept Storyboard dependency is required before autonomous Previs timing.");
  }
  if (state.anchor.renderPlanReady) {
    return {
      status: "ready",
      receipt: { ...receipt, renderPlanReady: true, validationResult: "passed" },
    };
  }

  let shotId = state.anchor.shots.find((shot) => !shot.durationSeconds || shot.reviewState !== "approved")?.id || "";
  if (!shotId) {
    const created = await ports.createProductionShot({
      projectId,
      targetId,
      miniBlockNumber,
      storyboardArtifactId: state.anchor.storyboardArtifactId,
      storyboardDependencyKey: state.anchor.storyboardDependencyKey,
      expectedRevision: state.projectRevision,
      authority,
      autonomousPolicy: policy,
    });
    if (created?.applied !== true || !text(created.shotId, 180)) {
      return blocked(receipt, "production-shot-create-failed", created?.reason || "Production Shot was not created through the canonical Previs path.");
    }
    shotId = text(created.shotId, 180);
    const resultingRevision = revision(created.projectRevision);
    if (resultingRevision === state.projectRevision) throw new Error("Production Shot creation reported a change without a resulting revision.");
    receipt = mergeOperationReceipt({
      ...receipt,
      currentRevision: resultingRevision,
      resultingRevision,
      productionShotIds: [...new Set([...receipt.productionShotIds, shotId])],
    }, created);
    state = await inspect(ports, { projectId, targetId, miniBlockNumber }, resultingRevision);
  } else {
    receipt = { ...receipt, productionShotIds: [...new Set([...receipt.productionShotIds, shotId])] };
  }

  const remainingDurationSeconds = Math.round((RENDER_MINI_BLOCK_SECONDS - state.anchor.authoredDurationSeconds) * 100) / 100;
  if (remainingDurationSeconds <= 0) {
    return blocked(receipt, "previs-timing-invalid", "Previs timing reached or exceeded the Mini-Block duration without producing a valid Render Plan.");
  }

  let timing = null;
  let timingAttempts = 0;
  let lastTimingRationale = "";
  while (!timing && timingAttempts < maxEvaluationAttempts) {
    timingAttempts += 1;
    const evaluated = normalizeTimingCandidate(await ports.evaluatePrevisTiming({
      projectId,
      targetId,
      miniBlockNumber,
      shotId,
      storyboardArtifactId: state.anchor.storyboardArtifactId,
      storyboardDependencyKey: state.anchor.storyboardDependencyKey,
      currentShots: state.anchor.shots,
      authoredDurationSeconds: state.anchor.authoredDurationSeconds,
      remainingDurationSeconds,
      targetDurationSeconds: RENDER_MINI_BLOCK_SECONDS,
      attempt: timingAttempts,
      maxAttempts: maxEvaluationAttempts,
      minimumConfidence,
    }), shotId, remainingDurationSeconds);
    lastTimingRationale = evaluated.rationale;
    if (evaluated.confidence >= minimumConfidence) timing = evaluated;
  }
  if (!timing) {
    return blocked(receipt, "previs-evaluation-incomplete", lastTimingRationale || "Bounded Previs timing evaluation remained below the configured confidence threshold.");
  }

  receipt = { ...receipt, rationales: [...receipt.rationales, timing.rationale].filter(Boolean) };
  const authored = await ports.authorPrevisTiming({
    projectId,
    targetId,
    miniBlockNumber,
    shotId,
    expectedRevision: state.projectRevision,
    storyboardArtifactId: state.anchor.storyboardArtifactId,
    storyboardDependencyKey: state.anchor.storyboardDependencyKey,
    authority,
    autonomousPolicy: policy,
    timing: {
      durationSeconds: timing.durationSeconds,
      shotSize: timing.shotSize,
      angle: timing.angle,
      movement: timing.movement,
      lens: timing.lens,
      visualIntent: timing.visualIntent,
      transitionIn: timing.transitionIn,
      transitionOut: timing.transitionOut,
      reviewState: "approved",
    },
    rationale: timing.rationale,
  });
  if (authored?.applied !== true) return blocked(receipt, "previs-save-failed", authored?.reason || "Previs timing was not saved through the canonical production path.");
  const resultingRevision = revision(authored.projectRevision);
  if (resultingRevision === state.projectRevision) throw new Error("Previs timing reported a canonical production change without a resulting revision.");
  receipt = mergeOperationReceipt({ ...receipt, currentRevision: resultingRevision, resultingRevision }, authored);
  state = await inspect(ports, { projectId, targetId, miniBlockNumber }, resultingRevision);

  if (state.anchor.staleBecause.length || state.anchor.staleShotIds.includes(shotId)) {
    return blocked(receipt, "stale-production-shot", "The approved Storyboard dependency changed while autonomous Previs timing was being authored.");
  }

  return {
    status: state.anchor.renderPlanReady ? "ready" : "progressed",
    receipt: {
      ...receipt,
      storyboardArtifactId: state.anchor.storyboardArtifactId,
      renderPlanReady: state.anchor.renderPlanReady,
      validationResult: state.anchor.renderPlanReady ? "passed" : "progressed",
    },
  };
}
