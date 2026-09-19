import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2175 defines bounded Mini-Block, Block and Sequence projection scopes over canonical story addresses", async () => {
  const source = await read("lib/preproduction/agentic-story-to-screen-projection.ts");

  assert.match(source, /kind: "mini-block"/u);
  assert.match(source, /kind: "block"/u);
  assert.match(source, /kind: "sequence"/u);
  assert.match(source, /ppf-project:\$\{project\.id\}:revision:\$\{project\.revision\}/u);
  assert.match(source, /storyboard-anchor:block:\$\{block\.id\}:mini-\$\{scope\.miniBlockNumber\}/u);
  assert.match(source, /project\.structure\.blocks\.filter\(\(block\) => block\.sequenceNumber === scope\.sequenceNumber\)/u);
});

test("#2175 reuses canonical Responsibility Runs for the five candidate stages", async () => {
  const [source, assistance, runs] = await Promise.all([
    read("lib/preproduction/agentic-story-to-screen-projection.ts"),
    read("lib/preproduction/assistance.ts"),
    read("lib/agents/responsibility/responsibility-runs.ts"),
  ]);

  for (const stage of ["outline", "storyboard", "previs", "scene-workspace", "production-candidate"]) {
    assert.ok(source.includes(`"${stage}"`), `missing stage ${stage}`);
  }
  assert.match(source, /createPreproductionAssistanceRun/u);
  assert.match(source, /attachResponsibilityChild/u);
  assert.match(source, /parentRunId: parentEnvelope\.run\.runId/u);
  assert.match(source, /maxParallelChildren: orderedStages\.length/u);
  assert.match(assistance, /maxParallelChildren: Math\.max\(0, Math\.min\(8/u);
  assert.match(runs, /canonical: false/u);
  assert.match(runs, /verificationMode: "writer-approval"/u);
});

test("#2175 remains proposal-only, zero-spend by default, and leaves provider routing to Story Mode", async () => {
  const source = await read("lib/preproduction/agentic-story-to-screen-projection.ts");

  assert.match(source, /canonicalStoryOwner: "ppf-human"/u);
  assert.match(source, /proposalOwner: "responsibility-runs"/u);
  assert.match(source, /revisionOwner: "creative-transaction-contract"/u);
  assert.match(source, /routingOwner: "story-mode-capability-resolution"/u);
  assert.match(source, /acceptanceOwner: "writer-approval"/u);
  assert.match(source, /cloudSpendAuthorized: false/u);
  assert.match(source, /autoPromoteCandidates: false/u);
  assert.match(source, /stopBetweenStagesAllowed: true/u);
  assert.match(source, /manualWorkflowStillSupported: true/u);
  assert.doesNotMatch(source, /fetch\(|openai|ollama|comfy|saveActiveLibraryProject|reviewState:\s*"accepted"/iu);
});

test("#2175 Write exposes a real Visualize this Block request through the local Responsibility Run host", async () => {
  const [write, gateway] = await Promise.all([
    read("modules/write/ui/block-native-write-workspace.tsx"),
    read("build/responsibility-run-gateway.ts"),
  ]);

  assert.match(write, /Visualize this Block/u);
  assert.match(write, /createAgenticStoryToScreenProjectionRequest/u);
  assert.match(write, /scope: \{ kind: "block", blockNumber: address\.blockNumber \}/u);
  assert.match(write, /responsibilityRunCreatePayload\(request\.parentRun\)/u);
  assert.match(write, /responsibilityRunCreatePayload\(stage\.run\)/u);
  assert.match(write, /action: "attach-child"/u);
  assert.match(write, /Save or discard the current screenplay edit/u);
  assert.match(write, /No provider call, cloud spend, canon promotion, or story rewrite occurred/u);
  assert.match(gateway, /action === "attach-child"/u);
  assert.match(gateway, /child\.parentRunId !== current\.runId/u);
  assert.match(gateway, /attachResponsibilityChild\(current, child\.runId\)/u);
});

test("#2175 keeps the Afterglow acceptance path zero-spend and Human-authorized", async () => {
  const manifest = JSON.parse(await read("config/verification/afterglow-story-to-screen-uat.json"));

  assert.equal(manifest.fixture.blockNumber, 17);
  assert.equal(manifest.fixture.miniBlockNumber, 1);
  assert.equal(manifest.fixture.cloudSpendAllowed, false);
  assert.equal(manifest.humanUat.providerGeneration.ordinaryCi, false);
  assert.equal(manifest.humanUat.providerGeneration.humanAuthorizationRequired, true);
  assert.ok(manifest.ciStages.some((stage) => stage.id === "agentic-projection"));
});
