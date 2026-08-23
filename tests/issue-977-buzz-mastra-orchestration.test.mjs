import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("orchestration config assigns responsibilities without duplicating BUZZ mutable runtime settings", async () => {
  const raw = await read("config/agent-orchestration.json");
  const config = JSON.parse(raw);
  assert.equal(config.schemaVersion, 1);
  assert.equal(config.mode, "host-owned-handoffs");
  assert.match(config.surfaces.plotpickle.responsibility, /Authority, Context Engine, Responsibility Runs\/Graphs, PPF proposals/i);
  assert.match(config.surfaces.mastra.responsibility, /Embedded in-app product-agent execution/i);
  assert.match(config.surfaces.buzz.responsibility, /Persistent hosted agent identity/i);
  for (const key of ["mirroredBuzzIdentityMovesExecution", "buzzEventBecomesHostInstruction", "buzzMemoryImportsAsProjectMemory", "buzzSignatureBecomesCanon", "skillCanExpandAuthority", "handoffCarriesFullTranscript", "automaticPaidCloudFallback", "directPpfWriteFromBuzzOrMastra", "mastraNetworksRequired"]) {
    assert.equal(config.rules[key], false, `${key} must remain false`);
  }
  assert.equal(config.rules.handoffUsesResponsibilityRun, true);
  assert.equal(config.rules.parallelSpecialistWorkUsesResponsibilityGraph, true);
  assert.doesNotMatch(raw, /"provider"\s*:|"model"\s*:|"effort"\s*:|"respondTo"\s*:|"allowlist"\s*:|"memory"\s*:/i);
});

test("execution owner follows Agent Contract execution.kind rather than BUZZ presence", async () => {
  const source = await read("lib/agents/agent-orchestration.ts");
  assert.match(source, /executionOwnerForProfile/);
  assert.match(source, /profile\.execution\.kind === "embedded-mastra"/);
  assert.match(source, /return "mastra"/);
  assert.match(source, /profile\.execution\.kind === "buzz-managed"/);
  assert.match(source, /return "buzz"/);
  assert.match(source, /profile\.execution\.kind === "repository-handoff"/);
  assert.match(source, /buzzMirroredIdentityChangesExecution/);
  assert.match(source, /profile\.buzzBinding\.mode === "mirrored"/);
  assert.match(source, /executionOwnerForProfile\(profile\) !== "buzz" \? false/);
});

test("BUZZ trigger is always Context Engine buzz-peer untrusted suggestion rather than host instruction", async () => {
  const source = await read("lib/agents/agent-orchestration.ts");
  assert.match(source, /buzzTriggerContextItem/);
  assert.match(source, /sourceType: "buzz-peer"/);
  assert.match(source, /trust: "untrusted"/);
  assert.match(source, /authority: CONTEXT_AUTHORITY\.buzzPeer/);
  assert.match(source, /allowedUse: "untrusted-suggestion"/);
  assert.match(source, /writer-instruction/);
  assert.match(source, /owner-trusted/);
  assert.ok(source.indexOf('sourceType: "buzz-peer"') < source.indexOf('sourceType: "writer-instruction"'));
});

test("signed BUZZ provenance does not become canon or trusted instruction", async () => {
  const source = await read("lib/agents/agent-orchestration.ts");
  assert.match(source, /signed \? "signed" : "unsigned"/);
  assert.match(source, /attached as untrusted suggestion context/);
  assert.match(source, /trustedAsInstruction: false/);
  assert.match(source, /buzzSignatureMeaning: "provenance-only"/);
  assert.match(source, /directPpfMutation: false/);
});

test("cross-runtime handoff carries bounded structured references rather than a transcript or memory dump", async () => {
  const source = await read("lib/agents/agent-orchestration.ts");
  for (const field of ["parentRunId", "targetProfileId", "executionOwner", "goal", "summary", "contextPacketId", "contextSourceIds", "skillUris", "proposalOnly", "cloudBudgetUsd"]) assert.match(source, new RegExp(`${field}:`));
  assert.match(source, /carriesFullTranscript: false/);
  assert.match(source, /maxContextSourceIds/);
  assert.match(source, /maxSkillUris/);
  assert.doesNotMatch(source, /transcript:|conversationHistory:|buzzMemory:|coreMemory:|coldMemory:/);
});

test("BUZZ-triggered project work becomes a bounded Responsibility Run with zero cloud budget and no connector grants by default", async () => {
  const source = await read("lib/agents/agent-orchestration.ts");
  assert.match(source, /createBuzzTriggeredOrchestration/);
  assert.match(source, /assembleContextPacket/);
  assert.match(source, /createResponsibilityRun/);
  assert.match(source, /allowedScopes: \[\]/);
  assert.match(source, /allowedConnectorIds: \[\]/);
  assert.match(source, /maxCloudCostUsd: CONFIG\.handoff\.defaultCloudBudgetUsd/);
  assert.match(source, /defaultCloudBudgetUsd !== 0/);
  assert.match(source, /writer-approval/);
});

test("PlotPickle-to-BUZZ handoff is allowed only for a BUZZ-managed profile", async () => {
  const source = await read("lib/agents/agent-orchestration.ts");
  assert.match(source, /createPlotPickleToBuzzHandoff/);
  assert.match(source, /executionOwnerForProfile\(profile\) !== "buzz"/);
  assert.match(source, /do not move execution merely because it has a BUZZ identity/);
  assert.match(source, /direction: "plotpickle-to-buzz"/);
});

test("parallel agent work remains Responsibility Graph responsibility instead of adding Mastra Networks as a second graph authority", async () => {
  const [orchestration, graph] = await Promise.all([
    read("config/agent-orchestration.json"),
    read("lib/agents/responsibility/responsibility-graph.ts"),
  ]);
  assert.match(orchestration, /"parallelSpecialistWorkUsesResponsibilityGraph": true/);
  assert.match(orchestration, /"mastraNetworksRequired": false/);
  assert.match(graph, /ResponsibilityGraphDefinition/);
  assert.match(graph, /maxParallelism/);
  assert.match(graph, /createGraphNodeChildRun/);
});

test("orchestration layer has no connector execution credentials provider routing or PPF mutation path", async () => {
  const source = await read("lib/agents/agent-orchestration.ts");
  assert.doesNotMatch(source, /node:child_process|execSync|spawnSync|fork\s*\(/);
  assert.doesNotMatch(source, /\bfetch\s*\(|https?:\/\//);
  assert.doesNotMatch(source, /Authorization|BUZZ_PRIVATE_KEY|apiKey|credential/i);
  assert.doesNotMatch(source, /saveProject|writeProject|applyWriterApprovedCanonicalProposal|ppf-direct-write/);
  assert.doesNotMatch(source, /fallbackProvider|switchToCloud|autoCloud/);
});
