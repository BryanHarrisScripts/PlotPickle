import assert from "node:assert/strict";
import test from "node:test";
import { auditAgentDurability, loadAgentDurabilityAudit } from "../scripts/developer-diagnostics/agents/durability-audit.mjs";

test("#2707 source-backed inventory distinguishes profiles, embedded roles and external owners", async () => {
  const audit = await loadAgentDurabilityAudit();
  assert.equal(audit.profiles.length, 20);
  assert.equal(audit.embeddedRoles.length, 16);
  assert.ok(audit.profiles.some((entry) => entry.profileId === "merrin-bellwarden" && entry.executionOwner === "buzz"));
  assert.ok(audit.unnamedEmbeddedRoles.includes("screenwriter"));
  assert.ok(audit.unnamedEmbeddedRoles.includes("discovery-mapper"));
  assert.deepEqual(audit.embeddedRoles.find((entry) => entry.roleId === "story-architect").profileIds, ["elowen-mapweaver"]);
  assert.equal(audit.profiles.find((entry) => entry.profileId === "bram-gatewick").integration, "existing-evidence-and-run-persistence");
  assert.equal(audit.taskRecoveryProven, true);
  assert.deepEqual(audit.applicationRecoveryRoles, ["story-architect"]);
  assert.deepEqual(audit.checkpointTaskProofRoles, ["continuity", "critic", "creative-director"]);
  assert.equal(audit.profiles.find((entry) => entry.profileId === "elowen-mapweaver").taskConnection, "PROVEN-APPLICATION");
  assert.equal(audit.profiles.find((entry) => entry.profileId === "mira-threadmere").taskConnection, "PROVEN-CHECKPOINT");
  assert.equal(audit.profiles.find((entry) => entry.profileId === "critics-circle").taskConnection, "PROVEN-CHECKPOINT");
  assert.equal(audit.profiles.find((entry) => entry.profileId === "quillan-reedcloak").taskConnection, "PROVEN-CHECKPOINT");
  assert.ok(audit.notAdoptedEmbeddedRoles.includes("screenwriter"));
  assert.equal(audit.providerRequestsIssued, false);
  assert.ok(audit.profiles.filter((entry) => entry.executionOwner !== "mastra").every((entry) => entry.taskConnection === "OWNER-PRESERVED"));
  assert.ok(audit.embeddedRoles.every((entry) => ["PROVEN-APPLICATION", "PROVEN-CHECKPOINT", "NOT-ADOPTED"].includes(entry.taskConnection)));
});

test("#2707 unknown owners and inconsistent registrations require review", () => {
  const profile = { id: "a", displayName: "A", execution: { kind: "embedded-mastra", roleId: "story-architect" } };
  assert.throws(() => auditAgentDurability({ profiles: [profile, profile], runtimeRoles: ["story-architect"] }), /unique/);
  assert.throws(() => auditAgentDurability({ profiles: [profile], runtimeRoles: ["continuity"] }), /Unregistered/);
  assert.throws(() => auditAgentDurability({ profiles: [{ ...profile, execution: { kind: "new-owner", roleId: "a" } }], runtimeRoles: ["story-architect"] }), /Unreviewed/);
  assert.throws(() => auditAgentDurability({ profiles: [], runtimeRoles: [] }), /nonempty/);
});

test("#2707 availability never grants recovery or safe replay", () => {
  const audit = auditAgentDurability({
    profiles: [{ id: "visual", defaultAvailability: "ready", execution: { kind: "embedded-mastra", roleId: "visual-director" } }],
    runtimeRoles: ["visual-director"],
  });
  assert.equal(audit.profiles[0].taskConnection, "NOT-ADOPTED");
  assert.equal(audit.profiles[0].replayPolicy, "host-classifies-each-operation");
});
