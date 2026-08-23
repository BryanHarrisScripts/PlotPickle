import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("structured telemetry is appended to the existing Responsibility Run event truth", async () => {
  const [telemetry, runs] = await Promise.all([
    read("lib/runtime/run-telemetry.ts"),
    read("lib/agents/responsibility/responsibility-runs.ts"),
  ]);
  assert.match(runs, /events: ResponsibilityRunEvent\[\]/);
  assert.match(telemetry, /appendRunTelemetryEvent/);
  assert.match(telemetry, /events: \[\.\.\.run\.events, event\]/);
  assert.match(telemetry, /runId: run\.runId/);
  for (const type of ["profile.bound", "skill.bound", "context.bound", "model.request", "model.response", "tool.call", "tool.result", "policy.decision", "verification.result", "writer.decision", "graph.node", "provider.health", "context.restart", "usage.snapshot", "error"]) {
    assert.match(telemetry, new RegExp(`"${type.replaceAll(".", "\\.")}"`));
  }
});

test("model requests are recorded before send and can be reconstructed with a desync assertion", async () => {
  const telemetry = await read("lib/runtime/run-telemetry.ts");
  assert.match(telemetry, /ModelRequestBlueprint/);
  assert.match(telemetry, /recordModelRequest/);
  assert.match(telemetry, /modelRequestFingerprint/);
  assert.match(telemetry, /reconstructModelRequest/);
  assert.match(telemetry, /assertModelRequestSynchronized/);
  assert.match(telemetry, /context\/request desync/);
  assert.match(telemetry, /contextPacketId/);
  assert.match(telemetry, /contextSourceIds/);
  assert.match(telemetry, /toolSchemaIds/);
  assert.match(telemetry, /userInput/);
});

test("telemetry sanitization excludes credentials and hidden reasoning rather than logging them for completeness", async () => {
  const telemetry = await read("lib/runtime/run-telemetry.ts");
  assert.match(telemetry, /SECRET_KEY/);
  assert.match(telemetry, /SECRET_VALUE/);
  assert.match(telemetry, /HIDDEN_REASONING_KEY/);
  assert.match(telemetry, /\[redacted\]/);
  assert.match(telemetry, /chain\[_ -\]\?of\[_ -\]\?thought/);
  assert.match(telemetry, /hidden\[_ -\]\?reasoning/);
  assert.doesNotMatch(telemetry, /privateKey:\s*data|apiKey:\s*data|chainOfThought:\s*data/);
});

test("usage accounting labels exact estimated and unknown tokens/cost instead of pretending precision", async () => {
  const telemetry = await read("lib/runtime/run-telemetry.ts");
  assert.match(telemetry, /UsagePrecision = "exact" \| "estimated" \| "unknown"/);
  assert.match(telemetry, /inputTokens/);
  assert.match(telemetry, /outputTokens/);
  assert.match(telemetry, /contextCharacters/);
  assert.match(telemetry, /cloudCostUsd/);
  assert.match(telemetry, /timeToFirstTokenMs/);
  assert.match(telemetry, /completionLatencyMs/);
  assert.match(telemetry, /estimatedTokenEvents/);
  assert.match(telemetry, /unknownTokenEvents/);
  assert.match(telemetry, /estimatedCostEvents/);
  assert.match(telemetry, /unknownCostEvents/);
  assert.match(telemetry, /RouteClass = "local" \| "cloud-byok" \| "none"/);
});

test("provider protocol adapters hide model quirks below Agent Profiles without granting authority or paid fallback", async () => {
  const [harness, profiles] = await Promise.all([
    read("lib/runtime/provider-harness.ts"),
    read("lib/agents/agent-profiles.ts"),
  ]);
  assert.match(harness, /openAiCompatibleAdapter/);
  assert.match(harness, /plotPickleLocalAdapter/);
  assert.match(harness, /normalizeRequest/);
  assert.match(harness, /normalizeResponse/);
  assert.match(harness, /normalizeFailure/);
  assert.match(harness, /previous_response_id/);
  assert.match(harness, /prompt_tokens/);
  assert.match(harness, /completion_tokens/);
  assert.match(harness, /grantsTools: false/);
  assert.match(harness, /changesPpfAuthority: false/);
  assert.match(harness, /changesContextTrust: false/);
  assert.match(harness, /enablesPaidCloudFallback: false/);
  assert.match(profiles, /AGENT_PROFILE_CAPABILITY_ROLES/);
  assert.doesNotMatch(profiles, /openai-compatible|plotpickle-local/);
});

test("provider health and circuit state are explicit and never imply a silent route change", async () => {
  const harness = await read("lib/runtime/provider-harness.ts");
  for (const state of ["healthy", "unavailable", "timeout", "rate-limited", "circuit-open", "recovering"]) assert.match(harness, new RegExp(`"${state}"`));
  assert.match(harness, /consecutiveFailures >= 3/);
  assert.match(harness, /providerCircuitAllowsAttempt/);
  assert.match(harness, /recoverAfterMs/);
  assert.doesNotMatch(harness, /fallbackProvider|switchToCloud|autoCloud|paidFallback/);
});

test("portability evals cover Sage PLAN graph schema and known-bad verifier rejection with model-independent rules", async () => {
  const evals = await read("lib/verification/model-portability-evals.ts");
  for (const caseId of ["sage-grounding", "plan-proposal", "graph-structured-output", "verifier-known-bad"]) assert.match(evals, new RegExp(`"${caseId}"`));
  assert.match(evals, /evaluateSageGrounding/);
  assert.match(evals, /requiredSourceIds/);
  assert.match(evals, /evaluatePlanProposal/);
  assert.match(evals, /requiredFieldIds/);
  assert.match(evals, /evaluateGraphStructuredOutput/);
  assert.match(evals, /validateStructuredObject/);
  assert.match(evals, /evaluateVerifierKnownBad/);
  assert.match(evals, /Verifier failed to reject the known-bad finding/);
  assert.match(evals, /expectedFailedRule/);
});

test("portability reports compare runtime/provider/model variants without changing Agent definitions or production routing", async () => {
  const evals = await read("lib/verification/model-portability-evals.ts");
  assert.match(evals, /PortabilityVariant/);
  assert.match(evals, /capabilityRole/);
  assert.match(evals, /runtime/);
  assert.match(evals, /provider/);
  assert.match(evals, /model/);
  assert.match(evals, /comparePortabilityReports/);
  assert.match(evals, /mutatesPpf: false/);
  assert.match(evals, /changesProductionRouting: false/);
  assert.match(evals, /letsAgentSelfGradeAsSoleAuthority: false/);
  assert.match(evals, /usesPopularityAsAcceptanceMetric: false/);
});

test("portability evals include reconstruction loop and retry integrity signals", async () => {
  const evals = await read("lib/verification/model-portability-evals.ts");
  assert.match(evals, /reconstructionSynchronized/);
  assert.match(evals, /context\/request reconstruction desynchronized/);
  assert.match(evals, /loopCount/);
  assert.match(evals, />= 8/);
  assert.match(evals, /retryCount/);
  assert.match(evals, /> 4/);
  assert.match(evals, /evaluateIntegritySignals/);
});

test("Skills are evaluatable versioned artifacts including trust/source/eval metadata and overhead", async () => {
  const evals = await read("lib/verification/model-portability-evals.ts");
  for (const field of ["skillId", "skillTrustState", "skillSourceRevision", "skillSourceHash"]) assert.match(evals, new RegExp(`${field}:`));
  assert.match(evals, /PORTABILITY_EVAL_REVISION/);
  assert.match(evals, /compareSkillVariants/);
  assert.match(evals, /qualityDelta/);
  assert.match(evals, /tokenDelta/);
  assert.match(evals, /contextCharacterDelta/);
  assert.match(evals, /promotionEligible/);
  assert.match(evals, /skillTriggerReliability/);
  assert.match(evals, /triggerSelectedSkillId/);
});

test("persistent telemetry appends to the same local Run file with serialized per-Run writes", async () => {
  const [gateway, vite] = await Promise.all([
    read("build/run-telemetry-gateway.ts"),
    read("vite.config.ts"),
  ]);
  assert.match(gateway, /persistentHome\(\), "responsibility-runs"/);
  assert.match(gateway, /\/api\/responsibility-runs\/telemetry/);
  assert.match(gateway, /appendRunTelemetryEvent/);
  assert.match(gateway, /writeQueues = new Map/);
  assert.match(gateway, /enqueue/);
  assert.match(gateway, /rename\(temporary, file\)/);
  assert.match(gateway, /local\(request\)/);
  assert.match(vite, /runTelemetryGateway/);
});

test("Agent Activity renders plain-language event-derived summary first and expandable technical detail", async () => {
  const activity = await read("app/responsibility-run-activity.tsx");
  assert.match(activity, /summarizeRunTelemetry/);
  assert.match(activity, /telemetry\.plainLanguage/);
  assert.match(activity, /Technical Run details/);
  assert.match(activity, /Provider health/);
  assert.match(activity, /Token accounting/);
  assert.match(activity, /Cloud cost/);
  assert.match(activity, /Safety signals/);
  assert.match(activity, /partial\/truncated result/);
  assert.match(activity, /Private internal deliberation and credentials are not recorded/);
});

test("Verification Inbox and BUZZ can reference a Run without duplicating private telemetry", async () => {
  const telemetry = await read("lib/runtime/run-telemetry.ts");
  assert.match(telemetry, /minimalVerificationRunReference/);
  assert.match(telemetry, /return \{ runId: text\(runId/);
  assert.match(telemetry, /minimalBuzzRunReceipt/);
  assert.match(telemetry, /profileId/);
  assert.match(telemetry, /state: run\.state/);
  assert.doesNotMatch(telemetry, /minimalBuzzRunReceipt[\s\S]{0,300}events:/);
});
