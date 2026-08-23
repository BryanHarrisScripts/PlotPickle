import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Responsibility Runs expose the bounded lifecycle requested by the architecture", async () => {
  const source = await read("lib/agents/responsibility/responsibility-runs.ts");
  for (const state of ["queued", "preparing-context", "working", "verifying", "revising", "waiting-for-writer", "paused", "completed", "failed", "cancelled"]) {
    assert.match(source, new RegExp(`"${state}"`));
  }
  for (const limit of ["maxAttempts", "timeoutMs", "maxParallelChildren", "maxContextCharacters", "maxTokens", "maxToolCalls", "maxCloudCostUsd"]) {
    assert.match(source, new RegExp(limit));
  }
  assert.match(source, /responsibilityRunLimitStatus/);
  assert.match(source, /beginResponsibilityAttempt/);
  assert.match(source, /limit:attempts/);
});

test("deterministic workers can observe but only authoritative verification can PASS or FAIL the Run", async () => {
  const [runs, verifier] = await Promise.all([
    read("lib/agents/responsibility/responsibility-runs.ts"),
    read("scripts/verification-orchestrator.mjs"),
  ]);
  assert.match(runs, /recordWorkerVerificationObservation/);
  assert.match(runs, /authority: "worker-observation"/);
  assert.match(runs, /result: "OBSERVATION"/);
  assert.match(runs, /recordAuthoritativeDeterministicVerification/);
  assert.match(runs, /authority: "authoritative-system"/);
  assert.match(runs, /Prior FAIL evidence remains immutable; bounded revision may occur before a fresh retest/);
  assert.match(verifier, /agentsMayOverridePassFail: false/);
  assert.match(verifier, /requiresRerun:true/);
  assert.match(runs, /responsibilityRunFromFullVerification/);
});

test("creative Runs stop at the writer gate and never turn artifacts into canon themselves", async () => {
  const [runs, revisions] = await Promise.all([
    read("lib/agents/responsibility/responsibility-runs.ts"),
    read("lib/project-revisions.ts"),
  ]);
  assert.match(runs, /createCreativeResponsibilityRun/);
  assert.match(runs, /requestWriterApproval/);
  assert.match(runs, /state !== "waiting-for-writer"/);
  assert.match(runs, /writerId/);
  assert.match(runs, /canonical: false/);
  assert.match(runs, /PPF canon mutation still requires the separate revision-aware PPF apply boundary/);
  assert.match(revisions, /applyWriterApprovedCanonicalProposal/);
  assert.match(revisions, /Explicit writer approval is required for canonical mutation/);
});

test("pause, resume, cancel and redirect remain host-visible state changes without canon mutation", async () => {
  const source = await read("lib/agents/responsibility/responsibility-runs.ts");
  for (const operation of ["pauseResponsibilityRun", "resumeResponsibilityRun", "cancelResponsibilityRun", "redirectResponsibilityRun"]) {
    assert.match(source, new RegExp(operation));
  }
  assert.match(source, /Writer identity is required to redirect a Run objective/);
  assert.match(source, /objectiveRevision: run\.objectiveRevision \+ 1/);
  assert.match(source, /Produced creative artifacts remain non-canonical proposals\/evidence only/);
  assert.doesNotMatch(source, /writeProject|saveProject|ppf-direct-write/);
});

test("equivalent repeated tool calls produce escalating reminders before hard host limits", async () => {
  const source = await read("lib/agents/responsibility/responsibility-runs.ts");
  assert.match(source, /REPETITION_THRESHOLDS = \[3, 5, 8\]/);
  assert.match(source, /stable\(input\.arguments\)/);
  assert.match(source, /deniedCount/);
  assert.match(source, /Re-read the previous result before trying it again/);
  assert.match(source, /Change approach, use existing evidence, or conclude this step/);
  assert.match(source, /Repeated tool use is consuming the Run budget/);
  assert.match(source, /usage: \{ \.\.\.run\.usage, toolCalls: run\.usage\.toolCalls \+ 1 \}/);
  assert.match(source, /responsibilityRunLimitStatus\(next, now\)/);
});

test("fresh-context restart carries only a compact handoff and cannot alter objective or permissions", async () => {
  const source = await read("lib/agents/responsibility/responsibility-runs.ts");
  assert.match(source, /ResponsibilityRunHandoff/);
  for (const field of ["status", "summary", "evidence", "nextSteps", "blocker"]) assert.match(source, new RegExp(`${field}:`));
  assert.match(source, /restartResponsibilityRunContext/);
  assert.match(source, /contextRound: run\.contextRound \+ 1/);
  assert.match(source, /samePermissions\(run, next\)/);
  assert.match(source, /next\.goal !== run\.goal/);
  assert.match(source, /prior transcript is not part of the handoff/);
  assert.doesNotMatch(source, /transcript:|messages:|conversationHistory:/);
});

test("Run records persist under the local PlotPickle home and are queryable/controlable by ID", async () => {
  const [gateway, vite] = await Promise.all([
    read("build/responsibility-run-gateway.ts"),
    read("vite.config.ts"),
  ]);
  assert.match(gateway, /persistentHome\(\), "responsibility-runs"/);
  assert.match(gateway, /\/api\/responsibility-runs/);
  assert.match(gateway, /url\.searchParams\.get\("runId"\)/);
  assert.match(gateway, /readRun\(requested\)/);
  assert.match(gateway, /saveRun/);
  assert.match(gateway, /rename\(temporary, file\)/);
  assert.match(gateway, /action === "pause"/);
  assert.match(gateway, /action === "resume"/);
  assert.match(gateway, /action === "cancel"/);
  assert.match(gateway, /action === "redirect"/);
  assert.match(gateway, /action === "fresh-context"/);
  assert.match(vite, /responsibilityRunGateway/);
});

test("Responsibility Run activity remains understandable while the simplified public Agent roster omits operator controls", async () => {
  const [roster, activity] = await Promise.all([
    read("app/community-agent-roster.tsx"),
    read("app/responsibility-run-activity.tsx"),
  ]);
  assert.doesNotMatch(roster, /ResponsibilityRunActivity/);
  assert.match(activity, /Responsibility Runs/);
  assert.match(activity, /Bounded work with visible limits and human gates/);
  assert.match(activity, /Waiting for/);
  assert.match(activity, /Attempt/);
  assert.match(activity, /Tool calls/);
  assert.match(activity, /Cloud budget/);
  assert.match(activity, />Pause</);
  assert.match(activity, />Resume</);
  assert.match(activity, />Stop</);
  assert.doesNotMatch(activity, /chain[-_ ]?of[-_ ]?thought|hidden reasoning|scratchpad/i);
});

test("local-first cloud safety remains explicit in Run budgets and connector policy", async () => {
  const [runs, policy] = await Promise.all([
    read("lib/agents/responsibility/responsibility-runs.ts"),
    read("lib/agents/responsibility/connector-trust-policy.ts"),
  ]);
  assert.match(runs, /maxCloudCostUsd/);
  assert.match(runs, /cloudCostUsd > run\.limits\.maxCloudCostUsd/);
  assert.match(policy, /call-cloud-provider/);
  assert.match(policy, /network-egress/);
  assert.match(policy, /scope-not-granted/);
});
