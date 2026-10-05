import { normalizeAgentCheckpointInput } from "./agent-checkpoint-task.mjs";

const CONTRACTS = Object.freeze({
  "mira-threadmere": Object.freeze({
    profileId: "mira-threadmere",
    roleId: "continuity",
    grantedCapabilities: Object.freeze(["continuity-analysis", "project-context-read", "proposal-draft"]),
    allowedKinds: Object.freeze(["review"]),
    authority: "advisory-noncanonical",
  }),
  "critics-circle": Object.freeze({
    profileId: "critics-circle",
    roleId: "critic",
    grantedCapabilities: Object.freeze(["critique", "project-context-read", "proposal-draft"]),
    allowedKinds: Object.freeze(["review"]),
    authority: "advisory-noncanonical",
  }),
  "quillan-reedcloak": Object.freeze({
    profileId: "quillan-reedcloak",
    roleId: "creative-director",
    grantedCapabilities: Object.freeze(["project-context-read", "proposal-draft", "specialist-coordination"]),
    allowedKinds: Object.freeze(["proposal"]),
    authority: "proposal-noncanonical",
  }),
});

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const sorted = (values) => Object.freeze([...new Set(values || [])].sort());

export function phase3DurableRoleContracts() {
  return Object.freeze(Object.values(CONTRACTS));
}

export function phase3DurableRoleContract(profileId) {
  const contract = CONTRACTS[String(profileId || "")];
  if (!contract) throw new Error("This Agent Profile is not adopted by the Phase 3 durable checkpoint contract.");
  return contract;
}

export function validatePhase3DurableRoleProfile(profile) {
  const contract = phase3DurableRoleContract(profile?.id);
  if (profile?.execution?.kind !== "embedded-mastra") throw new Error("Phase 3 durable roles must remain embedded Mastra profiles.");
  if (profile.execution.roleId !== contract.roleId) throw new Error("Phase 3 durable role/profile registration mismatch.");
  if (!same(sorted(profile.requestedCapabilities), contract.grantedCapabilities)) {
    throw new Error("Phase 3 durable role capability snapshot diverged from the canonical Agent Profile.");
  }
  if (!["proposal-only", "advisory-only"].includes(profile.creativeAuthority)) {
    throw new Error("Phase 3 durable role must remain proposal/advisory-only.");
  }
  return contract;
}

export function buildPhase3RoleCheckpointInput({ scope, steps }) {
  const contract = phase3DurableRoleContract(scope?.agentProfileId);
  if (scope?.roleId !== contract.roleId) throw new Error("Phase 3 durable task role does not match its Agent Profile.");
  if (!same(sorted(scope?.grantedCapabilities), contract.grantedCapabilities)) {
    throw new Error("Phase 3 durable task grants must exactly match the adopted Agent Profile snapshot.");
  }
  if (!Array.isArray(steps) || !steps.length) throw new Error("Phase 3 durable task requires bounded steps.");
  for (const step of steps) {
    if (!contract.allowedKinds.includes(step?.kind)) {
      throw new Error("Phase 3 durable task step class is not replay-safe for this role.");
    }
    if (step?.replayPolicy !== "safe") throw new Error("Phase 3 durable task requires replay-safe review/proposal steps.");
  }
  const normalized = normalizeAgentCheckpointInput({
    scope: { ...scope, grantedCapabilities: contract.grantedCapabilities },
    steps,
  });
  return Object.freeze({
    ...normalized,
    adoption: Object.freeze({
      phase: 3,
      profileId: contract.profileId,
      roleId: contract.roleId,
      authority: contract.authority,
      canonical: false,
      providerRequestsIssued: false,
      modelRequestsIssued: false,
      automaticResume: false,
    }),
  });
}
