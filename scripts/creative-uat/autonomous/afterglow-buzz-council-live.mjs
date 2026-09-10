import {
  createAfterglowBuzzCouncilPlan,
  createAfterglowBuzzCouncilProof,
} from "./afterglow-buzz-council.mjs";

const BRIDGE_API = "/api/story-workflow/buzz-bridge";
const RUN_API = "/api/responsibility-runs";

function clean(value, maximum = 800) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function responseFailure(response, fallback) {
  return clean(response?.payload?.message, 800) || `${fallback} (HTTP ${Number(response?.status || 0)}).`;
}

function degraded(reason, extra = {}) {
  return {
    mode: "degraded-local",
    configured: false,
    liveSatisfied: false,
    genuineContributionCount: 0,
    requiredContributionCount: 3,
    contributions: [],
    bridgeRequests: [],
    reason: clean(reason, 800),
    ...extra,
  };
}

function failed(reason, extra = {}) {
  return {
    mode: "failed-live-proof",
    configured: true,
    liveSatisfied: false,
    genuineContributionCount: 0,
    requiredContributionCount: 3,
    contributions: [],
    bridgeRequests: [],
    reason: clean(reason, 800),
    ...extra,
  };
}

export async function collectAfterglowBuzzCouncilEvidence(input) {
  const request = input?.request;
  if (typeof request !== "function") throw new Error("Afterglow BUZZ Council live collection requires a bounded same-origin request function.");
  const sleep = typeof input?.sleep === "function"
    ? input.sleep
    : (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const plan = createAfterglowBuzzCouncilPlan({
    projectId: input.projectId,
    revision: input.revision,
    generatedAt: input.generatedAt,
  });

  const diagnostic = await request({ url: BRIDGE_API, method: "POST", body: { action: "diagnostics" } });
  if (diagnostic?.ok !== true) {
    return degraded(responseFailure(diagnostic, "The profile-scoped BUZZ Story Bridge is unavailable to this autonomous reference run"), {
      status: Number(diagnostic?.status || 0),
    });
  }
  if (diagnostic.payload?.storyBridge?.ready !== true) {
    return degraded(clean(diagnostic.payload?.storyBridge?.message, 800) || "The existing BUZZ Story Bridge is not configured and ready.");
  }
  const bindings = Array.isArray(diagnostic.payload?.agentSigners?.bindings) ? diagnostic.payload.agentSigners.bindings : [];
  const missingSigners = plan.requiredAgentIds.filter((agentId) => !bindings.some((binding) => binding?.profileId === agentId && binding?.ready === true));
  if (missingSigners.length) {
    return degraded(`The live Story Bridge is reachable, but required approved Agent signer bindings are missing: ${missingSigners.join(", ")}.`, { missingAgentIds: missingSigners });
  }

  const bridgeRequests = [];
  for (const entry of plan.entries) {
    const created = await request({ url: RUN_API, method: "POST", body: entry.responsibilityRunCreate });
    if (created?.ok !== true || !created.payload?.run?.runId) {
      return failed(responseFailure(created, `Could not create the bounded Responsibility Run for ${entry.agentId}`), { bridgeRequests });
    }
    const started = await request({
      url: RUN_API,
      method: "POST",
      body: {
        action: "start",
        runId: created.payload.run.runId,
        contextCharacters: entry.contextPacket.receipt.usedCharacters,
      },
    });
    if (started?.ok !== true || started.payload?.run?.state !== "working") {
      return failed(responseFailure(started, `Could not start the bounded Responsibility Run for ${entry.agentId}`), { bridgeRequests });
    }
    const prepared = await request({
      url: BRIDGE_API,
      method: "POST",
      body: {
        action: "prepare",
        project: entry.project,
        workItem: entry.workItem,
        run: started.payload.run,
        contextPacket: entry.contextPacket,
      },
    });
    if (prepared?.ok !== true || !prepared.payload?.request?.requestId) {
      return failed(responseFailure(prepared, `Could not prepare the Story Bridge request for ${entry.agentId}`), { bridgeRequests });
    }
    if (prepared.payload.request.state !== "ready") {
      return degraded(clean(prepared.payload.request.stateReason, 800) || `${entry.agentId} has no ready signed BUZZ route.`, {
        missingAgentIds: [entry.agentId],
        bridgeRequests,
      });
    }
    const dispatched = await request({
      url: BRIDGE_API,
      method: "POST",
      body: { action: "dispatch", request: prepared.payload.request },
    });
    if (dispatched?.ok !== true || dispatched.payload?.executionPath !== "buzz" || dispatched.payload?.state !== "sent") {
      return failed(responseFailure(dispatched, `Configured BUZZ dispatch failed for ${entry.agentId}`), { bridgeRequests });
    }
    bridgeRequests.push({
      agentId: entry.agentId,
      request: prepared.payload.request,
      requestId: prepared.payload.request.requestId,
      workItemId: prepared.payload.request.workItemId,
      runId: prepared.payload.request.runId,
      baseRevision: prepared.payload.request.baseRevision,
      dispatched: true,
    });
  }

  const allContributions = [];
  const pollAttempts = Math.max(1, Math.min(18, Number(input?.pollAttempts || 12)));
  const pollIntervalMs = Math.max(250, Math.min(10_000, Number(input?.pollIntervalMs || 5_000)));
  for (let attempt = 1; attempt <= pollAttempts; attempt += 1) {
    allContributions.length = 0;
    for (const pending of bridgeRequests) {
      const collected = await request({
        url: BRIDGE_API,
        method: "POST",
        body: { action: "collect", request: pending.request, currentRevision: plan.project.revision },
      });
      if (collected?.ok !== true) {
        return failed(responseFailure(collected, `Configured BUZZ collection failed for ${pending.agentId}`), {
          bridgeRequests: bridgeRequests.map(({ request, ...item }) => item),
        });
      }
      for (const contribution of Array.isArray(collected.payload?.contributions) ? collected.payload.contributions : []) {
        allContributions.push(contribution);
      }
    }
    const proof = createAfterglowBuzzCouncilProof(allContributions, plan.requiredAgentIds);
    if (proof.liveSatisfied) {
      return {
        mode: "buzz-signed",
        configured: true,
        liveSatisfied: true,
        genuineContributionCount: proof.genuineContributionCount,
        requiredContributionCount: proof.requiredCount,
        contributions: allContributions,
        proof: proof.contributions,
        missingAgentIds: [],
        bridgeRequests: bridgeRequests.map(({ request, ...item }) => item),
        polling: { attemptsUsed: attempt, maxAttempts: pollAttempts, intervalMs: pollIntervalMs },
        reason: "Three distinct approved BUZZ specialists returned revision-current signed Story Bridge contributions.",
      };
    }
    if (attempt < pollAttempts) await sleep(pollIntervalMs);
  }

  const proof = createAfterglowBuzzCouncilProof(allContributions, plan.requiredAgentIds);
  return failed(`BUZZ was configured and all three bounded requests were dispatched, but only ${proof.genuineContributionCount}/${proof.requiredCount} required signed contributions passed identity, signature and revision checks before the bounded polling limit.`, {
    genuineContributionCount: proof.genuineContributionCount,
    requiredContributionCount: proof.requiredCount,
    contributions: allContributions,
    proof: proof.contributions,
    missingAgentIds: proof.missingAgentIds,
    bridgeRequests: bridgeRequests.map(({ request, ...item }) => item),
    polling: { attemptsUsed: pollAttempts, maxAttempts: pollAttempts, intervalMs: pollIntervalMs },
  });
}
