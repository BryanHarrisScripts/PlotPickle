import {
  engineeringObservation,
  engineeringHandoff,
} from "./contract.mjs";

// An explicit, on-demand dispatch driver. It never discovers providers,
// publishes GitHub/BUZZ messages, edits files or acquires credentials.
// Host adapters must be independently admitted through PlotPickle's existing
// Responsibility Run/tool/provider grants before being passed to this driver.
export async function executeEngineeringTeam(campaign, options) {
  if (!campaign || campaign.schemaVersion !== 1 || !campaign.scopeHash) {
    throw new Error("Engineering Team requires an admitted campaign.");
  }
  if (typeof options?.getExactHead !== "function") {
    throw new Error("Engineering Team requires a trusted exact-head resolver.");
  }
  const adapters = options.adapters || {};
  if (campaign.roles.length > campaign.budget.maxRoleRuns) {
    throw new Error("Engineering Team budget cannot cover every admitted role.");
  }
  const started = Date.now();
  const observations = [];
  const handoffs = [];
  const roleResults = [];
  const executorIds = new Map();
  let previous = null;

  for (const role of campaign.roles) {
    if (options.signal?.aborted) return result("cancelled");
    if (Date.now() - started > campaign.budget.maxDurationMs) return result("blocked");
    const current = await options.getExactHead();
    if (String(current).toLowerCase() !== campaign.exactSha) return result("stale");
    const adapter = adapters[role];
    const identity = adapter?.executorId;
    // The repairer is deliberately not admitted to a read-only experiment.
    // The existing approved repair workflow has its own separate mutation grant.
    if (role === "repairer" || !adapter || typeof adapter.run !== "function" || !/^[a-z0-9][a-z0-9._:/-]{0,199}$/i.test(identity || "")) {
      roleResults.push(Object.freeze({ role, status: "blocked", reason: "adapter-unavailable-or-write-required" }));
      previous = null;
      continue;
    }
    if ((role === "challenger" && executorIds.get("tester") === identity)
        || (role === "tester" && executorIds.get("challenger") === identity)) {
      roleResults.push(Object.freeze({ role, status: "blocked", reason: "independent-executor-required" }));
      previous = null;
      continue;
    }
    const handoff = previous ? engineeringHandoff(campaign, previous, role) : null;
    if (handoff) {
      if (handoffs.length >= campaign.budget.maxMessages) return result("blocked");
      handoffs.push(handoff);
    }
    // Model/tool output is explicitly not an authority or a verification
    // receipt. Executor identity is host-owned, not model-declared.
    let raw;
    try {
      raw = await adapter.run(Object.freeze({
        role, exactSha: campaign.exactSha,
        taskRef: campaign.taskRef,
        scopeHash: campaign.scopeHash,
        handoff,
        permissions: Object.freeze({
          sourceMutationAllowed: false,
          mergeAllowed: false,
          publicBuzzPostingAllowed: false,
          humanCredentialAccessAllowed: false,
        }),
      }));
    } catch {
      roleResults.push(Object.freeze({ role, status: "blocked", reason: "adapter-failed" }));
      previous = null;
      continue;
    }
    if (options.signal?.aborted) return result("cancelled");
    if (String(await options.getExactHead()).toLowerCase() !== campaign.exactSha) return result("stale");
    try {
      const item = engineeringObservation(campaign, {
        exactSha: campaign.exactSha,
        observationId: raw?.observationId,
        executorId: identity,
        role,
        state: raw?.state,
        findingRef: raw?.findingRef,
        summary: raw?.summary,
        evidenceRefs: raw?.evidenceRefs,
      });
      observations.push(item);
      executorIds.set(role, identity);
      roleResults.push(Object.freeze({ role, status: "observed", observationId: item.observationId }));
      previous = item;
    } catch {
      roleResults.push(Object.freeze({ role, status: "blocked", reason: "invalid-role-output" }));
      previous = null;
    }
  }
  return result(roleResults.every((item) => item.status === "observed") ? "observed" : "blocked");

  function result(status) {
    return Object.freeze({
      schemaVersion: 1,
      campaignId: campaign.campaignId,
      exactSha: campaign.exactSha,
      scopeHash: campaign.scopeHash,
      status, // "observed" is NOT "passed" or verified.
      observations: Object.freeze([...observations]),
      handoffs: Object.freeze([...handoffs]),
      roleResults: Object.freeze([...roleResults]),
      verified: false,
      mergeEligible: false,
      publishedExternally: false,
    });
  }
}
