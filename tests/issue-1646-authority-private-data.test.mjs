import assert from "node:assert/strict";
import test from "node:test";

import { decideLifecycleAuthority } from "../core/lifecycle/lifecycle-authority.mjs";

function envelope() {
  return {
    schemaVersion: 1,
    runId: "run-private-proof",
    projectId: "project-private-proof",
    revision: "1",
    stage: "enter-understand",
    priorTransition: null,
    actor: { actorId: "guest-private", kind: "guest", authorityClass: "delegated-guest-autonomous-operator", delegated: true, humanProfileId: "", operatorId: "guest-operator", authorityRef: "authority:guest-private" },
    intent: { kind: "story-run", ref: "intent:private-proof" },
    planOrDecisionRefs: [],
    capabilities: ["route:learn"],
    contextRefs: [],
    inputRefs: [],
    outputRefs: [],
    evidenceRefs: [],
    integrationRefs: [],
    contractRefs: [],
    validation: { result: "not-run", authorityRef: "", evidenceRefs: [] },
    repairBudget: { attempts: 0, maxAttempts: 2 },
    persistence: { classification: "none", ownerRef: "", decision: "approved", approvalRef: "" },
    stopReason: { code: "", detailRef: "" },
    nextAction: { action: "prepare", ref: "lifecycle:learn-prepare", continuationRef: "run:private-proof" },
  };
}

test("#1646 authority gate inherits lifecycle privacy rejection rather than becoming a second payload channel", () => {
  assert.throws(
    () => decideLifecycleAuthority({ envelope: { ...envelope(), hiddenReasoning: "private" }, action: "observe" }),
    /forbidden private or credential field/,
  );
  assert.throws(
    () => decideLifecycleAuthority({ envelope: { ...envelope(), apiKey: "secret" }, action: "observe" }),
    /forbidden private or credential field/,
  );
});
