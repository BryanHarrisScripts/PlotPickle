import profileConfig from "../config/agent-profiles.json";

export type AgentModelCapability = "fast" | "quality" | "deep" | "vision" | "repair" | "deterministic";

export type AgentProfile = {
  readonly id: string;
  readonly displayName: string;
  readonly title: string;
  readonly roleId: string;
  readonly responsibility: string;
  readonly runtime: string;
  readonly modelCapability: AgentModelCapability;
  readonly memory: string;
  readonly skills: readonly string[];
  readonly profilePicture: string;
  readonly homeRoom: string;
  readonly buzzPresence: string;
  readonly lifecycle: string;
  readonly communityVisible: boolean;
};

function assertNonEmpty(value: unknown, field: string, id: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Agent Profile ${id} requires ${field}.`);
  return value.trim();
}

function normalizeProfile(value: unknown): AgentProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Agent Profile entries must be objects.");
  const item = value as Record<string, unknown>;
  const id = assertNonEmpty(item.id, "id", "unknown");
  const modelCapability = assertNonEmpty(item.modelCapability, "modelCapability", id) as AgentModelCapability;
  if (!["fast", "quality", "deep", "vision", "repair", "deterministic"].includes(modelCapability)) {
    throw new Error(`Agent Profile ${id} uses unsupported model capability ${modelCapability}.`);
  }
  const skills = Array.isArray(item.skills) ? item.skills.map((skill) => assertNonEmpty(skill, "skills", id)) : [];
  for (const skill of skills) {
    if (!skill.startsWith("skill://plotpickle/")) throw new Error(`Agent Profile ${id} has invalid Skill URI ${skill}.`);
  }
  return Object.freeze({
    id,
    displayName: assertNonEmpty(item.displayName, "displayName", id),
    title: assertNonEmpty(item.title, "title", id),
    roleId: assertNonEmpty(item.roleId, "roleId", id),
    responsibility: assertNonEmpty(item.responsibility, "responsibility", id),
    runtime: assertNonEmpty(item.runtime, "runtime", id),
    modelCapability,
    memory: assertNonEmpty(item.memory, "memory", id),
    skills: Object.freeze(skills),
    profilePicture: assertNonEmpty(item.profilePicture, "profilePicture", id),
    homeRoom: assertNonEmpty(item.homeRoom, "homeRoom", id),
    buzzPresence: assertNonEmpty(item.buzzPresence, "buzzPresence", id),
    lifecycle: assertNonEmpty(item.lifecycle, "lifecycle", id),
    communityVisible: item.communityVisible === true,
  });
}

const profiles = profileConfig.profiles.map(normalizeProfile);
const ids = new Set<string>();
for (const profile of profiles) {
  if (ids.has(profile.id)) throw new Error(`Duplicate Agent Profile id ${profile.id}.`);
  ids.add(profile.id);
}

export const AGENT_PROFILES = Object.freeze(profiles);

export function agentProfile(id: string) {
  return AGENT_PROFILES.find((profile) => profile.id === id) ?? null;
}

export function communityAgentProfiles() {
  return AGENT_PROFILES.filter((profile) => profile.communityVisible);
}

export function initialsFromProfilePicture(value: string, displayName: string) {
  if (value.startsWith("initials:")) return value.slice("initials:".length).trim().slice(0, 3).toUpperCase();
  return displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "AI";
}
