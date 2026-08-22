import type { PluginManifest } from "./plugin-platform";

export type CommunityRoomContribution = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly actionHint: string;
};

export type PublicAgentContribution = {
  readonly profileId: string;
  readonly displayName: string;
  readonly title: string;
  readonly avatarRef: string;
  readonly shortBio: string;
  readonly publicBio: string;
  readonly helpPrompt: string;
  readonly helpGroup: string;
  readonly roomIds: readonly string[];
  readonly officialBuzzPubkey: string | null;
};

export type CommunityHelpGroupContribution = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
};

export type BuzzAgentProvisioningContribution = {
  readonly profileId: string;
  readonly displayName: string;
  readonly avatarRef: string;
  readonly publicBio: string;
  readonly roomIds: readonly string[];
  readonly officialBuzzPubkey: string | null;
};

export type CommunityExtensionPlugin = {
  readonly manifest: PluginManifest;
  readonly communityId: string;
  readonly displayName: string;
  readonly rooms: readonly CommunityRoomContribution[];
  readonly helpGroups: readonly CommunityHelpGroupContribution[];
  readonly agents: readonly PublicAgentContribution[];
};

export type CommunityExtensionSnapshot = {
  readonly plugins: readonly CommunityExtensionPlugin[];
  readonly rooms: readonly CommunityRoomContribution[];
  readonly helpGroups: readonly CommunityHelpGroupContribution[];
  readonly agents: readonly PublicAgentContribution[];
};

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertUnique(values: readonly string[], label: string) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Duplicate ${label}: ${value}.`);
    seen.add(value);
  }
}

export function defineCommunityExtensionPlugin(plugin: CommunityExtensionPlugin): CommunityExtensionPlugin {
  if (!plugin.communityId.trim()) throw new Error("Community extension plugin requires a communityId.");
  if (!plugin.displayName.trim()) throw new Error("Community extension plugin requires a displayName.");
  if (!plugin.manifest.capabilities.includes("community")) throw new Error(`Plugin ${plugin.manifest.id} must declare the community capability.`);
  if (!plugin.manifest.capabilities.includes("agent-directory")) throw new Error(`Plugin ${plugin.manifest.id} must declare the agent-directory capability.`);
  if (!plugin.rooms.length) throw new Error(`Plugin ${plugin.manifest.id} must contribute at least one Human-facing room.`);
  if (!plugin.agents.length) throw new Error(`Plugin ${plugin.manifest.id} must contribute at least one public Agent.`);

  assertUnique(plugin.rooms.map((room) => room.id), "Community room id");
  assertUnique(plugin.helpGroups.map((group) => group.id), "Help group id");
  assertUnique(plugin.agents.map((agent) => agent.profileId), "public Agent profile id");

  const roomIds = new Set(plugin.rooms.map((room) => room.id));
  const helpGroups = new Set(plugin.helpGroups.map((group) => group.id));
  for (const room of plugin.rooms) {
    if (!ID_PATTERN.test(room.id)) throw new Error(`Invalid Community room id: ${room.id}.`);
    if (!room.label.trim() || !room.description.trim() || !room.actionHint.trim()) throw new Error(`Community room ${room.id} requires label, description, and actionHint.`);
  }
  for (const agent of plugin.agents) {
    if (!agent.profileId.trim() || !agent.displayName.trim() || !agent.title.trim()) throw new Error("Public Agent contributions require profileId, displayName, and title.");
    if (!agent.avatarRef.trim() || !agent.shortBio.trim() || !agent.publicBio.trim() || !agent.helpPrompt.trim()) throw new Error(`Public Agent ${agent.profileId} has incomplete presentation data.`);
    if (!helpGroups.has(agent.helpGroup)) throw new Error(`Public Agent ${agent.profileId} references unknown Help group ${agent.helpGroup}.`);
    if (!agent.roomIds.length || agent.roomIds.some((roomId) => !roomIds.has(roomId))) throw new Error(`Public Agent ${agent.profileId} references an unknown Community room.`);
    if (agent.officialBuzzPubkey !== null && !/^[a-f0-9]{64}$/i.test(agent.officialBuzzPubkey)) throw new Error(`Public Agent ${agent.profileId} has an invalid official BUZZ pubkey.`);
  }
  return Object.freeze(plugin);
}

export function createCommunityExtensionSnapshot(plugins: readonly CommunityExtensionPlugin[]): CommunityExtensionSnapshot {
  assertUnique(plugins.map((plugin) => plugin.manifest.id), "Community plugin id");
  assertUnique(plugins.map((plugin) => plugin.communityId), "Community id");

  const rooms = plugins.flatMap((plugin) => plugin.rooms);
  const helpGroups = plugins.flatMap((plugin) => plugin.helpGroups);
  const agents = plugins.flatMap((plugin) => plugin.agents);
  assertUnique(rooms.map((room) => room.id), "Community room id");
  assertUnique(agents.map((agent) => agent.profileId), "public Agent profile id");

  return Object.freeze({
    plugins: [...plugins],
    rooms,
    helpGroups,
    agents,
  });
}

export function agentsForCommunityRoom(snapshot: CommunityExtensionSnapshot, roomId: string) {
  return snapshot.agents.filter((agent) => agent.roomIds.includes(roomId));
}

export function publicAgentByProfileId(snapshot: CommunityExtensionSnapshot, profileId: string) {
  return snapshot.agents.find((agent) => agent.profileId === profileId) ?? null;
}

export function buzzAgentProvisioningPlan(snapshot: CommunityExtensionSnapshot): readonly BuzzAgentProvisioningContribution[] {
  return snapshot.agents.map((agent) => ({
    profileId: agent.profileId,
    displayName: agent.displayName,
    avatarRef: agent.avatarRef,
    publicBio: agent.publicBio,
    roomIds: agent.roomIds,
    officialBuzzPubkey: agent.officialBuzzPubkey,
  }));
}
