import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1571 change-aware planning maps product domains to bounded tester roles", async () => {
  const source = await read("build/autonomous-guest/qa/campaign-planner.ts");
  for (const reason of [
    "changed:installer-runtime",
    "changed:beginner-story-surface",
    "changed:story-authority",
    "changed:visual-production",
    "changed:autonomous-runtime",
    "changed:provider-runtime",
    "changed:identity-community",
  ]) assert.ok(source.includes(reason), `Missing deterministic change selector ${reason}`);
  assert.ok(source.includes("scheduled-deep"));
  assert.ok(source.includes("release-candidate"));
  assert.ok(source.includes("AUTONOMOUS_QA_TESTER_ROLES.map"));
  assert.doesNotMatch(source, /Math\.random|model|prompt|completion|chat/i);
});

test("#1571 campaign tasks reuse the #1569 durable ledger and remain non-canon", async () => {
  const [source, ledger] = await Promise.all([
    read("build/autonomous-guest/qa/campaign-planner.ts"),
    read("build/autonomous-guest/task-ledger.ts"),
  ]);
  assert.ok(source.includes("enqueueAutonomousGuestTask"));
  assert.ok(source.includes("taskKind: `qa:${input.campaign.testerRole}`"));
  assert.ok(source.includes("baseRevision: input.campaign.commitSha"));
  assert.ok(source.includes("affectsCanon: false"));
  assert.ok(source.includes("maxAttempts: 2"));
  assert.ok(source.includes("providerPolicyRef: input.campaign.providerPolicyRef"));
  assert.ok(source.includes("dedupeKey:"));
  assert.ok(ledger.includes("duplicate pending work") || ledger.includes("dedupeKey"));
  assert.doesNotMatch(source, /writeFile|localStorage|indexedDB|applyStoryCommand|saveActiveLibraryProject|browser_navigate/);
});

test("#1571 QA wake policy revalidates exact commit, role, Guest namespace, provider and budget", async () => {
  const source = await read("build/autonomous-guest/qa/campaign-planner.ts");
  assert.ok(source.includes("resolveAutonomousQaTaskPolicy"));
  assert.ok(source.includes("policy.allowedRoles.includes(role)"));
  assert.ok(source.includes("task.autonomousRunId === authority.autonomousRunId"));
  assert.ok(source.includes("task.guestWorkspaceId === authority.workspaceId"));
  assert.ok(source.includes("currentRevision: policy.commitSha.toLowerCase()"));
  assert.ok(source.includes("providerAllowed: policy.providerAllowed === true"));
  assert.ok(source.includes("budgetAllowed: policy.budgetAllowed === true"));
  assert.ok(source.includes("cancelled: policy.cancelled === true"));
});

test("#1571 QA task scheduling cannot invent tester roles or remote execution routes", async () => {
  const source = await read("build/autonomous-guest/qa/campaign-planner.ts");
  assert.ok(source.includes("AUTONOMOUS_QA_TESTER_ROLES"));
  assert.ok(source.includes("qaTaskRole"));
  assert.ok(source.includes("targetRoute: \"/\""));
  assert.doesNotMatch(source, /https?:\/\//i);
  assert.doesNotMatch(source, /authenticated-human|humanProfileId|credential|privateKey|secret/i);
});
