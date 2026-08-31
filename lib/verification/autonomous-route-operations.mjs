const OPERATOR_ID = "plotpickle-autonomous-route-controller";

const ACTION_IDS = Object.freeze({
  library: "verify-library-working-copy",
  plan: "audit-plan-frontier",
  build: "audit-canonical-story-structure",
  "story-decisions": "audit-story-decision-queue",
  "story-workbench": "verify-workbench-operation",
  storyboard: "audit-storyboard-anchor",
  "production-shots": "audit-production-shot-state",
  "previs-animatic": "audit-previs-timing-state",
  write: "audit-write-projection",
  edit: "audit-edit-projection",
  refine: "audit-refinement-state",
});

function text(value, maximum = 240) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

const boundedCount = (value) => Math.max(0, Math.trunc(Number(value) || 0));

function baseReceipt(route, probe, expectedProjectId) {
  return {
    attempted: true,
    succeeded: false,
    actionId: ACTION_IDS[route.id] || `operate-${route.id}`,
    operatorId: OPERATOR_ID,
    outcome: "blocked",
    canonicalProjectId: text(probe?.projectId || expectedProjectId, 180),
    revision: text(probe?.revision, 120),
    writesCanon: false,
    error: "",
  };
}

export function evaluateAutonomousRouteOperation(route, evidence = {}, probe = {}, context = {}) {
  if (route?.operation !== "operate") return {};
  const expectedProjectId = text(context.expectedProjectId, 180);
  const receipt = baseReceipt(route, probe, expectedProjectId);
  if (!expectedProjectId) return { ...receipt, error: `${route.label} operation requires the reference working-copy project id.` };
  if (!evidence.reached) return { ...receipt, error: evidence.error || `${route.label} did not render before its operation.` };

  const actualProjectId = text(probe?.projectId, 180);
  if (actualProjectId && actualProjectId !== expectedProjectId) {
    return { ...receipt, error: `${route.label} exposed a different canonical project identity.` };
  }

  if (route.id === "library") {
    const body = text(evidence.bodyText, 20_000).toLowerCase();
    if (!body.includes("my stories") || !body.includes("afterglow")) {
      return { ...receipt, error: "Library did not prove the normal Afterglow working-copy shelf after bootstrap." };
    }
    return { ...receipt, succeeded: true, outcome: "verified-existing-working-copy" };
  }

  if (route.id === "story-decisions") {
    if (probe?.decisionQueueReachable !== true) {
      return { ...receipt, error: probe?.decisionQueueError || "Story Decision gateway could not be reached through the autonomous Guest application session." };
    }
    const actionable = boundedCount(probe?.actionableDecisionCount);
    if (actionable > 0) {
      return { ...receipt, error: `${actionable} actionable Story Decision(s) remain; route entry cannot substitute for the delegated Decision/Workbench operator.` };
    }
    return { ...receipt, succeeded: true, outcome: "completed-no-change", decisionCount: boundedCount(probe?.decisionCount) };
  }

  if (["storyboard", "production-shots", "previs-animatic"].includes(route.id)) {
    if (!actualProjectId) {
      return { ...receipt, error: `${route.label} did not expose canonical project identity for the visual-production operator audit.` };
    }
    if (boundedCount(probe?.staleProductionTargets) > 0) {
      return { ...receipt, error: `${route.label} still exposes stale production targets that require visual-operator work.` };
    }
    return {
      ...receipt,
      succeeded: true,
      outcome: "completed-no-change",
      readinessItems: boundedCount(probe?.readinessItems),
      storyDecisionTargets: boundedCount(probe?.storyDecisionTargets),
    };
  }

  if (route.id === "story-workbench") {
    if (!String(evidence.resolvedRoute || "").includes("decisionId=")) {
      return { ...receipt, error: "Story Workbench operation requires an answered Story Decision route input." };
    }
    return { ...receipt, succeeded: true, outcome: "verified-workbench-package" };
  }

  return { ...receipt, succeeded: true, outcome: "completed-no-change" };
}

export async function captureAutonomousRouteOperationProbe(session, route) {
  if (route?.operation !== "operate") return {};
  const raw = await session.client.call("browser_evaluate", {
    function: `async () => {
      const body = (document.body.innerText || '').replace(/\\s+/g, ' ').trim();
      const revisionMatch = body.match(/(?:PPF|Current) revision\\s+([0-9]+)/i);
      const root = document.querySelector('[data-canonical-project-id]');
      let decisionQueueReachable = false;
      let decisionQueueError = '';
      let decisionCount = 0;
      let actionableDecisionCount = 0;
      if (location.pathname === '/story-decisions') {
        try {
          const response = await fetch('/api/story-decisions', { cache: 'no-store', credentials: 'same-origin' });
          if (response.ok) {
            const payload = await response.json();
            const decisions = Array.isArray(payload && payload.decisions) ? payload.decisions : [];
            decisionQueueReachable = true;
            decisionCount = decisions.length;
            actionableDecisionCount = decisions.filter((decision) => ['new', 'reviewing', 'deferred'].includes(String(decision && decision.status || ''))).length;
          } else {
            decisionQueueError = 'Story Decision gateway returned HTTP ' + response.status + '.';
          }
        } catch (error) {
          decisionQueueError = error instanceof Error ? error.message : String(error);
        }
      }
      return {
        projectId: root ? (root.getAttribute('data-canonical-project-id') || '') : '',
        revision: revisionMatch ? revisionMatch[1] : '',
        decisionQueueReachable,
        decisionQueueError,
        decisionCount,
        actionableDecisionCount,
        storyDecisionTargets: document.querySelectorAll('[data-story-decision-target]').length,
        readinessItems: document.querySelectorAll('[data-canonical-readiness-item]').length,
        staleProductionTargets: document.querySelectorAll('[data-stale="true"]').length
      };
    }`,
  });
  const textResult = (raw?.content || []).map((item) => item?.text || "").join("\n");
  const start = textResult.indexOf("{");
  const end = textResult.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error(`${route.label} operation probe returned no JSON object.`);
  try {
    return JSON.parse(textResult.slice(start, end + 1));
  } catch (error) {
    throw new Error(`${route.label} operation probe returned invalid JSON.`, { cause: error });
  }
}
