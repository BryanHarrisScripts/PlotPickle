#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

const ADOPTED_EMBEDDED_ROLES = Object.freeze({
  "story-architect": Object.freeze({ taskConnection: "PROVEN-APPLICATION", replayPolicy: "safe-review-only" }),
  continuity: Object.freeze({ taskConnection: "PROVEN-CHECKPOINT", replayPolicy: "safe-review-only" }),
  critic: Object.freeze({ taskConnection: "PROVEN-CHECKPOINT", replayPolicy: "safe-review-only" }),
  "creative-director": Object.freeze({ taskConnection: "PROVEN-CHECKPOINT", replayPolicy: "safe-proposal-only" }),
});

// This audit reads registration sources only. Availability does not prove task wiring.
export function auditAgentDurability({ profiles, runtimeRoles }) {
  const owners = {
    "embedded-mastra": "mastra",
    "buzz-managed": "buzz",
    "plotpickle-uat": "uat-harness",
    "deterministic-observer": "deterministic-verification",
    "deterministic-gate": "deterministic-verification",
    "repository-handoff": "governed-developer-handoff",
  };
  const seen = new Set();
  const roles = new Set(runtimeRoles);
  if (!roles.size || roles.size !== runtimeRoles.length) throw new Error("Embedded runtime roles must be nonempty and unique.");
  const entries = profiles.map((profile) => {
    if (!profile.id || seen.has(profile.id)) throw new Error("Agent profile IDs must be nonempty and unique.");
    seen.add(profile.id);
    const kind = profile.execution?.kind;
    const owner = owners[kind];
    if (!owner) throw new Error(`Unreviewed execution owner for ${profile.id}: ${kind}`);
    const roleId = profile.execution?.roleId;
    if (!roleId) throw new Error(`Missing role for ${profile.id}.`);
    if (kind === "embedded-mastra" && !roles.has(roleId)) throw new Error(`Unregistered embedded role for ${profile.id}: ${roleId}`);
    const adopted = kind === "embedded-mastra" ? ADOPTED_EMBEDDED_ROLES[roleId] : null;
    return {
      profileId: profile.id,
      displayName: profile.displayName,
      roleId,
      executionOwner: owner,
      taskConnection: kind === "embedded-mastra"
        ? adopted?.taskConnection || "NOT-ADOPTED"
        : "OWNER-PRESERVED",
      integration: kind === "embedded-mastra" ? "shared-checkpoint-bridge"
        : kind === "buzz-managed" ? "external-owner-handoff-only"
        : kind === "repository-handoff" ? "governed-handoff-references"
        : "existing-evidence-and-run-persistence",
      replayPolicy: adopted?.replayPolicy || "host-classifies-each-operation",
    };
  });
  const profiled = new Set(entries.filter((entry) => entry.executionOwner === "mastra").map((entry) => entry.roleId));
  const embeddedRoles = runtimeRoles.map((roleId) => {
    const adopted = ADOPTED_EMBEDDED_ROLES[roleId];
    return {
      roleId,
      profileIds: entries.filter((entry) => entry.executionOwner === "mastra" && entry.roleId === roleId).map((entry) => entry.profileId),
      taskConnection: adopted?.taskConnection || "NOT-ADOPTED",
      replayPolicy: adopted?.replayPolicy || "host-classifies-each-operation",
    };
  });
  return {
    schemaVersion: 2,
    issue: 2707,
    phase: "closeout-support-matrix",
    providerRequestsIssued: false,
    taskRecoveryProven: true,
    applicationRecoveryRoles: ["story-architect"],
    checkpointTaskProofRoles: ["continuity", "critic", "creative-director"],
    profiles: entries,
    embeddedRoles,
    notAdoptedEmbeddedRoles: embeddedRoles.filter((entry) => entry.taskConnection === "NOT-ADOPTED").map((entry) => entry.roleId),
    unnamedEmbeddedRoles: runtimeRoles.filter((roleId) => !profiled.has(roleId)),
  };
}

export async function loadAgentDurabilityAudit(root = DEFAULT_ROOT) {
  const [base, community, source] = await Promise.all([
    readFile(path.join(root, "config/agent-profiles.json"), "utf8").then(JSON.parse),
    readFile(path.join(root, "config/agent-profile-extensions/community.json"), "utf8").then(JSON.parse),
    readFile(path.join(root, "build/mastra-agent-runtime.ts"), "utf8"),
  ]);
  // Read the canonical literal without importing Mastra, providers or startup hooks.
  const literal = source.match(/export const PLOTPICKLE_AGENT_ROLES = \{([\s\S]*?)\n\} as const;/)?.[1];
  if (!literal) throw new Error("Canonical embedded role literal was not found; review the audit reader.");
  const runtimeRoles = [...literal.matchAll(/^\s*(?:"([^"]+)"|([a-zA-Z][\w]*))\s*:/gm)].map((match) => match[1] || match[2]);
  return auditAgentDurability({ profiles: [...base.profiles, ...community.profiles], runtimeRoles });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(await loadAgentDurabilityAudit(), null, 2)}\n`);
}
