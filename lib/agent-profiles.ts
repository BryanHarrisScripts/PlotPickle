import profileConfig from "../config/agent-profiles.json";
import communityProfileConfig from "../config/agent-profile-extensions/community.json";
import publicProfileConfig from "../config/agent-profile-extensions/public.json";
import skillConfig from "../config/agent-skills.json";

export const AGENT_PROFILE_CAPABILITY_ROLES = ["fast", "quality", "deep", "vision", "repair"] as const;
export const AGENT_PROFILE_AVAILABILITY = ["ready", "working", "waiting", "needs-attention", "parked", "on-demand"] as const;
export const AGENT_PROFILE_EXECUTION_KINDS = [
  "embedded-mastra",
  "plotpickle-uat",
  "deterministic-observer",
  "deterministic-gate",
  "repository-handoff",
  "buzz-managed",
] as const;
export const AGENT_PROFILE_BUZZ_MODES = ["mirrored", "native", "service"] as const;
export const AGENT_PROFILE_EXECUTION_CONTEXTS = ["private-local", "public-buzz"] as const;
export const HOST_FORBIDDEN_PROFILE_CAPABILITIES = [
  "ppf-direct-write",
  "github-write",
  "developer-shell",
  "credential-read",
  "provider-selection",
] as const;
export const BUZZ_OWNED_AGENT_SETTINGS = [
  "identity",
  "avatar",
  "instructions",
  "team-instructions",
  "core-memory",
  "cold-memory",
  "acp-harness",
  "provider",
  "model",
  "effort",
  "respond-to",
  "allowlist",
  "parallelism",
  "timeouts",
  "start-on-launch",
  "auto-restart",
  "runtime-args",
  "workspace-nest",
] as const;

export type AgentProfileCapabilityRole = (typeof AGENT_PROFILE_CAPABILITY_ROLES)[number];
export type AgentProfileAvailability = (typeof AGENT_PROFILE_AVAILABILITY)[number];
export type AgentProfileExecutionKind = (typeof AGENT_PROFILE_EXECUTION_KINDS)[number];
export type AgentProfileBuzzMode = (typeof AGENT_PROFILE_BUZZ_MODES)[number];
export type AgentProfileExecutionContext = (typeof AGENT_PROFILE_EXECUTION_CONTEXTS)[number];

export type AgentPublicPresentation = {
  readonly avatarRef: string;
  readonly publicBio: string;
  readonly executionContexts: readonly AgentProfileExecutionContext[];
  readonly officialBuzzIdentity: {
    readonly provisioning: "external-buzz-admin";
    readonly pubkey: string | null;
  };
};

type AgentPublicPresentationRegistry = {
  readonly schemaVersion: number;
  readonly profiles: Readonly<Record<string, AgentPublicPresentation>>;
};

export type AgentProfileConfig = {
  readonly id: string;
  readonly displayName: string;
  readonly title: string;
  readonly responsibility: string;
  readonly execution: {
    readonly kind: AgentProfileExecutionKind;
    readonly roleId: string;
  };
  readonly buzzBinding: {
    readonly actorId: string;
    readonly mode: AgentProfileBuzzMode;
  };
  readonly skillUris: readonly string[];
  readonly requestedCapabilityRole: AgentProfileCapabilityRole | null;
  readonly requestedCapabilities: readonly string[];
  readonly readScopes: readonly string[];
  readonly proposalScopes: readonly string[];
  readonly forbiddenCapabilities: readonly string[];
  readonly creativeAuthority: string;
  readonly verificationContract: string;
  readonly homeRoomId: string;
  readonly defaultAvailability: AgentProfileAvailability;
};

export type AgentProfile = AgentProfileConfig & {
  /** Derived compatibility aliases for existing Context Engine/UI consumers. They are not persisted BUZZ settings. */
  readonly runtime: AgentProfileExecutionKind;
  readonly runtimeRoleId: string;
  readonly requestedModelRole: AgentProfileCapabilityRole | null;
  readonly lifecycleState: AgentProfileAvailability;
  readonly buzzPresence: "mirrored" | "native-draft" | "service";
  /** Canonical public presentation only. Official BUZZ private signers are provisioned outside distributed PlotPickle. */
  readonly publicPresentation: AgentPublicPresentation | null;
};

export type AgentProfileRegistry = {
  readonly schemaVersion: number;
  readonly ownership: {
    readonly plotpickleOwns: readonly string[];
    readonly buzzOwnsWhenManaged: readonly string[];
    readonly boundaries: readonly string[];
  };
  readonly hostPolicy: {
    readonly capabilityRoles: readonly AgentProfileCapabilityRole[];
    readonly forbiddenCapabilities: readonly string[];
  };
  readonly profiles: readonly AgentProfileConfig[];
};

const BASE_AGENT_PROFILE_REGISTRY = profileConfig as unknown as AgentProfileRegistry;
const COMMUNITY_AGENT_PROFILES = communityProfileConfig.profiles as unknown as readonly AgentProfileConfig[];
const PUBLIC_AGENT_PRESENTATION_REGISTRY = publicProfileConfig as unknown as AgentPublicPresentationRegistry;

export const AGENT_PROFILE_REGISTRY: AgentProfileRegistry = {
  ...BASE_AGENT_PROFILE_REGISTRY,
  profiles: [...BASE_AGENT_PROFILE_REGISTRY.profiles, ...COMMUNITY_AGENT_PROFILES],
};

function buzzPresence(mode: AgentProfileBuzzMode): AgentProfile["buzzPresence"] {
  if (mode === "native") return "native-draft";
  if (mode === "mirrored") return "mirrored";
  return "service";
}

function materializeProfile(profile: AgentProfileConfig): AgentProfile {
  return {
    ...profile,
    runtime: profile.execution.kind,
    runtimeRoleId: profile.execution.roleId,
    requestedModelRole: profile.requestedCapabilityRole,
    lifecycleState: profile.defaultAvailability,
    buzzPresence: buzzPresence(profile.buzzBinding.mode),
    publicPresentation: PUBLIC_AGENT_PRESENTATION_REGISTRY.profiles[profile.id] ?? null,
  };
}

export const AGENT_PROFILES: readonly AgentProfile[] = AGENT_PROFILE_REGISTRY.profiles.map(materializeProfile);

const CAPABILITY_ROLES = new Set<string>(AGENT_PROFILE_CAPABILITY_ROLES);
const AVAILABILITY = new Set<string>(AGENT_PROFILE_AVAILABILITY);
const EXECUTION_KINDS = new Set<string>(AGENT_PROFILE_EXECUTION_KINDS);
const EXECUTION_CONTEXTS = new Set<string>(AGENT_PROFILE_EXECUTION_CONTEXTS);
const BUZZ_MODES = new Set<string>(AGENT_PROFILE_BUZZ_MODES);
const HOST_FORBIDDEN = new Set<string>(HOST_FORBIDDEN_PROFILE_CAPABILITIES);
const KNOWN_SKILL_URIS = new Set(skillConfig.skills.map((skill) => skill.uri));
const PUBLIC_AVATAR_REF = /^\/assets\/helpers\/lore\/[a-z0-9-]+\.svg$/;
const PUBLIC_AGENT_SECRET_FIELD = /^(?:nsec|privateKey|private_key|secret|signingKey|signing_key|credential|token)$/i;

function nonEmptyStrings(values: readonly string[] | undefined) {
  return Array.isArray(values) && values.every((value) => typeof value === "string" && value.trim().length > 0);
}

function stringList(values: readonly string[] | undefined) {
  return Array.isArray(values) && values.every((value) => typeof value === "string");
}

function publicPresentationHasSecretField(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(publicPresentationHasSecretField);
  return Object.entries(value as Record<string, unknown>).some(([key, child]) => PUBLIC_AGENT_SECRET_FIELD.test(key) || publicPresentationHasSecretField(child));
}

function validatePublicAgentPresentations(errors: string[], profileIds: ReadonlySet<string>) {
  if (PUBLIC_AGENT_PRESENTATION_REGISTRY.schemaVersion !== 1) {
    errors.push(`Unsupported public Agent presentation schema version: ${PUBLIC_AGENT_PRESENTATION_REGISTRY.schemaVersion}.`);
    return;
  }
  for (const [profileId, presentation] of Object.entries(PUBLIC_AGENT_PRESENTATION_REGISTRY.profiles || {})) {
    const prefix = `Public Agent presentation ${profileId}`;
    if (!profileIds.has(profileId)) errors.push(`${prefix} does not match a host-owned Agent Profile.`);
    if (!PUBLIC_AVATAR_REF.test(presentation.avatarRef || "")) errors.push(`${prefix} must use a canonical PlotPickle lore avatar asset.`);
    if (typeof presentation.publicBio !== "string" || !presentation.publicBio.trim() || presentation.publicBio.length > 500) {
      errors.push(`${prefix} requires a public bio of 1-500 characters.`);
    }
    if (!nonEmptyStrings(presentation.executionContexts) || presentation.executionContexts.some((context) => !EXECUTION_CONTEXTS.has(context))) {
      errors.push(`${prefix} has invalid execution contexts.`);
    }
    if (presentation.officialBuzzIdentity?.provisioning !== "external-buzz-admin") {
      errors.push(`${prefix} must keep official BUZZ signer provisioning outside distributed PlotPickle.`);
    }
    const pubkey = presentation.officialBuzzIdentity?.pubkey;
    if (pubkey !== null && !/^[a-f0-9]{64}$/i.test(pubkey || "")) errors.push(`${prefix} has an invalid official BUZZ public key.`);
    if (publicPresentationHasSecretField(presentation)) errors.push(`${prefix} contains forbidden private signing material.`);
  }
}

export function validateAgentProfileRegistry(registry: AgentProfileRegistry = AGENT_PROFILE_REGISTRY) {
  const errors: string[] = [];
  if (registry.schemaVersion !== 2) errors.push(`Unsupported Agent Profile schema version: ${registry.schemaVersion}.`);
  if (!Array.isArray(registry.profiles) || !registry.profiles.length) errors.push("Agent Profile registry must contain profiles.");
  if (!nonEmptyStrings(registry.ownership?.plotpickleOwns)) errors.push("Agent Profile ownership must declare PlotPickle-owned concerns.");
  if (!nonEmptyStrings(registry.ownership?.buzzOwnsWhenManaged)) errors.push("Agent Profile ownership must declare BUZZ-owned concerns.");
  if (!nonEmptyStrings(registry.ownership?.boundaries)) errors.push("Agent Profile ownership boundaries are required.");

  const configuredForbidden = new Set(registry.hostPolicy?.forbiddenCapabilities || []);
  for (const capability of HOST_FORBIDDEN_PROFILE_CAPABILITIES) {
    if (!configuredForbidden.has(capability)) errors.push(`Host policy must forbid ${capability}.`);
  }

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
      roleId: profile.execution?.roleId,
      buzzActorId: profile.buzzBinding?.actorId,
      creativeAuthority: profile.creativeAuthority,
      verificationContract: profile.verificationContract,
      homeRoomId: profile.homeRoomId,
    })) {
      if (typeof value !== "string" || !value.trim()) errors.push(`${prefix} requires ${field}.`);
    }

    if (!EXECUTION_KINDS.has(profile.execution?.kind)) errors.push(`${prefix} has invalid execution kind ${profile.execution?.kind}.`);
    if (!BUZZ_MODES.has(profile.buzzBinding?.mode)) errors.push(`${prefix} has invalid BUZZ binding mode ${profile.buzzBinding?.mode}.`);
    if (profile.requestedCapabilityRole !== null && !CAPABILITY_ROLES.has(profile.requestedCapabilityRole)) {
      errors.push(`${prefix} requests unsupported capability role ${profile.requestedCapabilityRole}.`);
    }
    if (!AVAILABILITY.has(profile.defaultAvailability)) errors.push(`${prefix} has invalid default availability ${profile.defaultAvailability}.`);

    for (const [field, values] of Object.entries({
      skillUris: profile.skillUris,
      requestedCapabilities: profile.requestedCapabilities,
      readScopes: profile.readScopes,
      proposalScopes: profile.proposalScopes,
    })) {
      if (!nonEmptyStrings(values)) errors.push(`${prefix} requires a valid ${field} string list.`);
    }
    if (!stringList(profile.forbiddenCapabilities)) errors.push(`${prefix} requires a valid forbiddenCapabilities string list.`);

    for (const skillUri of profile.skillUris || []) {
      if (!KNOWN_SKILL_URIS.has(skillUri)) errors.push(`${prefix} references unknown Agent Skill ${skillUri}.`);
    }

    const requested = new Set(profile.requestedCapabilities || []);
    for (const capability of HOST_FORBIDDEN) {
      if (requested.has(capability)) errors.push(`${prefix} cannot request host-forbidden capability ${capability}.`);
    }
  }
  validatePublicAgentPresentations(errors, seen);
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

export function officialAgentPublicIdentity(profileId: string) {
  return agentProfileById(profileId)?.publicPresentation?.officialBuzzIdentity ?? null;
}

export function agentExecutionContexts(profileId: string): readonly AgentProfileExecutionContext[] {
  return agentProfileById(profileId)?.publicPresentation?.executionContexts ?? ["private-local"];
}

export function effectiveForbiddenCapabilities(profile: AgentProfileConfig) {
  return [...new Set([...HOST_FORBIDDEN_PROFILE_CAPABILITIES, ...profile.forbiddenCapabilities])];
}

export function resolveAgentProfileCapabilities(input: {
  readonly profileId: string;
  readonly hostGrantedCapabilities: readonly string[];
  readonly skillRequestedCapabilities?: readonly string[];
}) {
  const profile = agentProfileById(input.profileId);
  if (!profile) throw new Error(`Unknown Agent Profile: ${input.profileId}.`);
  const requestedByProfile = new Set(profile.requestedCapabilities);
  const forbidden = new Set(effectiveForbiddenCapabilities(profile));
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
