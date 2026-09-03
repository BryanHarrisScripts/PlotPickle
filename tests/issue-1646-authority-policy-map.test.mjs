import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const policy = JSON.parse(await readFile(new URL("../config/harness-lifecycle-authority.json", import.meta.url), "utf8"));

test("#1646 machine-readable authority map points to the single Core decision gate and existing owners", () => {
  assert.equal(policy.schemaVersion, 1);
  assert.equal(policy.owner, "core");
  assert.equal(policy.decisionModule, "core/lifecycle/lifecycle-authority.mjs");
  assert.equal(policy.boundaries.execution, "requires-envelope-capability-ref");
  assert.equal(policy.boundaries.durableKnowledge, "requires-server-owned-harness-policy-approval");
  assert.equal(policy.boundaries.canonicalProjectState, "requires-explicit-human-writer-approval");
  assert.equal(policy.boundaries.authorityChange, "never-actor-self-service");
  assert.equal(policy.existingOwners.guestAuthority, "core/auth/autonomous-guest/guest-authority.ts");
  assert.equal(policy.existingOwners.canonicalWriter, "lib/projects/persistence/project-revisions.ts");
  assert.equal(policy.existingOwners.durableKnowledge, "build/autonomous-guest/maintainer/durable-knowledge-store.mjs");
});
