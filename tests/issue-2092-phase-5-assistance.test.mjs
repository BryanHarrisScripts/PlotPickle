import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const EXPECTED_PROFILES = {
  "craft-guidance": "sage-brinewick",
  "structure-review": "elowen-mapweaver",
  "continuity-review": "mira-threadmere",
  "creative-coordination": "quillan-reedcloak",
  "story-review": "critics-circle",
};

test("#2092 Phase 5 reuses existing Agent Profiles instead of creating production-role agents", async () => {
  const [assistance, registrySource] = await Promise.all([
    read("lib/preproduction/assistance.ts"),
    read("config/agent-profiles.json"),
  ]);
  const registry = JSON.parse(registrySource);
  const existingIds = new Set(registry.profiles.map((profile) => profile.id));

  for (const [role, profileId] of Object.entries(EXPECTED_PROFILES)) {
    assert.ok(assistance.includes(`\"${role}\": \"${profileId}\"`), `${role} should reuse ${profileId}`);
    assert.ok(existingIds.has(profileId), `${profileId} must already exist in the Agent Profile registry`);
  }

  for (const inventedRole of ["story-architect-agent", "structure-director", "continuity-director", "previs-director", "production-coordinator"]) {
    assert.doesNotMatch(assistance, new RegExp(`profileId:\\s*[\"']${inventedRole}[\"']`));
  }
});

test("#2092 Phase 5 uses Responsibility Runs as bounded proposal envelopes with Human approval", async () => {
  const assistance = await read("lib/preproduction/assistance.ts");

  assert.match(assistance, /createResponsibilityRun/);
  assert.match(assistance, /kind: "creative-proposal"/);
  assert.match(assistance, /verificationMode: "writer-approval"/);
  assert.match(assistance, /allowedScopes: \[\]/);
  assert.match(assistance, /allowedConnectorIds: \[\]/);
  assert.match(assistance, /maxCloudCostUsd: 0/);
  assert.match(assistance, /canonicalAuthority: "ppf-human"/);
  assert.match(assistance, /directPpfWrite: false/);
  assert.match(assistance, /providerSelectionOwner: "existing-runtime-capability-resolution"/);
  assert.match(assistance, /transactionOwner: "creative-transaction-contract"/);
});

test("#2092 Phase 5 binds Sequence Director proposals to stable production refs without changing authority", async () => {
  const [assistance, director] = await Promise.all([
    read("lib/preproduction/assistance.ts"),
    read("core/contracts/sequence-director/index.ts"),
  ]);

  assert.match(assistance, /SequenceDirectorDraft/);
  assert.match(assistance, /SequenceDirectorSurface/);
  assert.match(assistance, /draft\.anchorRef/);
  assert.match(assistance, /draft\.beats\.map\(\(beat\) => beat\.id\)/);
  assert.match(assistance, /reference\.assetId/);
  assert.match(assistance, /role: "creative-coordination"/);
  assert.match(assistance, /draftStatus: draft\.status/);
  assert.match(assistance, /sequenceDirectorAuthority: "sequence-director-contract"/);
  assert.match(director, /SequenceDirectorStatus = "proposal" \| "approved"/);
  assert.match(director, /Human-authored Previs timing/);

  assert.doesNotMatch(assistance, /status:\s*"approved"/);
  assert.doesNotMatch(assistance, /saveFoundationProject|localStorage|sessionStorage|registerProjectAssetSource/);
});

test("#2092 Phase 5 does not add provider execution, orchestration graphs or transaction logic", async () => {
  const assistance = await read("lib/preproduction/assistance.ts");

  assert.doesNotMatch(assistance, /fetch\(|openai|ollama|comfy|provider\.generate|Mastra|LangGraph/);
  assert.doesNotMatch(assistance, /CreativeChangeSet|commitCreative|rollback|recovery/);
  assert.doesNotMatch(assistance, /create.*AgentProfile|AGENT_PROFILE_REGISTRY\s*=/);
});
