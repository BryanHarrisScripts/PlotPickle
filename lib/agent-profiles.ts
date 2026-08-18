import profileConfig from "../config/agent-profiles.json";
import skillConfig from "../config/agent-skills.json";

export const AGENT_PROFILE_MODEL_ROLES = ["fast", "quality", "deep", "vision", "repair"] as const;
export const AGENT_PROFILE_LIFECYCLE_STATES = ["ready", "working", "waiting", "needs-attention", "parked", "on-demand"] as const;
export const HOST_FORBIDDEN_PROFILE_CAPABILITIES = [
  "ppf-direct-write",
  "github-write",
  "developer-shell",
  "credential-read",
  "provider-selection",
] as const;

export type AgentProfileModelRole = (typeof AGENT_PROFILE_MODEL_ROLES)[number];
export type AgentProfileLifecycleState = (typeof AGENT_PROFILE_LIFECYCLE_STATES)[number];

export type AgentProfile = {
  readonly id: string;
  readonly displayName: string;
  readonly title: string;
  readonly responsibility: string;
  readonly runtime: string;
  readonly runtimeRoleId: string;
  readonly skillUris: readonly string[];
  readonly requestedModelRole: AgentProfileModelRole | null;
  readonly requestedCapabilities: readonly string[];
  readonly readScopes: readonly string[];
  readonly proposalScopes: readonly string[];
  readonly forbiddenCapabilities: readonly string[];
  readonly creativeAuthority: string;
  readonly verificationContract: string;
  readonly homeRoomId: string;
  readonly buzzPresence: string;
  readonly lifecycleState: AgentProfileLifecycleState;
};

export type AgentProfileRegistry = {
  readonly schemaVersion: number;
  readonly authority: {
    readonly profileMeaning: string;
    readonly skillMeaning: string;
    readonly modelSelection: string;
    readonly creativeAuthority: string;
    readonly developerBoundary: string;
  };
  readonly profiles: readonly AgentProfile[];
};

export const AGENT_PROFILE_REGISTRY = profileConfig as unknown as AgentProfileRegistry;
export const AGENT_PROFILES = AGENT_PROFILE_REGISTRY.profiles;

const MODEL_ROLES = new Set<string>(AGENT_PROFILE_MODEL_ROLES);
const LIFECYCLE_STATES = new Set<string>(AGENT_PROFILE_LIFECYCLE_STATES);
const HOST_FORBIDDEN = new Set<string>(HOST_FORBIDDEN_PROFILE_CAPABILITIES);
const KNOWN_SKILL_URIS = new Set(skillConfig.skills.map((skill) => skill.uri));

function nonEmptyStrings(values: readonly string[] | undefined) {
  return Array.isArray(values) && values.every((value) => typeof value === "string" && value.trim().length > 0);
}

export function validateAgentProfileRegistry(registry: AgentProfileRegistry = AGENT_PROFILE_REGISTRY) {
  const errors: string[] = [];
  if (registry.schemaVersion !== 1) errors.push(`Unsupported Agent Profile schema version: ${registry.schemaVersion}.`);
  if (!Array.isArray(registry.profiles) || !registry.profiles.length) errors.push("Agent Profile registry must contain profiles.");

  const seen = new Set<string>();
  for (const profile of registry.profiles || []) {
    const prefix = profile?.id ? `Agent Profile ${profile.id}` : "Agent Profile";
    if (!profile?.id?.trim()) {
      errors.push("Agent Profile id is required.");
      continue;
    }
    if (seen.has(profile.id)) errors.push(`${prefix} is duplicated.`);
    seen.add(profile.id);

    for (const [field, value] of Object.entries({
      displayName: profile.displayName,
      title: profile.title,
      responsibility: profile.responsibility,
      runtime: profile.runtime,
      runtimeRoleId: profile.runtimeRoleId,
      creativeAuthority: profile.creativeAuthority,
      verificationContract: profile.verificationContract,
      homeRoomId: profile.homeRoomId,
      buzzPresence: profile.buzzPresence,
    })) {
      if (typeof value !== "string" || !value.trim()) errors.push(`${prefix} requires ${field}.`);
    }

    if (profile.requestedModelRole !== null && !MODEL_ROLES.has(profile.requestedModelRole)) {
      errors.push(`${prefix} requests unsupported model role ${profile.requestedModelRole}.`);
    }
    if (!LIFECYCLE_STATES.has(profile.lifecycleState)) errors.push(`${prefix} has invalid lifecycle state ${profile.lifecycleState}.`);

    for (const [field, values] of Object.entries({
      skillUris: profile.skillUris,
      requestedCapabilities: profile.requestedCapabilities,
      readScopes: profile.readScopes,
      proposalScopes: profile.proposalScopes,
      forbiddenCapabilities: profile.forbiddenCapabilities,
    })) {
      if (!nonEmptyStrings(values)) errors.push(`${prefix} requires a valid ${field} string list.`);
    }

    for (const skillUri of profile.skillUris || []) {
      if (!KNOWN_SKILL_URIS.has(skillUri)) errors.push(`${prefix} references unknown Agent Skill ${skillUri}.`);
    }

    const requested = new Set(profile.requestedCapabilities || []);
    const forbidden = new Set(profile.forbiddenCapabilities || []);
    for (const capability of HOST_FORBIDDEN) {
      if (!forbidden.has(capability)) errors.push(`${prefix} must explicitly forbid ${capability}.`);
      if (requested.has(capability)) errors.push(`${prefix} cannot request host-forbidden capability ${capability}.`);
    }
  }
  return errors;
}

export function assertAgentProfilesValid(registry: AgentProfileRegistry = AGENT_PROFILE_REGISTRY) {
  const errors = validateAgentProfileRegistry(registry);
  if (errors.length) throw new Error(`Agent Profile registry is invalid:\n- ${errors.join("\n- ")}`);
  return registry;
}

export function agentProfileById(profileId: string) {
  return AGENT_PROFILES.find((profile) => profile.id === profileId) ?? null;
}

export function resolveAgentProfileCapabilities(input: {
  readonly profileId: string;
  readonly hostGrantedCapabilities: readonly string[];
  readonly skillRequestedCapabilities?: readonly string[];
}) {
  const profile = agentProfileById(input.profileId);
  if (!profile) throw new Error(`Unknown Agent Profile: ${input.profileId}.`);
  const requestedByProfile = new Set(profile.requestedCapabilities);
  const forbidden = new Set([...HOST_FORBIDDEN_PROFILE_CAPABILITIES, ...profile.forbiddenCapabilities]);
  const skillRequests = input.skillRequestedCapabilities ? new Set(input.skillRequestedCapabilities) : null;

  return input.hostGrantedCapabilities.filter((capability) => {
    if (!requestedByProfile.has(capability) || forbidden.has(capability)) return false;
    return !skillRequests || skillRequests.has(capability);
  });
}

export function profileCanRequestCapability(profileId: string, capability: string) {
  const profile = agentProfileById(profileId);
  if (!profile) return false;
  if (HOST_FORBIDDEN.has(capability) || profile.forbiddenCapabilities.includes(capability)) return false;
  return profile.requestedCapabilities.includes(capability);
}
