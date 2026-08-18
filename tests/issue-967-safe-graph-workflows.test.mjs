import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("graph nodes define one bounded job with structured contracts, policy scopes, isolation and verification", async () => {
  const source = await read("lib/responsibility-graph.ts");
  assert.match(source, /GraphNodeContract/);
  for (const field of ["job", "profileId", "capabilityRole", "allowedScopes", "allowedConnectorIds", "inputSchema", "outputSchema", "exclusiveResources", "timeoutMs", "tokenBudget", "cloudCostBudgetUsd", "failureRoutes", "verification"]) {
    assert.match(source, new RegExp(`${field}:`), `missing node field ${field}`);
  }
  assert.match(source, /validateStructuredObject/);
  assert.match(source, /Structured result contains an undeclared field/);
  assert.match(source, /Structured result exceeds its node byte budget/);
});

test("data edges require real declared output-to-input dependencies instead of arbitrary sequence", async () => {
  const source = await read("lib/responsibility-graph.ts");
  assert.match(source, /GraphDependency/);
  assert.match(source, /outputFields: string\[\]/);
  assert.match(source, /inputKeys: string\[\]/);
  assert.match(source, /must represent a real structured data dependency/);
  assert.match(source, /requests undeclared output/);
  assert.match(source, /targets undeclared input/);
  assert.match(source, /readyGraphNodeIds/);
  assert.match(source, /node\.dependencies\.every\(\(dependency\) => dependencyPassed/);
});

test("independent nodes are schedulable in parallel while shared resources remain isolated", async () => {
  const source = await read("lib/responsibility-graph.ts");
  assert.match(source, /maxParallelism/);
  assert.match(source, /runningResourceIds/);
  assert.match(source, /busyResources\.has\(resource\) \|\| selectedResources\.has\(resource\)/);
  assert.match(source, /slice\(0, slots\)/);
  assert.match(source, /graphParallelWidth/);
  assert.match(source, /codeSweepGraphFixture/);
  assert.match(source, /dependencies: \[\]/);
  assert.match(source, /sequentialGraphFixture/);
  assert.match(source, /Review cannot start until the draft it reviews exists/);
});

test("developer workers require worktree isolation while creative work stays on proposal boundaries", async () => {
  const source = await read("lib/responsibility-graph.ts");
  assert.match(source, /workerType === "developer-worker" && node\.isolation\.mode !== "git-worktree"/);
  assert.match(source, /requires isolated git-worktree execution/);
  assert.match(source, /workerType === "product-agent" && node\.isolation\.mode === "git-worktree"/);
  assert.match(source, /mode: "proposal-revision"/);
  assert.doesNotMatch(source, /saveProject|writeProject|ppf-direct-write|applyWriterApprovedCanonicalProposal/);
});

test("node outcomes are machine-routable through pass retry reroute escalate and stop", async () => {
  const source = await read("lib/responsibility-graph.ts");
  assert.match(source, /GRAPH_OUTCOME_ROUTES = \["pass", "retry", "reroute", "escalate", "stop"\]/);
  for (const route of ["pass", "retry", "reroute", "escalate", "stop"]) assert.match(source, new RegExp(`input\.route === "${route}"|route: "${route}"|${route}:`));
  assert.match(source, /failedRule/);
  assert.match(source, /evidence/);
  assert.match(source, /target/);
  assert.match(source, /maxRetries/);
});

test("fresh verifier receives structured output and evidence rather than the worker transcript", async () => {
  const source = await read("lib/responsibility-graph.ts");
  assert.match(source, /freshVerifierInput/);
  assert.match(source, /structuredOutput: result\.output/);
  assert.match(source, /evidence: result\.evidence/);
  assert.match(source, /workerSelfAssessmentAuthority: "none"/);
  assert.match(source, /node\.verification\.verifierProfileId === node\.profileId/);
  assert.match(source, /A graph worker cannot be the sole verifier of its own output/);
  assert.doesNotMatch(source, /workerTranscript|conversationHistory|fullTranscript/);
});

test("fan-in detects missing and failed children and partial completion must be explicit", async () => {
  const source = await read("lib/responsibility-graph.ts");
  assert.match(source, /fanInGraphResults/);
  assert.match(source, /missingNodeIds/);
  assert.match(source, /failedNodeIds/);
  assert.match(source, /if \(partial && !allowPartial\)/);
  assert.match(source, /records: \[\]/);
  assert.match(source, /expectedCount/);
  assert.match(source, /receivedCount/);
});

test("layered fan-in bounds raw result count and bytes before synthesis", async () => {
  const source = await read("lib/responsibility-graph.ts");
  assert.match(source, /layeredFanIn/);
  assert.match(source, /maxItemsPerLayer/);
  assert.match(source, /maxBytesPerLayer/);
  assert.match(source, /A single fan-in record exceeds the layered fan-in byte cap/);
  assert.match(source, /batch\.length >= maxItems/);
  assert.match(source, /batchBytes \+ recordBytes > maxBytes/);
});

test("discovery rounds stop deterministically after no-new rounds or graph caps", async () => {
  const source = await read("lib/responsibility-graph.ts");
  assert.match(source, /advanceDiscoveryRound/);
  assert.match(source, /noNewRounds >= 2/);
  assert.match(source, /two-rounds-no-new-findings/);
  assert.match(source, /max-rounds/);
  assert.match(source, /max-nodes/);
});

test("graph budgets cannot exceed the parent Responsibility Run or silently enable cloud spend", async () => {
  const source = await read("lib/responsibility-graph.ts");
  assert.match(source, /Graph parallelism exceeds the parent Responsibility Run child cap/);
  assert.match(source, /Graph token budget exceeds the parent Responsibility Run budget/);
  assert.match(source, /Graph context budget exceeds the parent Responsibility Run budget/);
  assert.match(source, /Graph cloud budget exceeds the parent Responsibility Run budget/);
  assert.match(source, /cannot silently enable paid cloud usage/);
  assert.match(source, /createGraphNodeChildRun/);
  assert.match(source, /Math\.min\(node\.cloudCostBudgetUsd, parent\.limits\.maxCloudCostUsd\)/);
});

test("the real code sweep fixture has width while the sequential control retains a genuine dependency", async () => {
  const source = await read("lib/responsibility-graph.ts");
  assert.match(source, /Parallel code\/UAT sweep with deterministic reduction/);
  assert.match(source, /workers\.map/);
  assert.match(source, /Deterministically combine verified findings and preserve missing-child evidence/);
  assert.match(source, /Sequential control fixture with a real data dependency/);
});
